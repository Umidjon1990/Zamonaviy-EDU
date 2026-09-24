import { billingMigration } from "./billing-service";
import type { Pool } from 'pg';
// Additive only. Existing balances, receipts, and duplicate historical records are preserved.
export const auditMigration=`
ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS attendance_sms_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketing_sms_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS domain_audit_logs(id SERIAL PRIMARY KEY,tenant_id INTEGER NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,details JSONB NOT NULL,created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS student_groups_lookup ON student_groups(group_id,student_id);
CREATE INDEX IF NOT EXISTS attendance_daily_lookup ON attendance(tenant_id,group_id,student_id,date);
CREATE INDEX IF NOT EXISTS grades_daily_lookup ON grades(tenant_id,group_id,student_id,date);
CREATE INDEX IF NOT EXISTS payment_audit_revision ON payment_audit_logs(tenant_id,id DESC);
CREATE OR REPLACE FUNCTION crm_user_credentials_changed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.password IS DISTINCT FROM OLD.password OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN NEW.auth_version=OLD.auth_version+1; END IF;
 IF NEW.phone IS DISTINCT FROM OLD.phone OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN NEW.telegram_chat_id=NULL;DELETE FROM telegram_verified_links WHERE kind='user' AND entity_id=OLD.id;END IF;
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS crm_user_credentials_changed ON users;
CREATE TRIGGER crm_user_credentials_changed BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION crm_user_credentials_changed();
CREATE OR REPLACE FUNCTION crm_student_contact_changed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.phone IS DISTINCT FROM OLD.phone OR NEW.parent_phone IS DISTINCT FROM OLD.parent_phone OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN NEW.telegram_chat_id=NULL;DELETE FROM telegram_verified_links WHERE kind='student' AND entity_id=OLD.id::text;END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS crm_student_contact_changed ON students;
CREATE TRIGGER crm_student_contact_changed BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION crm_student_contact_changed();
CREATE OR REPLACE FUNCTION crm_membership_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE g groups%ROWTYPE;s students%ROWTYPE;BEGIN
 SELECT * INTO g FROM groups WHERE id=NEW.group_id FOR UPDATE;
 SELECT * INTO s FROM students WHERE id=NEW.student_id;
 IF g.id IS NULL OR s.id IS NULL OR g.tenant_id<>s.tenant_id OR g.archived_at IS NOT NULL OR s.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Guruh va o‘quvchi mos emas'; END IF;
 IF EXISTS(SELECT 1 FROM student_groups WHERE group_id=NEW.group_id AND student_id=NEW.student_id AND id<>NEW.id) THEN RAISE EXCEPTION 'O‘quvchi allaqachon guruhda';END IF;
 IF (SELECT COUNT(*) FROM student_groups sg JOIN students st ON st.id=sg.student_id WHERE sg.group_id=NEW.group_id AND st.archived_at IS NULL AND sg.id<>NEW.id)>=g.max_students THEN RAISE EXCEPTION 'Guruh sig‘imi to‘lgan';END IF;
 RETURN NEW;END $$;
DROP TRIGGER IF EXISTS crm_membership_guard ON student_groups;
CREATE TRIGGER crm_membership_guard BEFORE INSERT OR UPDATE ON student_groups FOR EACH ROW EXECUTE FUNCTION crm_membership_guard();
CREATE OR REPLACE FUNCTION crm_class_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(709,NEW.tenant_id);
 IF NOT EXISTS(SELECT 1 FROM student_groups sg JOIN groups g ON g.id=sg.group_id JOIN students s ON s.id=sg.student_id WHERE sg.group_id=NEW.group_id AND sg.student_id=NEW.student_id AND s.tenant_id=NEW.tenant_id AND g.tenant_id=NEW.tenant_id AND s.archived_at IS NULL AND g.archived_at IS NULL) THEN RAISE EXCEPTION 'O‘quvchi guruhga tegishli emas';END IF;
 IF TG_TABLE_NAME='attendance' THEN
  IF NEW.status NOT IN ('present','absent','late') THEN RAISE EXCEPTION 'Noto‘g‘ri davomat holati';END IF;
  IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM attendance WHERE tenant_id=NEW.tenant_id AND student_id=NEW.student_id AND group_id=NEW.group_id AND date::date=NEW.date::date) THEN RAISE EXCEPTION 'Davomat takrorlangan';END IF;
 ELSE
  IF NEW.grade NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Baho 1–5 bo‘lsin';END IF;
  IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM grades WHERE tenant_id=NEW.tenant_id AND student_id=NEW.student_id AND group_id=NEW.group_id AND date::date=NEW.date::date) THEN RAISE EXCEPTION 'Baho takrorlangan';END IF;
 END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS crm_class_record_guard ON attendance;
CREATE TRIGGER crm_class_record_guard BEFORE INSERT OR UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION crm_class_record_guard();
DROP TRIGGER IF EXISTS crm_class_record_guard ON grades;
CREATE TRIGGER crm_class_record_guard BEFORE INSERT OR UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION crm_class_record_guard();
`;
export async function migrateAudit(pool:Pool){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(709,0)');await c.query(auditMigration);await c.query(billingMigration);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
