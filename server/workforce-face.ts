import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { z } from 'zod';
import { faceConsent } from '../shared/workforce';
import { FinanceError } from './payment-service';
import type { WorkforceActor } from './workforce-service';

const code = z.string().regex(/^[A-Za-z0-9_-]{24}$/);
const uuid = z.string().uuid();
const teacherId = z.string().min(1).max(200);
const pairInput = z.object({ code, publicKey: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const envelopeInput = z.object({
  terminalId: uuid, requestId: uuid, timestamp: z.number().int().safe(),
  payload: z.string().regex(/^[A-Za-z0-9_-]{1,600}$/),
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
}).strict();
const attendance = z.object({ teacherId, enrollmentId: uuid, action: z.enum(['in', 'out']) }).strict();
const operations = {
  roster: z.object({}).strict(),
  'enrollment-lookup': z.object({ code }).strict(),
  'enrollment-confirm': z.object({ code, enrollmentId: uuid }).strict(),
  attendance,
  issue: attendance.extend({ reason: z.enum(['camera', 'face_mismatch', 'liveness', 'quality', 'template']) }).strict(),
};
const operationInput = z.enum(['roster', 'enrollment-lookup', 'enrollment-confirm', 'attendance', 'issue']);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const newCode = () => randomBytes(18).toString('base64url');
const expiry = (now: Date, minutes: number) => new Date(+now + minutes * 60_000);
const fail = (message: string, status = 400): never => { throw new FinanceError(message, status); };
const admin = (a: WorkforceActor) => { if (a.role !== 'markaz_admin') fail('Faqat administrator uchun', 403); };
const teacher = (a: WorkforceActor) => { if (a.role !== 'teacher') fail('Faqat o‘qituvchi uchun', 403); };

type Dependencies = {
  pool: any;
  tx: <T>(a: WorkforceActor, fn: (c: any) => Promise<T>) => Promise<T>;
  clock: () => Date;
  log: (c: any, a: WorkforceActor, kind: string, id: string | number, action: string, detail?: unknown, teacherId?: string) => Promise<void>;
  validTeacher: (c: any, a: WorkforceActor, id: string) => Promise<void>;
  setup: (c: any, a: WorkforceActor) => Promise<any>;
  recordAttendance: (c: any, a: WorkforceActor, action: 'in' | 'out', now: Date, s: any, detail: Record<string, unknown>, actorId?: string) => Promise<unknown>;
  reportFaceIssue: (c: any, a: WorkforceActor, action: 'in' | 'out', reason: string, now: Date, terminalId: string) => Promise<unknown>;
  tenantAllowed: (tenantId: number) => Promise<boolean>;
};

export function createWorkforceFace({ pool, tx, clock, log, validTeacher, setup, recordAttendance, reportFaceIssue, tenantAllowed }: Dependencies) {
  async function activeTerminal(c: any, tenantId: number) {
    return (await c.query(`SELECT id,label,paired_at AS "pairedAt",last_seen_at AS "lastSeenAt"
      FROM workforce_face_terminals WHERE tenant_id=$1 AND revoked_at IS NULL`, [tenantId])).rows[0];
  }

  async function isReady(c: any, tenantId: number) {
    return (await c.query(`SELECT 1 FROM workforce_face_enrollments e
      JOIN workforce_face_terminals t ON t.id=e.terminal_id AND t.tenant_id=e.tenant_id
      JOIN users u ON u.id=e.teacher_id AND u.tenant_id=e.tenant_id
      WHERE e.tenant_id=$1 AND e.enrolled_at IS NOT NULL AND e.revoked_at IS NULL AND t.revoked_at IS NULL
        AND u.role='teacher' AND u.archived_at IS NULL LIMIT 1`, [tenantId])).rows.length > 0;
  }

  async function status(a: WorkforceActor) {
    admin(a);
    return tx(a, async c => ({
      terminal: await activeTerminal(c, a.tenantId) ?? null,
      teachers: (await c.query(`SELECT u.id,u.first_name||' '||u.last_name AS name,
        CASE WHEN t.id IS NULL OR e.revoked_at IS NOT NULL THEN 'none'
             WHEN e.enrolled_at IS NOT NULL THEN 'active'
             WHEN e.expires_at>$2 THEN 'pending' ELSE 'none' END AS status
        FROM users u LEFT JOIN workforce_face_enrollments e ON e.tenant_id=u.tenant_id AND e.teacher_id=u.id
        LEFT JOIN workforce_face_terminals t ON t.id=e.terminal_id AND t.tenant_id=e.tenant_id AND t.revoked_at IS NULL
        WHERE u.tenant_id=$1 AND u.role='teacher' AND u.archived_at IS NULL ORDER BY name,u.id`, [a.tenantId, clock()])).rows,
    }));
  }

  async function issuePairing(a: WorkforceActor, input: unknown) {
    admin(a);
    const { label } = z.object({ label: z.string().trim().min(2).max(100) }).strict().parse(input);
    return tx(a, async c => {
      if (await activeTerminal(c, a.tenantId)) fail('Avval faol terminalni bekor qiling', 409);
      const token = newCode(), expiresAt = expiry(clock(), 10);
      await c.query(`INSERT INTO workforce_face_pairing(tenant_id,code_hash,label,expires_at) VALUES($1,$2,$3,$4)
        ON CONFLICT(tenant_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,label=EXCLUDED.label,expires_at=EXCLUDED.expires_at,terminal_id=NULL`,
      [a.tenantId, hash(token), label, expiresAt]);
      await log(c, a, 'face_terminal', a.tenantId, 'pairing_issued', { label });
      return { code: token, expiresAt };
    });
  }

  async function pair(input: unknown) {
    const d = pairInput.parse(input), digest = hash(d.code);
    const client = await pool.connect();
    let row;
    try {
      row = (await client.query('SELECT tenant_id FROM workforce_face_pairing WHERE code_hash=$1 AND expires_at>$2', [digest, clock()])).rows[0];
    } finally { client.release(); }
    if (!row || !(await tenantAllowed(row.tenant_id))) fail('Ulash kodi eskirgan yoki noto‘g‘ri', 403);
    const a = { tenantId: row.tenant_id, userId: 'face-pairing', role: 'terminal' };
    return tx(a, async c => {
      const now = clock();
      const pending = (await c.query('SELECT * FROM workforce_face_pairing WHERE tenant_id=$1 AND code_hash=$2 AND expires_at>$3', [a.tenantId, digest, now])).rows[0];
      if (!pending) fail('Ulash kodi eskirgan yoki noto‘g‘ri', 403);
      if (pending.terminal_id) {
        const paired = (await c.query('SELECT id FROM workforce_face_terminals WHERE id=$1 AND tenant_id=$2 AND public_key=$3 AND revoked_at IS NULL', [pending.terminal_id, a.tenantId, d.publicKey])).rows[0];
        if (paired) return { terminalId: paired.id };
        fail('Ulash kodi ishlatilgan', 409);
      }
      if (await activeTerminal(c, a.tenantId)) fail('Markazda faol terminal bor', 409);
      const id = randomUUID();
      await c.query('INSERT INTO workforce_face_terminals(id,tenant_id,label,public_key,paired_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$5)', [id, a.tenantId, pending.label, d.publicKey, now]);
      await c.query('UPDATE workforce_face_pairing SET terminal_id=$2 WHERE tenant_id=$1', [a.tenantId, id]);
      await log(c, a, 'face_terminal', id, 'paired', { label: pending.label });
      return { terminalId: id };
    });
  }

  async function revokeTerminal(a: WorkforceActor, input: unknown) {
    admin(a);
    const { terminalId } = z.object({ terminalId: uuid }).strict().parse(input);
    return tx(a, async c => {
      const now = clock();
      const revoked = (await c.query('UPDATE workforce_face_terminals SET revoked_at=$3 WHERE tenant_id=$1 AND id=$2 AND revoked_at IS NULL RETURNING id', [a.tenantId, terminalId, now])).rows[0];
      if (!revoked) fail('Faol terminal topilmadi', 404);
      await c.query('DELETE FROM workforce_face_pairing WHERE tenant_id=$1', [a.tenantId]);
      await c.query('UPDATE workforce_face_enrollments SET revoked_at=$3,code_hash=NULL WHERE tenant_id=$1 AND terminal_id=$2 AND revoked_at IS NULL', [a.tenantId, terminalId, now]);
      await c.query("UPDATE workforce_settings SET enabled=FALSE,trial_mode=TRUE WHERE tenant_id=$1 AND attendance_method='face'", [a.tenantId]);
      await log(c, a, 'face_terminal', terminalId, 'revoked');
      return { success: true };
    });
  }

  async function enrollmentForTeacher(c: any, a: WorkforceActor, id: string) {
    return (await c.query(`SELECT terminal_id,enrolled_at,revoked_at,expires_at,self_enrollment_blocked
      FROM workforce_face_enrollments WHERE tenant_id=$1 AND teacher_id=$2`, [a.tenantId, id])).rows[0];
  }

  async function selfStatus(a: WorkforceActor) {
    teacher(a);
    return tx(a, async c => {
      await validTeacher(c, a, a.userId);
      const terminal = await activeTerminal(c, a.tenantId);
      const row = await enrollmentForTeacher(c, a, a.userId);
      const state = row?.self_enrollment_blocked ? 'blocked'
        : !terminal || !row || row.revoked_at || row.terminal_id !== terminal.id ? 'none'
        : row.enrolled_at ? 'active'
        : +new Date(row.expires_at) > +clock() ? 'pending' : 'none';
      return { terminalReady: Boolean(terminal), status: state, expiresAt: state === 'pending' ? row.expires_at : null };
    });
  }

  async function createEnrollment(c: any, a: WorkforceActor, id: string, consentRef: string, selfConsentVersion: string | null) {
    const terminal = await activeTerminal(c, a.tenantId);
    if (!terminal) fail('Avval markaz terminali ulanishi kerak');
    const current = await enrollmentForTeacher(c, a, id);
    if (current?.enrolled_at && !current.revoked_at && current.terminal_id === terminal.id) {
      fail('Yuzingiz allaqachon ro‘yxatdan o‘tgan', 409);
    }
    if (selfConsentVersion && current?.self_enrollment_blocked) fail('Qayta ro‘yxatdan o‘tish uchun administratorga murojaat qiling', 403);

    const token = newCode(), now = clock(), expiresAt = expiry(now, 10), enrollmentId = randomUUID();
    await c.query(`INSERT INTO workforce_face_enrollments(tenant_id,teacher_id,terminal_id,id,consent_ref,code_hash,expires_at,self_consent_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(tenant_id,teacher_id) DO UPDATE SET terminal_id=EXCLUDED.terminal_id,id=EXCLUDED.id,
        consent_ref=EXCLUDED.consent_ref,code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,enrolled_at=NULL,
        revoked_at=NULL,self_consent_version=EXCLUDED.self_consent_version,self_enrollment_blocked=FALSE`,
    [a.tenantId, id, terminal.id, enrollmentId, consentRef, hash(token), expiresAt, selfConsentVersion]);
    const detail = selfConsentVersion
      ? { terminalId: terminal.id, consentVersion: selfConsentVersion, acceptedAt: now.toISOString(), notice: faceConsent.notice, acceptance: faceConsent.acceptance }
      : { terminalId: terminal.id, consentRef };
    await log(c, a, 'face_enrollment', enrollmentId, selfConsentVersion ? 'self_issued' : 'issued', detail, id);
    return { code: token, expiresAt };
  }

  async function issueEnrollment(a: WorkforceActor, input: unknown) {
    admin(a);
    const d = z.object({ teacherId, consentRef: z.string().trim().min(3).max(200) }).strict().parse(input);
    return tx(a, async c => {
      await validTeacher(c, a, d.teacherId);
      return createEnrollment(c, a, d.teacherId, d.consentRef, null);
    });
  }

  async function issueSelfEnrollment(a: WorkforceActor, input: unknown) {
    teacher(a);
    z.object({ consent: z.literal(true), consentVersion: z.literal(faceConsent.version) }).strict().parse(input);
    return tx(a, async c => {
      await validTeacher(c, a, a.userId);
      const settings = await setup(c, a);
      if (settings.attendance_method !== 'face') fail('Markaz Face ID usuliga hali o‘tmagan', 409);
      return createEnrollment(c, a, a.userId, faceConsent.version, faceConsent.version);
    });
  }

  async function revoke(c: any, a: WorkforceActor, id: string, blocked: boolean) {
    const revoked = (await c.query(`UPDATE workforce_face_enrollments SET revoked_at=$3,code_hash=NULL,self_enrollment_blocked=$4
      WHERE tenant_id=$1 AND teacher_id=$2 AND revoked_at IS NULL RETURNING id`, [a.tenantId, id, clock(), blocked])).rows[0];
    if (!revoked) fail('Faol Face ID ro‘yxati topilmadi', 404);
    await log(c, a, 'face_enrollment', revoked.id, blocked ? 'revoked' : 'consent_withdrawn', {}, id);
    return { success: true };
  }

  async function revokeEnrollment(a: WorkforceActor, input: unknown) {
    admin(a);
    const { teacherId: id } = z.object({ teacherId }).strict().parse(input);
    return tx(a, c => revoke(c, a, id, true));
  }

  async function withdrawSelfEnrollment(a: WorkforceActor, input: unknown) {
    teacher(a);
    z.object({}).strict().parse(input);
    return tx(a, async c => {
      await validTeacher(c, a, a.userId);
      return revoke(c, a, a.userId, false);
    });
  }

  async function enrollmentByCode(c: any, a: WorkforceActor, terminalId: string, token: string, now: Date) {
    const row = (await c.query(`SELECT e.id AS "enrollmentId",e.teacher_id AS "teacherId",u.first_name||' '||u.last_name AS name,
      e.self_consent_version IS NOT NULL AS "selfEnrollment"
      FROM workforce_face_enrollments e JOIN users u ON u.id=e.teacher_id AND u.tenant_id=e.tenant_id
      WHERE e.tenant_id=$1 AND e.terminal_id=$2 AND e.code_hash=$3 AND e.expires_at>$4
        AND e.enrolled_at IS NULL AND e.revoked_at IS NULL AND u.role='teacher' AND u.archived_at IS NULL`, [a.tenantId, terminalId, hash(token), now])).rows[0];
    if (!row) fail('Ro‘yxatdan o‘tish kodi eskirgan yoki noto‘g‘ri', 403);
    return row;
  }

  async function signed(operation: unknown, input: unknown) {
    const op = operationInput.parse(operation), e = envelopeInput.parse(input);
    const now = clock();
    if (Math.abs(+now - e.timestamp) > 120_000) fail('Terminal soati CRM bilan mos emas', 401);
    const message = ['workforce-face-v1', op, e.terminalId, e.timestamp, e.requestId, e.payload].join('\n');
    const client = await pool.connect();
    let terminal;
    try {
      terminal = (await client.query('SELECT tenant_id,public_key,revoked_at FROM workforce_face_terminals WHERE id=$1', [e.terminalId])).rows[0];
    } finally { client.release(); }
    if (!terminal) fail('Terminal tanilmadi', 401);
    const publicKey = createPublicKey({ key: Buffer.from('302a300506032b6570032100' + terminal.public_key, 'hex'), format: 'der', type: 'spki' });
    if (!verify(null, Buffer.from(message), publicKey, Buffer.from(e.signature, 'base64url'))) fail('Terminal imzosi noto‘g‘ri', 401);
    if (terminal.revoked_at) fail('Terminal bekor qilingan', 410);
    if (!(await tenantAllowed(terminal.tenant_id))) fail('Markaz obunasi faol emas', 403);

    const payload = Buffer.from(e.payload, 'base64url');
    if (payload.toString('base64url') !== e.payload) fail('Terminal so‘rovi noto‘g‘ri');
    let data: unknown;
    try { data = JSON.parse(payload.toString('utf8')); } catch { fail('Terminal so‘rovi noto‘g‘ri'); }
    const a = { tenantId: terminal.tenant_id, userId: `face-terminal:${e.terminalId}`, role: 'terminal' };
    return tx(a, async c => {
      const active = await activeTerminal(c, a.tenantId);
      if (active?.id !== e.terminalId) fail('Terminal bekor qilingan', 410);
      await c.query('UPDATE workforce_face_terminals SET last_seen_at=GREATEST(last_seen_at,$2) WHERE id=$1', [e.terminalId, now]);
      if (op === 'roster') {
        operations.roster.parse(data);
        const { rows } = await c.query(`SELECT e.id AS "enrollmentId",e.teacher_id AS "teacherId",
          u.first_name||' '||u.last_name AS name,e.enrolled_at IS NOT NULL AS active
          FROM workforce_face_enrollments e JOIN users u ON u.id=e.teacher_id AND u.tenant_id=e.tenant_id
          WHERE e.tenant_id=$1 AND e.terminal_id=$2 AND e.revoked_at IS NULL AND (e.enrolled_at IS NOT NULL OR e.expires_at>$3)
            AND u.role='teacher' AND u.archived_at IS NULL ORDER BY name,u.id`, [a.tenantId, e.terminalId, now]);
        const settings = await setup(c, a);
        return { enabled: settings.attendance_method === 'face' && settings.enabled, enrollments: rows };
      }
      if (op === 'enrollment-lookup') {
        const d = operations[op].parse(data);
        return enrollmentByCode(c, a, e.terminalId, d.code, now);
      }

      // Retain receipts beyond the signature window, including requests retried after a lost response.
      await c.query('DELETE FROM workforce_face_receipts WHERE expires_at<$1', [now]);
      const digest = hash(message);
      const receipt = (await c.query('SELECT digest,response FROM workforce_face_receipts WHERE terminal_id=$1 AND request_id=$2', [e.terminalId, e.requestId])).rows[0];
      if (receipt) {
        if (receipt.digest !== digest) fail('So‘rov identifikatori ishlatilgan', 409);
        return receipt.response;
      }
      let result: unknown;
      if (op === 'enrollment-confirm') {
        const d = operations[op].parse(data), enrollment = await enrollmentByCode(c, a, e.terminalId, d.code, now);
        if (enrollment.enrollmentId !== d.enrollmentId) fail('Ro‘yxatdan o‘tish so‘rovi mos kelmadi', 403);
        await c.query('UPDATE workforce_face_enrollments SET enrolled_at=$2,code_hash=NULL WHERE id=$1', [d.enrollmentId, now]);
        await log(c, a, 'face_enrollment', d.enrollmentId, 'confirmed', { terminalId: e.terminalId }, enrollment.teacherId);
        result = { success: true };
      } else {
        const d = operations[op].parse(data);
        await validTeacher(c, a, d.teacherId);
        const enrolled = (await c.query(`SELECT 1 FROM workforce_face_enrollments WHERE tenant_id=$1 AND teacher_id=$2 AND terminal_id=$3 AND id=$4
          AND enrolled_at IS NOT NULL AND revoked_at IS NULL`, [a.tenantId, d.teacherId, e.terminalId, d.enrollmentId])).rows[0];
        if (!enrolled) fail('O‘qituvchining Face ID ro‘yxati faol emas', 403);
        const s = await setup(c, a);
        if (s.attendance_method !== 'face' || !s.enabled) fail('Face ID davomat hali yoqilmagan');
        const teacher = { ...a, userId: d.teacherId };
        result = op === 'issue'
          ? await reportFaceIssue(c, teacher, d.action, operations.issue.parse(data).reason, now, e.terminalId)
          : await recordAttendance(c, teacher, d.action, now, s, { terminalId: e.terminalId, method: 'face' }, a.userId);
      }
      await c.query('INSERT INTO workforce_face_receipts(terminal_id,request_id,digest,response,expires_at) VALUES($1,$2,$3,$4,$5)',
        [e.terminalId, e.requestId, digest, JSON.stringify(result), expiry(now, 5)]);
      return result;
    });
  }

  return { isReady, status, issuePairing, pair, revokeTerminal, issueEnrollment, revokeEnrollment, selfStatus, issueSelfEnrollment, withdrawSelfEnrollment, signed };
}
