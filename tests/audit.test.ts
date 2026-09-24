import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {auditMigration} from '../server/audit-migration';
import {financeMigration} from '../server/finance-migration';
import {createDomainService} from '../server/domain-service';
import {billingMigration,createBillingService} from '../server/billing-service';
import {createPaymentService} from '../server/payment-service';
import {studentInput,groupInput,gradeInput,monthBounds,uzDate,parseClassTime} from '../shared/domain';

test('audit migrations and transactional regressions',async t=>{
 const db=new PGlite();
 await db.exec(`
 CREATE TABLE tenants(id SERIAL PRIMARY KEY,status TEXT,sms_enabled BOOLEAN,sms_credits INT);
 CREATE TABLE users(id TEXT PRIMARY KEY,tenant_id INT,role TEXT,first_name TEXT,last_name TEXT,salary_percent INT,permissions TEXT[],telegram_chat_id TEXT,plain_password TEXT,password TEXT,phone TEXT);
 CREATE TABLE students(id SERIAL PRIMARY KEY,tenant_id INT,first_name TEXT,last_name TEXT,phone TEXT,parent_phone TEXT,status TEXT,balance INT NOT NULL DEFAULT 0,telegram_chat_id TEXT,updated_at TIMESTAMP DEFAULT NOW());
 CREATE TABLE groups(id SERIAL PRIMARY KEY,tenant_id INT,teacher_id TEXT,name TEXT,max_students INT DEFAULT 15);
 CREATE TABLE student_groups(id SERIAL PRIMARY KEY,student_id INT,group_id INT);
 CREATE TABLE payments(id SERIAL PRIMARY KEY,tenant_id INT,student_id INT,teacher_id TEXT,amount INT NOT NULL,teacher_earning INT,payment_type TEXT,status TEXT,notes TEXT,student_name TEXT,created_at TIMESTAMP DEFAULT NOW());
 CREATE TABLE teacher_collected_payments(id SERIAL PRIMARY KEY,tenant_id INT,teacher_id TEXT,teacher_name TEXT,student_id INT,student_name TEXT,group_id INT,group_name TEXT,amount INT,payment_type TEXT,notes TEXT,status TEXT,confirmed_by TEXT,confirmed_at TIMESTAMP,rejected_by TEXT,rejected_at TIMESTAMP,rejection_reason TEXT,created_at TIMESTAMP DEFAULT NOW());
 CREATE TABLE attendance(id SERIAL PRIMARY KEY,tenant_id INT,student_id INT,group_id INT,date TIMESTAMP,status TEXT,notes TEXT);
 CREATE TABLE grades(id SERIAL PRIMARY KEY,tenant_id INT,student_id INT,group_id INT,date TIMESTAMP,grade INT,topic TEXT,notes TEXT);
 CREATE TABLE cash_receipts(id SERIAL PRIMARY KEY,tenant_id INT,amount INT,submitted_by TEXT,note TEXT,payment_type TEXT,status TEXT,accepted_by TEXT,accepted_at TIMESTAMP,rejected_by TEXT,rejected_at TIMESTAMP,rejection_reason TEXT,updated_at TIMESTAMP DEFAULT NOW());
 CREATE TABLE cash_receipt_logs(id SERIAL PRIMARY KEY,cash_receipt_id INT,action TEXT,old_status TEXT,new_status TEXT,acted_by TEXT,note TEXT);
 `);
 await db.exec(financeMigration);await db.exec(auditMigration);await db.exec(billingMigration);await db.exec(auditMigration);await db.exec(billingMigration);
 let tail=Promise.resolve();const pool:any={connect:async()=>{let release!:()=>void;const before=tail;tail=new Promise<void>(r=>release=r);await before;return {query:(s:string,v?:any[])=>db.query(s,v),release};}};
 const domain=createDomainService(pool),billing=createBillingService(pool),finance=createPaymentService(pool);
 const admin={tenantId:1,userId:'admin',role:'markaz_admin'},teacher={...admin,userId:'teacher',role:'teacher'},manager={...admin,userId:'manager',role:'manager'};
 const key=(s:string)=>'audit-request-'+s;
 await db.exec(`INSERT INTO tenants VALUES(1,'active',true,1,false,false);INSERT INTO users(id,tenant_id,role,first_name,last_name,salary_percent,permissions,password,phone) VALUES('admin',1,'markaz_admin','Test','Admin',0,'{}','hash','998900000000'),('teacher',1,'teacher','Test','Teacher',60,'{accept_payment}','hash','998900000001'),('other',2,'teacher','Other','Tenant',50,'{}','hash','998900000002');
 INSERT INTO students(tenant_id,first_name,last_name,phone,parent_phone,status) VALUES(1,'Test','Student','998900000003','','active'),(1,'Second','Student','998900000004','','active'),(2,'Foreign','Student','998900000005','','active');
 INSERT INTO groups(tenant_id,teacher_id,name,max_students) VALUES(1,'teacher','First',2),(1,'teacher','Second',1),(2,'other','Foreign',10);INSERT INTO student_groups(student_id,group_id) VALUES(1,1),(2,1),(2,2);`);
 await t.test('cash retry is one receipt and opposing concurrent decisions cannot both succeed',async()=>{
  const body={amount:250000,paymentType:'cash',note:'Test'};const [a,b]=await Promise.all([domain.cashCreate(admin,key('cash'),body),domain.cashCreate(admin,key('cash'),body)]);assert.equal(a.id,b.id);
  await assert.rejects(domain.cashCreate(admin,key('cash'),{...body,amount:5}),/boshqa/);
  const results=await Promise.allSettled([domain.cashDecide(manager,a.id,'accepted'),domain.cashDecide(manager,a.id,'rejected')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await db.query<any>('SELECT COUNT(*) AS n FROM cash_receipt_logs')).rows[0].n,2);
  await assert.rejects(domain.cashDecide(teacher,a.id,'accepted'),/rahbar/);
 });
 await t.test('failed destination insertion rolls back membership and audit',async()=>{
  await assert.rejects(domain.move(teacher,1,1,2),/sig‘imi/);
  assert.equal((await db.query('SELECT 1 FROM student_groups WHERE student_id=1 AND group_id=1')).rows.length,1);
  assert.equal((await db.query("SELECT 1 FROM domain_audit_logs WHERE action='student_moved'")).rows.length,0);
  await db.exec('UPDATE groups SET max_students=2 WHERE id=2');await domain.move(teacher,1,1,2);
  assert.equal((await db.query('SELECT 1 FROM student_groups WHERE student_id=1 AND group_id=1')).rows.length,0);
 });
 await t.test('foreign memberships and duplicate or invalid class records are blocked by database',async()=>{
  await assert.rejects(db.query('INSERT INTO student_groups(student_id,group_id) VALUES(3,2)'),/mos emas/);
  await assert.rejects(db.query('INSERT INTO student_groups(student_id,group_id) VALUES(1,2)'),/allaqachon/);
  await assert.rejects(domain.classRecord(teacher,'grades',{studentId:3,groupId:2,date:'2026-09-23',grade:5}),/tegishli/);
  await assert.rejects(domain.classRecord(teacher,'grades',{studentId:1,groupId:2,date:'2026-09-23',grade:999}));
 });
 await t.test('parallel attendance changes are one row and durable recipient jobs, latest state wins',async()=>{
  const base={studentId:1,groupId:2,date:'2026-09-23'};
  await Promise.all([domain.classRecord(teacher,'attendance',{...base,status:'present'}),domain.classRecord(teacher,'attendance',{...base,status:'late'})]);
  const rows=(await db.query<any>('SELECT * FROM attendance')).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'late');
  assert.equal((await db.query("SELECT * FROM payment_notifications WHERE payload->>'kind'='attendance'")).rows.length,2);
  await assert.rejects(db.query("INSERT INTO attendance(tenant_id,student_id,group_id,date,status) VALUES(1,1,2,'2026-09-23','present')"),/takrorlangan/);
 });
 await t.test('cancellation and collection rejection reach admin, teacher and student',async()=>{
  const p=await finance.create(admin,key('payment'),{studentId:1,teacherId:'teacher',groupId:2,amount:100000});await finance.remove(admin,p.id);
  const jobs=(await db.query<any>("SELECT recipient_id FROM payment_notifications WHERE event_key LIKE $1",[`payment:${p.id}:deleted:%`])).rows.map(j=>j.recipient_id).sort();assert.deepEqual(jobs,['1','admin','teacher']);
  const collection=await finance.collect(teacher,key('collection'),{studentId:1,groupId:2,amount:10});await finance.decide(admin,collection.id,'reject','Test rejection');
  assert.equal((await db.query("SELECT 1 FROM payment_notifications WHERE event_key LIKE $1",[`collection:${collection.id}:rejected:%`])).rows.length,3);
 });
 await t.test('tuition charge is idempotent, duplicate period rejected and cancellation reverses once',async()=>{
  const body={studentId:1,groupId:2,period:'2026-09',amount:300000,reason:'September tariff'};
  const charge=await billing.create(admin,key('tuition'),body);await billing.create(admin,key('tuition'),body);
  assert.equal((await db.query<any>('SELECT balance FROM students WHERE id=1')).rows[0].balance,-300000);
  await assert.rejects(billing.create(admin,key('tuition-other'),body),/yozilgan/);
  await billing.void(admin,charge.id,'Wrong tariff');await billing.void(admin,charge.id,'Wrong tariff');
  assert.equal((await db.query<any>('SELECT balance FROM students WHERE id=1')).rows[0].balance,0);
 });
 await t.test('historical reconciliation preserves all amounts and stores evidence',async()=>{
  const p=await finance.create(admin,key('reconcile'),{studentId:1,teacherId:'teacher',groupId:2,amount:100000});
  const r=await billing.reconcile(admin,p.id,{groupId:1,paymentPeriod:'2026-08',reason:'Historical receipt #5'});assert.equal(r.amount,100000);assert.equal(r.teacher_earning,60000);assert.equal(r.group_id,1);
  assert.equal((await db.query<any>('SELECT balance FROM students WHERE id=1')).rows[0].balance,100000);
  await assert.rejects(billing.reconcile(admin,p.id,{groupId:3,paymentPeriod:'2026-08',reason:'Historical receipt'}),/mos emas/);
 });
 await t.test('password change revokes sessions and phone change revokes verified contact',async()=>{
  await db.exec("INSERT INTO telegram_verified_links(kind,entity_id,chat_id) VALUES('user','teacher','1');UPDATE users SET password='newhash' WHERE id='teacher'");
  assert.equal((await db.query<any>("SELECT auth_version FROM users WHERE id='teacher'")).rows[0].auth_version,1);
  await db.exec("UPDATE users SET phone='998900000006' WHERE id='teacher'");assert.equal((await db.query("SELECT 1 FROM telegram_verified_links WHERE entity_id='teacher'")).rows.length,0);
 });
 await t.test('archiving student preserves history and refuses new payments',async()=>{
  await db.exec('UPDATE students SET archived_at=NOW() WHERE id=1');
  assert.ok((await db.query('SELECT 1 FROM payments WHERE student_id=1')).rows.length>0);
  await assert.rejects(finance.create(admin,key('archived'),{studentId:1,teacherId:'teacher',groupId:2,amount:100000}),/topilmadi/);
 });
 await db.close();
});

test('strict public inputs, precise times and Tashkent month boundaries',()=>{
 assert.equal(studentInput.safeParse({firstName:'Test',lastName:'Student',balance:999}).success,false);
 assert.equal(studentInput.partial().safeParse({tenantId:2}).success,false);
 assert.equal(groupInput.partial().safeParse({tenantId:2}).success,false);
 assert.equal(gradeInput.safeParse({studentId:1,groupId:1,date:'2026-09-24',grade:999}).success,false);
 assert.deepEqual(parseClassTime('07:30 - 09:00'),{start:450,end:540});assert.equal(parseClassTime('25:00'),null);
 const b=monthBounds(2026,10);assert.equal(b.startDate.toISOString(),'2026-09-30T19:00:00.000Z');assert.equal(uzDate('2026-09-30T20:00:00Z'),'2026-10-01');
});
