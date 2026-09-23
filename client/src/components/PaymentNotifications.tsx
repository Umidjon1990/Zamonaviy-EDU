import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
export function PaymentNotifications(){
  const client=useQueryClient();
  const {data=[],isError}=useQuery<any[]>({queryKey:['/api/payment-notifications'],refetchInterval:10000,queryFn:async()=>{const r=await fetch('/api/payment-notifications');if(!r.ok)throw new Error('Yuklanmadi');return r.json();}});
  const retry=useMutation({mutationFn:async(id:number)=>{const r=await fetch(`/api/payment-notifications/${id}/retry`,{method:'POST'});if(!r.ok)throw new Error('Qayta urinish bajarilmadi');},onSuccess:()=>client.invalidateQueries({queryKey:['/api/payment-notifications']})});
  if(isError)return <p role="alert" className="text-sm text-red-700">Xabarnomalar holatini yuklab bo‘lmadi.</p>;
  if(!data.length)return null;
  return <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">To‘lov xabarnomalari: {data.filter(j=>j.status==='failed').length} ta yuborilmagan, {data.filter(j=>j.status!=='failed').length} ta navbatda</summary>
    <p className="my-2 text-muted-foreground">Xabarnoma yuborilmagani saqlangan to‘lovni bekor qilmaydi. Telegram uchun botda /start orqali o‘z kontaktini tasdiqlash kerak.</p>
    {data.slice(0,20).map(j=><div key={j.id} className="flex items-center justify-between gap-2 border-t py-2"><span>{j.paymentId?`Chek #${j.paymentId}`:'Kutayotgan yig‘im'} · {j.channel.toUpperCase()} · {j.lastError||'Yuborish navbatida'}</span>{j.status==='failed'&&<Button size="sm" variant="outline" disabled={retry.isPending} onClick={()=>retry.mutate(j.id)}>Qayta yuborish</Button>}</div>)}
    {retry.isError&&<p role="alert">Qayta urinish bajarilmadi. Sahifani yangilang.</p>}
  </details>;
}
