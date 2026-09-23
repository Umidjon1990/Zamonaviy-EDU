import { pool, storage } from './storage';
import { sendPaymentReceivedSMS } from './sms';
import { sendTelegramMessage } from './telegram-bot';

const escapeHtml=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let running=false;
export async function deliverPaymentNotifications() {
  if(running)return;running=true;
  try {
    // Recover a job whose worker stopped. At-least-once delivery: money is never re-posted.
    await pool.query("UPDATE payment_notifications SET status='pending' WHERE status='sending' AND locked_at<NOW()-INTERVAL '5 minutes'");
    for(let i=0;i<20;i++){
      const result=await pool.query(`UPDATE payment_notifications SET status='sending',locked_at=NOW(),attempts=attempts+1
        WHERE id=(SELECT id FROM payment_notifications WHERE status IN ('pending','failed') AND attempts<5 AND next_attempt_at<=NOW() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
      const job=result.rows[0];if(!job)break;
      try {
        if(job.payment_id){const payment=await storage.getPayment(job.payment_id,job.tenant_id);
          if(!payment || (payment.deletedAt && !job.payload.deleted) || payment.amount!==job.payload.amount || (job.payload.status && payment.status!==job.payload.status) || (job.channel==='sms' && payment.status!=='completed')) {await pool.query("UPDATE payment_notifications SET status='cancelled' WHERE id=$1",[job.id]);continue;}
        }
        if(job.payload.collectionId){
          const collection=await pool.query("SELECT status FROM teacher_collected_payments WHERE id=$1 AND tenant_id=$2",[job.payload.collectionId,job.tenant_id]);
          if(collection.rows[0]?.status!=='pending'){await pool.query("UPDATE payment_notifications SET status='cancelled' WHERE id=$1",[job.id]);continue;}
        }
        const student=job.recipient_type==='student'?await storage.getStudent(Number(job.recipient_id),job.tenant_id):null;
        const user=job.recipient_type==='user'?await storage.getUser(job.recipient_id):null;
        if(user && user.tenantId!==job.tenant_id)throw new Error('Qabul qiluvchi markazga tegishli emas');
        const group=job.payload.groupId?await storage.getGroup(job.payload.groupId,job.tenant_id):null;
        let providerId:string|undefined;
        if(job.channel==='sms'){
          if(!student)throw new Error('O‘quvchi topilmadi');
          const phone=student.parentPhone||student.phone;if(!phone)throw new Error('Telefon raqami yo‘q');
          // Preserve the existing direct-provider billing policy for payment receipts.
          const sms=await sendPaymentReceivedSMS(phone,student.firstName.trim(),group?.name||'umumiy kursi',job.payload.amount);
          if(!sms.success)throw new Error(sms.error||'SMS yuborilmadi');providerId=sms.messageId;
        }else{
          const recipient=student||user;
          if(!recipient?.telegramChatId)throw new Error('Telegram ulanmagan. Botda /start va o‘z kontaktingizni yuboring.');
          const link=await pool.query("SELECT 1 FROM telegram_verified_links WHERE kind=$1 AND entity_id=$2 AND chat_id=$3",[job.recipient_type,job.recipient_id,recipient.telegramChatId]);
          if(!link.rows.length)throw new Error('Telegram kontakti qayta tasdiqlanishi kerak');
          const p=job.payload;
          const title=p.deleted?'To‘lov bekor qilindi':p.status==='pending'?'Tasdiqlash kutilmoqda':p.status==='completed'?(String(p.event).includes(':updated:')?'To‘lov yangilandi':'To‘lov qayd qilindi'):'To‘lov holati o‘zgardi';
          const message=`💰 <b>${title}</b>\n${p.paymentId?`Chek #${p.paymentId}\n`:''}O‘quvchi: ${escapeHtml(p.studentName)}\nSumma: ${Number(p.amount).toLocaleString()} so‘m\nGuruh: ${escapeHtml(group?.name||'Guruh belgilanmagan')}\nHolat: ${escapeHtml(p.status)}`;
          if(!await sendTelegramMessage(recipient.telegramChatId,message))throw new Error('Telegram yuborilmadi');
        }
        await pool.query("UPDATE payment_notifications SET status='sent',sent_at=NOW(),last_error=NULL,provider_id=$2 WHERE id=$1",[job.id,providerId||null]);
      }catch(error){
        const message=error instanceof Error?error.message:'Yuborishda xatolik';
        await pool.query("UPDATE payment_notifications SET status='failed',last_error=$2,next_attempt_at=NOW()+($3*INTERVAL '1 second') WHERE id=$1",[job.id,message.slice(0,250),Math.min(3600,60*2**job.attempts)]);
      }
    }
  }finally{running=false;}
}
export function startPaymentNotifications(){
  const tick=()=>deliverPaymentNotifications().catch(()=>console.error('Payment notification worker failed'));
  const timer=setInterval(tick,5000);timer.unref();return timer;
}
