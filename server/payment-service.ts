import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { moneySchema, paymentTypeSchema, balanceEffect, collectionSchema, currentPaymentPeriod, paymentCreateSchema, paymentUpdateSchema } from "../shared/finance";

export class FinanceError extends Error { constructor(message:string, public status=400){super(message);} }
export type Actor = {tenantId:number; userId:string; role:string};
const camel = (row:any):any => row && Object.fromEntries(Object.entries(row).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v]));
const validId = (id:number) => { if(!Number.isSafeInteger(id) || id <= 0) throw new FinanceError("Noto‘g‘ri identifikator"); };
const admin = (a:Actor) => { if(a.role !== "markaz_admin") throw new FinanceError("Faqat administrator uchun",403); };

export function createPaymentService(pool:Pool) {
  async function transaction<T>(a:Actor, fn:(c:PoolClient)=>Promise<T>):Promise<T> {
    const c=await pool.connect();
    try { await c.query("BEGIN"); await c.query("SELECT pg_advisory_xact_lock(707, $1)",[a.tenantId]);
      const value=await fn(c); await c.query("COMMIT"); return value;
    } catch(e){await c.query("ROLLBACK");throw e;} finally{c.release();}
  }
  async function idempotent(a:Actor,key:string|undefined,input:unknown,fn:(c:PoolClient)=>Promise<any>) {
    if(!key || !/^[a-zA-Z0-9:_-]{16,150}$/.test(key)) throw new FinanceError("Sahifani yangilab qayta urinib ko‘ring (so‘rov kaliti kerak)");
    const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return transaction(a,async c=>{
      const old=(await c.query("SELECT * FROM finance_requests WHERE tenant_id=$1 AND request_key=$2",[a.tenantId,key])).rows[0];
      if(old){if(old.actor_id!==a.userId || old.fingerprint!==fingerprint)throw new FinanceError("Bu so‘rov kaliti boshqa operatsiya uchun ishlatilgan",409);return old.result;}
      const result=await fn(c);
      await c.query("INSERT INTO finance_requests(tenant_id,request_key,actor_id,fingerprint,result) VALUES($1,$2,$3,$4,$5)",[a.tenantId,key,a.userId,fingerprint,JSON.stringify(result)]);
      return result;
    });
  }
  async function audit(c:PoolClient,a:Actor,id:number|null,action:string,before:any,after:any) {
    await c.query("INSERT INTO payment_audit_logs(tenant_id,payment_id,action,actor_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6)",[a.tenantId,id,action,a.userId,JSON.stringify(before),JSON.stringify(after)]);
  }
  async function groupFor(c:PoolClient,a:Actor,studentId:number,teacherId:string,groupId?:number) {
    const rows=(await c.query(`SELECT g.* FROM groups g JOIN student_groups sg ON sg.group_id=g.id
      WHERE sg.student_id=$1 AND g.tenant_id=$2 AND g.teacher_id=$3`,[studentId,a.tenantId,teacherId])).rows;
    if(groupId){const group=rows.find(g=>g.id===groupId);if(!group)throw new FinanceError("O‘quvchi, guruh va o‘qituvchi mos emas");return group;}
    if(rows.length>1)throw new FinanceError("To‘lov qaysi guruh uchun ekanini tanlang");
    return rows[0] || null;
  }
  async function queue(c:PoolClient,a:Actor,p:any,event:string,sendSms=false) {
    const recipients=(await c.query("SELECT id FROM users WHERE tenant_id=$1 AND role='markaz_admin'",[a.tenantId])).rows.map(r=>({kind:'user',id:r.id,label:'admin'}));
    if(p.status==='completed' && !p.deleted_at){
      recipients.push({kind:'student',id:String(p.student_id),label:'student'});
      if(p.teacher_id)recipients.push({kind:'user',id:p.teacher_id,label:'teacher'});
    }
    for(const r of recipients) await c.query(`INSERT INTO payment_notifications(tenant_id,payment_id,event_key,channel,recipient_type,recipient_id,payload)
      VALUES($1,$2,$3,'telegram',$4,$5,$6) ON CONFLICT(event_key) DO NOTHING`,[a.tenantId,p.id,`${event}:${r.label}:${r.id}`,r.kind,r.id,JSON.stringify({event,amount:p.amount,studentName:p.student_name,groupId:p.group_id,status:p.status,deleted:!!p.deleted_at,paymentId:p.id,collectionId:p.collection_id})]);
    if(sendSms&&p.status==='completed')await c.query(`INSERT INTO payment_notifications(tenant_id,payment_id,event_key,channel,recipient_type,recipient_id,payload)
      VALUES($1,$2,$3,'sms','student',$4,$5) ON CONFLICT(event_key) DO NOTHING`,[a.tenantId,p.id,`${event}:sms`,String(p.student_id),JSON.stringify({amount:p.amount,groupId:p.group_id})]);
  }
  async function insert(c:PoolClient,a:Actor,d:any,sourceId?:number) {
    moneySchema.parse(d.amount);paymentTypeSchema.parse(d.paymentType);
    const student=(await c.query("SELECT * FROM students WHERE id=$1 AND tenant_id=$2 FOR UPDATE",[d.studentId,a.tenantId])).rows[0];
    if(!student)throw new FinanceError("O‘quvchi topilmadi",404);
    const teacher=(await c.query("SELECT * FROM users WHERE id=$1 AND tenant_id=$2 AND role='teacher'",[d.teacherId,a.tenantId])).rows[0];
    if(!teacher)throw new FinanceError("O‘qituvchi topilmadi",404);
    const group=await groupFor(c,a,student.id,teacher.id,d.groupId);
    const pct=Number(teacher.salary_percent??0);
    if(pct<0||pct>100)throw new FinanceError("O‘qituvchi foizi 0–100 oralig‘ida bo‘lishi kerak");
    const p=(await c.query(`INSERT INTO payments(tenant_id,student_id,teacher_id,amount,teacher_earning,payment_type,status,notes,student_name,group_id,payment_period,teacher_percent,source_collected_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[a.tenantId,student.id,teacher.id,d.amount,Math.round(d.amount*pct/100),d.paymentType,d.status,d.notes||null,`${student.first_name} ${student.last_name}`,group?.id||null,d.paymentPeriod||currentPaymentPeriod(),pct,sourceId||null])).rows[0];
    await c.query("UPDATE students SET balance=balance+$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3",[balanceEffect(p.amount,p.status),student.id,a.tenantId]);
    await audit(c,a,p.id,'created',null,p);await queue(c,a,p,`payment:${p.id}:created`,d.sendSms);
    return camel(p);
  }
  return {
    async create(a:Actor,key:string|undefined,body:unknown){admin(a);const d=paymentCreateSchema.parse(body);
      return idempotent(a,key,{action:'create',...d},async c=>{
        let createdStudent=null;let studentId=d.studentId;
        if(d.newStudent){const n=d.newStudent;
          if(n.phone){const old=await c.query("SELECT id FROM students WHERE tenant_id=$1 AND regexp_replace(phone,'[^0-9]','','g')=$2",[a.tenantId,n.phone.replace(/\D/g,'')]);if(old.rows.length)throw new FinanceError("Bu telefon raqamli o‘quvchi mavjud",409);}
          const row=(await c.query(`INSERT INTO students(tenant_id,first_name,last_name,phone,parent_phone,status,balance) VALUES($1,$2,$3,$4,$5,'active',0) RETURNING *`,[a.tenantId,n.firstName,n.lastName,n.phone,n.parentPhone])).rows[0];
          studentId=row.id;createdStudent=camel(row);
        }
        return {...await insert(c,a,{...d,studentId}),createdStudent};
      });
    },
    async update(a:Actor,id:number,body:unknown){admin(a);validId(id);const d=paymentUpdateSchema.parse(body);return transaction(a,async c=>{
      const old=(await c.query("SELECT * FROM payments WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE",[id,a.tenantId])).rows[0];if(!old)throw new FinanceError("To‘lov topilmadi",404);
      const amount=d.amount??old.amount,status=d.status??old.status;
      // Preserve historical percentage instead of applying today's rate to old payments.
      const teacher=(await c.query("SELECT salary_percent FROM users WHERE id=$1 AND tenant_id=$2",[old.teacher_id,a.tenantId])).rows[0];
      const pct=old.teacher_percent??(old.amount>0 && old.teacher_earning!=null ? old.teacher_earning*100/old.amount : Number(teacher?.salary_percent??0));
      const earning=amount===old.amount ? old.teacher_earning : Math.round(amount*pct/100);
      const next=(await c.query(`UPDATE payments SET amount=$1,status=$2,teacher_earning=$3,payment_type=$4,notes=$5,payment_period=$6
        WHERE id=$7 AND tenant_id=$8 RETURNING *`,[amount,status,earning,d.paymentType??old.payment_type,d.notes===undefined?old.notes:d.notes,d.paymentPeriod??old.payment_period,id,a.tenantId])).rows[0];
      const diff=balanceEffect(amount,status)-balanceEffect(old.amount,old.status);
      const balanceUpdate=await c.query("UPDATE students SET balance=balance+$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id",[diff,old.student_id,a.tenantId]);
      if(diff!==0 && !balanceUpdate.rows.length)throw new FinanceError("To‘lov o‘quvchisi topilmadi. Hisobni tekshiring.",409);
      await audit(c,a,id,'updated',old,next);
      if(amount!==old.amount || status!==old.status){
        const cancelled=await c.query("UPDATE payment_notifications SET status='cancelled' WHERE payment_id=$1 AND tenant_id=$2 AND status IN ('pending','failed') RETURNING channel",[id,a.tenantId]);
        const event=(await c.query("SELECT MAX(id) AS id FROM payment_audit_logs WHERE tenant_id=$1 AND payment_id=$2",[a.tenantId,id])).rows[0].id;
        await queue(c,a,next,`payment:${id}:updated:${event}`,cancelled.rows.some(r=>r.channel==='sms'));
      }
      return camel(next);
    });},
    async remove(a:Actor,id:number){admin(a);validId(id);return transaction(a,async c=>{
      const old=(await c.query("SELECT * FROM payments WHERE id=$1 AND tenant_id=$2 FOR UPDATE",[id,a.tenantId])).rows[0];if(!old)throw new FinanceError("To‘lov topilmadi",404);if(old.deleted_at)return;
      const balanceUpdate=await c.query("UPDATE students SET balance=balance-$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id",[balanceEffect(old.amount,old.status),old.student_id,a.tenantId]);
      if(balanceEffect(old.amount,old.status)!==0 && !balanceUpdate.rows.length)throw new FinanceError("To‘lov o‘quvchisi topilmadi. Hisobni tekshiring.",409);
      const next=(await c.query("UPDATE payments SET status='cancelled',deleted_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *",[id,a.tenantId])).rows[0];
      await c.query("UPDATE payment_notifications SET status='cancelled' WHERE payment_id=$1 AND tenant_id=$2 AND status IN ('pending','failed')",[id,a.tenantId]);
      await audit(c,a,id,'deleted',old,next);await queue(c,a,next,`payment:${id}:deleted`);
    });},
    async collect(a:Actor,key:string|undefined,body:unknown){
      if(a.role!=='teacher')throw new FinanceError("Faqat o‘qituvchi uchun",403);const d=collectionSchema.parse(body);
      return idempotent(a,key,{action:'collect',...d},async c=>{
        const teacher=(await c.query("SELECT * FROM users WHERE id=$1 AND tenant_id=$2 AND role='teacher'",[a.userId,a.tenantId])).rows[0];
        if(!teacher?.permissions?.includes('accept_payment'))throw new FinanceError("To‘lov qabul qilishga ruxsat yo‘q",403);
        const student=(await c.query("SELECT * FROM students WHERE id=$1 AND tenant_id=$2",[d.studentId,a.tenantId])).rows[0];if(!student)throw new FinanceError("O‘quvchi topilmadi",404);
        const group=await groupFor(c,a,d.studentId,a.userId,d.groupId);
        const row=(await c.query(`INSERT INTO teacher_collected_payments(tenant_id,teacher_id,teacher_name,student_id,student_name,group_id,group_name,amount,payment_type,notes,status,payment_period)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11) RETURNING *`,[a.tenantId,a.userId,`${teacher.first_name} ${teacher.last_name}`,student.id,`${student.first_name} ${student.last_name}`,group.id,group.name,d.amount,d.paymentType,d.notes||null,d.paymentPeriod||currentPaymentPeriod()])).rows[0];
        await audit(c,a,null,'collected',null,row);
        await queue(c,a,{id:null,collection_id:row.id,student_id:student.id,student_name:row.student_name,group_id:group.id,amount:d.amount,status:'pending'},`collection:${row.id}:pending`);
        return camel(row);
      });
    },
    async decide(a:Actor,id:number,decision:'confirm'|'reject',reason?:string){admin(a);validId(id);return transaction(a,async c=>{
      const row=(await c.query("SELECT * FROM teacher_collected_payments WHERE id=$1 AND tenant_id=$2 FOR UPDATE",[id,a.tenantId])).rows[0];if(!row)throw new FinanceError("To‘lov topilmadi",404);
      if(row.status==='confirmed'&&decision==='confirm')return {success:true,paymentId:row.payment_id,alreadyProcessed:true};
      if(row.status==='rejected'&&decision==='reject')return {success:true,alreadyProcessed:true};
      if(row.status!=='pending')throw new FinanceError("Bu to‘lov ko‘rib chiqilgan",409);
      let paymentId=null;
      if(decision==='confirm'){
        // Collection owner must also own the recorded group; never guess a different teacher.
        const payment=await insert(c,a,{studentId:row.student_id,teacherId:row.teacher_id,groupId:row.group_id||undefined,amount:row.amount,paymentType:row.payment_type,status:'completed',notes:row.notes,paymentPeriod:row.payment_period},row.id);
        paymentId=payment.id;
        await c.query("UPDATE teacher_collected_payments SET status='confirmed',confirmed_by=$1,confirmed_at=NOW(),payment_id=$2 WHERE id=$3 AND tenant_id=$4",[a.userId,paymentId,id,a.tenantId]);
      }else{
        await c.query("UPDATE teacher_collected_payments SET status='rejected',rejected_by=$1,rejected_at=NOW(),rejection_reason=$2 WHERE id=$3 AND tenant_id=$4",[a.userId,(reason||'').slice(0,2000),id,a.tenantId]);
      }
      await c.query("UPDATE payment_notifications SET status='cancelled' WHERE tenant_id=$1 AND event_key LIKE $2 AND status IN ('pending','failed')",[a.tenantId,`collection:${id}:pending:%`]);
      await audit(c,a,paymentId,`collection_${decision}`,row,{status:decision,paymentId});return {success:true,paymentId};
    });}
  };
}
