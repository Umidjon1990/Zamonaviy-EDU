export const workforceMigration = `
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payroll_period TEXT;
CREATE TABLE IF NOT EXISTS workforce_settings (
 tenant_id INTEGER PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE, trial_mode BOOLEAN NOT NULL DEFAULT TRUE,
 latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, radius_m INTEGER NOT NULL DEFAULT 50 CHECK(radius_m=50),
 grace_minutes INTEGER NOT NULL DEFAULT 5, early_minutes INTEGER NOT NULL DEFAULT 30,
 started_on DATE, reconciled_through DATE, qr_secret TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
