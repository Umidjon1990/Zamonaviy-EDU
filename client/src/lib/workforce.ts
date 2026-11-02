import type { QueryClient } from '@tanstack/react-query';
export async function wf<T = any>(path: string, data?: any, method = 'POST'): Promise<T> {
  const res = await fetch('/api/workforce/' + path, { credentials: 'include', method: data === undefined ? 'GET' : method, headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Ma’lumot olinmadi'); return result;
}
export const wfMoney = (n: number) => new Intl.NumberFormat('uz-UZ').format(n || 0) + ' so‘m';
export const wfTime = (v: string | null) => v ? new Date(v).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }) : '—';
export const wfDate = (v: string) => String(v).slice(0, 10);
export const statusLabels: Record<string, string> = { expected: 'Kelishi kutilmoqda', missing: 'Kelishi qayd etilmagan', present: 'Kelishi qayd etilgan', late: 'Kechikkan', left: 'Ketishi tasdiqlangan', excused: 'Ruxsat / dars bekor', draft: 'Ko‘rib chiqilmoqda', approved: 'Tasdiqlangan', rejected: 'Rad etilgan', cancelled: 'Bekor qilingan', pending: 'Admin tasdig‘i kutilmoqda', active: 'Faol', revoked: 'Bekor qilingan' };
export async function refreshWorkforce(client: QueryClient) { await client.invalidateQueries({ predicate: q => ['workforce', '/api/teacher/salary', 'teacher-salary', 'salary', 'groups'].some(k => String(q.queryKey[0]).includes(k)) }); }
export const getPosition = (): Promise<GeolocationPosition> => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('Qurilmada lokatsiya mavjud emas'));
  navigator.geolocation.getCurrentPosition(resolve, e => reject(new Error(e.code === 1 ? 'Lokatsiyaga ruxsat bering va qayta urinib ko‘ring.' : 'GPS joylashuvni aniqlay olmadi. Ochiqroq joyda qayta urinib ko‘ring.')), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
});
