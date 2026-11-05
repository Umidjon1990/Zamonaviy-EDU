import { cloneElement, isValidElement, lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { faceSetupCode, wf, wfDate, wfMoney, wfTime, statusLabels, refreshWorkforce, getPosition } from '@/lib/workforce';
import { faceConsent, uzWorkDate } from '@shared/workforce';
import { QrCode, MapPin, Clock, Smartphone, ShieldCheck, CalendarDays, Plus, Download, History, Wallet } from 'lucide-react';

const MapPicker = lazy(() => import('@/components/WorkforceMap'));
const Scanner = lazy(() => import('@/components/WorkforceScanner'));
const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm';
const useData = <T = any,>(path: string, enabled = true, interval: number | false = false) => useQuery<T>({ queryKey: ['workforce', path], queryFn: () => wf<T>(path), enabled, refetchInterval: interval });
function useAction() {
  const client = useQueryClient(), { toast } = useToast();
  return useMutation({ mutationFn: ({ path, data, method }: { path: string; data: any; method?: string }) => wf(path, data, method), onSuccess: async () => { await refreshWorkforce(client); toast({ title: 'Saqlandi' }); }, onError: (e: Error) => toast({ title: 'Amal bajarilmadi', description: e.message, variant: 'destructive' }) });
}
function ErrorText({ error }: { error?: Error | null }) { return error ? <p role="alert" className="p-3 rounded-lg border border-destructive/30 text-destructive text-sm">{error.message}</p> : null; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>{isValidElement(children) ? cloneElement(children as React.ReactElement<any>, {"aria-label":label}) : children}</label>; }
function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) { return <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Ma’lumotlarni tekshirib, amalni saqlang.</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>; }

const faceIssues: Record<string, string> = {
  camera: 'Kamera ishlamadi',
  face_mismatch: 'Yuz mos kelmadi',
  liveness: 'Jonli yuz tasdiqlanmadi',
  quality: 'Tasvir sifati yetarli emas',
  template: 'Yuz andozasi topilmadi',
};

export function WorkforceToday({ compact = false, admin = true }: { compact?: boolean; admin?: boolean }) {
  const [date, setDate] = useState(uzWorkDate()), [correction, setCorrection] = useState<any>(null), [note, setNote] = useState(''), [excused, setExcused] = useState(false), [inTime, setInTime] = useState(''), [outTime, setOutTime] = useState('');
  const q = useData('dashboard?date=' + date, true, 20000), lessons = useData('schedule?from=' + date + '&to=' + date, true, 30000), action = useAction();
  const days: any[] = q.data?.days || [];
  const startEdit = (d: any) => { setCorrection(d); setNote(''); setExcused(d.excused); setInTime(d.checkIn ? wfTime(d.checkIn) : ''); setOutTime(d.checkOut ? wfTime(d.checkOut) : ''); };
  const submit = async () => { await action.mutateAsync({ path: 'day-correction', data: { teacherId: correction.teacherId, date, excused, checkIn: inTime ? `${date}T${inTime}:00+05:00` : null, checkOut: outTime ? `${date}T${outTime}:00+05:00` : null, note } }); setCorrection(null); };
  return <Card>
    <CardHeader className="gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" />{admin ? 'Bugungi darslar va o‘qituvchilar' : 'Mening keldi-kettim'}</CardTitle><Input className="w-40" aria-label="Davomat sanasi" type="date" max={uzWorkDate()} value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Kutilgan: {days.filter(d => d.lessonCount > 0).length}</Badge><Badge variant="outline">Kelgan: {days.filter(d => d.checkIn).length}</Badge><Badge variant="outline">Kechikkan: {days.filter(d => d.lateMinutes > d.graceMinutes).length}</Badge><Badge variant="outline">Tekshiruv: {days.filter(d => d.state === 'missing' || d.checkInIssue || d.checkOutIssue || (d.checkIn && !d.checkOut && new Date(d.expectedEnd) < new Date())).length}</Badge>{q.data?.trialMode && <Badge variant="secondary">Sinov rejimi</Badge>}</div>
    </CardHeader>
    <CardContent className="space-y-4"><ErrorText error={q.error} />{q.isLoading && <p>Davomat yuklanmoqda…</p>}
      {!q.isLoading && !days.length && <p className="text-muted-foreground text-sm">Bu sana uchun darslar yo‘q. Jadvalda boshlanish va tugash vaqtlarini tekshiring.</p>}
      <div className="space-y-3">{(compact ? days.slice(0, 8) : days).map(d => <div key={d.id} className="rounded-xl border p-4 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{d.teacherName}</span><Badge variant={d.state === 'missing' ? 'destructive' : 'secondary'}>{d.state === 'missing' && q.data?.attendanceMethod === 'face' ? 'Kelish tasdig‘i yo‘q' : statusLabels[d.state]}</Badge></div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><span>Darslar: {wfTime(d.expectedStart)}–{wfTime(d.expectedEnd)}</span><span>Keldi: <b>{wfTime(d.checkIn)}</b></span><span>Ketdi: <b>{wfTime(d.checkOut)}</b></span>{d.lateMinutes > 0 && <span className="text-amber-700">{d.lateMinutes} daqiqa kechikish</span>}</div>
        <div className="text-xs text-muted-foreground">{(lessons.data?.lessons || []).filter((l: any) => l.teacherId === d.teacherId).map((l: any) => `${l.groupName} · ${wfTime(l.startAt)}–${wfTime(l.endAt)} · ${l.room || 'Xona belgilanmagan'}${l.status === 'cancelled' ? ' (bekor)' : ''}`).join(' | ')}</div>
        {(d.checkInIssue || d.checkOutIssue) && <p className="text-sm text-amber-700">
          {[d.checkInIssue && `Kelish — ${faceIssues[d.checkInIssue]}`, d.checkOutIssue && `Ketish — ${faceIssues[d.checkOutIssue]}`].filter(Boolean).join(' · ')}
        </p>}
        {d.note && <p className="text-xs">Izoh: {d.note}</p>}{admin && !compact && <Button size="sm" variant="outline" onClick={() => startEdit(d)}>Ruxsat / qaydni tuzatish</Button>}
      </div>)}</div>
      {compact && <Link href="/staff-attendance" className="text-sm font-medium text-primary">Barcha davomat va boshqaruv →</Link>}
      <Modal title="Davomatni aniqlashtirish" open={!!correction} onClose={() => setCorrection(null)}><div className="space-y-4"><p>{correction?.teacherName} · {date}</p><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={excused} onChange={e => setExcused(e.target.checked)} />Ruxsatli / uzrli sabab</label><div className="grid grid-cols-2 gap-3"><Field label="Kelgan vaqt"><Input type="time" value={inTime} onChange={e => setInTime(e.target.value)} /></Field><Field label="Ketgan vaqt"><Input type="time" value={outTime} onChange={e => setOutTime(e.target.value)} /></Field></div><Field label="Sabab va dalil"><Textarea value={note} onChange={e => setNote(e.target.value)} /></Field><Button disabled={action.isPending || note.trim().length < 3} onClick={()=>void submit().catch(()=>{})}>Tuzatishni saqlash</Button></div></Modal>
    </CardContent>
  </Card>;
}

