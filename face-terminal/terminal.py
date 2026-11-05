"""Local key storage and the signed CRM terminal protocol."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import keyring
import numpy as np

SERVICE = "Zamonaviy CRM Face Terminal"
SAFE_KEYRINGS = {"keyring.backends.Windows", "keyring.backends.macOS", "keyring.backends.SecretService", "keyring.backends.kwallet"}


class TerminalError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def b64(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def normalize_url(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
        or parsed.path not in ("", "/") or parsed.query or parsed.fragment
    ):
        raise TerminalError("CRM manzilini https:// bilan va sahifa yo‘lisiz kiriting.")
    return f"https://{parsed.netloc}"


def state_path():
    if os.name == "nt":
        return Path(os.environ["LOCALAPPDATA"]) / SERVICE
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / SERVICE
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "zamonaviy-face-terminal"


class LocalStore:
    def __init__(self, directory, backend=None):
        self.directory = directory.resolve()
        self.directory.mkdir(parents=True, mode=0o700, exist_ok=True)
        self.account = hashlib.sha256(str(self.directory).encode()).hexdigest()
        self.backend = backend if backend is not None else keyring.get_keyring()
        if backend is None and type(self.backend).__module__ not in SAFE_KEYRINGS:
            raise TerminalError("Operatsion tizimning himoyalangan kalit ombori topilmadi.")
        self.path = self.directory / "terminal.db"
        with self.db() as db:
            db.execute("CREATE TABLE IF NOT EXISTS binding (id INTEGER PRIMARY KEY CHECK(id=1), crm TEXT NOT NULL, terminal_id TEXT)")
            db.execute("CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, nonce BLOB NOT NULL, ciphertext BLOB NOT NULL)")

    def db(self):
        # Use a per-operation connection. Camera and network work stays outside transactions.
        db = sqlite3.connect(self.path, factory=ClosingConnection)
        db.execute("PRAGMA secure_delete=ON")
        return db

    def binding(self):
        with self.db() as db:
            return db.execute("SELECT crm,terminal_id FROM binding WHERE id=1").fetchone()

    def bind(self, crm, terminal_id):
        with self.db() as db:
            db.execute("INSERT INTO binding VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET terminal_id=excluded.terminal_id", (crm, terminal_id))

    def keys(self, create=False):
        try:
            value = self.backend.get_password(SERVICE, self.account)
            if value is None and create:
                # Write both keys together so retrying a pairing uses the same private key.
                value = Ed25519PrivateKey.generate().private_bytes_raw().hex() + AESGCM.generate_key(256).hex()
                self.backend.set_password(SERVICE, self.account, value)
            if value is not None and len(value) == 128:
                raw = bytes.fromhex(value)
                return Ed25519PrivateKey.from_private_bytes(raw[:32]), AESGCM(raw[32:])
        except Exception:
            raise TerminalError("Terminal kalitlari ochilmadi. Administratorga xabar bering.") from None
        raise TerminalError("Terminal kalitlari topilmadi. Administratorga xabar bering.")

    def save(self, enrollment_id, feature):
        nonce = secrets.token_bytes(12)
        _, cipher = self.keys()
        encrypted = cipher.encrypt(nonce, np.asarray(feature, dtype="<f4").tobytes(), enrollment_id.encode())
        with self.db() as db:
            db.execute("INSERT OR REPLACE INTO templates VALUES(?,?,?)", (enrollment_id, nonce, encrypted))

    def load(self, enrollment_id):
        with self.db() as db:
            row = db.execute("SELECT nonce,ciphertext FROM templates WHERE id=?", (enrollment_id,)).fetchone()
        if not row:
            return None
        try:
            _, cipher = self.keys()
            vector = np.frombuffer(cipher.decrypt(*row, enrollment_id.encode()), dtype="<f4")
            if vector.size == 128 and np.isfinite(vector).all() and np.isclose(np.linalg.norm(vector), 1, atol=0.01):
                return vector
        except (InvalidTag, ValueError):
            pass
        return None

    def prune(self, enrollment_ids):
        with self.db() as db:
            stored = {row[0] for row in db.execute("SELECT id FROM templates")}
            db.executemany("DELETE FROM templates WHERE id=?", [(identifier,) for identifier in stored - enrollment_ids])

    def erase(self):
        with self.db() as db:
            db.execute("DELETE FROM templates")
            db.execute("DELETE FROM binding")
        try:
            if self.backend.get_password(SERVICE, self.account) is not None:
                self.backend.delete_password(SERVICE, self.account)
        except Exception:
            raise TerminalError("Mahalliy andozalar o‘chirildi, kalit omborini administrator tekshirishi kerak.") from None


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def envelope(operation, terminal_id, private_key, data, *, timestamp=None, request_id=None):
    timestamp = time.time_ns() // 1_000_000 if timestamp is None else timestamp
    request_id = str(uuid4()) if request_id is None else request_id
    payload = b64(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode())
    message = "\n".join(("workforce-face-v1", operation, terminal_id, str(timestamp), request_id, payload))
    return {
        "terminalId": terminal_id,
        "requestId": request_id,
        "timestamp": timestamp,
        "payload": payload,
        "signature": b64(private_key.sign(message.encode())),
    }


class Terminal:
    def __init__(self, store, crm):
        self.store = store
        self.crm = normalize_url(crm)
        self.http = build_opener(NoRedirect())
        binding = store.binding()
        if binding and binding[0] != self.crm:
            raise TerminalError("Terminal boshqa CRM manziliga ulangan. Administrator mahalliy ulanishni tozalashi kerak.")
        self.terminal_id = binding[1] if binding else None

    def post(self, operation, data):
        request = Request(
            f"{self.crm}/api/workforce-terminal/{operation}",
            data=json.dumps(data).encode(),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        for attempt in range(2):
            try:
                with self.http.open(request, timeout=6) as response:
                    result = json.loads(response.read(1_000_001))
                if not isinstance(result, dict):
                    raise ValueError()
                return result
            except HTTPError as error:
                if error.code >= 500 and attempt == 0:
                    continue
                with error:
                    try:
                        message = json.loads(error.read(8192)).get("error")
                    except (AttributeError, ValueError):
                        message = None
                raise TerminalError(message or "CRM so‘rovi bajarilmadi. Administratorga xabar bering.", error.code) from None
            except (OSError, URLError, ValueError):
                if attempt:
                    raise TerminalError("CRM bilan aloqa yo‘q. Qayta urinib ko‘ring yoki administratorga xabar bering.") from None

    def pair(self, code):
        private, _ = self.store.keys(create=True)
        self.store.bind(self.crm, None)
        result = self.post("pair", {"code": code, "publicKey": private.public_key().public_bytes_raw().hex()})
        self.terminal_id = result["terminalId"]
        self.store.bind(self.crm, self.terminal_id)

    def signed(self, operation, data):
        if not self.terminal_id:
            raise TerminalError("Avval terminalni ulang.")
        private, _ = self.store.keys()
        try:
            return self.post(operation, envelope(operation, self.terminal_id, private, data))
        except TerminalError as error:
            if error.status == 410:
                self.terminal_id = None
                self.store.erase()
            raise

    def roster(self):
        result = self.signed("roster", {})
        self.store.prune({row["enrollmentId"] for row in result["enrollments"]})
        return result
