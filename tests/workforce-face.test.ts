import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import { registerWorkforceRoutes } from '../server/workforce-routes';
import { createWorkforceService } from '../server/workforce-service';
import { workforceFixture } from './workforce-fixture';

const admin = { tenantId: 1, userId: 'admin', role: 'markaz_admin' };
const teacher = { tenantId: 1, userId: 't1', role: 'teacher' };
const settings = { enabled: true, trialMode: false, latitude: null, longitude: null, earlyMinutes: 30, graceMinutes: 5 };

function terminalKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  function envelope(operation: string, terminalId: string, timestamp: number, data: unknown, requestId = randomUUID()) {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    const message = ['workforce-face-v1', operation, terminalId, timestamp, requestId, payload].join('\n');
    return { terminalId, timestamp, requestId, payload, signature: sign(null, Buffer.from(message), privateKey).toString('base64url') };
  }
  return { publicHex, envelope };
}

test('Face terminal pairing, attendance, consent withdrawal and absence review', async () => {
  const { db, pool } = await workforceFixture();
  let now = new Date('2026-11-02T03:45:00Z');
  let tenantActive = true;
  const service = createWorkforceService(pool, () => now, async tenantId => tenantId === 1 && tenantActive);
  const { face } = service;
  try {
    await assert.rejects(face.status(teacher), /administrator/);
    await assert.rejects(service.updateSettings(admin, settings), /terminalni/);
    await assert.rejects(service.qr(admin), /Face ID/);
    const key = terminalKey();
    const pairing = await face.issuePairing(admin, { label: 'Asosiy kirish' });
    const pair = { code: pairing.code, publicKey: key.publicHex };
    const { terminalId } = await face.pair(pair);
    assert.deepEqual(await face.pair(pair), { terminalId });
    await assert.rejects(face.pair({ ...pair, publicKey: terminalKey().publicHex }), /ishlatilgan/);
    await assert.rejects(face.issuePairing(admin, { label: 'Ikkinchi' }), /faol terminal/);

    const envelope = (op: string, data: unknown, id?: `${string}-${string}-${string}-${string}-${string}`) => key.envelope(op, terminalId, +now, data, id);
    const call = (op: string, data: unknown = {}) => face.signed(op, envelope(op, data));
    const signedRoster = envelope('roster', {});
    await assert.rejects(face.signed('roster', { ...signedRoster, signature: 'A'.repeat(86) }), /imzosi/);
    await assert.rejects(face.signed('issue', signedRoster), /imzosi/);
    await assert.rejects(face.signed('roster', key.envelope('roster', terminalId, +now - 121_000, {})), /soati/);
    tenantActive = false;
    await assert.rejects(call('roster'), /obunasi/);
    tenantActive = true;

    await assert.rejects(face.issueEnrollment(admin, { teacherId: 'foreign', consentRef: 'Rozilik 01' }), /topilmadi/);
    const { code } = await face.issueEnrollment(admin, { teacherId: 't1', consentRef: 'Rozilik 01' });
    const { enrollmentId } = await call('enrollment-lookup', { code }) as { enrollmentId: string };
    const checkIn = { teacherId: 't1', enrollmentId, action: 'in' };
    await assert.rejects(call('attendance', checkIn), /faol emas/);
    await assert.rejects(call('enrollment-confirm', { code, enrollmentId: randomUUID() }), /mos kelmadi/);
    const confirmation = envelope('enrollment-confirm', { code, enrollmentId });
    assert.deepEqual(await face.signed('enrollment-confirm', confirmation), { success: true });
    assert.deepEqual(await face.signed('enrollment-confirm', confirmation), { success: true });
    await assert.rejects(call('enrollment-lookup', { code }), /eskirgan/);
    assert.equal((await face.status(admin)).teachers.find((t: any) => t.id === 't1').status, 'active');

    await service.updateSettings(admin, settings);
    assert.equal((await service.settings(admin)).trialMode, true);
    await assert.rejects(call('attendance', { ...checkIn, teacherId: 'foreign' }), /topilmadi/);
    await assert.rejects(call('attendance', { ...checkIn, frame: 'invalid' }));
    await call('issue', { ...checkIn, reason: 'quality' });
    assert.equal((await service.dashboard(teacher, '2026-11-02')).days[0].checkInIssue, 'quality');

    now = new Date('2026-11-02T04:06:00Z');
    const first = envelope('attendance', checkIn);
    const [one, retry] = await Promise.all([face.signed('attendance', first), face.signed('attendance', first)]);
    assert.deepEqual(JSON.parse(JSON.stringify(one)), retry);
    const checkOut = { ...checkIn, action: 'out' };
    await assert.rejects(face.signed('attendance', envelope('attendance', checkOut, first.requestId)), /identifikatori/);
    await assert.rejects(call('attendance', checkOut), /Oxirgi dars/);
    const day = (await service.dashboard(teacher, '2026-11-02')).days[0];
    assert.equal(day.checkInIssue, null);
    assert.equal(day.lateMinutes, 6);
    assert.equal((await service.fines(teacher, '2026-11'))[0].trialMode, true);

    now = new Date('2026-11-02T08:31:00Z');
    await call('attendance', checkOut);
    const history = await service.history(teacher, 'day');
    assert.deepEqual(history.filter((entry: any) => ['in', 'out'].includes(entry.action)).map((entry: any) => entry.actorId), Array(2).fill(`face-terminal:${terminalId}`));
    assert.equal((await service.dashboard(admin, '2026-11-02')).days.find((d: any) => d.teacherId === 't2').state, 'missing');
    assert.equal((await service.fines(admin, '2026-11')).length, 1);

    await face.revokeEnrollment(admin, { teacherId: 't1' });
    assert.deepEqual((await call('roster') as any).enrollments, []);
    await assert.rejects(call('attendance', checkOut), /faol emas/);
    await assert.rejects(face.revokeTerminal({ ...admin, tenantId: 2 }, { terminalId }), /topilmadi/);
    await face.revokeTerminal(admin, { terminalId });
    await assert.rejects(call('roster'), { status: 410 });
    assert.equal((await service.settings(admin)).enabled, false);
  } finally {
    await db.close();
  }
});

