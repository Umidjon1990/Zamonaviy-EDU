import { PGlite } from '@electric-sql/pglite';
import { workforceMigration } from '../server/workforce-migration';
export async function workforceFixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,tenant_id INT,role TEXT,first_name TEXT,last_name TEXT,archived_at TIMESTAMP);
    CREATE TABLE groups(id SERIAL PRIMARY KEY,tenant_id INT,name TEXT,teacher_id TEXT,days TEXT[],time TEXT,room TEXT,archived_at TIMESTAMP,created_at TIMESTAMP DEFAULT '2026-10-01');
    CREATE TABLE payments(id SERIAL PRIMARY KEY,tenant_id INT,teacher_id TEXT,amount INT,teacher_earning INT,status TEXT,deleted_at TIMESTAMP,created_at TIMESTAMP);
    CREATE TABLE expenses(id SERIAL PRIMARY KEY,tenant_id INT,teacher_id TEXT,amount INT,category TEXT,date TIMESTAMP);`);
  await db.exec(workforceMigration); await db.exec(workforceMigration);
  let tail = Promise.resolve();
  const pool: any = { connect: async () => { let release!: () => void; const previous = tail; tail = new Promise<void>(r => release = r); await previous; return { query: (s: string, p?: any[]) => db.query(s, p), release }; } };
  const reset = async () => { await db.exec(`TRUNCATE workforce_events,workforce_credits,workforce_deductions,workforce_payroll,workforce_fines,workforce_fine_types,workforce_devices,workforce_days,workforce_lessons,workforce_schedule_versions,workforce_settings,groups,users,payments,expenses RESTART IDENTITY;
    INSERT INTO users VALUES('admin',1,'markaz_admin','Test','Admin',NULL),('t1',1,'teacher','Anvar','Ustoz',NULL),('t2',1,'teacher','Dilnoza','Ustoz',NULL),('foreign',2,'teacher','Other','Center',NULL);
    INSERT INTO groups(tenant_id,name,teacher_id,days,time,room) VALUES(1,'A1','t1',ARRAY['Du','Chor','Ju'],'09:00 - 10:30','101'),(1,'A2','t1',ARRAY['Du'],'12:00 - 13:30','102'),(1,'B1','t2',ARRAY['Du'],'10:00 - 11:30','103'),(2,'Foreign','foreign',ARRAY['Du'],'09:00 - 11:00','101');
    INSERT INTO payments(tenant_id,teacher_id,amount,teacher_earning,status,created_at) VALUES(1,'t1',4000000,2000000,'completed','2026-11-02 09:00'),(1,'t1',400000,200000,'pending','2026-11-02 09:00'),(2,'foreign',3000000,1000000,'completed','2026-11-02 09:00');
    INSERT INTO expenses(tenant_id,teacher_id,amount,category,date) VALUES(1,'t1',500000,'salary','2026-11-02 10:00'),(1,'t1',200000,'other','2026-11-02 10:00');`); };
  await reset(); return { db, pool, reset };
}
