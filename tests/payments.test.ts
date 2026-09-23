import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentService } from '../server/payment-service';
import { financeMigration } from '../server/finance-migration';
import { ownsTelegramContact, publicJson } from '../server/security';
import { currentPaymentPeriod, paymentMatchesGroup } from '../shared/finance';
import { QueryClient } from '@tanstack/react-query';
import { invalidateFinance } from '../client/src/lib/finance';

test('payment transactions and security regression',async t=>{
  const db=new PGlite();
  await db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,tenant_id INT,role TEXT,first_name TEXT,last_name TEXT,salary_percent INT,permissions TEXT[],telegram_chat_id TEXT,plain_password TEXT);
    CREATE TABLE students(id SERIAL PRIMARY KEY,tenant_id INT,first_name TEXT,last_name TEXT,phone TEXT,parent_phone TEXT,status TEXT,balance INT NOT NULL DEFAULT 0,telegram_chat_id TEXT,updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE groups(id SERIAL PRIMARY KEY,tenant_id INT,teacher_id TEXT,name TEXT);
    CREATE TABLE student_groups(id SERIAL PRIMARY KEY,student_id INT,group_id INT);
    CREATE TABLE payments(id SERIAL PRIMARY KEY,tenant_id INT,student_id INT,teacher_id TEXT,amount INT NOT NULL,teacher_earning INT,payment_type TEXT,status TEXT,notes TEXT,student_name TEXT,created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE teacher_collected_payments(id SERIAL PRIMARY KEY,tenant_id INT,teacher_id TEXT,teacher_name TEXT,student_id INT,student_name TEXT,group_id INT,group_name TEXT,amount INT,payment_type TEXT,notes TEXT,status TEXT,confirmed_by TEXT,confirmed_at TIMESTAMP,rejected_by TEXT,rejected_at TIMESTAMP,rejection_reason TEXT,created_at TIMESTAMP DEFAULT NOW());
  `);
  await db.exec(financeMigration);await db.exec(financeMigration);
  // PGlite has one session: serialize transaction leases; SQL/rollback/constraints are real PostgreSQL.
  let tail=Promise.resolve();
  const pool:any={connect:async()=>{let release!:()=>void;const old=tail;tail=new Promise<void>(r=>release=r);await old;return {query:(sql:string,params?:any[])=>db.query(sql,params),release};}};
  const service=createPaymentService(pool);
  const actor={tenantId:1,userId:'admin',role:'markaz_admin'};
  const teacher={tenantId:1,userId:'teacher',role:'teacher'};
  const base={studentId:1,teacherId:'teacher',groupId:1,amount:250000,paymentType:'cash',status:'completed'};
  const balance=async()=>Number((await db.query<any>('SELECT balance FROM students WHERE id=1')).rows[0].balance);
  let sequence=0;const key=()=>`test-request-${++sequence}`.padEnd(20,'x');
  const reset=async()=>{
    await db.exec(`TRUNCATE payment_notifications,payment_audit_logs,finance_requests,payments,teacher_collected_payments,student_groups,groups,students,users RESTART IDENTITY;
      INSERT INTO users VALUES('admin',1,'markaz_admin','Test','Admin',0,'{}',NULL,NULL),('teacher',1,'teacher','Test','Teacher',60,'{accept_payment}',NULL,NULL),('other',1,'teacher','Other','Teacher',50,'{}',NULL,NULL),('foreign',2,'teacher','Other','Tenant',40,'{}',NULL,NULL);
      INSERT INTO students(tenant_id,first_name,last_name,phone,parent_phone,status) VALUES(1,'Test','Student','001','','active'),(2,'Other','Student','002','','active');
      INSERT INTO groups(tenant_id,teacher_id,name) VALUES(1,'teacher','Group A'),(1,'other','Group B');
      INSERT INTO student_groups(student_id,group_id) VALUES(1,1),(1,2);`);
  };
  await t.test('completed create atomically credits balance and teacher; targeted durable notifications',async()=>{
    await reset();const p=await service.create(actor,key(),base);assert.equal(await balance(),250000);assert.equal(p.teacherEarning,150000);assert.equal(p.groupId,1);
    const jobs=(await db.query<any>('SELECT recipient_id FROM payment_notifications')).rows.map(r=>r.recipient_id);assert.deepEqual(jobs.sort(),['1','admin','teacher']);
  });
  await t.test('all status transitions and edited amounts keep balances consistent',async()=>{
    await reset();const p=await service.create(actor,key(),{...base,status:'pending'});assert.equal(await balance(),0);
    await service.update(actor,p.id,{status:'completed'});assert.equal(await balance(),250000);
    await service.update(actor,p.id,{status:'cancelled',amount:300000});assert.equal(await balance(),0);
    await service.update(actor,p.id,{status:'completed'});assert.equal(await balance(),300000);
    await service.update(actor,p.id,{amount:400000});assert.equal(await balance(),400000);
    await service.remove(actor,p.id);await service.remove(actor,p.id);assert.equal(await balance(),0);
    assert.equal((await db.query<any>('SELECT COUNT(*) AS n FROM payments')).rows[0].n,1);
  });
  await t.test('historical earning percentage survives later teacher percentage changes',async()=>{
    await reset();const p=await service.create(actor,key(),base);await db.exec("UPDATE users SET salary_percent=80 WHERE id='teacher'");
    const changed=await service.update(actor,p.id,{amount:300000});assert.equal(changed.teacherEarning,180000);
  });
  await t.test('same idempotency key cannot double post or be used for different data',async()=>{
    await reset();const k=key();const [a,b]=await Promise.all([service.create(actor,k,base),service.create(actor,k,base)]);assert.equal(a.id,b.id);assert.equal(await balance(),250000);
    await assert.rejects(service.create(actor,k,{...base,amount:300000}),/boshqa operatsiya/);
  });
  await t.test('different concurrent payments add rather than overwrite balance',async()=>{
    await reset();await Promise.all([service.create(actor,key(),base),service.create(actor,key(),base)]);assert.equal(await balance(),500000);
  });
  await t.test('database write failure rolls back payment, audit, outbox and idempotency marker',async()=>{
    await reset();await db.exec(`CREATE FUNCTION fail_balance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$;
      CREATE TRIGGER fail_balance BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION fail_balance();`);
    const k=key();await assert.rejects(service.create(actor,k,base));
    for(const name of ['payments','payment_audit_logs','finance_requests','payment_notifications'])assert.equal((await db.query<any>(`SELECT COUNT(*) AS n FROM ${name}`)).rows[0].n,0);
    await db.exec('DROP TRIGGER fail_balance ON students; DROP FUNCTION fail_balance()');
    await service.create(actor,k,base);assert.equal(await balance(),250000);
  });
  await t.test('teacher collection is pending, confirmation is exactly one accounting operation',async()=>{
    await reset();const c=await service.collect(teacher,key(),{studentId:1,groupId:1,amount:'250000'});assert.equal(await balance(),0);
    const [a,b]=await Promise.all([service.decide(actor,c.id,'confirm'),service.decide(actor,c.id,'confirm')]);assert.equal(a.paymentId,b.paymentId);assert.equal(await balance(),250000);
    const p=(await db.query<any>('SELECT * FROM payments')).rows[0];assert.equal(p.teacher_id,'teacher');assert.equal(p.teacher_earning,150000);assert.equal(p.source_collected_id,c.id);
    await assert.rejects(service.decide(actor,c.id,'reject'),/ko‘rib chiqilgan/);
  });
  await t.test('receipt survives notes-only edit; changed amount supersedes unsent receipt',async()=>{
    await reset();const p=await service.create(actor,key(),{...base,sendSms:true});
    await service.update(actor,p.id,{notes:'Corrected note'});
    assert.equal((await db.query<any>("SELECT COUNT(*) AS n FROM payment_notifications WHERE channel='sms' AND status='pending'")).rows[0].n,1);
    await service.update(actor,p.id,{amount:300000});
    const jobs=(await db.query<any>("SELECT payload FROM payment_notifications WHERE channel='sms' AND status='pending'")).rows;
    assert.equal(jobs.length,1);assert.equal(jobs[0].payload.amount,300000);
  });
  await t.test('approval cancels stale pending alerts and missing student edits roll back',async()=>{
    await reset();const c=await service.collect(teacher,key(),{studentId:1,groupId:1,amount:250000});
    const result=await service.decide(actor,c.id,'confirm');
    assert.equal((await db.query<any>("SELECT COUNT(*) AS n FROM payment_notifications WHERE event_key LIKE 'collection:%' AND status='pending'")).rows[0].n,0);
    await db.exec('DELETE FROM students WHERE id=1');
    await assert.rejects(service.update(actor,result.paymentId,{amount:300000}),/o‘quvchisi topilmadi/);
    assert.equal((await db.query<any>('SELECT amount FROM payments WHERE id=$1',[result.paymentId])).rows[0].amount,250000);
    await assert.rejects(service.remove(actor,result.paymentId),/o‘quvchisi topilmadi/);
  });
  await t.test('teacher cannot mutate or approve official payments even with collection permission',async()=>{
    await reset();await assert.rejects(service.create(teacher,key(),base),/administrator/);await assert.rejects(service.update(teacher,1,{amount:100}),/administrator/);await assert.rejects(service.remove(teacher,1),/administrator/);await assert.rejects(service.decide(teacher,1,'confirm'),/administrator/);
  });
  await t.test('tenant ownership and group assignment are enforced',async()=>{
    await reset();await assert.rejects(service.create(actor,key(),{...base,studentId:2}),/topilmadi/);await assert.rejects(service.create(actor,key(),{...base,teacherId:'foreign'}),/topilmadi/);await assert.rejects(service.create(actor,key(),{...base,groupId:2}),/mos emas/);
    await assert.rejects(service.collect(teacher,key(),{studentId:1,groupId:2,amount:10}),/mos emas/);
    await assert.rejects(service.collect({...teacher,userId:'other'},key(),{studentId:1,groupId:2,amount:10}),/ruxsat/);
  });
  await t.test('negative, fractional, invalid status and oversized payments are rejected',async()=>{
    await reset();for(const amount of [-100,0,1.5,1_000_000_001])await assert.rejects(service.create(actor,key(),{...base,amount}));
    await assert.rejects(service.create(actor,key(),{...base,status:'anything'}));await assert.rejects(service.create(actor,undefined,base));
  });
  await t.test('new student and payment roll back together when teacher is invalid',async()=>{
    await reset();await assert.rejects(service.create(actor,key(),{newStudent:{firstName:'New',lastName:'Name'},teacherId:'missing',amount:500}));
    assert.equal((await db.query<any>('SELECT COUNT(*) AS n FROM students')).rows[0].n,2);
  });
  await t.test('group filter cannot mix two groups of the same teacher',()=>{
    const g={id:1,teacherId:'t'};assert.equal(paymentMatchesGroup({groupId:2,studentId:1,teacherId:'t'},g,new Map([[1,[1,2]]]),[1,2]),false);
    assert.equal(paymentMatchesGroup({groupId:null,studentId:1,teacherId:'t'},g,new Map([[1,[1,2]]]),[1,2]),false);
    assert.equal(paymentMatchesGroup({groupId:null,studentId:1,teacherId:'t'},g,new Map([[1,[1]]]),[1,2]),true);
  });
  await t.test('passwords never serialize and Telegram only accepts own private contact',()=>{
    assert.deepEqual(publicJson({user:{password:'hash',plainPassword:'secret',firstName:'Test'},nested:[{plain_password:'secret'}]}),{user:{firstName:'Test'},nested:[{}]});
    assert.equal(ownsTelegramContact(1,1,'private'),true);assert.equal(ownsTelegramContact(2,1,'private'),false);assert.equal(ownsTelegramContact(undefined,1,'private'),false);assert.equal(ownsTelegramContact(1,1,'group'),false);
  });
  await t.test('all financial cache variants are invalidated together',async()=>{
    const c=new QueryClient();for(const k of [['payments'],['/api/payments'],['students'],['stats',9,2026],['/api/teacher/salary'],['/api/teacher-collected-payments']])c.setQueryData(k,[]);
    await invalidateFinance(c);assert.ok(c.getQueryCache().getAll().every(q=>q.state.isInvalidated));c.clear();
    assert.equal(currentPaymentPeriod(new Date('2026-09-30T20:00:00Z')),'2026-10');
  });
  await db.close();
});
