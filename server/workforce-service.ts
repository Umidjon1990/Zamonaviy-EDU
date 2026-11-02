import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { FinanceError } from './payment-service';
import { monthBounds } from '../shared/domain';
import { atMinute, dateInput, dateWeekday, locationProblem, monthInput, payrollAmounts, scanInput, scheduleInput, settingsInput, strictLegacySlots, uzWorkDate, type Slot } from '../shared/workforce';

export type WorkforceActor = { tenantId: number; userId: string; role: string };
const fail = (message: string, status = 400): never => { throw new FinanceError(message, status); };
const admin = (a: WorkforceActor) => { if (a.role !== 'markaz_admin') fail('Faqat administrator uchun', 403); };
const teacher = (a: WorkforceActor) => { if (a.role !== 'teacher') fail('Faqat o‘qituvchi uchun', 403); };
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const dateText = (v: any) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
export function camel(row: any): any { if (!row) return row; return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])); }
const same = (a: string, b: string) => { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); };

export function createWorkforceService(pool: any, clock = () => new Date()) {
  async function tx<T>(a: WorkforceActor, fn: (c: any) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try { await c.query('BEGIN'); c.workforceAssignmentsApplied=false; await c.query('SELECT pg_advisory_xact_lock(830,$1)', [a.tenantId]); const value = await fn(c); await c.query('COMMIT'); return value; }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async function log(c: any, a: WorkforceActor, kind: string, id: any, action: string, detail: any = {}, teacherId?: string) {
    await c.query('INSERT INTO workforce_events(tenant_id,teacher_id,entity_type,entity_id,action,actor_id,detail) VALUES($1,$2,$3,$4,$5,$6,$7)', [a.tenantId, teacherId || null, kind, String(id), action, a.userId, JSON.stringify(detail)]);
  }
  async function validTeacher(c: any, a: WorkforceActor, id: string, includeArchived = false) {
    const u = (await c.query("SELECT id FROM users WHERE tenant_id=$1 AND id=$2 AND role='teacher' AND ($3::boolean OR archived_at IS NULL)", [a.tenantId, id, includeArchived])).rows[0];
    if (!u) fail('O‘qituvchi topilmadi', 404);
  }
  async function setup(c: any, a: WorkforceActor) {
    await c.query('INSERT INTO workforce_settings(tenant_id,qr_secret) VALUES($1,$2) ON CONFLICT DO NOTHING', [a.tenantId, randomBytes(32).toString('hex')]);
    const defaults = [['absence', 'Umuman kelmaslik', 200000], ['late', 'Kech kelish', 100000], ['room', 'Xona toza emas', 100000], ['hall', 'Dars zalda yurish', 100000], ['order', 'O‘qituvchilari tartibsiz', 100000]];
    for (const [code, name, amount] of defaults) await c.query('INSERT INTO workforce_fine_types(tenant_id,code,name,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [a.tenantId, code, name, amount]);
    return (await c.query('SELECT * FROM workforce_settings WHERE tenant_id=$1', [a.tenantId])).rows[0];
  }
  async function applyAssignments(c:any,a:WorkforceActor){
    if(c.workforceAssignmentsApplied)return;c.workforceAssignmentsApplied=true;
    const rows=(await c.query(`SELECT DISTINCT ON(v.group_id) v.*,g.teacher_id AS old_teacher FROM workforce_schedule_versions v JOIN groups g ON g.id=v.group_id AND g.tenant_id=v.tenant_id
      WHERE v.tenant_id=$1 AND v.effective_from<=$2 AND g.archived_at IS NULL ORDER BY v.group_id,v.effective_from DESC,v.id DESC`,[a.tenantId,uzWorkDate(clock())])).rows;
    for(const v of rows)if(v.teacher_id!==v.old_teacher){
      await validTeacher(c,a,v.teacher_id);
      await c.query('UPDATE groups SET teacher_id=$3 WHERE tenant_id=$1 AND id=$2',[a.tenantId,v.group_id,v.teacher_id]);
      await log(c,a,'schedule',v.id,'assignment_applied',{groupId:v.group_id,from:v.old_teacher,to:v.teacher_id,scheduledBy:v.created_by},v.teacher_id);
    }
  }
  async function configs(c: any, a: WorkforceActor, date: string) {
    await applyAssignments(c,a);
    const groups = (await c.query(`SELECT g.id,g.name,g.teacher_id,g.days,g.time,g.room FROM groups g WHERE g.tenant_id=$1 AND (g.archived_at IS NULL OR (g.archived_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date>=$2::date) AND (g.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date<=$2::date ORDER BY g.name`, [a.tenantId, date])).rows;
    const versions=(await c.query('SELECT DISTINCT ON(group_id) * FROM workforce_schedule_versions WHERE tenant_id=$1 AND effective_from<=$2 ORDER BY group_id,effective_from DESC,id DESC',[a.tenantId,date])).rows;
    const byGroup=new Map(versions.map((v:any)=>[v.group_id,v]));
    const result: any[] = [];
    for (const g of groups) {
      let version:any=byGroup.get(g.id);
      if (!version) {
        const slots = strictLegacySlots(g.days || [], g.time);
        if (slots.length) version = { teacher_id: g.teacher_id, room: g.room || '', slots, id: null };
      }
      result.push({ ...g, versionId: version?.id || null, teacherId: version?.teacher_id || g.teacher_id, room: version?.room || '', slots: version?.slots || [], issue: !version ? 'Boshlanish va tugash vaqtini Dars jadvalida kiriting' : null });
    }
    return result;
  }
  async function materialize(c: any, a: WorkforceActor, date: string) {
    const cfg = await configs(c, a, date), weekday = dateWeekday(date);
    const frozen = new Set((await c.query('SELECT DISTINCT group_id FROM workforce_lessons WHERE tenant_id=$1 AND work_date=$2', [a.tenantId, date])).rows.map((r: any) => r.group_id));
    for (const g of cfg.filter(g => !frozen.has(g.id))) for (const slot of g.slots as Slot[]) if (slot.weekday === weekday) {
      await c.query(`INSERT INTO workforce_lessons(tenant_id,group_id,group_name,teacher_id,work_date,start_at,end_at,room,slot_key,version_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [a.tenantId, g.id, g.name, g.teacherId, date, atMinute(date, slot.start), atMinute(date, slot.end), g.room, `${slot.start}-${slot.end}`, g.versionId]);
    }
    const lessons = (await c.query(`SELECT l.*,u.first_name||' '||u.last_name AS teacher_name FROM workforce_lessons l JOIN users u ON u.id=l.teacher_id AND u.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND l.work_date=$2 ORDER BY l.start_at,l.group_name`, [a.tenantId, date])).rows;
    const settings = await setup(c, a);
    for (const id of new Set<string>(lessons.filter((l: any) => l.status === 'scheduled').map((l: any) => l.teacher_id))) {
      const rows = lessons.filter((l: any) => l.teacher_id === id && l.status === 'scheduled');
      const start = new Date(Math.min(...rows.map((l: any) => +new Date(l.start_at)))), end = new Date(Math.max(...rows.map((l: any) => +new Date(l.end_at))));
      await c.query(`INSERT INTO workforce_days(tenant_id,teacher_id,work_date,expected_start,expected_end,trial_mode,grace_minutes) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(tenant_id,teacher_id,work_date) DO UPDATE SET expected_start=EXCLUDED.expected_start,expected_end=EXCLUDED.expected_end`, [a.tenantId, id, date, start, end, settings.trial_mode, settings.grace_minutes]);
    }
    return { lessons, configs: cfg, settings };
  }
  async function automaticFine(c: any, a: WorkforceActor, day: any, code: 'late' | 'absence') {
    if (day.excused) return;
    const type = (await c.query('SELECT * FROM workforce_fine_types WHERE tenant_id=$1 AND code=$2 AND active=TRUE', [a.tenantId, code])).rows[0];
    if (!type) return;
    if ((await c.query("SELECT id FROM workforce_fines WHERE tenant_id=$1 AND teacher_id=$2 AND work_date=$3 AND type_id IN (SELECT id FROM workforce_fine_types WHERE tenant_id=$1 AND code IN ('absence','late')) AND source='manual' AND status IN ('draft','approved')", [a.tenantId, day.teacher_id, day.work_date])).rows.length) return;
    const inserted = (await c.query(`INSERT INTO workforce_fines(tenant_id,teacher_id,type_id,work_date,name,amount,source,trial_mode,note)
      VALUES($1,$2,$3,$4,$5,$6,'automatic',$7,$8) ON CONFLICT DO NOTHING RETURNING id`, [a.tenantId, day.teacher_id, type.id, day.work_date, type.name, type.amount, day.trial_mode, code === 'late' ? `${day.late_minutes} daqiqa kechikish` : 'Kelish tasdig‘i yo‘q. Sababini tekshiring.'])).rows[0];
    if (inserted) await log(c, a, 'fine', inserted.id, 'created', { code, amount: type.amount }, day.teacher_id);
  }
  async function reconcile(c: any, a: WorkforceActor, date: string) {
    const { settings } = await materialize(c, a, date);
    if (!settings.enabled || !settings.started_on || date < dateText(settings.started_on)) return;
    const days = (await c.query(`SELECT d.* FROM workforce_days d WHERE d.tenant_id=$1 AND d.work_date=$2 AND d.excused=FALSE
      AND EXISTS(SELECT 1 FROM workforce_lessons l WHERE l.tenant_id=d.tenant_id AND l.teacher_id=d.teacher_id AND l.work_date=d.work_date AND l.status='scheduled')`, [a.tenantId, date])).rows;
    for (const day of days) {
      if (day.check_in && day.late_minutes > day.grace_minutes) await automaticFine(c, a, day, 'late');
      else if (!day.check_in && clock() > new Date(day.expected_end)) await automaticFine(c, a, day, 'absence');
    }
  }
  async function settings(a: WorkforceActor) { return tx(a, async c => { const s = await setup(c, a); const { qr_secret, ...rest } = s; return camel(rest); }); }
  async function updateSettings(a: WorkforceActor, input: any) {
    admin(a); const d = settingsInput.parse(input);
    return tx(a, async c => {
      const old = await setup(c, a);
      if (d.enabled && !old.enabled) {
        for (const g of await configs(c, a, uzWorkDate(clock()))) if (g.slots.length && !g.versionId) await c.query("INSERT INTO workforce_schedule_versions(tenant_id,group_id,teacher_id,room,slots,effective_from,created_by) VALUES($1,$2,$3,$4,$5,'1970-01-01',$6)", [a.tenantId, g.id, g.teacherId, g.room, JSON.stringify(g.slots), a.userId]);
      }
      await c.query(`UPDATE workforce_settings SET enabled=$2,trial_mode=$3,latitude=$4,longitude=$5,grace_minutes=$6,early_minutes=$7,
        started_on=CASE WHEN $2 AND (started_on IS NULL OR enabled=FALSE) THEN $8 ELSE started_on END,
        reconciled_through=CASE WHEN $2 AND enabled=FALSE THEN NULL ELSE reconciled_through END,updated_at=NOW() WHERE tenant_id=$1`, [a.tenantId, d.enabled, d.trialMode, d.latitude, d.longitude, d.graceMinutes, d.earlyMinutes, uzWorkDate(clock())]);
      await log(c, a, 'settings', a.tenantId, 'updated', { ...d, previousEnabled: old.enabled }); return { success: true };
    });
  }
  async function qr(a: WorkforceActor) { admin(a); return tx(a, async c => `ZAMONAVIY-CRM:ATTENDANCE:${(await setup(c, a)).qr_secret}`); }
  async function registerDevice(a: WorkforceActor, token: string | undefined, label: string) {
    teacher(a); return tx(a, async c => {
      if (token) { const old = (await c.query('SELECT id,status,label FROM workforce_devices WHERE tenant_id=$1 AND teacher_id=$2 AND secret_hash=$3 AND status!=\'revoked\'', [a.tenantId, a.userId, hash(token)])).rows[0]; if (old) return { device: old, token }; }
      const pending = (await c.query("SELECT id FROM workforce_devices WHERE tenant_id=$1 AND teacher_id=$2 AND status='pending'", [a.tenantId, a.userId])).rows[0];
      if (pending) fail('Boshqa qurilma ulash so‘rovi mavjud. Admin uni bekor qilishi kerak.', 409);
      const secret = randomBytes(32).toString('hex'), id = randomUUID();
      await c.query("INSERT INTO workforce_devices(id,tenant_id,teacher_id,secret_hash,label,status) VALUES($1,$2,$3,$4,$5,'pending')", [id, a.tenantId, a.userId, hash(secret), label]);
      await log(c, a, 'device', id, 'requested', { label }, a.userId); return { device: { id, status: 'pending', label }, token: secret };
    });
  }
  async function devices(a: WorkforceActor, token?: string) { return tx(a, async c => {
    const rows = (await c.query(`SELECT d.id,d.teacher_id,d.label,d.status,d.created_at,d.approved_at,d.last_used_at,u.first_name||' '||u.last_name AS teacher_name,
      d.secret_hash=$3 AS current_device FROM workforce_devices d JOIN users u ON u.id=d.teacher_id AND u.tenant_id=d.tenant_id WHERE d.tenant_id=$1 AND ($2::text IS NULL OR d.teacher_id=$2) ORDER BY d.created_at DESC LIMIT 300`, [a.tenantId, a.role === 'teacher' ? a.userId : null, token ? hash(token) : ''])).rows;
    return rows.map(camel);
  }); }
  async function decideDevice(a: WorkforceActor, id: string, action: string) { admin(a); return tx(a, async c => {
    const d = (await c.query('SELECT * FROM workforce_devices WHERE tenant_id=$1 AND id=$2', [a.tenantId, id])).rows[0]; if (!d) fail('Qurilma topilmadi', 404);
    if (action === 'approve') {
      if (d.status !== 'pending') fail('Faqat kutilayotgan qurilma tasdiqlanadi');
      await validTeacher(c, a, d.teacher_id);
      await c.query("UPDATE workforce_devices SET status='revoked' WHERE tenant_id=$1 AND teacher_id=$2 AND status='active'", [a.tenantId, d.teacher_id]);
      await c.query("UPDATE workforce_devices SET status='active',approved_at=NOW() WHERE id=$1", [id]);
    } else if (action === 'revoke') await c.query("UPDATE workforce_devices SET status='revoked' WHERE id=$1", [id]); else fail('Amal noto‘g‘ri');
    await log(c, a, 'device', id, action, { label: d.label }, d.teacher_id); return { success: true };
  }); }
  async function saveSchedule(a: WorkforceActor, input: any) { admin(a); const d = scheduleInput.parse(input); return tx(a, async c => {
    await setup(c,a);
    if (d.effectiveFrom < uzWorkDate(clock())) fail('O‘tgan kun jadvali versiya orqali o‘zgartirilmaydi');
    await validTeacher(c, a, d.teacherId);
    const g = (await c.query('SELECT * FROM groups WHERE tenant_id=$1 AND id=$2 AND archived_at IS NULL', [a.tenantId, d.groupId])).rows[0]; if (!g) fail('Guruh topilmadi', 404);
    for (let i = 0; i < d.slots.length; i++) for (let j = i + 1; j < d.slots.length; j++) if (d.slots[i].weekday === d.slots[j].weekday && d.slots[i].start < d.slots[j].end && d.slots[j].start < d.slots[i].end) fail('Guruhning dars vaqtlari to‘qnashdi');
    // Check every known future version boundary; a change must not introduce a later conflict.
    const boundaries = [d.effectiveFrom, ...(await c.query('SELECT DISTINCT effective_from::text AS date FROM workforce_schedule_versions WHERE tenant_id=$1 AND effective_from>$2', [a.tenantId, d.effectiveFrom])).rows.map((r: any) => r.date)];
    for (const date of boundaries) for (const other of await configs(c, a, date)) if (other.id !== d.groupId && (other.teacherId === d.teacherId || (d.room && other.room === d.room))) for (const s of d.slots) for (const os of other.slots) if (s.weekday === os.weekday && s.start < os.end && os.start < s.end) fail(`${other.name} bilan o‘qituvchi yoki xona vaqti to‘qnashadi`);
    if (d.effectiveFrom === uzWorkDate(clock()) && (await c.query('SELECT id FROM workforce_lessons WHERE tenant_id=$1 AND group_id=$2 AND work_date=$3 LIMIT 1', [a.tenantId, d.groupId, d.effectiveFrom])).rows.length) fail('Bugungi jadval qayd etilgan. O‘zgarishni ertadan belgilang yoki alohida darsni tahrirlang.');
    // Preserve the legacy baseline so future versions do not leak backwards.
    if (!(await c.query('SELECT id FROM workforce_schedule_versions WHERE tenant_id=$1 AND group_id=$2 LIMIT 1', [a.tenantId, d.groupId])).rows.length) {
      const old = strictLegacySlots(g.days || [], g.time); if (old.length) await c.query("INSERT INTO workforce_schedule_versions(tenant_id,group_id,teacher_id,room,slots,effective_from,created_by) VALUES($1,$2,$3,$4,$5,'1970-01-01',$6)", [a.tenantId, d.groupId, g.teacher_id, g.room || '', JSON.stringify(old), a.userId]);
    }
    const row = (await c.query('INSERT INTO workforce_schedule_versions(tenant_id,group_id,teacher_id,room,slots,effective_from,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [a.tenantId, d.groupId, d.teacherId, d.room, JSON.stringify(d.slots), d.effectiveFrom, a.userId])).rows[0];
    await log(c, a, 'schedule', row.id, 'created', d, d.teacherId); return row;
  }); }
  async function schedule(a: WorkforceActor, from: string, to: string) { dateInput.parse(from); dateInput.parse(to); if (to < from || Date.parse(to) - Date.parse(from) > 31 * 86400000) fail('Eng ko‘pi bilan 32 kun tanlang');
    return tx(a, async c => {
      const lessons: any[] = [], today = uzWorkDate(clock());
      for (let n = Date.parse(from + 'T12:00:00Z'); n <= Date.parse(to + 'T12:00:00Z'); n += 86400000) {
        const date = new Date(n).toISOString().slice(0, 10);
        if (date <= today) lessons.push(...(await materialize(c, a, date)).lessons);
        else {
          const frozen = (await c.query('SELECT l.*,u.first_name||\' \'||u.last_name AS teacher_name FROM workforce_lessons l JOIN users u ON u.id=l.teacher_id AND u.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND l.work_date=$2', [a.tenantId, date])).rows;
          const frozenGroups = new Set(frozen.map((l: any) => l.group_id)); lessons.push(...frozen);
          const names = (await c.query("SELECT id,first_name||' '||last_name AS name FROM users WHERE tenant_id=$1", [a.tenantId])).rows;
          for (const g of await configs(c, a, date)) if (!frozenGroups.has(g.id)) for (const s of g.slots as Slot[]) if (s.weekday === dateWeekday(date)) lessons.push({ id: null, group_id: g.id, group_name: g.name, teacher_id: g.teacherId, teacher_name: names.find((u: any) => u.id === g.teacherId)?.name, work_date: date, start_at: atMinute(date, s.start), end_at: atMinute(date, s.end), room: g.room, status: 'scheduled' });
        }
      }
      return { lessons: lessons.filter(l => a.role !== 'teacher' || l.teacher_id === a.userId).map(camel), configs: (await configs(c, a, from)).filter(g => a.role !== 'teacher' || g.teacherId === a.userId).map(g => ({ id: g.id, name: g.name, teacherId: g.teacherId, room: g.room, slots: g.slots, issue: g.issue })) };
    });
  }
  async function dashboard(a: WorkforceActor, date: string) { dateInput.parse(date); return tx(a, async c => {
    await reconcile(c, a, date);
    const days = (await c.query(`SELECT d.*,u.first_name||' '||u.last_name AS teacher_name,
      (SELECT COUNT(*)::int FROM workforce_lessons l WHERE l.tenant_id=d.tenant_id AND l.teacher_id=d.teacher_id AND l.work_date=d.work_date AND l.status='scheduled') AS lesson_count
      FROM workforce_days d JOIN users u ON u.id=d.teacher_id AND u.tenant_id=d.tenant_id WHERE d.tenant_id=$1 AND d.work_date=$2 AND ($3::text IS NULL OR d.teacher_id=$3) ORDER BY d.expected_start`, [a.tenantId, date, a.role === 'teacher' ? a.userId : null])).rows;
    const s = await setup(c, a);
    return { date, graceMinutes: s.grace_minutes, trialMode: s.trial_mode, enabled: s.enabled, days: days.map((d: any) => ({ ...camel(d), state: d.excused || !d.lesson_count ? 'excused' : d.check_out ? 'left' : d.check_in ? (d.late_minutes > d.grace_minutes ? 'late' : 'present') : clock() > new Date(d.expected_end) ? 'missing' : 'expected' })) };
  }); }
  async function scan(a: WorkforceActor, token: string | undefined, input: any) { teacher(a); const d = scanInput.parse(input); return tx(a, async c => {
    const s = await setup(c, a), now = clock(), date = uzWorkDate(now);
    if (!s.enabled || s.latitude === null || s.longitude === null) fail('QR davomat hali admin tomonidan yoqilmagan');
    if (!same(d.qr, `ZAMONAVIY-CRM:ATTENDANCE:${s.qr_secret}`)) fail('QR kod ushbu markazga tegishli emas');
    const device = token && (await c.query("SELECT id FROM workforce_devices WHERE tenant_id=$1 AND teacher_id=$2 AND secret_hash=$3 AND status='active'", [a.tenantId, a.userId, hash(token)])).rows[0];
    if (!device) fail('Ushbu qurilma tasdiqlanmagan. Admin bilan bog‘laning.', 403);
    const issue = locationProblem(d, { latitude: Number(s.latitude), longitude: Number(s.longitude) }, now); if (issue) fail(issue);
    const { lessons } = await materialize(c, a, date);
    if (!lessons.some((l: any) => l.teacher_id === a.userId && l.status === 'scheduled')) fail('Bugun jadvalingizda dars yo‘q');
    const day = (await c.query('SELECT * FROM workforce_days WHERE tenant_id=$1 AND teacher_id=$2 AND work_date=$3 FOR UPDATE', [a.tenantId, a.userId, date])).rows[0];
    if (!day || day.excused) fail('Bugun sizga davomat talab qilinmaydi');
    if (d.action === 'in') {
      if (day.check_in) return { success: true, duplicate: true, time: day.check_in, action: 'in' };
      if (now < new Date(+new Date(day.expected_start) - s.early_minutes * 60000)) fail('Kelishni qayd etish vaqti hali boshlanmagan');
      if (now >= new Date(day.expected_end)) fail('Bugungi darslar tugagan. Admin orqali holatni aniqlashtiring.');
      const late = Math.max(0, Math.ceil((+now - +new Date(day.expected_start)) / 60000));
      await c.query('UPDATE workforce_days SET check_in=$2,late_minutes=$3 WHERE id=$1', [day.id, now, late]);
      if (late > day.grace_minutes) await automaticFine(c, a, { ...day, late_minutes: late }, 'late');
    } else {
      if (day.check_out) return { success: true, duplicate: true, time: day.check_out, action: 'out' };
      if (!day.check_in) fail('Avval kelishingizni qayd eting');
      if (now < new Date(day.expected_end)) fail('Oxirgi darsingiz hali tugamagan');
      await c.query('UPDATE workforce_days SET check_out=$2 WHERE id=$1', [day.id, now]);
    }
    await c.query('UPDATE workforce_devices SET last_used_at=$2 WHERE id=$1', [device.id, now]);
    await log(c, a, 'day', day.id, d.action, { deviceId: device.id, accuracy: d.accuracy, latitude: d.latitude, longitude: d.longitude, capturedAt: d.capturedAt }, a.userId);
    return { success: true, time: now, action: d.action };
  }); }
  async function fineTypes(a: WorkforceActor) { return tx(a, async c => { await setup(c, a); return (await c.query('SELECT * FROM workforce_fine_types WHERE tenant_id=$1 ORDER BY id', [a.tenantId])).rows.map(camel); }); }
  async function saveFineType(a: WorkforceActor, id: number | null, input: any) { admin(a); const d = z.object({ name: z.string().trim().min(3).max(200), amount: z.number().int().min(0).max(1_000_000_000), active: z.boolean() }).strict().parse(input); return tx(a, async c => {
    const row = id ? (await c.query('UPDATE workforce_fine_types SET name=$3,amount=$4,active=$5 WHERE tenant_id=$1 AND id=$2 RETURNING *', [a.tenantId, id, d.name, d.amount, d.active])).rows[0] : (await c.query('INSERT INTO workforce_fine_types(tenant_id,name,amount,active) VALUES($1,$2,$3,$4) RETURNING *', [a.tenantId, d.name, d.amount, d.active])).rows[0];
    if (!row) fail('Jarima turi topilmadi', 404); await log(c, a, 'fine_type', row.id, id ? 'updated' : 'created', d); return camel(row);
  }); }
  async function fines(a: WorkforceActor, month: string) { monthInput.parse(month); return tx(a, async c => (await c.query(`SELECT f.*,u.first_name||' '||u.last_name AS teacher_name,
      COALESCE((SELECT SUM(d.amount) FROM workforce_deductions d WHERE d.fine_id=f.id AND d.tenant_id=f.tenant_id),0)::int AS deducted
      FROM workforce_fines f JOIN users u ON u.id=f.teacher_id AND u.tenant_id=f.tenant_id WHERE f.tenant_id=$1 AND to_char(f.work_date,'YYYY-MM')=$2 AND ($3::text IS NULL OR f.teacher_id=$3) ORDER BY f.created_at DESC,f.id DESC`, [a.tenantId, month, a.role === 'teacher' ? a.userId : null])).rows.map(camel)); }
  async function createFine(a: WorkforceActor, input: any) { admin(a); const d = z.object({ teacherId: z.string().min(1), typeId: z.number().int().positive(), date: dateInput, requestKey: z.string().uuid(), note: z.string().trim().min(3).max(2000) }).strict().parse(input); return tx(a, async c => {
    const previous = (await c.query('SELECT * FROM workforce_fines WHERE tenant_id=$1 AND request_key=$2', [a.tenantId, d.requestKey])).rows[0];
    if (previous) { if (previous.teacher_id !== d.teacherId || previous.type_id !== d.typeId || dateText(previous.work_date) !== d.date || previous.note !== d.note) fail('So‘rov kaliti boshqa jarima uchun ishlatilgan',409); return {id:previous.id}; }
    if (d.date > uzWorkDate(clock())) fail('Kelajak sanaga jarima yozilmaydi'); await validTeacher(c, a, d.teacherId);
    const s = await setup(c, a), type = (await c.query('SELECT * FROM workforce_fine_types WHERE tenant_id=$1 AND id=$2 AND active=TRUE', [a.tenantId, d.typeId])).rows[0]; if (!type) fail('Faol jarima turi topilmadi', 404);
    if (['absence','late'].includes(type.code) && (await c.query("SELECT id FROM workforce_fines WHERE tenant_id=$1 AND teacher_id=$2 AND work_date=$3 AND status IN ('draft','approved') AND type_id IN (SELECT id FROM workforce_fine_types WHERE tenant_id=$1 AND code IN ('absence','late'))",[a.tenantId,d.teacherId,d.date])).rows.length) fail('Shu kun uchun kelish bo‘yicha jarima mavjud');
    const row = (await c.query("INSERT INTO workforce_fines(tenant_id,teacher_id,type_id,work_date,name,amount,source,trial_mode,note,request_key) VALUES($1,$2,$3,$4,$5,$6,'manual',$7,$8,$9) RETURNING id", [a.tenantId, d.teacherId, type.id, d.date, type.name, type.amount, s.trial_mode, d.note, d.requestKey])).rows[0];
    await log(c, a, 'fine', row.id, 'created', { ...d, amount: type.amount }, d.teacherId); return row;
  }); }
  async function explainFine(a: WorkforceActor, id: number, input: any) { teacher(a); const d = z.object({ explanation: z.string().trim().min(3).max(4000), disputed: z.boolean() }).strict().parse(input); return tx(a, async c => {
    const row = (await c.query('UPDATE workforce_fines SET explanation=$4,disputed=$5 WHERE tenant_id=$1 AND teacher_id=$2 AND id=$3 RETURNING id', [a.tenantId, a.userId, id, d.explanation, d.disputed])).rows[0]; if (!row) fail('Jarima topilmadi', 404);
    await log(c, a, 'fine', id, 'explanation', d, a.userId); return { success: true };
  }); }
  async function decideFine(a: WorkforceActor, id: number, input: any) { admin(a); const d = z.object({ action: z.enum(['approve', 'reject', 'cancel']), note: z.string().trim().min(3).max(4000), orderRef: z.string().max(300).optional(), acknowledgement: z.string().max(1000).optional(), explanationRecord: z.string().max(1000).optional(), averageSalary: z.number().int().positive().optional(), capPercent: z.union([z.literal(30), z.literal(50)]).optional(), policyRef: z.string().max(300).optional() }).strict().parse(input); return tx(a, async c => {
    const f = (await c.query('SELECT * FROM workforce_fines WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [a.tenantId, id])).rows[0]; if (!f) fail('Jarima topilmadi', 404);
    const next = { approve: 'approved', reject: 'rejected', cancel: 'cancelled' }[d.action]; if (f.status === next && !f.disputed) return { success: true, duplicate: true };
    if (d.action === 'approve') {
      if (f.status !== 'draft' && !(f.status === 'approved' && f.disputed)) fail('Ushbu jarima holati tasdiqlashga mos emas');
      if (f.trial_mode) fail('Sinov davridagi jarima oylikka qo‘llanmaydi');
      if (!d.orderRef?.trim() || !d.acknowledgement?.trim() || (!f.explanation.trim() && !d.explanationRecord?.trim())) fail('Tushuntirish yoki rad etish dalolatnomasi, buyruq va tanishtirish qaydini kiriting');
      if (!d.averageSalary || !d.capPercent) fail('O‘rtacha oylik va qonuniy jarima chegarasini kiriting');
      if (d.capPercent === 50 && !d.policyRef?.trim()) fail('50% chegara uchun ichki mehnat qoidalari asosini kiriting');
      if (f.amount > Math.floor(d.averageSalary! * d.capPercent! / 100)) fail('Jarima o‘rtacha oylikka nisbatan belgilangan chegaradan oshadi');
    } else if (d.action === 'reject' && f.status !== 'draft') fail('Faqat loyiha rad etiladi');
    else if (d.action === 'cancel' && !['draft', 'approved'].includes(f.status)) fail('Ushbu jarima allaqachon yopilgan');
    await c.query('UPDATE workforce_fines SET status=$3,decision_note=$4,order_ref=COALESCE($5,order_ref),acknowledgement=COALESCE($6,acknowledgement),approved_by=$7,decided_at=NOW(),disputed=FALSE WHERE tenant_id=$1 AND id=$2', [a.tenantId, id, next, d.note, d.orderRef || null, d.acknowledgement || null, a.userId]);
    if (d.action === 'cancel') {
      const amount = Number((await c.query('SELECT COALESCE(SUM(amount),0) AS n FROM workforce_deductions WHERE tenant_id=$1 AND fine_id=$2', [a.tenantId, id])).rows[0].n);
      if (amount > 0) await c.query('INSERT INTO workforce_credits(tenant_id,teacher_id,fine_id,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [a.tenantId, f.teacher_id, id, amount]);
    }
    await log(c, a, 'fine', id, d.action, { ...d, previousStatus: f.status }, f.teacher_id); return { success: true };
  }); }
  async function updateDay(a: WorkforceActor, input: any) { admin(a); const d = z.object({ teacherId: z.string().min(1), date: dateInput, excused: z.boolean(), checkIn: z.string().datetime({ offset: true }).nullable(), checkOut: z.string().datetime({ offset: true }).nullable(), note: z.string().trim().min(3).max(2000) }).strict().parse(input); return tx(a, async c => {
    if (d.date > uzWorkDate(clock())) fail('Kelajakdagi kelish-ketish yozilmaydi'); await materialize(c, a, d.date); await validTeacher(c, a, d.teacherId);
    const old = (await c.query('SELECT * FROM workforce_days WHERE tenant_id=$1 AND teacher_id=$2 AND work_date=$3', [a.tenantId, d.teacherId, d.date])).rows[0]; if (!old) fail('Shu sana uchun dars topilmadi', 404);
    if (d.checkOut && (!d.checkIn || Date.parse(d.checkOut) < Date.parse(d.checkIn))) fail('Ketish vaqti kelishdan keyin bo‘lsin');
    for (const time of [d.checkIn, d.checkOut]) if (time && (uzWorkDate(new Date(time)) !== d.date || new Date(time) > clock())) fail('Qayd vaqti sana yoki hozirgi vaqtga mos emas');
    if ((await c.query("SELECT id FROM workforce_fines WHERE tenant_id=$1 AND teacher_id=$2 AND work_date=$3 AND source='automatic' AND status='approved'", [a.tenantId, d.teacherId, d.date])).rows.length) fail('Avval tasdiqlangan avtomatik jarimani bekor qiling');
    const late = d.checkIn ? Math.max(0, Math.ceil((Date.parse(d.checkIn) - +new Date(old.expected_start)) / 60000)) : 0;
    await c.query('UPDATE workforce_days SET excused=$4,check_in=$5,check_out=$6,late_minutes=$7,note=$8 WHERE tenant_id=$1 AND teacher_id=$2 AND work_date=$3', [a.tenantId, d.teacherId, d.date, d.excused, d.checkIn, d.checkOut, late, d.note]);
    // Keep the original automatic case as history; corrections do not silently rewrite money.
    await c.query("UPDATE workforce_fines SET status='rejected',note=note||$4 WHERE tenant_id=$1 AND teacher_id=$2 AND work_date=$3 AND source='automatic' AND status='draft'", [a.tenantId, d.teacherId, d.date, '\nDavomat tuzatildi: ' + d.note]);
    await log(c, a, 'day', old.id, 'corrected', { before: camel(old), after: d }, d.teacherId); return { success: true };
  }); }
  async function updateLesson(a: WorkforceActor, input: any) { admin(a); const d = z.object({ groupId: z.number().int().positive(), date: dateInput, lessonId: z.number().int().positive().nullable(), originalStart: z.number().int().min(0).max(1439), status: z.enum(['scheduled', 'cancelled']), teacherId: z.string().min(1), start: z.number().int().min(0).max(1439), end: z.number().int().min(1).max(1440), room: z.string().max(200), note: z.string().trim().min(3).max(2000) }).strict().parse(input); return tx(a, async c => {
    if (d.date < uzWorkDate(clock())) fail('O‘tgan darsni o‘zgartirish o‘rniga davomat tuzatishidan foydalaning'); if (d.end <= d.start) fail('Dars vaqti noto‘g‘ri');
    await validTeacher(c, a, d.teacherId); const { lessons } = await materialize(c, a, d.date);
    const old = d.lessonId ? lessons.find((l: any) => l.id === d.lessonId && l.group_id === d.groupId) : lessons.find((l: any) => l.group_id === d.groupId && +new Date(l.start_at) === +atMinute(d.date, d.originalStart));
    if (!old) fail('Dars topilmadi. Avval jadvalga dars qo‘shing.', 404);
    const start = atMinute(d.date, d.start), end = atMinute(d.date, d.end);
    if (d.status === 'scheduled') for (const other of lessons) if (other.id !== old.id && other.status === 'scheduled' && (other.teacher_id === d.teacherId || (d.room && other.room === d.room)) && start < new Date(other.end_at) && new Date(other.start_at) < end) fail('O‘qituvchi yoki xona vaqti to‘qnashdi');
    await c.query('UPDATE workforce_lessons SET teacher_id=$3,start_at=$4,end_at=$5,room=$6,status=$7,note=$8 WHERE tenant_id=$1 AND id=$2', [a.tenantId, old.id, d.teacherId, start, end, d.room, d.status, d.note]);
    await materialize(c, a, d.date); await log(c, a, 'lesson', old.id, 'exception', { before: camel(old), after: d }, d.teacherId); return { success: true };
  }); }
  async function history(a: WorkforceActor, kind?: string, id?: string) { return tx(a, async c => (await c.query('SELECT * FROM workforce_events WHERE tenant_id=$1 AND ($2::text IS NULL OR teacher_id=$2) AND ($3::text IS NULL OR entity_type=$3) AND ($4::text IS NULL OR entity_id=$4) ORDER BY id DESC LIMIT 200', [a.tenantId, a.role === 'teacher' ? a.userId : null, kind || null, id || null])).rows.map(camel)); }
  async function payrollData(c: any, a: WorkforceActor, teacherId: string, month: string, otherDeductions = 0, simulated?: {deducted: Map<number,number>; credits: Set<number>}) {
    monthInput.parse(month); if (a.role === 'teacher' && teacherId !== a.userId) fail('Ruxsat yo‘q', 403); await validTeacher(c, a, teacherId, true);
    const [year, m] = month.split('-').map(Number), { startDate, endDate } = monthBounds(year, m);
    const earning = (await c.query("SELECT COALESCE(SUM(amount),0) AS total,COALESCE(SUM(teacher_earning),0) AS gross FROM payments WHERE tenant_id=$1 AND teacher_id=$2 AND status='completed' AND deleted_at IS NULL AND created_at>=$3 AND created_at<=$4", [a.tenantId, teacherId, startDate, endDate])).rows[0];
    const paid = Number((await c.query("SELECT COALESCE(SUM(amount),0) AS n FROM expenses WHERE tenant_id=$1 AND teacher_id=$2 AND category='salary' AND (payroll_period=$3 OR (payroll_period IS NULL AND date>=$4 AND date<=$5))", [a.tenantId, teacherId, month, startDate, endDate])).rows[0].n);
    const closed = (await c.query('SELECT * FROM workforce_payroll WHERE tenant_id=$1 AND teacher_id=$2 AND month=$3', [a.tenantId, teacherId, month])).rows[0];
    if (closed) {
      const detail = closed.detail; return { ...detail, paid, remaining: Math.max(0, detail.net - paid), overpaid: Math.max(0, paid - detail.net), closed: true, payrollId: closed.id, month, teacherId };
    }
    const list = (await c.query(`SELECT f.id,f.name,f.amount,f.work_date,COALESCE(SUM(d.amount),0)::int AS deducted FROM workforce_fines f LEFT JOIN workforce_deductions d ON d.fine_id=f.id AND d.tenant_id=f.tenant_id
      WHERE f.tenant_id=$1 AND f.teacher_id=$2 AND f.status='approved' AND f.disputed=FALSE AND f.trial_mode=FALSE AND f.work_date<=$3::date AND f.decided_at<=$4 GROUP BY f.id HAVING f.amount>COALESCE(SUM(d.amount),0) ORDER BY f.work_date,f.id`, [a.tenantId, teacherId, uzWorkDate(endDate), endDate])).rows;
    const credits = (await c.query('SELECT * FROM workforce_credits WHERE tenant_id=$1 AND teacher_id=$2 AND applied_payroll_id IS NULL AND created_at<=$3', [a.tenantId, teacherId, endDate])).rows;
    for(const f of list)f.deducted+=simulated?.deducted.get(f.id)||0;
    const eligibleCredits=credits.filter((r:any)=>!simulated?.credits.has(r.id));
    const summary = payrollAmounts(Number(earning.gross), paid, list.reduce((n: number, f: any) => n + f.amount - f.deducted, 0), eligibleCredits.reduce((n: number, r: any) => n + r.amount, 0), otherDeductions);
    return { ...summary, totalPayments: Number(earning.total), closed: false, month, teacherId, fineItems: list.map(camel), creditItems: eligibleCredits.map(camel) };
  }
  async function payroll(a: WorkforceActor, teacherId: string, month: string) { return tx(a, c => payrollData(c, a, teacherId, month)); }
  async function payrollRange(a:WorkforceActor,teacherId:string,months:string[]){return tx(a,async c=>{
    const simulated={deducted:new Map<number,number>(),credits:new Set<number>()},result:any[]=[];
    for(const month of months){const p:any=await payrollData(c,a,teacherId,month,0,simulated);result.push(p);
      if(!p.closed){let budget=p.fines;for(const f of p.fineItems){const n=Math.min(budget,Math.max(0,f.amount-f.deducted));simulated.deducted.set(f.id,(simulated.deducted.get(f.id)||0)+n);budget-=n;}for(const r of p.creditItems)simulated.credits.add(r.id);}
    }return result;
  });}
  async function closePayroll(a: WorkforceActor, teacherId: string, month: string, otherDeductions: number) { admin(a); monthInput.parse(month); z.number().int().min(0).max(1_000_000_000).parse(otherDeductions); return tx(a, async c => {
    if (month >= uzWorkDate(clock()).slice(0, 7)) fail('Oy hisobi faqat oy tugagach yopiladi. Hozir dastlabki hisobdan foydalaning.');
    const data: any = await payrollData(c, a, teacherId, month, otherDeductions); if (data.closed) return data;
    if (otherDeductions>Math.floor(data.gross*.5)) fail('Boshqa ushlanmalar ham umumiy 50% chegaradan oshmasligi kerak');
    const row = (await c.query('INSERT INTO workforce_payroll(tenant_id,teacher_id,month,gross,paid,credits,fines,other_deductions,detail,closed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id', [a.tenantId, teacherId, month, data.gross, data.paid, data.credits, data.fines, otherDeductions, JSON.stringify(data), a.userId])).rows[0];
    let remaining = data.fines; for (const fine of data.fineItems) { const amount = Math.min(remaining, fine.amount - fine.deducted); if (amount > 0) await c.query('INSERT INTO workforce_deductions(tenant_id,teacher_id,fine_id,payroll_id,amount) VALUES($1,$2,$3,$4,$5)', [a.tenantId, teacherId, fine.id, row.id, amount]); remaining -= amount; }
    for (const credit of data.creditItems) await c.query('UPDATE workforce_credits SET applied_payroll_id=$2 WHERE id=$1 AND applied_payroll_id IS NULL', [credit.id, row.id]);
    await log(c, a, 'payroll', row.id, 'closed', { month, ...data }, teacherId); return { ...data, closed: true, payrollId: row.id };
  }); }
  async function tick() {
    const c = await pool.connect(); let rows: any[]; try { rows = (await c.query('SELECT tenant_id,enabled,started_on,reconciled_through FROM workforce_settings')).rows; } finally { c.release(); }
    const today = uzWorkDate(clock());
    for (const s of rows) {
      const a = { tenantId: s.tenant_id, userId: 'system', role: 'system' };
      await tx(a,c=>applyAssignments(c,a));
      if(!s.enabled||!s.started_on)continue;
      let cursor = s.reconciled_through ? new Date(Date.parse(dateText(s.reconciled_through)) + 86400000).toISOString().slice(0, 10) : dateText(s.started_on);
      for (let i = 0; i < 7 && cursor < today; i++) {
        const date = cursor; await tx(a, async db => { await reconcile(db, a, date); await db.query('UPDATE workforce_settings SET reconciled_through=$2 WHERE tenant_id=$1', [a.tenantId, date]); });
        cursor = new Date(Date.parse(cursor) + 86400000).toISOString().slice(0, 10);
      }
      await tx(a, c => reconcile(c, a, today));
    }
  }
  return { settings, updateSettings, qr, registerDevice, devices, decideDevice, saveSchedule, schedule, dashboard, scan, fineTypes, saveFineType, fines, createFine, explainFine, decideFine, updateDay, updateLesson, history, payroll, payrollRange, closePayroll, tick };
}
