import type { QueryClient } from '@tanstack/react-query';
const pending = new Map<string,string>();
export async function submitFinance(url:string,data:unknown):Promise<any>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url+JSON.stringify(data)));
  const storageKey='crm:pending:'+Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
  let key=pending.get(storageKey);
  try { key ||= sessionStorage.getItem(storageKey)||undefined; } catch{}
  key ||= crypto.randomUUID();pending.set(storageKey,key);
  try{sessionStorage.setItem(storageKey,key);}catch{}
  const res=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(data)});
  const result=await res.json();
  if(!res.ok)throw new Error(result.error||'To‘lov saqlanmadi');
  pending.delete(storageKey);try{sessionStorage.removeItem(storageKey);}catch{}
  return result;
}
export function invalidateFinance(client:QueryClient){
  return client.invalidateQueries({predicate:q=>q.queryKey[0]!=="payment-revision"&&/tuition|payment|student|stats|salary|finance|report|group/i.test(String(q.queryKey[0]))});
}
