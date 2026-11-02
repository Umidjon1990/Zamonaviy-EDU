import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createServer } from 'node:http';
import { createWorkforceService } from '../server/workforce-service';
import { registerWorkforceRoutes } from '../server/workforce-routes';
import { atMinute, distanceMeters, locationProblem, payrollAmounts, strictLegacySlots, uzWorkDate } from '../shared/workforce';
import { workforceFixture } from './workforce-fixture';

test('workforce pure rules: dates, explicit schedules, GPS and deduction capacity', () => {
  assert.equal(uzWorkDate(new Date('2026-11-01T20:00:00Z')), '2026-11-02');
  assert.equal(atMinute('2026-11-02', 540).toISOString(), '2026-11-02T04:00:00.000Z');
  assert.deepEqual(strictLegacySlots(['Du', 'Juma'], '09:00'), []);
  assert.deepEqual(strictLegacySlots(['Du', 'Juma'], '09:00 - 10:30'), [{ weekday: 1, start: 540, end: 630 }, { weekday: 5, start: 540, end: 630 }]);
  const now = new Date('2026-11-02T04:00:00Z'), base = { action: 'in' as const, qr: 'x'.repeat(30), latitude: 41, longitude: 71, accuracy: 10, capturedAt: +now };
  assert.equal(locationProblem(base, { latitude: 41, longitude: 71 }, now), null);
  assert.ok(distanceMeters(41, 71, 41.001, 71) > 100);
  for (const change of [{ latitude: 41.001 }, { accuracy: 100 }, { capturedAt: +now - 31000 }, { capturedAt: +now + 11000 }]) assert.ok(locationProblem({ ...base, ...change }, { latitude: 41, longitude: 71 }, now));
  assert.deepEqual(payrollAmounts(1000000, 700000, 600000), { gross: 1000000, paid: 700000, credits: 0, otherDeductions: 0, fines: 300000, fineTotal: 600000, deferred: 300000, net: 700000, remaining: 0, overpaid: 0 });
});