test('Face terminal HTTP authentication and upgrade from QR', async () => {
  const { db, pool } = await workforceFixture();
  await db.exec("INSERT INTO workforce_settings(tenant_id,qr_secret,attendance_method) VALUES(1,'legacy','qr')");
  const app = express();
  app.use(express.json());
  const service = registerWorkforceRoutes(app, pool, (req: any, res, next) => {
    const role = req.get('x-test-role');
    if (!role) { res.sendStatus(401); return; }
    req.session = { ...admin, role };
    next();
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/`;
  const post = (path: string, data: unknown, role?: string) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify(data),
  });
  try {
    assert.equal((await post('workforce/face/pairing', { label: 'Test' })).status, 401);
    assert.equal((await post('workforce/face/pairing', { label: 'Test' }, 'teacher')).status, 403);
    const pairing = await post('workforce/face/pairing', { label: 'Test' }, 'markaz_admin');
    assert.equal(pairing.headers.get('cache-control'), 'no-store');
    const key = terminalKey();
    const response = await post('workforce-terminal/pair', { code: (await pairing.json()).code, publicKey: key.publicHex });
    assert.equal(response.status, 200);
    const { terminalId } = await response.json();
    assert.equal((await post('workforce-terminal/roster', {}, 'markaz_admin')).status, 400);
    assert.equal((await post('workforce-terminal/roster', key.envelope('roster', terminalId, Date.now(), {}))).status, 200);
    await service.updateSettings(admin, { ...settings, enabled: false, attendanceMethod: 'face' });
    await assert.rejects(service.qr(admin), /Face ID/);
    assert.equal((await service.settings(admin)).attendanceMethod, 'face');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
