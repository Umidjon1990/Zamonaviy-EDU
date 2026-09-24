import type { Express, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { storage } from './storage';
import { normalizePhone } from '../shared/domain';
const attempts=new Map<string,{n:number;until:number}>();
export const loginLimit:RequestHandler=(req,res,next)=>{const key=req.ip||'unknown',now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);const v=attempts.get(key)||{n:0,until:now+15*60000};if(attempts.size>10000&&!attempts.has(key))return res.status(429).json({error:'Keyinroq urinib ko‘ring'});attempts.set(key,v);if(++v.n>25){res.set('Retry-After',String(Math.ceil((v.until-now)/1000)));return res.status(429).json({error:'Urinishlar ko‘p. 15 daqiqadan keyin urinib ko‘ring'});}next();};
export const activeTenant=(t:any)=>!!t&&['active','trial'].includes(t.status)&&!(t.status==='trial'&&t.trialEndsAt&&new Date(t.trialEndsAt)<new Date())&&!(t.status==='active'&&t.subscriptionEndsAt&&new Date(t.subscriptionEndsAt)<new Date());
export function registerAccounts(app:Express){
 app.use(['/api/auth/login','/api/auth/rahbar-login','/api/super-admin/login'],loginLimit);
 for(const route of ['/api/auth/login','/api/auth/rahbar-login'])app.post(route,async(req,res)=>{try{
  const d=z.object({phone:z.string().max(30),password:z.string().min(1).max(200),tenantSlug:z.string().max(100).optional(),role:z.string().optional()}).parse(req.body);
  const candidates=await storage.getUsersByPhone(normalizePhone(d.phone));const matches=[];
  for(const u of candidates){if(u.archivedAt||(route.endsWith('rahbar-login')&&u.role!=='manager')||(d.role&&u.role!==d.role))continue;const t=await storage.getTenant(u.tenantId);if(d.tenantSlug&&t?.slug!==d.tenantSlug)continue;if(await bcrypt.compare(d.password,u.password))matches.push({u,t});}
  if(!matches.length)return res.status(401).json({error:'Telefon yoki parol noto‘g‘ri'});
  if(matches.length!==1)return res.status(409).json({error:'Bir nechta akkaunt mos keldi. Markaz manzili (slug) va rolni tanlang.'});
  const {u,t}=matches[0];if(!activeTenant(t))return res.status(403).json({error:'Markaz obunasi faol emas'});
  await new Promise<void>((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
  Object.assign(req.session,{userId:u.id,tenantId:u.tenantId,role:u.role,authVersion:u.authVersion});
  await new Promise<void>((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
  res.json({user:{id:u.id,firstName:u.firstName,lastName:u.lastName,role:u.role,phone:u.phone,permissions:u.permissions||[]},tenant:{id:t!.id,name:t!.name,slug:t!.slug}});
 }catch{res.status(400).json({error:'Kirish ma’lumotlarini tekshiring'});}});
}
