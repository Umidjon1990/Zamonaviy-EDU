import type { Pool } from "pg";

// Additive, repeatable migration. Existing monetary balances are never rewritten.
export const financeMigration = `
ALTER TABLE payments ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_period TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS teacher_percent INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS source_collected_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE teacher_collected_payments ADD COLUMN IF NOT EXISTS payment_id INTEGER;
ALTER TABLE teacher_collected_payments ADD COLUMN IF NOT EXISTS payment_period TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS payments_collected_source_unique
  ON payments (tenant_id, source_collected_id) WHERE source_collected_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_tenant_created ON payments (tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS finance_requests (
  tenant_id INTEGER NOT NULL, request_key TEXT NOT NULL, actor_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL, result JSONB NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, request_key)
);
CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, payment_id INTEGER,
  action TEXT NOT NULL, actor_id TEXT NOT NULL, before_value JSONB, after_value JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_notifications (
  id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, payment_id INTEGER,
  event_key TEXT NOT NULL UNIQUE, channel TEXT NOT NULL, recipient_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL, payload JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, provider_id TEXT,
  next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(), locked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), sent_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payment_notifications_queue ON payment_notifications(status, next_attempt_at);
CREATE TABLE IF NOT EXISTS telegram_verified_links (
  kind TEXT NOT NULL, entity_id TEXT NOT NULL, chat_id TEXT NOT NULL,
  verified_at TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY(kind, entity_id)
);
`;

export async function migrateFinance(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(707, 0)");
    await c.query(financeMigration);
    // Stop retaining recoverable passwords; bcrypt hashes and existing logins stay valid.
    await c.query("UPDATE users SET plain_password = NULL WHERE plain_password IS NOT NULL");
    // Previous bindings did not prove phone ownership. Preserve verified bindings only.
    await c.query("UPDATE users u SET telegram_chat_id=NULL WHERE telegram_chat_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM telegram_verified_links l WHERE l.kind='user' AND l.entity_id=u.id AND l.chat_id=u.telegram_chat_id)");
    await c.query("UPDATE students s SET telegram_chat_id=NULL WHERE telegram_chat_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM telegram_verified_links l WHERE l.kind='student' AND l.entity_id=s.id::text AND l.chat_id=s.telegram_chat_id)");
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