test('teacher workforce transactions and payroll regression', async t => {
  const { db, pool, reset } = await workforceFixture();
  let now = new Date('2026-11-02T03:50:00Z'); const service = createWorkforceService(pool, () => now);
  const a = { tenantId: 1, userId: 'admin', role: 'markaz_admin' }, teacher = { tenantId: 1, userId: 't1', role: 'teacher' }, other = { tenantId: 2, userId: 'foreign', role: 'teacher' };
  const settings = { enabled: true, trialMode: false, latitude: 41, longitude: 71, graceMinutes: 5, earlyMinutes: 30 };
  const init = async (trial = false) => { await reset(); now = new Date('2026-11-02T03:50:00Z'); await service.updateSettings(a, { ...settings, trialMode: trial }); const d = await service.registerDevice(teacher, undefined, 'Android test'); await service.decideDevice(a, d.device.id, 'approve'); return d.token; };
  const scan = async (token: string, action = 'in', changes: any = {}) => service.scan(teacher, token, { action, qr: await service.qr(a), latitude: 41, longitude: 71, accuracy: 10, capturedAt: +now, ...changes });
  const manual = async (code = 'room') => { const type = (await service.fineTypes(a)).find((f: any) => f.code === code); return service.createFine(a, { teacherId: 't1', typeId: type.id, date: '2026-11-02', requestKey: randomUUID(), note: 'Dalil bilan qayd etildi' }); };
  const approve = (id: number) => service.decideFine(a, id, { action: 'approve', note: 'Tekshirildi va tasdiqlandi', orderRef: '2026-11-02 / 12', acknowledgement: 'Imzoli tanishtirish qaydi 12', explanationRecord: 'Yozma tushuntirish 12', averageSalary: 2000000, capPercent: 30 });
  await t.test('settings default to disabled trial and never reveal the QR secret', async () => { await reset(); const s = await service.settings(a); assert.equal(s.enabled, false); assert.equal(s.trialMode, true); assert.equal('qrSecret' in s, false); await assert.rejects(service.updateSettings(teacher, settings), /administrator/); await assert.rejects(service.updateSettings(a, { ...settings, latitude: null }), /xaritada/); });
  await t.test('one active device; approval replaces old device, no hashes exposed', async () => { const token = await init(); const second = await service.registerDevice(teacher, undefined, 'iPhone test'); await assert.rejects(scan(second.token), /tasdiqlanmagan/); await service.decideDevice(a, second.device.id, 'approve'); await assert.rejects(scan(token), /tasdiqlanmagan/); await scan(second.token); const rows = await service.devices(teacher, second.token); assert.equal(rows.filter((r: any) => r.status === 'active').length, 1); assert.ok(rows.find((r: any) => r.currentDevice)); assert.ok(rows.every((r: any) => !('secretHash' in r))); });
  await t.test('on-time arrival is idempotent; checkout only after last of multiple classes', async () => { const token = await init(); const [x, y] = await Promise.all([scan(token), scan(token)]); assert.equal(x.time.toString(), y.time.toString()); assert.equal((await db.query<any>("SELECT COUNT(*) AS n FROM workforce_events WHERE action='in'")).rows[0].n, 1); now = new Date('2026-11-02T06:00:00Z'); await assert.rejects(scan(token, 'out'), /Oxirgi dars/); now = new Date('2026-11-02T08:30:00Z'); await scan(token, 'out'); await scan(token, 'out'); assert.equal((await service.fines(teacher, '2026-11')).length, 0); });
  await t.test('QR, device, old GPS, outside radius and unknown fields are rejected', async () => { const token = await init(); for (const changes of [{ qr: 'wrong'.repeat(12) }, { latitude: 41.002 }, { accuracy: 80 }, { capturedAt: +now - 31000 }, { teacherId: 't2' }]) await assert.rejects(scan(token, 'in', changes)); await assert.rejects(scan('bad-device-token'), /tasdiqlanmagan/); assert.equal((await service.dashboard(teacher, '2026-11-02')).days[0].checkIn, null); });
  await t.test('grace boundary creates exactly one late fine, no absence after missing checkout', async () => { const token = await init(); now = new Date('2026-11-02T04:05:01Z'); await scan(token); now = new Date('2026-11-02T09:00:00Z'); await service.dashboard(a, '2026-11-02'); await service.dashboard(a, '2026-11-02'); const list = await service.fines(teacher, '2026-11'); assert.equal(list.length, 1); assert.equal(list[0].amount, 100000); assert.equal(list[0].status, 'draft'); });
  await t.test('too-early and after-final-class arrival cannot create attendance', async () => { const token = await init(); now = new Date('2026-11-02T03:29:59Z'); await assert.rejects(scan(token), /hali boshlanmagan/); now = new Date('2026-11-02T08:30:00Z'); await assert.rejects(scan(token), /darslar tugagan/); });
  await t.test('absence only after final class and retry-safe worker catches up', async () => { await init(); await service.dashboard(a, '2026-11-02'); assert.equal((await service.fines(teacher, '2026-11')).length, 0); now = new Date('2026-11-03T05:00:00Z'); await service.tick(); await service.tick(); const f = await service.fines(teacher, '2026-11'); assert.equal(f.length, 1); assert.equal(f[0].amount, 200000); });
  await t.test('cancellation and substitute exempt original teacher, leave is honored', async () => { await init(); const data = await service.schedule(a, '2026-11-02', '2026-11-02'); const first = data.lessons.find((l: any) => l.groupId === 1); const second = data.lessons.find((l: any) => l.groupId === 2); for (const l of [first, second]) await service.updateLesson(a, { groupId: l.groupId, lessonId: l.id, date: '2026-11-02', teacherId: 't1', originalStart: l.groupId === 1 ? 540 : 720, start: l.groupId === 1 ? 540 : 720, end: l.groupId === 1 ? 630 : 810, room: l.room, status: 'cancelled', note: 'Bayram sabab dars bekor' }); now = new Date('2026-11-02T10:00:00Z'); await service.dashboard(a, '2026-11-02'); assert.equal((await service.fines(teacher, '2026-11')).length, 0); });
  await t.test('correcting a forgotten scan retains audit and rejects the draft', async () => { await init(); now = new Date('2026-11-02T10:00:00Z'); await service.dashboard(a, '2026-11-02'); await service.updateDay(a, { teacherId: 't1', date: '2026-11-02', excused: false, checkIn: '2026-11-02T08:55:00+05:00', checkOut: '2026-11-02T13:31:00+05:00', note: 'Kamera ishlamadi, admin tasdiqladi' }); assert.equal((await service.fines(teacher, '2026-11'))[0].status, 'rejected'); assert.ok((await service.history(teacher)).some((h: any) => h.action === 'corrected')); });
  await t.test('schedule conflicts and tenant ownership rejected; effective date preserves history', async () => { await init(); await assert.rejects(service.saveSchedule(a, { groupId: 4, teacherId: 't1', room: '100', effectiveFrom: '2026-11-03', slots: [{ weekday: 1, start: 600, end: 700 }] }), /Guruh topilmadi/); await assert.rejects(service.saveSchedule(a, { groupId: 1, teacherId: 't2', room: '101', effectiveFrom: '2026-11-03', slots: [{ weekday: 1, start: 600, end: 700 }] }), /to‘qnashadi/); await service.schedule(a, '2026-11-02', '2026-11-02'); await service.saveSchedule(a, { groupId: 1, teacherId: 't1', room: '105', effectiveFrom: '2026-11-03', slots: [{ weekday: 1, start: 480, end: 540 }] }); const old = await service.schedule(teacher, '2026-11-02', '2026-11-02'), future = await service.schedule(teacher, '2026-11-09', '2026-11-09'); assert.equal(new Date(old.lessons[0].startAt).getUTCHours(), 4); assert.equal(new Date(future.lessons[0].startAt).getUTCHours(), 3); assert.equal((await service.dashboard(other, '2026-11-02')).days.length, 1); });
  await t.test('manual fine idempotency and type amount snapshot; ownership checks', async () => { await init(); const type = (await service.fineTypes(a)).find((f: any) => f.code === 'room'), d = { teacherId: 't1', typeId: type.id, date: '2026-11-02', note: 'Aniq dalil saqlandi', requestKey: randomUUID() }; const [one, two] = await Promise.all([service.createFine(a, d), service.createFine(a, d)]); assert.equal(one.id, two.id); await service.saveFineType(a, type.id, { name: type.name, amount: 300000, active: true }); assert.equal((await service.fines(teacher, '2026-11'))[0].amount, 100000); await assert.rejects(service.explainFine(other, one.id, { explanation: 'Begona jarimaga kirish', disputed: true }), /topilmadi/); await assert.rejects(service.createFine(teacher, d), /administrator/); });
  await t.test('trial fines cannot be approved; required documents and legal amount cap enforced', async () => { await init(true); const f = await manual(); await assert.rejects(approve(f.id), /Sinov/); await init(); const x = await manual(); await assert.rejects(service.decideFine(a, x.id, { action: 'approve', note: 'Yetarli hujjatlar yo‘q' }), /Tushuntirish/); await assert.rejects(service.decideFine(a, x.id, { action: 'approve', note: 'Hujjatlar mavjud', orderRef: '1', acknowledgement: 'imzo', explanationRecord: 'izoh', averageSalary: 100000, capPercent: 30 }), /chegaradan oshadi/); });
  await t.test('payroll uses stored earnings, applies approved fines once and cancels with credit', async () => { await init(); const f = await manual(); await approve(f.id); const p = await service.payroll(teacher, 't1', '2026-11'); assert.equal(p.gross, 2000000); assert.equal(p.paid, 500000); assert.equal(p.fines, 100000); assert.equal(p.remaining, 1400000); now=new Date('2026-12-01T09:00:00Z'); const x = await service.closePayroll(a, 't1', '2026-11', 0), y = await service.closePayroll(a, 't1', '2026-11', 0); assert.equal(x.payrollId, y.payrollId); assert.equal((await db.query<any>('SELECT COUNT(*) AS n FROM workforce_deductions')).rows[0].n, 1); await service.decideFine(a, f.id, { action: 'cancel', note: 'Dalil bilan bekor qilindi' }); await service.decideFine(a, f.id, { action: 'cancel', note: 'Qayta urinish amalga oshdi' }); assert.equal((await db.query<any>('SELECT COUNT(*) AS n FROM workforce_credits')).rows[0].n, 1); const old = await service.payroll(teacher, 't1', '2026-11'); assert.equal(old.fines, 100000); now = new Date('2026-12-02T09:00:00Z'); assert.equal((await service.payroll(teacher, 't1', '2026-12')).credits, 100000); await assert.rejects(service.payroll(other, 't1', '2026-11'), /Ruxsat/); });
  await t.test('disputed approved fines are held until the administrator reviews them', async () => { await init(); const f = await manual(); await approve(f.id); await service.explainFine(teacher, f.id, { explanation: 'Dalil bo‘yicha e’tirozim bor', disputed: true }); assert.equal((await service.payroll(teacher, 't1', '2026-11')).fines, 0); await approve(f.id); assert.equal((await service.payroll(teacher, 't1', '2026-11')).fines, 100000); });
  await t.test('deduction limit includes other deductions and retains outstanding balance', async () => { await init(); const type = (await service.fineTypes(a)).find((f: any) => f.code === 'room'); await service.saveFineType(a, type.id, { name: type.name, amount: 500000, active: true }); for (let i = 0; i < 3; i++) { const f = await manual(); await approve(f.id); } now=new Date('2026-12-01T09:00:00Z'); const p = await service.closePayroll(a, 't1', '2026-11', 200000); assert.equal(p.fines, 800000); assert.equal(p.deferred, 700000); assert.equal(p.remaining, 500000); });
  await t.test('transaction failure rolls back attendance and its audit', async () => { const token = await init(); await db.exec(`CREATE FUNCTION fail_workforce() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER fail_workforce BEFORE INSERT ON workforce_events FOR EACH ROW EXECUTE FUNCTION fail_workforce();`); await assert.rejects(scan(token)); await db.exec('DROP TRIGGER fail_workforce ON workforce_events; DROP FUNCTION fail_workforce();'); const q = await service.dashboard(teacher, '2026-11-02'); assert.equal(q.days[0].checkIn, null); });
  await t.test('substitute and authorized leave change only the selected lesson/day',async()=>{
    await init();const q=await service.schedule(a,'2026-11-02','2026-11-02');const l=q.lessons.find((r:any)=>r.groupId===2);
    await service.updateLesson(a,{groupId:2,lessonId:l.id,date:'2026-11-02',teacherId:'t2',originalStart:720,start:720,end:810,room:'102',status:'scheduled',note:'O‘rinbosar tayinlandi'});
    const d=await service.dashboard(teacher,'2026-11-02');assert.equal(new Date(d.days[0].expectedEnd).getUTCHours(),5);
    await service.updateDay(a,{teacherId:'t1',date:'2026-11-02',excused:true,checkIn:null,checkOut:null,note:'Tasdiqlangan ruxsat'});
    now=new Date('2026-11-02T10:00:00Z');await service.tick();assert.equal((await service.fines(teacher,'2026-11')).length,0);
  });
  await t.test('changing grace settings and legacy group time cannot rewrite recorded work days',async()=>{
    const token=await init();now=new Date('2026-11-02T04:06:00Z');await scan(token);
    await service.updateSettings(a,{...settings,graceMinutes:60});await db.exec("UPDATE groups SET time='15:00 - 17:00' WHERE id=1");
    const q=await service.dashboard(teacher,'2026-11-02');assert.equal(q.days[0].state,'late');assert.equal(q.days[0].lessonCount,2);
    assert.equal(new Date(q.days[0].expectedStart).getUTCHours(),4);
  });
  await t.test('monthly range does not count one outstanding fine twice',async()=>{
    await init();const f=await manual();await approve(f.id);await db.exec("INSERT INTO payments(tenant_id,teacher_id,amount,teacher_earning,status,created_at) VALUES(1,'t1',4000000,2000000,'completed','2026-12-02')");
    now=new Date('2026-12-05T09:00:00Z');const range=await service.payrollRange(a,'t1',['2026-11','2026-12']);assert.equal(range.reduce((n:number,p:any)=>n+p.fines,0),100000);
  });
  await t.test('scheduled teacher assignment takes effect on its date and leaves earning snapshots intact',async()=>{
    await init();await service.saveSchedule(a,{groupId:1,teacherId:'t2',room:'101',effectiveFrom:'2026-11-09',slots:[{weekday:1,start:480,end:540}]});
    assert.equal((await db.query<any>('SELECT teacher_id FROM groups WHERE id=1')).rows[0].teacher_id,'t1');
    now=new Date('2026-11-09T03:00:00Z');await service.tick();assert.equal((await db.query<any>('SELECT teacher_id FROM groups WHERE id=1')).rows[0].teacher_id,'t2');
    assert.equal((await service.payroll(teacher,'t1','2026-11')).gross,2000000);
  });
  await t.test('archived teachers retain historical payroll and manual attendance cases do not duplicate automatic ones',async()=>{
    await init();await manual('late');now=new Date('2026-11-02T10:00:00Z');await service.tick();assert.equal((await service.fines(teacher,'2026-11')).length,1);
    await db.exec("UPDATE users SET archived_at=NOW() WHERE id='t1'");assert.equal((await service.payroll(a,'t1','2026-11')).gross,2000000);
  });
  await t.test('payroll remains open until month end and next-month payments settle the right period',async()=>{
    await init();await assert.rejects(service.closePayroll(a,'t1','2026-11',0),/oy tugagach/);
    now=new Date('2026-12-01T09:00:00Z');const closed=await service.closePayroll(a,'t1','2026-11',0);assert.equal(closed.remaining,1500000);
    await db.exec("INSERT INTO expenses(tenant_id,teacher_id,amount,category,date,payroll_period) VALUES(1,'t1',1500000,'salary','2026-12-01','2026-11')");
    assert.equal((await service.payroll(teacher,'t1','2026-11')).remaining,0);assert.equal((await service.payroll(teacher,'t1','2026-12')).paid,0);
  });
  await db.close();
});

