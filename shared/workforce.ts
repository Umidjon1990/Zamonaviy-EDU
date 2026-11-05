import { z } from 'zod';

export const dayNames = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const aliases: Record<string, number> = { Du: 1, Se: 2, Chor: 3, Pay: 4, Ju: 5, Juma: 5, Sha: 6, Yak: 7 };
export const weekdayNumber = (s: string) => aliases[s] || dayNames.indexOf(s) + 1;
export const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, 'Sana noto‘g‘ri');
export const monthInput = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const moneyInput = z.coerce.number().int().min(0).max(1_000_000_000);
export const slotInput = z.object({ weekday: z.number().int().min(1).max(7), start: z.number().int().min(0).max(1439), end: z.number().int().min(1).max(1440) }).strict().refine(s => s.end > s.start, 'Tugash vaqti boshlanishdan keyin bo‘lsin');
export const scheduleInput = z.object({ groupId: z.number().int().positive(), teacherId: z.string().min(1).max(200), room: z.string().trim().max(200), effectiveFrom: dateInput, slots: z.array(slotInput).min(1).max(35) }).strict();
export const settingsInput = z.object({ attendanceMethod: z.enum(['qr', 'face']).optional(), enabled: z.boolean(), trialMode: z.boolean(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), graceMinutes: z.number().int().min(0).max(60), earlyMinutes: z.number().int().min(0).max(120) }).strict();
export const scanInput = z.object({ action: z.enum(['in', 'out']), qr: z.string().min(20).max(500), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().positive().max(10000), capturedAt: z.number().int().positive() }).strict();
export type Slot = z.infer<typeof slotInput>;

export function strictLegacySlots(days: string[], time: string): Slot[] {
  const m = time?.trim().match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return [];
  const start = Number(m[1]) * 60 + Number(m[2]), end = Number(m[3]) * 60 + Number(m[4]);
  if (+m[1] > 23 || +m[2] > 59 || +m[3] > 23 || +m[4] > 59 || end <= start) return [];
  return [...new Set(days.map(weekdayNumber))].filter(n => n > 0).map(weekday => ({ weekday, start, end }));
}
export function uzWorkDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function atMinute(date: string, minute: number) { return new Date(Date.parse(date + 'T00:00:00+05:00') + minute * 60000); }
export function dateWeekday(date: string) { return new Date(date + 'T12:00:00+05:00').getUTCDay() || 7; }
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
export function locationProblem(v: z.infer<typeof scanInput>, settings: { latitude: number; longitude: number }, now: Date): string | null {
  if (now.getTime() - v.capturedAt > 30000 || v.capturedAt - now.getTime() > 10000) return 'Lokatsiya eskirgan. Qayta o‘lchang.';
  if (v.accuracy > 50) return 'GPS aniqligi yetarli emas. Ochiqroq joyda qayta o‘lchang.';
  const d = distanceMeters(settings.latitude, settings.longitude, v.latitude, v.longitude);
  if (d > 50) return `Markazdan ${Math.round(d)} metr uzoqdasiz. Ruxsat etilgan hudud — 50 metr.`;
  return null;
}
export function payrollAmounts(gross: number, paid: number, outstanding: number, credits = 0, otherDeductions = 0) {
  const capacity = Math.max(0, Math.min(Math.floor(gross * .5) - otherDeductions, gross + credits - paid - otherDeductions));
  const fines = Math.min(outstanding, capacity);
  return { gross, paid, credits, otherDeductions, fines, fineTotal: outstanding, deferred: outstanding - fines, net: gross + credits - fines - otherDeductions, remaining: Math.max(0, gross + credits - paid - fines - otherDeductions), overpaid: Math.max(0, paid - (gross + credits - fines - otherDeductions)) };
}
export const minutesText = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