function TeacherAttendance() {
  const settings = useData('settings');
  if (settings.error) return <ErrorText error={settings.error} />;
  if (!settings.data) return null;
  if (settings.data.attendanceMethod === 'qr') return <TeacherScan />;
  return <TeacherFace enabled={settings.data.enabled} />;
}

type TeacherFaceStatus = {
  terminalReady: boolean;
  status: 'none' | 'pending' | 'active' | 'blocked';
  expiresAt: string | null;
};

function TeacherFace({ enabled }: { enabled: boolean }) {
  const q = useData<TeacherFaceStatus>('face/self', true, 5000), action = useAction();
  const [consent, setConsent] = useState(false);
  const [scanCode, setScanCode] = useState(faceSetupCode);
  const [withdraw, setWithdraw] = useState(false);
  const profile = q.data;
  useEffect(() => {
    const update = () => { setScanCode(faceSetupCode()); setConsent(false); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const approveScan = async () => {
    await action.mutateAsync({ path: 'face/self/qr', data: { code: scanCode, consent, consentVersion: faceConsent.version } });
    if (faceSetupCode() === scanCode) window.history.replaceState(window.history.state, '', '/teacher-checkin');
    setScanCode(null);
    setConsent(false);
  };
  const withdrawConsent = async () => {
    await action.mutateAsync({ path: 'face/self/withdraw', data: {} });
    setConsent(false);
    setWithdraw(false);
  };

  return <Card className="border-primary/25">
    <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Face ID davomat</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <ErrorText error={q.error} />
      {!profile && !q.error && <p>Face ID holati tekshirilmoqda…</p>}
      {profile && (!profile.terminalReady
        ? <p>Markaz terminali ulangach Face ID ro‘yxatidan o‘tishingiz mumkin.</p>
        : profile.status === 'blocked'
          ? <p>Face ID ro‘yxatingiz bekor qilingan. Qayta ro‘yxatdan o‘tish uchun administratorga murojaat qiling.</p>
          : profile.status === 'active'
            ? <>
              <Badge variant="secondary">Face ID faol</Badge>
              {enabled
                ? <p>Markaz kirishidagi terminalda ismingizni tanlab, <b>Keldim</b> yoki <b>Ketdim</b> tugmasini bosing. Ketishni oxirgi darsingiz tugagach tasdiqlang.</p>
                : <p>Yuzingiz ro‘yxatdan o‘tgan. Administrator davomatni yoqqach terminaldan foydalanishingiz mumkin.</p>}
              <p className="text-muted-foreground">Tasdiqlangan vaqt quyidagi ro‘yxatda ko‘rinadi. Terminal qaydni tasdiqlamasa, administratorga xabar bering.</p>
            </>
            : scanCode
              ? <div className="space-y-3">
                <p>Terminalda yuzingizni ro‘yxatdan o‘tkazishni tasdiqlang.</p>
                <p className="text-muted-foreground">{faceConsent.notice}</p>
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={consent} onChange={e => setConsent(e.target.checked)} />{faceConsent.acceptance}</label>
                <Button disabled={q.isError || action.isPending || !consent} onClick={() => void approveScan().catch(() => {})}>Terminalda davom etish</Button>
              </div>
              : profile.status === 'pending'
                ? <p>Ro‘yxatdan o‘tishni markaz terminalida yakunlang. Qayta boshlash uchun terminalda yangi QR oching.</p>
                : <p>Markaz terminalida <b>Yuzni ro‘yxatga olish</b> tugmasini bosing va ekrandagi QR’ni telefon kamerasi bilan oching.</p>)}
      {(profile?.status === 'active' || profile?.status === 'pending') && <Button variant="ghost" size="sm" onClick={() => setWithdraw(true)}>Rozilikni bekor qilish</Button>}
      <Modal title="Face ID roziligini bekor qilish" open={withdraw} onClose={() => setWithdraw(false)}>
        <p className="text-sm">Face ID orqali davomat to‘xtaydi. Terminal navbatdagi aloqada yuz andozasini o‘chiradi.</p>
        <Button variant="destructive" disabled={action.isPending} onClick={() => void withdrawConsent().catch(() => {})}>Rozilikni bekor qilishni tasdiqlash</Button>
      </Modal>
    </CardContent>
  </Card>;
}

type FaceStatus = {
  terminal: { id: string; label: string; lastSeenAt: string } | null;
  teachers: { id: string; name: string; status: 'none' | 'pending' | 'active' }[];
};
function FaceTerminal() {
  const q = useData<FaceStatus>('face', true, 15000), action = useAction();
  const [label, setLabel] = useState(''), [teacherId, setTeacherId] = useState(''), [consentRef, setConsentRef] = useState('');
  const [issued, setIssued] = useState<{ code: string; expiresAt: string; title: string } | null>(null);
  const [revoke, setRevoke] = useState<{ path: string; data: any; title: string } | null>(null);
  const teacher = q.data?.teachers.find(t => t.id === teacherId);
  const terminal = q.data?.terminal;
  const issue = async (path: string, data: any, title: string) => {
    const result = await action.mutateAsync({ path, data });
    setIssued({ ...result, title });
  };
  const choose = (id: string) => { setTeacherId(id); setConsentRef(''); };
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Face ID terminali</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <ErrorText error={q.error} />
      {!q.data && !q.error && <p>Terminal holati yuklanmoqda…</p>}
      {q.data && (terminal ? <div className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-medium">{terminal.label}</p><p className="text-sm text-muted-foreground">Oxirgi aloqa · {uzWorkDate(new Date(terminal.lastSeenAt))} {wfTime(terminal.lastSeenAt)}</p></div>
        <Button variant="outline" onClick={() => setRevoke({ path: 'face/terminal/revoke', data: { terminalId: terminal.id }, title: 'Terminalni bekor qilish' })}>Terminalni bekor qilish</Button>
      </div> : <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Kirish joyidagi terminal dasturini oching va quyida yaratilgan kodni o‘sha qurilmaga kiriting.</p>
        <Field label="Terminal nomi"><Input value={label} maxLength={100} placeholder="Asosiy kirish" onChange={e => setLabel(e.target.value)} /></Field>
        <Button disabled={action.isPending || label.trim().length < 2} onClick={() => void issue('face/pairing', { label }, 'Terminalni ulash kodi').catch(() => {})}>Ulash kodini yaratish</Button>
      </div>)}
      {terminal && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">O‘qituvchilar Face ID ro‘yxatidan o‘z kabinetlari orqali o‘tishadi. Bu yerdan ro‘yxat holatini boshqarishingiz mumkin.</p>
        <Field label="O‘qituvchini tanlang"><select className={selectClass} value={teacherId} onChange={e => choose(e.target.value)}>
          <option value="">Tanlang</option>
          {q.data?.teachers.map(t => <option key={t.id} value={t.id}>{t.name} · {t.status === 'active' ? 'Faol' : t.status === 'pending' ? 'Kod berilgan' : 'Ro‘yxatdan o‘tmagan'}</option>)}
        </select></Field>
        {teacher && (teacher.status === 'none' ? <>
          <Field label="O‘qituvchining rozilik hujjati raqami"><Input value={consentRef} maxLength={200} onChange={e => setConsentRef(e.target.value)} /></Field>
          <p className="text-sm text-muted-foreground">Admin yordamida ro‘yxatdan o‘tkazish kerak bo‘lsa, rozilikni rasmiylashtiring va o‘qituvchini terminalda tasdiqlang.</p>
          <Button disabled={action.isPending || consentRef.trim().length < 3} onClick={() => void issue('face/enrollment', { teacherId, consentRef }, 'Ro‘yxatdan o‘tkazish kodi').catch(() => {})}>Ro‘yxatdan o‘tkazish kodini yaratish</Button>
        </> : <Button variant="outline" onClick={() => setRevoke({ path: 'face/enrollment/revoke', data: { teacherId }, title: 'Face ID ro‘yxatini bekor qilish' })}>Ro‘yxatni bekor qilish</Button>)}
      </div>}
      <Modal title={issued?.title ?? 'Kod'} open={!!issued} onClose={() => setIssued(null)}>
        <Input readOnly value={issued?.code ?? ''} aria-label="Bir martalik kod" onFocus={e => e.target.select()} />
        <p className="text-sm text-muted-foreground">Kod {issued ? wfTime(issued.expiresAt) : ''} gacha amal qiladi. Uni administrator terminalda ishlatadi.</p>
      </Modal>
      <Modal title={revoke?.title ?? 'Bekor qilish'} open={!!revoke} onClose={() => setRevoke(null)}>
        <p className="text-sm">{revoke?.data.terminalId ? 'Terminal orqali davomat o‘chadi. Yangi terminalda o‘qituvchilar qayta ro‘yxatdan o‘tadi.' : 'O‘qituvchi uchun Face ID tasdig‘i bekor qilinadi. Terminal navbatdagi aloqada andozani o‘chiradi. Qayta ro‘yxatdan o‘tkazishni admin boshlaydi.'}</p>
        <Button variant="destructive" disabled={action.isPending} onClick={() => { if (revoke) void action.mutateAsync(revoke).then(() => setRevoke(null)).catch(() => {}); }}>Bekor qilishni tasdiqlash</Button>
      </Modal>
    </CardContent>
  </Card>;
}

function TeacherScan() {
  const q = useData<any[]>('devices', true, 15000), settings = useData('settings'), [label, setLabel] = useState(''), [scanAction, setScanAction] = useState<'in' | 'out' | null>(null), [busy, setBusy] = useState(false), [result, setResult] = useState('');
  const action = useAction(), client = useQueryClient();
  const current = q.data?.find(d => d.currentDevice && d.status !== 'revoked');
  const read = async (qr: string) => { const kind = scanAction; setScanAction(null); if (!kind) return; setBusy(true); setResult('Joylashuv tekshirilmoqda…'); try { const p = await getPosition(); const r = await wf('scan', { action: kind, qr, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, capturedAt: p.timestamp }); setResult(`${kind === 'in' ? 'Kelishingiz' : 'Ketishingiz'} ${wfTime(r.time)} da ${r.duplicate ? 'avval qayd etilgan' : 'tasdiqlandi'}.`); await refreshWorkforce(client); } catch (e) { setResult((e as Error).message); } finally { setBusy(false); } };
  return <Card className="border-primary/25"><CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="w-5 h-5" />QR davomat</CardTitle></CardHeader><CardContent className="space-y-4">
    <ErrorText error={q.error} /><p className="text-sm text-muted-foreground">Markazdagi QR rasmni skanerlang. Joylashuv 50 metr hududda tekshiriladi.</p>
    {!settings.data?.enabled && <p className="rounded-lg p-3 bg-amber-50 text-amber-900 text-sm">Admin davomatni hali yoqmagan. Qurilmangizni oldindan ulashingiz mumkin.</p>}
    {current ? <p className="text-sm"><Smartphone className="w-4 h-4 inline mr-1" />{current.label} — {statusLabels[current.status]}</p> : <div className="space-y-2"><Label htmlFor="device-label">Qurilma nomi</Label><Input id="device-label" placeholder="Masalan: Umidjon — Samsung A54" value={label} onChange={e => setLabel(e.target.value)} /><Button disabled={action.isPending || label.trim().length < 2} onClick={() => action.mutate({ path: 'devices', data: { label } })}>Qurilmani ulashga so‘rov</Button><p className="text-xs text-muted-foreground">So‘rovni admin tasdiqlaydi. Brauzer ma’lumotlarini o‘chirsangiz, qayta ulash talab qilinadi.</p></div>}
    <div className="grid grid-cols-2 gap-3"><Button size="lg" disabled={busy || current?.status !== 'active' || !settings.data?.enabled} onClick={() => { setResult(''); setScanAction('in'); }}>Keldim — QR</Button><Button size="lg" variant="outline" disabled={busy || current?.status !== 'active' || !settings.data?.enabled} onClick={() => { setResult(''); setScanAction('out'); }}>Ketdim — QR</Button></div>
    {result && <p role="status" className="text-sm rounded-lg bg-muted p-3">{result}</p>}
    <Modal title="QR kodni skanerlang" open={!!scanAction} onClose={() => setScanAction(null)}><Suspense fallback={<p>Kamera tayyorlanmoqda…</p>}><Scanner onRead={read} onClose={() => setScanAction(null)} /></Suspense></Modal>
  </CardContent></Card>;
}

function Devices() {
  const q = useData<any[]>('devices', true, 15000), action = useAction();
  return <Card><CardHeader><CardTitle>O‘qituvchilarning qurilmalari</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Yangi qurilmani tasdiqlash shu o‘qituvchining avvalgi faol qurilmasini bekor qiladi.</p><ErrorText error={q.error} />{q.data?.map(d => <div className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3" key={d.id}><div><p className="font-medium">{d.teacherName}</p><p className="text-sm text-muted-foreground">{d.label} · {statusLabels[d.status]}</p></div><div className="flex gap-2">{d.status === 'pending' && <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: `devices/${d.id}/decision`, data: { action: 'approve' } })}>Tasdiqlash</Button>}{d.status !== 'revoked' && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ path: `devices/${d.id}/decision`, data: { action: 'revoke' } })}>Bekor qilish</Button>}</div></div>)}{q.data?.length === 0 && <p className="text-sm text-muted-foreground">Hali qurilma ulash so‘rovlari yo‘q.</p>}</CardContent></Card>;
}

function FineTypes() {
  const q = useData<any[]>('fine-types'), action = useAction(), [editing, setEditing] = useState<any>(null);
  const save = async () => { await action.mutateAsync({ path: editing.id ? `fine-types/${editing.id}` : 'fine-types', method: editing.id ? 'PATCH' : 'POST', data: { name: editing.name, amount: Number(editing.amount), active: editing.active } }); setEditing(null); };
  return <Card><CardHeader><div className="flex flex-wrap gap-3 items-center justify-between"><CardTitle>Jarima turlari</CardTitle><Button onClick={() => setEditing({ name: '', amount: 100000, active: true })}><Plus className="w-4 h-4 mr-2" />Tur qo‘shish</Button></div></CardHeader><CardContent className="space-y-3"><ErrorText error={q.error} />{q.data?.map(t => <div key={t.id} className="border rounded-lg p-3 flex items-center justify-between gap-3"><div><p className="font-medium">{t.name}</p><p className="text-sm">{wfMoney(t.amount)} · {t.active ? 'Faol' : 'Arxivda'}</p></div><Button variant="outline" onClick={() => setEditing({ ...t })}>Tahrirlash</Button></div>)}<p className="text-xs text-muted-foreground">Summani o‘zgartirish avval yozilgan jarimalarni o‘zgartirmaydi.</p><Modal title="Jarima turi" open={!!editing} onClose={() => setEditing(null)}>{editing && <div className="space-y-4"><Field label="Nomi va aniq mezoni"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field><Field label="Summa (so‘m)"><Input type="number" min="0" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />Faol</label><Button disabled={action.isPending || editing.name.trim().length < 3} onClick={()=>void save().catch(()=>{})}>Saqlash</Button></div>}</Modal></CardContent></Card>;
}

function Fines({ admin }: { admin: boolean }) {
  const [month, setMonth] = useState(uzWorkDate().slice(0, 7)), [creating, setCreating] = useState(false), [decision, setDecision] = useState<any>(null), [explaining, setExplaining] = useState<any>(null), [details, setDetails] = useState<any>(null);
  const q = useData<any[]>('fines?month=' + month, true, 20000), types = useData<any[]>('fine-types'), teachers = useQuery<any[]>({ queryKey: ['workforce', 'teachers'], enabled: admin, queryFn: async () => { const r = await fetch('/api/teachers'); if (!r.ok) throw new Error('O‘qituvchilar olinmadi'); return r.json(); } }), action = useAction();
  const history = useData<any[]>(`history?kind=fine&id=${details?.id || ''}`, !!details);
  const [form, setForm] = useState({ teacherId: '', typeId: '', date: uzWorkDate(), requestKey: crypto.randomUUID(), note: '' });
  const [explanation, setExplanation] = useState(''), [disputed, setDisputed] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ note: '', orderRef: '', acknowledgement: '', explanationRecord: '', averageSalary: '', capPercent: 30, policyRef: '' });
  const openDecision = (fine: any, kind: string) => { setDecision({ fine, kind }); setDecisionForm({ note: '', orderRef: '', acknowledgement: '', explanationRecord: '', averageSalary: '', capPercent: 30, policyRef: '' }); };
  const saveDecision = async () => { const data = decision.kind === 'approve' ? { ...decisionForm, averageSalary: Number(decisionForm.averageSalary), action: decision.kind } : { action: decision.kind, note: decisionForm.note }; await action.mutateAsync({ path: `fines/${decision.fine.id}/decision`, data }); setDecision(null); };
  return <Card><CardHeader><div className="flex flex-wrap justify-between gap-3"><CardTitle>{admin ? 'O‘qituvchilar jarimalari' : 'Jarimalarim'}</CardTitle><div className="flex gap-2"><Input aria-label="Jarimalar oyi" type="month" className="w-40" value={month} onChange={e => setMonth(e.target.value)} />{admin && <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" />Jarima</Button>}</div></div></CardHeader><CardContent className="space-y-4"><ErrorText error={q.error} />
    <div className="flex flex-wrap gap-3 text-sm"><Badge variant="outline">Tasdiqlangan: {wfMoney((q.data || []).filter(f => f.status === 'approved').reduce((n, f) => n + f.amount, 0))}</Badge><Badge variant="outline">Ko‘rib chiqilmoqda: {(q.data || []).filter(f => f.status === 'draft').length}</Badge></div>
    {q.data?.length === 0 && <p className="text-muted-foreground text-sm">Tanlangan oyda jarimalar yo‘q.</p>}
    {q.data?.map(f => <div key={f.id} className="rounded-xl border p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{f.name}</p><p className="text-sm text-muted-foreground">{admin && `${f.teacherName} · `}{wfDate(f.workDate)}</p></div><div className="text-right"><p className="font-semibold">{wfMoney(f.amount)}</p><Badge variant="secondary">{statusLabels[f.status]}</Badge></div></div>
      {f.trialMode && <Badge variant="outline">Sinov — oylikka qo‘llanmaydi</Badge>}{f.disputed && <Badge variant="destructive">E’tiroz bildirilgan</Badge>}
      <p className="text-sm whitespace-pre-wrap">{f.note}</p>{f.explanation && <p className="text-sm rounded-lg bg-muted p-3">O‘qituvchi izohi: {f.explanation}</p>}{f.decisionNote && <p className="text-sm">Qaror: {f.decisionNote}</p>}{f.orderRef && <p className="text-xs text-muted-foreground">Buyruq: {f.orderRef}</p>}{f.deducted > 0 && <p className="text-sm">Ushlangan: {wfMoney(f.deducted)}</p>}
      <div className="flex flex-wrap gap-2">{admin ? <>{(f.status === 'draft' || (f.status === 'approved' && f.disputed)) && <><Button size="sm" disabled={f.trialMode} onClick={() => openDecision(f, 'approve')}>Tasdiqlash</Button>{f.status === 'draft' && <Button size="sm" variant="outline" onClick={() => openDecision(f, 'reject')}>Rad etish</Button>}</>}{['draft', 'approved'].includes(f.status) && <Button size="sm" variant="outline" onClick={() => openDecision(f, 'cancel')}>Bekor qilish</Button>}</> : <Button size="sm" variant="outline" onClick={() => { setExplaining(f); setExplanation(f.explanation || ''); setDisputed(f.disputed); }}>Tushuntirish / e’tiroz</Button>}<Button size="sm" variant="ghost" onClick={() => setDetails(f)}><History className="w-4 h-4 mr-1" />Tarix</Button></div>
    </div>)}
    <Modal title="Jarima qayd etish" open={creating} onClose={() => setCreating(false)}><div className="space-y-4"><Field label="O‘qituvchi"><select className={selectClass} value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}><option value="">Tanlang</option>{teachers.data?.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select></Field><Field label="Jarima turi"><select className={selectClass} value={form.typeId} onChange={e => setForm({ ...form, typeId: e.target.value })}><option value="">Tanlang</option>{types.data?.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name} — {wfMoney(t.amount)}</option>)}</select></Field><Field label="Hodisa sanasi"><Input type="date" max={uzWorkDate()} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field><Field label="Sabab va dalil"><Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field><p className="text-xs text-muted-foreground">Yozuv ko‘rib chiqish uchun yaratiladi. Tushuntirish va rasmiy qarordan keyin oylikka qo‘llanadi.</p><Button disabled={action.isPending || !form.teacherId || !form.typeId || form.note.trim().length < 3} onClick={async () => { try { await action.mutateAsync({ path: 'fines', data: { ...form, typeId: Number(form.typeId) } }); setCreating(false); setForm({ teacherId: '', typeId: '', date: uzWorkDate(), requestKey: crypto.randomUUID(), note: '' }); } catch {} }}>Qayd etish</Button></div></Modal>
    <Modal title="Tushuntirish yoki e’tiroz" open={!!explaining} onClose={() => setExplaining(null)}><div className="space-y-4"><Field label="Izohingiz"><Textarea value={explanation} onChange={e => setExplanation(e.target.value)} /></Field><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={disputed} onChange={e => setDisputed(e.target.checked)} />Jarimaga e’tirozim bor</label><Button disabled={action.isPending || explanation.trim().length < 3} onClick={async () => { try { await action.mutateAsync({ path: `fines/${explaining.id}/explanation`, data: { explanation, disputed } }); setExplaining(null); } catch {} }}>Yuborish</Button></div></Modal>
    <Modal title={decision?.kind === 'approve' ? 'Jarimani rasmiylashtirish' : 'Jarima bo‘yicha qaror'} open={!!decision} onClose={() => setDecision(null)}><div className="space-y-4"><p>{decision?.fine.teacherName} · {wfMoney(decision?.fine.amount)}</p><Field label="Qaror sababi"><Textarea value={decisionForm.note} onChange={e => setDecisionForm({ ...decisionForm, note: e.target.value })} /></Field>{decision?.kind === 'approve' && <><Field label="Buyruq raqami va sanasi"><Input value={decisionForm.orderRef} onChange={e => setDecisionForm({ ...decisionForm, orderRef: e.target.value })} /></Field><Field label="Xodimni buyruq bilan tanishtirish qaydi"><Textarea placeholder="Imzoli hujjat sanasi / raqami yoki dalolatnoma" value={decisionForm.acknowledgement} onChange={e => setDecisionForm({ ...decisionForm, acknowledgement: e.target.value })} /></Field>{!decision.fine.explanation && <Field label="Yozma tushuntirish yoki rad etish dalolatnomasi"><Textarea value={decisionForm.explanationRecord} onChange={e => setDecisionForm({ ...decisionForm, explanationRecord: e.target.value })} /></Field>}<Field label="O‘rtacha oylik ish haqi (so‘m)"><Input type="number" min="1" value={decisionForm.averageSalary} onChange={e => setDecisionForm({ ...decisionForm, averageSalary: e.target.value })} /></Field><Field label="Jarima chegarasi"><select className={selectClass} value={decisionForm.capPercent} onChange={e => setDecisionForm({ ...decisionForm, capPercent: Number(e.target.value) })}><option value={30}>30% — umumiy chegara</option><option value={50}>50% — ichki qoidalardagi asos bilan</option></select></Field>{decisionForm.capPercent === 50 && <Field label="Ichki mehnat qoidalari bandi"><Input value={decisionForm.policyRef} onChange={e => setDecisionForm({ ...decisionForm, policyRef: e.target.value })} /></Field>}<p className="text-xs text-muted-foreground">Bu qaydlar rasmiy hujjatlarga havola uchun. Ilovadagi tugma yuridik imzo o‘rnini bosmaydi.</p></>}<Button disabled={action.isPending || decisionForm.note.trim().length < 3} onClick={()=>void saveDecision().catch(()=>{})}>Qarorni saqlash</Button></div></Modal>
    <Modal title="Jarima tarixi" open={!!details} onClose={() => setDetails(null)}><div className="space-y-3"><ErrorText error={history.error} />{history.data?.map(h => <div key={h.id} className="border rounded-lg p-3 text-sm"><p className="font-medium">{({ created: 'Qayd yaratildi', approve: 'Tasdiqlandi', reject: 'Rad etildi', cancel: 'Bekor qilindi', explanation: 'O‘qituvchi tushuntirish yubordi' } as any)[h.action] || h.action}</p><p className="text-muted-foreground">{new Date(h.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</p>{h.detail.note && <p>{h.detail.note}</p>}{h.detail.explanation && <p>{h.detail.explanation}</p>}</div>)}</div></Modal>
  </CardContent></Card>;
}

function Payroll({ admin }: { admin: boolean }) {
  const [month, setMonth] = useState(uzWorkDate().slice(0, 7)), [teacherId, setTeacherId] = useState(''), [closing, setClosing] = useState(false), [other, setOther] = useState('0');
  const teachers = useQuery<any[]>({ queryKey: ['workforce', 'teachers'], enabled: admin, queryFn: async () => { const r = await fetch('/api/teachers'); if (!r.ok) throw new Error('O‘qituvchilar olinmadi'); return r.json(); } });
  const q = useData(`payroll?month=${month}&teacherId=${encodeURIComponent(teacherId)}`, !admin || !!teacherId, 20000), action = useAction(), p = q.data;
  return <Card><CardHeader><CardTitle className="flex gap-2 items-center"><Wallet className="w-5 h-5" />Oylik va ushlanmalar</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-3"><Input type="month" aria-label="Oylik oyi" className="w-40" value={month} onChange={e => setMonth(e.target.value)} />{admin && <select aria-label="Oylik uchun o‘qituvchi" className={selectClass + ' max-w-xs'} value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">O‘qituvchini tanlang</option>{teachers.data?.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select>}</div><ErrorText error={q.error} />{p && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[['Hisoblangan haq', p.gross], ['To‘langan / avans', p.paid], ['Jarima ushlanmasi', p.fines], ['Qaytariladigan haq', p.credits], ['Boshqa ushlanmalar', p.otherDeductions], ['To‘lash qoldig‘i', p.remaining]].map(([label, value]) => <div key={label} className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="font-bold text-lg mt-1">{wfMoney(Number(value))}</p></div>)}</div><Badge variant={p.closed ? 'default' : 'secondary'}>{p.closed ? 'Oy hisobi yopilgan' : 'Dastlabki hisob'}</Badge>{!p.closed && <p className="text-sm text-muted-foreground">Jarimalar oy hisobi yopilganda bir marta qo‘llanadi. Ungacha bu ko‘rib chiqish uchun hisob.</p>}{p.deferred > 0 && <p className="text-sm text-amber-800 rounded-lg bg-amber-50 p-3">Cheklov sabab hozir qo‘llanmaydigan jarima: {wfMoney(p.deferred)}. Keyingi hisobda alohida ko‘rib chiqiladi.</p>}{p.overpaid > 0 && <p className="text-sm text-amber-800">Hisobdan ortiq to‘langan: {wfMoney(p.overpaid)}</p>}{p.fineItems?.map((f: any) => <p key={f.id} className="text-sm border-b pb-2">{f.name} · {wfDate(f.workDate)} — {wfMoney(f.amount - f.deducted)}</p>)}{admin && !p.closed && <><Button disabled={month>=uzWorkDate().slice(0,7)} onClick={() => setClosing(true)}>Oy hisobini yopish</Button>{month>=uzWorkDate().slice(0,7)&&<p className="text-xs text-muted-foreground">Oy tugagach hisobni yopish mumkin.</p>}</>}</>}
    <Modal title="Oy hisobini yopish" open={closing} onClose={() => setClosing(false)}><div className="space-y-4"><p className="text-sm">{month} uchun hisoblangan haq va qo‘llanadigan jarimalar qayd etiladi. Jarima ikkinchi marta ushlanmaydi. Keyingi bekor qilish qaytarish yozuvini yaratadi.</p><Field label="Shu to‘lovdagi boshqa majburiy ushlanmalar (so‘m)"><Input type="number" min="0" value={other} onChange={e => setOther(e.target.value)} /></Field><Button disabled={action.isPending} onClick={async () => { try { await action.mutateAsync({ path: 'payroll/close', data: { teacherId, month, otherDeductions: Number(other) } }); setClosing(false); } catch {} }}>Hisobni tasdiqlab yopish</Button></div></Modal>
  </CardContent></Card>;
}

function Settings() {
  const q = useData('settings');
  if (q.error) return <ErrorText error={q.error} />; if (!q.data) return <p>Sozlamalar yuklanmoqda…</p>;
  return <SettingsForm key={`${q.data.attendanceMethod}:${q.data.enabled}:${q.data.trialMode}`} initial={q.data} />;
}
function SettingsForm({ initial }: { initial: any }) {
  const [s, setS] = useState({
    attendanceMethod: initial.attendanceMethod as 'face' | 'qr', enabled: initial.enabled, trialMode: initial.trialMode,
    latitude: initial.latitude === null ? null : Number(initial.latitude), longitude: initial.longitude === null ? null : Number(initial.longitude),
    graceMinutes: initial.graceMinutes, earlyMinutes: initial.earlyMinutes,
  }), action = useAction();
  const qrMode = s.attendanceMethod === 'qr';
  const switching = s.attendanceMethod !== initial.attendanceMethod;
  return <div className="grid xl:grid-cols-[1.5fr_1fr] gap-5">
    <Card>
      <CardHeader><CardTitle className="flex gap-2 items-center"><MapPin className="w-5 h-5" />Davomat sozlamalari</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {initial.attendanceMethod === 'qr' && <Field label="Davomat usuli"><select className={selectClass} value={s.attendanceMethod} onChange={e => setS({ ...s, attendanceMethod: e.target.value as 'qr' | 'face', enabled: false, trialMode: true })}>
          <option value="qr">QR (avvalgi usul)</option><option value="face">Face ID</option>
        </select></Field>}
        {qrMode
          ? <Suspense fallback={<p>Xarita yuklanmoqda…</p>}><MapPicker latitude={s.latitude} longitude={s.longitude} onChange={(latitude, longitude) => setS({ ...s, latitude, longitude })} /></Suspense>
          : <p className="text-sm text-muted-foreground">Terminalni markaz kirishiga o‘rnating. «Face ID terminali» bo‘limida qurilmani ulang va o‘qituvchilarni ro‘yxatdan o‘tkazing. Birinchi yoqishda sinov rejimi ishlaydi.</p>}
        {switching && <p className="text-sm text-amber-700">Saqlagandan so‘ng QR yopiladi. Face ID davomatni terminal tayyor bo‘lgach yoqing.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Kechikish imtiyozi (daqiqa)"><Input type="number" min="0" max="60" value={s.graceMinutes} onChange={e => setS({ ...s, graceMinutes: Number(e.target.value) })} /></Field>
          <Field label="Kelish qancha oldin ochiladi (daqiqa)"><Input type="number" min="0" max="120" value={s.earlyMinutes} onChange={e => setS({ ...s, earlyMinutes: Number(e.target.value) })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={switching} checked={s.enabled} onChange={e => setS({ ...s, enabled: e.target.checked })} />Davomatni yoqish</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!qrMode && !initial.enabled} checked={s.trialMode} onChange={e => setS({ ...s, trialMode: e.target.checked })} />Sinov rejimi — jarimalar oylikka qo‘llanmaydi</label>
        <Button disabled={action.isPending || (qrMode && s.enabled && s.latitude === null)} onClick={() => action.mutate({ path: 'settings', method: 'PUT', data: s })}>Sozlamalarni saqlash</Button>
      </CardContent>
    </Card>
    {qrMode && <Card><CardHeader><CardTitle>Chop etiladigan QR kod</CardTitle></CardHeader><CardContent className="space-y-4"><img src="/api/workforce/qr.png" alt="Markaz uchun doimiy davomat QR kodi" className="w-full max-w-xs mx-auto rounded-lg border" /><Button asChild className="w-full"><a href="/api/workforce/qr.png?download=1" download="zamonaviy-crm-qr.png"><Download className="w-4 h-4 mr-2" />QR rasmni yuklab olish</a></Button></CardContent></Card>}
  </div>;
}

export default function Workforce() {
  const [location] = useLocation(), user = useQuery<any>({ queryKey: ['/api/auth/me'] }), isAdmin = user.data?.role === 'markaz_admin';
  const [tab, setTab] = useState(location === '/teacher-fines' ? 'fines' : 'today');
  useEffect(()=>setTab(location === '/teacher-fines' ? 'fines' : 'today'),[location]);
  const settings = useData('settings', isAdmin);
  const qrMode = settings.data?.attendanceMethod === 'qr';
  const tabs = isAdmin ? [['today', 'Davomat'], ['fines', 'Jarimalar'], ['types', 'Jarima turlari'], ['face', 'Face ID terminali'], ...(qrMode ? [['devices', 'QR qurilmalari']] : []), ['payroll', 'Oylik'], ['settings', 'Sozlamalar']] : [['today', 'Keldi-kettim'], ['fines', 'Jarimalarim'], ['payroll', 'Oylik hisobim']];
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">{isAdmin ? 'O‘qituvchilar davomati' : 'Mening davomatim'}</h1><p className="text-muted-foreground mt-1 text-sm">Dars jadvali, kelish-ketish va hisob-kitoblar</p></div><Button variant="outline" asChild><Link href="/schedule"><Clock className="w-4 h-4 mr-2" />Dars jadvali</Link></Button></div><div className="flex flex-wrap gap-2" role="tablist">{tabs.map(([id, label]) => <Button key={id} role="tab" aria-selected={tab === id} variant={tab === id ? 'default' : 'outline'} onClick={() => setTab(id)}>{label}</Button>)}</div>
    {tab === 'today' && <div className="space-y-5">{!isAdmin && <TeacherAttendance />}<WorkforceToday admin={isAdmin} /></div>}{tab === 'fines' && <Fines admin={isAdmin} />}{tab === 'types' && isAdmin && <FineTypes />}{tab === 'devices' && isAdmin && qrMode && <Devices />}{tab === 'face' && isAdmin && <FaceTerminal />}{tab === 'payroll' && <Payroll admin={isAdmin} />}{tab === 'settings' && isAdmin && <Settings />}
  </div>;
}
