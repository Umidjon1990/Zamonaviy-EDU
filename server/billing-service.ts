import type { Pool } from 'pg';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { FinanceError, type Actor } from './payment-service';
import { idSchema } from '../shared/domain';
import { moneySchema, periodSchema } from '../shared/finance';
export const billingMigration=`CREATE TABLE IF NOT EXISTS tuition_charges(id SERIAL PRIMARY KEY,tenant_id INTEGER NOT NULL,student_id INTEGER NOT NULL,group_id INTEGER NOT NULL,period TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),reason TEXT NOT NULL,created_by TEXT NOT NULL,created_at TIMESTAMP DEFAULT NOW(),voided_at TIMESTAMP,void_reason TEXT);CREATE UNIQUE INDEX IF NOT EXISTS tuition_charge_period ON tuition_charges(tenant_id,student_id,group_id,period) WHERE voided_at IS NULL;`;
export function createBillingService(pool:Pool){
 const input=z.object({studentId:idSchema,groupId:idSchema,period:periodSchema,amount:moneySchema,reason:z.string().trim().min(5).max(2000)}).strict();
 async function tx(a:Actor,fn:(c:any)=>Promise<any>){if(a.role!=='markaz_admin')throw new FinanceError('Faqat administrator uchun',403);const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(707,$1)',[a.tenantId]);const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 return {
 async create(a:Actor,key:string|undefined,body:unknown){const d=input.parse(body);if(!key||!/^[\w:-]{16,150}$/.test(key))throw new FinanceError('So‘rov kaliti kerak');const hash=createHash('sha256').update(JSON.stringify({action:'tuition',...d})).digest('hex');return tx(a,async c=>{
 const prior=(await c.query('SELECT * FROM finance_requests WHERE tenant_id=$1 AND request_key=$2',[a.tenantId,key])).rows[0];if(prior){if(prior.actor_id!==a.userId||prior.fingerprint!==hash)throw new FinanceError('So‘rov kaliti band',409);return prior.result;}
 const membership=(await c.query('SELECT 1 FROM student_groups sg JOIN students s ON s.id=sg.student_id JOIN groups g ON g.id=sg.group_id WHERE s.id=$1 AND g.id=$2 AND s.tenant_id=$3 AND g.tenant_id=$3 AND s.archived_at IS NULL AND g.archived_at IS NULL',[d.studentId,d.groupId,a.tenantId])).rows;
 if(!membership.length)throw new FinanceError('O‘quvchi guruhga tegishli emas');
 if((await c.query('SELECT 1 FROM tuition_charges WHERE tenant_id=$1 AND student_id=$2 AND group_id=$3 AND period=$4 AND voided_at IS NULL',[a.tenantId,d.studentId,d.groupId,d.period])).rows.length)throw new FinanceError('Bu oy uchun kurs haqi yozilgan',409);
 const r=(await c.query('INSERT INTO tuition_charges(tenant_id,student_id,group_id,period,amount,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[a.tenantId,d.studentId,d.groupId,d.period,d.amount,d.reason,a.userId])).rows[0];
 await c.query('UPDATE students SET balance=balance-$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3',[d.amount,d.studentId,a.tenantId]);
 await c.query("INSERT INTO payment_audit_logs(tenant_id,action,actor_id,after_value) VALUES($1,'tuition_created',$2,$3)",[a.tenantId,a.userId,JSON.stringify(r)]);
 await c.query('INSERT INTO finance_requests(tenant_id,request_key,actor_id,fingerprint,result) VALUES($1,$2,$3,$4,$5)',[a.tenantId,key,a.userId,hash,JSON.stringify(r)]);return r;
 });},
 async void(a:Actor,id:number,reason:unknown){idSchema.parse(id);const note=z.string().trim().min(5).max(2000).parse(reason);return tx(a,async c=>{
 const old=(await c.query('SELECT * FROM tuition_charges WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[id,a.tenantId])).rows[0];if(!old)throw new FinanceError('Topilmadi',404);if(old.voided_at)return old;
 await c.query('UPDATE students SET balance=balance+$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3',[old.amount,old.student_id,a.tenantId]);const r=(await c.query('UPDATE tuition_charges SET voided_at=NOW(),void_reason=$1 WHERE id=$2 RETURNING *',[note,id])).rows[0];
 await c.query("INSERT INTO payment_audit_logs(tenant_id,action,actor_id,before_value,after_value) VALUES($1,'tuition_voided',$2,$3,$4)",[a.tenantId,a.userId,JSON.stringify(old),JSON.stringify(r)]);return r;
 });},
 async reconcile(a:Actor,id:number,body:unknown){idSchema.parse(id);const d=z.object({groupId:idSchema,paymentPeriod:periodSchema,reason:z.string().trim().min(5).max(2000)}).strict().parse(body);return tx(a,async c=>{
 const old=(await c.query('SELECT * FROM payments WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE',[id,a.tenantId])).rows[0];if(!old)throw new FinanceError('To‘lov topilmadi',404);
 if(!(await c.query('SELECT 1 FROM groups WHERE id=$1 AND tenant_id=$2 AND teacher_id=$3',[d.groupId,a.tenantId,old.teacher_id])).rows.length)throw new FinanceError('Tarixiy guruh to‘lov o‘qituvchisiga mos emas');
 const r=(await c.query('UPDATE payments SET group_id=$1,payment_period=$2 WHERE id=$3 AND tenant_id=$4 RETURNING *',[d.groupId,d.paymentPeriod,id,a.tenantId])).rows[0];
 await c.query("INSERT INTO payment_audit_logs(tenant_id,payment_id,action,actor_id,before_value,after_value) VALUES($1,$2,'reconciled',$3,$4,$5)",[a.tenantId,id,a.userId,JSON.stringify(old),JSON.stringify({...r,reconciliationReason:d.reason})]);return r;
 });}
 };
}