test('workforce HTTP guards, cookie, PNG and tenant boundaries', async () => {
  const { db, pool } = await workforceFixture(), app = express(); app.use(express.json());
  const auth: any = (req: any, res: any, next: any) => { const role = req.headers['x-test-role']; if (!role) return res.status(401).json({ error: 'Login' }); req.session = { role, tenantId: 1, userId: role === 'teacher' ? 't1' : 'admin' }; next(); };
  registerWorkforceRoutes(app, pool, auth); const server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  try { const base = `http://127.0.0.1:${(server.address() as any).port}/api/workforce/`;
    assert.equal((await fetch(base + 'settings')).status, 401);
    assert.equal((await fetch(base + 'settings', { headers: { 'x-test-role': 'manager' } })).status, 403);
    assert.equal((await fetch(base + 'qr.png', { headers: { 'x-test-role': 'teacher' } })).status, 403);
    const png = await fetch(base + 'qr.png', { headers: { 'x-test-role': 'markaz_admin' } }); assert.equal(png.headers.get('content-type'), 'image/png'); assert.equal(Buffer.from(await png.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
    const register = await fetch(base + 'devices', { method: 'POST', headers: { 'x-test-role': 'teacher', 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'Android HTTP test' }) }); assert.equal(register.status, 200); assert.match(register.headers.get('set-cookie') || '', /HttpOnly/); assert.equal('token' in await register.json(), false);
    assert.equal((await fetch(base + 'settings', { method: 'PUT', headers: { 'x-test-role': 'markaz_admin', 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  } finally { await new Promise<void>(r => server.close(() => r())); await db.close(); }
});
