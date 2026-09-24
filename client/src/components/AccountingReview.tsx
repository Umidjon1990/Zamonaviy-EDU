import {useState} from 'react';
import {useQuery,useQueryClient,useMutation} from '@tanstack/react-query';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {submitFinance,invalidateFinance} from '@/lib/finance';
import {currentPaymentPeriod} from '@shared/finance';
import {apiRequest} from '@/lib/queryClient';

export function AccountingReview({payments,students,groups}:{payments:any[];students:any[];groups:any[]}){
 const client=useQueryClient();
 const [record,setRecord]=useState(''),[groupId,setGroup]=useState(''),[period,setPeriod]=useState(currentPaymentPeriod()),[reason,setReason]=useState('');
 const [studentId,setStudent]=useState(''),[chargeGroup,setChargeGroup]=useState(''),[chargeMonth,setChargeMonth]=useState(currentPaymentPeriod()),[amount,setAmount]=useState(''),[chargeReason,setChargeReason]=useState('');
 const [voidId,setVoidId]=useState<number|null>(null),[voidReason,setVoidReason]=useState('');
 const missing=payments.filter(p=>!p.groupId||!p.paymentPeriod),selected=payments.find(p=>String(p.id)===record);
 const {data:historyGroups=[],error:historyError}=useQuery<any[]>({queryKey:['reconciliation-groups'],queryFn:async()=>{const r=await apiRequest('GET','/api/payment-reconciliation/groups');return r.json();}});
 const {data:charges=[],error:chargeError}=useQuery<any[]>({queryKey:['tuition-charges'],queryFn:async()=>{const r=await apiRequest('GET','/api/tuition-charges');return r.json();}});
 const reconcile=useMutation({mutationFn:async()=>apiRequest('PUT',`/api/payments/${record}/reconcile`,{groupId:Number(groupId),paymentPeriod:period,reason}),onSuccess:()=>{void invalidateFinance(client);setRecord('');setGroup('');setReason('');}});
 const create=useMutation({mutationFn:()=>submitFinance('/api/tuition-charges',{studentId:Number(studentId),groupId:Number(chargeGroup),period:chargeMonth,amount:Number(amount),reason:chargeReason}),onSuccess:()=>{void invalidateFinance(client);void client.invalidateQueries({queryKey:['tuition-charges']});setAmount('');setChargeReason('');}});
 const cancel=useMutation({mutationFn:()=>apiRequest('DELETE',`/api/tuition-charges/${voidId}`,{reason:voidReason}),onSuccess:()=>{void invalidateFinance(client);void client.invalidateQueries({queryKey:['tuition-charges']});setVoidId(null);setVoidReason('');}});
 const selectedStudent=students.find(s=>String(s.id)===studentId);
 const inputClass='border rounded px-2 py-2 bg-background w-full';
 return <div className="space-y-3">
  <details className="border rounded-lg p-3"><summary className="font-medium cursor-pointer">Tarixiy to‘lovlarni tekshirish · {missing.length} ta yozuv</summary>
   <p className="text-sm text-muted-foreground my-3">Guruh yoki oyi ko‘rsatilmagan to‘lovlarni chek va tarixiy ma’lumot asosida belgilang. Summa, balans va saqlangan o‘qituvchi ulushi o‘zgarmaydi.</p>
   {historyError&&<p role="alert">Tarixiy guruhlar olinmadi.</p>}
   <form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();reconcile.mutate();}}>
    <label>To‘lov<select className={inputClass} required value={record} onChange={e=>{setRecord(e.target.value);setGroup('');}}><option value="">Tanlang</option>{missing.map(p=><option key={p.id} value={p.id}>#{p.id} · {p.studentName} · {p.amount.toLocaleString()} so‘m</option>)}</select></label>
    <label>Tarixiy guruh<select className={inputClass} required value={groupId} onChange={e=>setGroup(e.target.value)}><option value="">Tanlang</option>{historyGroups.filter(g=>g.teacherId===selected?.teacherId).map(g=><option key={g.id} value={g.id}>{g.name}{g.archivedAt?' (arxiv)':''}</option>)}</select></label>
    <label>Qaysi oy uchun?<Input type="month" required value={period} onChange={e=>setPeriod(e.target.value)}/></label>
    <label>Asos / dalil<Input required minLength={5} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Chek yoki tarixiy ro‘yxatdagi dalil"/></label>
    <Button disabled={reconcile.isPending||!record}>Bog‘lanishni saqlash</Button>
    {reconcile.error&&<p role="alert">{reconcile.error.message}</p>}
   </form>
  </details>
  <details className="border rounded-lg p-3"><summary className="font-medium cursor-pointer">Kurs haqi va hisob qoldig‘i</summary>
   <p className="my-3 text-sm text-muted-foreground">Tasdiqlangan oylik kurs haqi balansdan ayriladi; to‘lov balansga qo‘shiladi. Musbat qoldiq — avans, manfiy qoldiq — qarz. Tarif va chegirmalarni hisobga olgan summani kiriting. Eski oylar avtomatik hisoblanmaydi.</p>
   <form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();create.mutate();}}>
    <label>O‘quvchi<select className={inputClass} required value={studentId} onChange={e=>{setStudent(e.target.value);setChargeGroup('');}}><option value="">Tanlang</option>{students.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select></label>
    <label>Guruh<select className={inputClass} required value={chargeGroup} onChange={e=>setChargeGroup(e.target.value)}><option value="">Tanlang</option>{groups.filter(g=>selectedStudent?.groupIds?.includes(g.id)).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label>Oy<Input type="month" required value={chargeMonth} onChange={e=>setChargeMonth(e.target.value)}/></label>
    <label>Kurs haqi, so‘m<Input type="number" min={1} max={1000000000} step={1} required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label className="sm:col-span-2">Asos / tarif / chegirma<Input required minLength={5} value={chargeReason} onChange={e=>setChargeReason(e.target.value)}/></label>
    <Button disabled={create.isPending}>Kurs haqini hisobga yozish</Button>
    {create.error&&<p role="alert">{create.error.message}</p>}
   </form>
   {chargeError&&<p role="alert">Kurs haqlari olinmadi.</p>}
   <div className="mt-3 max-h-72 overflow-auto">{charges.map(c=><div className="border-t py-2 text-sm flex justify-between gap-2" key={c.id}><span>{c.first_name} {c.last_name} · {c.group_name} · {c.period} · {c.amount.toLocaleString()} so‘m{c.voided_at?' · Bekor qilingan':''}</span>{!c.voided_at&&<Button variant="outline" size="sm" onClick={()=>setVoidId(c.id)}>Bekor qilish</Button>}</div>)}</div>
   {voidId&&<form className="mt-3 space-y-2" onSubmit={e=>{e.preventDefault();cancel.mutate();}}><p>#{voidId} kurs haqini bekor qilish balansni qayta oshiradi.</p><Input required minLength={5} placeholder="Bekor qilish sababi" value={voidReason} onChange={e=>setVoidReason(e.target.value)}/><Button disabled={cancel.isPending}>Bekor qilishni tasdiqlash</Button><Button type="button" variant="ghost" onClick={()=>setVoidId(null)}>Ortga</Button>{cancel.error&&<p role="alert">{cancel.error.message}</p>}</form>}
  </details>
 </div>;
}
