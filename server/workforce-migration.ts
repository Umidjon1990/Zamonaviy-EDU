export const workforceMigration = `
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payroll_period TEXT;
CREATE TABLE IF NOT EXISTS workforce_settings (
 tenant_id INTEGER PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE, trial_mode BOOLEAN NOT NULL DEFAULT TRUE,
 latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, radius_m INTEGER NOT NULL DEFAULT 50 CHECK(radius_m=50),
 grace_minutes INTEGER NOT NULL DEFAULT 5, early_minutes INTEGER NOT NULL DEFAULT 30,
 started_on DATE, reconciled_through DATE, qr_secret TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workforce_settings ADD COLUMN IF NOT EXISTS attendance_method TEXT NOT NULL DEFAULT 'qr'
 CHECK(attendance_method IN ('qr','face'));
ALTER TABLE workforce_settings ALTER COLUMN attendance_method SET DEFAULT 'face';
CREATE TABLE IF NOT EXISTS workforce_face_terminals (
 id UUID PRIMARY KEY, tenant_id INTEGER NOT NULL, label TEXT NOT NULL, public_key TEXT NOT NULL,
 paired_at TIMESTAMPTZ NOT NULL, last_seen_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_terminal ON workforce_face_terminals(tenant_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS workforce_face_pairing (
 tenant_id INTEGER PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL, terminal_id UUID
);
CREATE TABLE IF NOT EXISTS workforce_face_enrollments (
 tenant_id INTEGER NOT NULL, teacher_id TEXT NOT NULL, terminal_id UUID NOT NULL,
 id UUID NOT NULL UNIQUE, consent_ref TEXT NOT NULL, code_hash TEXT UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL, enrolled_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
 PRIMARY KEY(tenant_id,teacher_id)
);
ALTER TABLE workforce_face_enrollments ADD COLUMN IF NOT EXISTS self_consent_version TEXT;
ALTER TABLE workforce_face_enrollments ADD COLUMN IF NOT EXISTS self_enrollment_blocked BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS workforce_face_enrollment_qr (
 terminal_id UUID PRIMARY KEY, tenant_id INTEGER NOT NULL, code_hash TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL, enrollment_id UUID
);
CREATE TABLE IF NOT EXISTS workforce_face_receipts (
 terminal_id UUID NOT NULL, request_id UUID NOT NULL, digest TEXT NOT NULL,
 response JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(terminal_id,request_id)
);
CREATE INDEX IF NOT EXISTS workforce_face_receipt_expiry ON workforce_face_receipts(expires_at);
CREATE TABLE IF NOT EXISTS workforce_devices (
 id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, teacher_id TEXT NOT NULL, secret_hash TEXT NOT NULL,
 label TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','active','revoked')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_active_device ON workforce_devices(tenant_id,teacher_id) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_pending_device ON workforce_devices(tenant_id,teacher_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS workforce_schedule_versions (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, group_id INTEGER NOT NULL, teacher_id TEXT NOT NULL,
 room TEXT NOT NULL DEFAULT '', slots JSONB NOT NULL, effective_from DATE NOT NULL, created_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workforce_schedule_lookup ON workforce_schedule_versions(tenant_id,group_id,effective_from DESC,id DESC);
CREATE TABLE IF NOT EXISTS workforce_lessons (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, group_id INTEGER NOT NULL, group_name TEXT NOT NULL,
 teacher_id TEXT NOT NULL, work_date DATE NOT NULL, start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL,
 room TEXT NOT NULL DEFAULT '', slot_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
 note TEXT, version_id INTEGER, CHECK(end_at>start_at), UNIQUE(tenant_id,group_id,work_date,slot_key)
);
CREATE TABLE IF NOT EXISTS workforce_days (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, teacher_id TEXT NOT NULL, work_date DATE NOT NULL,
 expected_start TIMESTAMPTZ NOT NULL, expected_end TIMESTAMPTZ NOT NULL, check_in TIMESTAMPTZ, check_out TIMESTAMPTZ,
 late_minutes INTEGER NOT NULL DEFAULT 0, grace_minutes INTEGER NOT NULL DEFAULT 5, excused BOOLEAN NOT NULL DEFAULT FALSE, note TEXT,
 trial_mode BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(tenant_id,teacher_id,work_date)
);
ALTER TABLE workforce_days ADD COLUMN IF NOT EXISTS check_in_issue TEXT;
ALTER TABLE workforce_days ADD COLUMN IF NOT EXISTS check_out_issue TEXT;
CREATE TABLE IF NOT EXISTS workforce_events (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, teacher_id TEXT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 action TEXT NOT NULL, actor_id TEXT NOT NULL, detail JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workforce_fine_types (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, code TEXT, name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0),
 active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(tenant_id,code)
);
CREATE TABLE IF NOT EXISTS workforce_fines (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, teacher_id TEXT NOT NULL, type_id INTEGER NOT NULL,
 work_date DATE NOT NULL, name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0), source TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected','cancelled')),
 trial_mode BOOLEAN NOT NULL DEFAULT TRUE, request_key TEXT, note TEXT NOT NULL DEFAULT '', explanation TEXT NOT NULL DEFAULT '',
 explanation_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), disputed BOOLEAN NOT NULL DEFAULT FALSE,
 order_ref TEXT, acknowledgement TEXT, decision_note TEXT, approved_by TEXT, decided_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_auto_fine ON workforce_fines(tenant_id,teacher_id,work_date) WHERE source='automatic';
CREATE UNIQUE INDEX IF NOT EXISTS workforce_manual_request ON workforce_fines(tenant_id,request_key) WHERE request_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS workforce_payroll (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, teacher_id TEXT NOT NULL, month TEXT NOT NULL,
 gross INTEGER NOT NULL, paid INTEGER NOT NULL, credits INTEGER NOT NULL, fines INTEGER NOT NULL,
 other_deductions INTEGER NOT NULL DEFAULT 0, detail JSONB NOT NULL, closed_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(tenant_id,teacher_id,month)
);
CREATE TABLE IF NOT EXISTS workforce_deductions (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, teacher_id TEXT NOT NULL, fine_id INTEGER NOT NULL,
 payroll_id INTEGER NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), UNIQUE(payroll_id,fine_id)
);
CREATE TABLE IF NOT EXISTS workforce_credits (
 id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, teacher_id TEXT NOT NULL, fine_id INTEGER NOT NULL UNIQUE,
 amount INTEGER NOT NULL CHECK(amount>0), applied_payroll_id INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workforce_lesson_day ON workforce_lessons(tenant_id,work_date,teacher_id);
CREATE INDEX IF NOT EXISTS workforce_fine_teacher_date ON workforce_fines(tenant_id,teacher_id,work_date);
CREATE INDEX IF NOT EXISTS workforce_event_teacher ON workforce_events(tenant_id,teacher_id,id DESC);
`;
export async function migrateWorkforce(pool: any) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock(830,0)'); await c.query(workforceMigration); await c.query('COMMIT'); }
  catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
