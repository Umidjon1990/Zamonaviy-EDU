import type { Pool, PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FinanceError, type Actor } from './payment-service';
import { attendanceInput, cashInput, gradeInput, idSchema } from '../shared/domain';
const camel=(r:any)=>r&&Object.fromEntries(Object.entries(r).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v]));
export function createDomainService(pool:Pool){
 async function tx<T>(a:Actor,fn:(c:PoolClient)=>Promise<T>){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(709,$1)',[a.tenantId]);const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async function audit(c:PoolClient,a:Actor,action:string,details:any){await c.query('INSERT INTO domain_audit_logs(tenant_id,actor_id,action,details) VALUES($1,$2,$3,$4)',[a.tenantId,a.userId,action,JSON.stringify(details)]);}
 return {
 async cashCreate(a:Actor,key:string|undefined,body:unknown){const d=cashInput.parse(body);if(!key||!/^[\w:-]{16,150}$/.test(key))throw new FinanceError('So‘rov kaliti kerak');const fingerprint=createHash('sha256').update(JSON.stringify({action:'cash',...d})).digest('hex');return tx(a,async c=>{
  const old=(await c.query('SELECT * FROM finance_requests WHERE tenant_id=$1 AND request_key=$2',[a.tenantId,key])).rows[0];if(old){if(old.actor_id!==a.userId||old.fingerprint!==fingerprint)throw new FinanceError('So‘rov kaliti boshqa amal uchun ishlatilgan',409);return old.result;}
  const r=(await c.query("INSERT INTO cash_receipts(tenant_id,amount,submitted_by,note,payment_type,status) VALUES($1,$2,$3,$4,$5,'pending') RETURNING *",[a.tenantId,d.amount,a.userId,d.note||null,d.paymentType])).rows[0];
  await c.query("INSERT INTO cash_receipt_logs(cash_receipt_id,action,new_status,acted_by,note) VALUES($1,'created','pending',$2,$3)",[r.id,a.userId,d.note||null]);const result=camel(r);
  await c.query('INSERT INTO finance_requests(tenant_id,request_key,actor_id,fingerprint,result) VALUES($1,$2,$3,$4,$5)',[a.tenantId,key,a.userId,fingerprint,JSON.stringify(result)]);return result;
 });},
 async cashDecide(a:Actor,id:number,status:'accepted'|'rejected',note?:unknown){if(a.role!=='manager')throw new FinanceError('Faqat rahbar uchun',403);idSchema.parse(id);const reason=z.string().max(2000).optional().parse(note);return tx(a,async c=>{
  const old=(await c.query('SELECT * FROM cash_receipts WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[id,a.tenantId])).rows[0];if(!old)throw new FinanceError('Topilmadi',404);if(old.status===status)return camel(old);if(old.status!=='pending')throw new FinanceError('Topshiriq ko‘rib chiqilgan',409);
  const cols=status==='accepted'?'accepted_by=$3,accepted_at=NOW()':'rejected_by=$3,rejected_at=NOW(),rejection_reason=$4';
  const r=(await c.query(`UPDATE cash_receipts SET status=$5,updated_at=NOW(),${cols} WHERE id=$1 AND tenant_id=$2 AND ($4::text IS NULL OR $4::text IS NOT NULL) RETURNING *`,[id,a.tenantId,a.userId,reason||null,status])).rows[0];
  await c.query('INSERT INTO cash_receipt_logs(cash_receipt_id,action,old_status,new_status,acted_by,note) VALUES($1,$2,$3,$2,$4,$5)',[id,status,old.status,a.userId,reason||null]);return camel(r);
 });},
 async classRecord(a:Actor,kind:'attendance'|'grades',body:unknown){const d=kind==='attendance'?attendanceInput.parse(body):gradeInput.parse(body);return tx(a,async c=>{
  const g=(await c.query('SELECT * FROM groups WHERE id=$1 AND tenant_id=$2 AND archived_at IS NULL',[d.groupId,a.tenantId])).rows[0];if(!g||(a.role==='teacher'&&g.teacher_id!==a.userId))throw new FinanceError('Guruhga ruxsat yo‘q',403);
  const old=(await c.query(`SELECT * FROM ${kind} WHERE tenant_id=$1 AND student_id=$2 AND group_id=$3 AND date::date=$4::date ORDER BY id DESC LIMIT 1 FOR UPDATE`,[a.tenantId,d.studentId,d.groupId,d.date.toISOString().slice(0,10)])).rows[0];
  const cols=kind==='attendance'?['status','notes']:['grade','topic','notes'];const values=cols.map(k=>(d as any)[k]??null);
  const row=old?(await c.query(`UPDATE ${kind} SET ${cols.map((k,i)=>`${k}=$${i+2}`).join(',')} WHERE id=$1 RETURNING *`,[old.id,...values])).rows[0]:(await c.query(`INSERT INTO ${kind}(tenant_id,student_id,group_id,date,${cols.join(',')}) VALUES($1,$2,$3,$4,${cols.map((_,i)=>'$'+(i+5)).join(',')}) RETURNING *`,[a.tenantId,d.studentId,d.groupId,d.date,...values])).rows[0];
  await audit(c,a,kind,{before:old,after:row});
  if(kind==='attendance'){
   const recipients=[{type:'student',id:String(d.studentId)},...(await c.query("SELECT id FROM users WHERE tenant_id=$1 AND role='markaz_admin' AND archived_at IS NULL",[a.tenantId])).rows.map(u=>({type:'user',id:u.id}))];
   for(const r of recipients){const key=`attendance:${a.tenantId}:${d.groupId}:${d.date.toISOString().slice(0,10)}:${r.type}:${r.id}`;
    const payload={kind:'attendance',groupId:d.groupId,date:d.date.toISOString().slice(0,10),studentId:r.type==='student'?d.studentId:null,revision:Date.now()};
    await c.query(`INSERT INTO payment_notifications(tenant_id,event_key,channel,recipient_type,recipient_id,payload,next_attempt_at) VALUES($1,$2,'telegram',$3,$4,$5,NOW()+INTERVAL '15 seconds') ON CONFLICT(event_key) DO UPDATE SET payload=EXCLUDED.payload,status='pending',attempts=0,next_attempt_at=EXCLUDED.next_attempt_at`,[a.tenantId,key,r.type,r.id,JSON.stringify(payload)]);
   }
  }return camel(row);
 });},
 async move(a:Actor,studentId:number,fromGroupId:number,toGroupId:number){[studentId,fromGroupId,toGroupId].forEach(v=>idSchema.parse(v));if(fromGroupId===toGroupId)throw new FinanceError('Boshqa guruhni tanlang');return tx(a,async c=>{
  const groups=(await c.query('SELECT * FROM groups WHERE tenant_id=$1 AND id=ANY($2) AND archived_at IS NULL ORDER BY id FOR UPDATE',[a.tenantId,[fromGroupId,toGroupId]])).rows;
  if(groups.length!==2||(a.role==='teacher'&&groups.some(g=>g.teacher_id!==a.userId)))throw new FinanceError('Guruhlarga ruxsat yo‘q',403);
  if(!(await c.query('SELECT 1 FROM student_groups WHERE student_id=$1 AND group_id=$2',[studentId,fromGroupId])).rows.length)throw new FinanceError('O‘quvchi avvalgi guruhda yo‘q');
  if(!(await c.query('SELECT 1 FROM student_groups WHERE student_id=$1 AND group_id=$2',[studentId,toGroupId])).rows.length)await c.query('INSERT INTO student_groups(student_id,group_id) VALUES($1,$2)',[studentId,toGroupId]);
  await c.query('DELETE FROM student_groups WHERE student_id=$1 AND group_id=$2',[studentId,fromGroupId]);await audit(c,a,'student_moved',{studentId,fromGroupId,toGroupId});return {success:true};
 });}
 };
}
