"""Entrance terminal. Run on a dedicated computer with a camera."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import sys
import tkinter as tk
from tkinter import messagebox, simpledialog, ttk

import cv2

from terminal import LocalStore, Terminal, TerminalError, state_path
from vision import CaptureError, FaceCamera

TASHKENT = timezone(timedelta(hours=5))


class Kiosk:
    def __init__(self, root, terminal, camera_index):
        self.root = root
        self.terminal = terminal
        self.camera_index = camera_index
        self.camera = None
        self.pool = ThreadPoolExecutor(max_workers=1)
        self.busy = False
        self.preview = None
        self.preview_frame = None
        self.rows = []
        self.enabled = False
        self.reset_timer = None

        root.title("Zamonaviy CRM · Face ID davomat")
        root.geometry("680x680")
        root.minsize(580, 510)
        root.option_add("*Font", ("Arial", 13))
        body = ttk.Frame(root, padding=24)
        body.pack(fill="both", expand=True)
        ttk.Label(body, text="O‘qituvchilar davomati", font=("Arial", 23, "bold")).pack(anchor="w")
        ttk.Label(body, text="Ismingizni va davomat amalini tanlang.").pack(anchor="w", pady=(4, 16))
        self.teachers = ttk.Combobox(body, state="readonly", font=("Arial", 16))
        self.teachers.pack(fill="x")
        self.teachers.bind("<<ComboboxSelected>>", lambda _: self.controls())

        buttons = ttk.Frame(body)
        buttons.pack(fill="x", pady=12)
        self.arrive = ttk.Button(buttons, text="Keldim", command=lambda: self.attend("in"))
        self.leave = ttk.Button(buttons, text="Ketdim", command=lambda: self.attend("out"))
        for button in (self.arrive, self.leave):
            button.pack(side="left", fill="x", expand=True, ipady=12, padx=4)
        self.message = ttk.Label(body, wraplength=540, font=("Arial", 15, "bold"))
        self.message.pack(anchor="w", pady=8)
        self.image = ttk.Label(body)
        self.image.pack(pady=4)
        tools = ttk.Frame(body)
        tools.pack(side="bottom", fill="x")
        self.setup = ttk.Button(tools, command=self.setup_or_enroll)
        self.setup.pack(side="left")
        self.reload = ttk.Button(tools, text="Yangilash", command=self.refresh)
        self.reload.pack(side="right")
        self.controls()
        root.after(100, self.refresh)
        root.after(30000, self.poll)
        root.protocol("WM_DELETE_WINDOW", self.close)

    def controls(self):
        paired = bool(self.terminal.terminal_id)
        selected = self.teachers.current() >= 0
        for button in (self.arrive, self.leave):
            button.configure(state="normal" if paired and not self.busy and self.enabled and selected else "disabled")
        self.teachers.configure(state="readonly" if paired and not self.busy and self.enabled else "disabled")
        self.setup.configure(text="Yuzni ro‘yxatga olish" if paired else "Terminalni ulash", state="disabled" if self.busy else "normal")
        self.reload.configure(state="normal" if paired and not self.busy else "disabled")

    def text(self, value):
        self.message.configure(text=value)

    def reset(self):
        self.reset_timer = None
        if not self.busy:
            self.teachers.set("")
            self.text(self.idle_message())
            self.controls()

    def idle_message(self):
        if not self.terminal.terminal_id:
            return "Administrator terminalni ulashi kerak."
        if not self.enabled:
            return "Face ID davomatni administrator yoqadi."
        return "Ismingizni tanlang."

    def render(self):
        if self.preview_frame is None:
            return
        frame, prompt = self.preview_frame
        self.preview_frame = None
        self.text(prompt)
        rgb = cv2.cvtColor(cv2.flip(cv2.resize(frame, (288, 216)), 1), cv2.COLOR_BGR2RGB)
        self.preview = tk.PhotoImage(data=b"P6\n288 216\n255\n" + rgb.tobytes(), format="PPM")
        self.image.configure(image=self.preview)

    def submit(self, job, on_success, on_error=None, *, quiet=False):
        self.busy = True
        if not quiet and self.reset_timer:
            self.root.after_cancel(self.reset_timer)
            self.reset_timer = None
        self.controls()
        future = self.pool.submit(job)

        def finish():
            self.render()
            if not future.done():
                self.root.after(60, finish)
                return
            self.image.configure(image="")
            self.preview = None
            self.preview_frame = None
            self.busy = False
            self.controls()
            try:
                result = future.result()
            except (TerminalError, CaptureError) as error:
                self.text(str(error))
                if not self.terminal.terminal_id:
                    self.clear_roster()
                if on_error:
                    on_error()
                if not quiet:
                    self.reset_timer = self.root.after(5000, self.reset)
            except Exception:
                self.text("Terminalda xatolik. Administratorga xabar bering.")
                if on_error:
                    on_error()
            else:
                on_success(result)

        self.root.after(60, finish)

    def clear_roster(self):
        self.rows = []
        self.enabled = False
        self.teachers.configure(values=[])
        self.teachers.set("")
        self.controls()

    def refresh(self, *, quiet=False):
        if self.busy:
            return
        if not self.terminal.terminal_id:
            self.text(self.idle_message())
            return

        def apply(result):
            current = self.teachers.current()
            previous_id = self.rows[current]["enrollmentId"] if current >= 0 else None
            self.rows = [row for row in result["enrollments"] if row["active"]]
            self.enabled = result["enabled"]
            self.teachers.configure(values=[f"{i}. {row['name']}" for i, row in enumerate(self.rows, 1)])
            next_index = next((i for i, row in enumerate(self.rows) if row["enrollmentId"] == previous_id), -1)
            if next_index >= 0 and self.enabled:
                self.teachers.current(next_index)
            else:
                self.teachers.set("")
            self.controls()
            if not quiet or not self.enabled:
                self.text(self.idle_message())

        if not quiet:
            self.text("Terminal holati tekshirilmoqda…")
        self.submit(self.terminal.roster, apply, self.clear_roster, quiet=quiet)

    def poll(self):
        self.refresh(quiet=self.enabled)
        self.root.after(30000, self.poll)

    def camera_capture(self, expected=None):
        if self.camera is None:
            try:
                self.camera = FaceCamera(self.camera_index)
            except (RuntimeError, OSError, cv2.error) as error:
                raise CaptureError("camera", "Yuz modellari ishlamadi. Administrator o‘rnatishni tekshirsin.") from error
        return self.camera.capture(self.update_preview, expected)

    def update_preview(self, frame, prompt):
        self.preview_frame = (frame, prompt)

    def attend(self, action):
        index = self.teachers.current()
        if index < 0 or self.busy or not self.enabled:
            return
        row = self.rows[index]
        payload = {"teacherId": row["teacherId"], "enrollmentId": row["enrollmentId"], "action": action}

        def work():
            try:
                vector = self.terminal.store.load(row["enrollmentId"])
                if vector is None:
                    raise CaptureError("template", "Mahalliy andoza topilmadi. Administratorga xabar bering.")
                self.camera_capture(vector)
            except CaptureError as error:
                self.terminal.signed("issue", {**payload, "reason": error.reason})
                raise
            return self.terminal.signed("attendance", payload)

        def done(result):
            when = datetime.fromisoformat(result["time"]).astimezone(TASHKENT).strftime("%H:%M")
            action_text = "Kelish" if action == "in" else "Ketish"
            self.text(f"{action_text} {when} da {'avval qayd etilgan' if result.get('duplicate') else 'tasdiqlandi'}.")
            self.reset_timer = self.root.after(5000, self.reset)

        self.text("Kamera ochilmoqda…")
        self.submit(work, done)

    def setup_or_enroll(self):
        if self.busy:
            return
        if not self.terminal.terminal_id:
            code = simpledialog.askstring("Terminalni ulash", "Admin panelidagi ulash kodini kiriting.", parent=self.root, show="•")
            if code:
                self.text("Terminal ulanmoqda…")
                self.submit(lambda: self.terminal.pair(code.strip()), lambda _: self.refresh())
            return

        code = simpledialog.askstring("Yuzni ro‘yxatga olish", "Kabinetdagi bir martalik ro‘yxatdan o‘tish kodini kiriting.", parent=self.root, show="•")
        if not code:
            return
        code = code.strip()

        def capture(row):
            if row.get("selfEnrollment"):
                title = "Yuzni ro‘yxatga olish"
                prompt = f"{row['name']}, bu sizning hisobingizmi? Yuzingizni ro‘yxatga olishni boshlaysizmi?"
            else:
                title = "Rozilik va shaxsni tekshirish"
                prompt = f"{row['name']} kameraning oldidami va rozilik hujjati tekshirildimi?"
            if not messagebox.askyesno(title, prompt, parent=self.root):
                self.text(self.idle_message())
                return

            def work():
                template = self.camera_capture()
                self.terminal.store.save(row["enrollmentId"], template)
                # A lost confirmation response can be retried safely. Roster also preserves valid pending IDs.
                return self.terminal.signed("enrollment-confirm", {"code": code, "enrollmentId": row["enrollmentId"]})

            self.text("Ro‘yxatdan o‘tish uchun kameraga qarang…")
            self.submit(work, lambda _: self.enrolled())

        self.submit(lambda: self.terminal.signed("enrollment-lookup", {"code": code}), capture)

    def enrolled(self):
        self.text("O‘qituvchi Face ID ro‘yxatiga qo‘shildi.")
        self.root.after(1800, self.refresh)

    def close(self):
        if self.busy:
            return
        self.pool.shutdown(wait=False)
        self.root.destroy()


def main():
    parser = argparse.ArgumentParser(description="Zamonaviy CRM kirish terminali")
    parser.add_argument("--crm", help="CRM’ning HTTPS manzili")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--erase-local", action="store_true", help="Mahalliy andozalar va terminal kalitlarini o‘chirish")
    args = parser.parse_args()
    try:
        store = LocalStore(state_path())
        if args.erase_local:
            if input("Avval CRM’da terminalni bekor qiling. Mahalliy andozalarni o‘chirish uchun OCHIR yozing: ") == "OCHIR":
                store.erase()
                print("Mahalliy terminal ma’lumotlari o‘chirildi.")
            return
        binding = store.binding()
        crm = args.crm or (binding[0] if binding else None)
        if not crm:
            parser.error("--crm https://markazingiz-manzili parametrini kiriting.")
        terminal = Terminal(store, crm)
        root = tk.Tk()
        Kiosk(root, terminal, args.camera)
        root.mainloop()
    except TerminalError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
