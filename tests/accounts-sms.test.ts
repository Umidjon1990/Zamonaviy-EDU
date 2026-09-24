import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import {createServer} from 'node:http';
import bcrypt from 'bcrypt';
import {registerAccounts} from '../server/accounts';
import {storage,pool} from '../server/storage';
import {sendTenantSMS} from '../server/sms';

test('multi-center login selects explicitly and rotates the existing session',async()=>{
 const password=await bcrypt.hash('test-password-only',4);
 storage.getUsersByPhone=async()=>[{id:'a',tenantId:1,role:'teacher',password,authVersion:0},{id:'b',tenantId:2,role:'teacher',password,authVersion:0}] as any;
 storage.getTenant=async(id)=>({id,status:'active',slug:id===1?'first':'second'}) as any;
 const app=express();app.use(express.json());app.use(session({secret:'test-session-secret-only',resave:false,saveUninitialized:true}));registerAccounts(app);app.get('/session',(req,res)=>res.json({id:req.sessionID}));
 const server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
 const initial=await fetch(url+'/session');const cookie=initial.headers.get('set-cookie')!.split(';')[0],before=(await initial.json()).id;
 const login=(body:any)=>fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({phone:'900000001',password:'test-password-only',...body})});
 assert.equal((await login({})).status,409);const result=await login({tenantSlug:'second'});assert.equal(result.status,200);assert.equal((await result.json()).tenant.id,2);
 const newCookie=result.headers.get('set-cookie')!.split(';')[0];const current=await fetch(url+'/session',{headers:{Cookie:newCookie}});assert.notEqual((await current.json()).id,before);
 for(let i=0;i<25;i++)await login({password:'invalid'});assert.equal((await login({})).status,429);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});

test('SMS credits reserve atomically, refund rejection and retain uncertain sends',async()=>{
 const original=globalThis.fetch;let credits=1,sends=0,mode='success';
 process.env.ESKIZ_EMAIL='test-only';process.env.ESKIZ_PASSWORD='test-only';
 pool.query=(async(sql:string)=>{if(sql.includes('sms_credits=sms_credits-1')){if(!credits)return {rows:[]};credits--;return {rows:[{id:1}]};}if(sql.includes('sms_credits=sms_credits+1')){credits++;return {rows:[]};}throw new Error('Unexpected SQL');}) as any;
 globalThis.fetch=(async(url:any)=>{if(String(url).includes('/auth/login'))return new Response(JSON.stringify({data:{token:'test-token'}}),{status:200});sends++;if(mode==='timeout')throw new Error('timeout');return new Response(JSON.stringify(mode==='success'?{status:'success',id:'test'}:{status:'error',message:'rejected'}),{status:mode==='success'?200:400});}) as any;
 try{
  const results=await Promise.all([sendTenantSMS(1,'998900000000','test'),sendTenantSMS(1,'998900000000','test')]);assert.equal(results.filter(r=>r.success).length,1);assert.equal(sends,1);assert.equal(credits,0);
  credits=1;mode='reject';assert.equal((await sendTenantSMS(1,'998900000000','test')).success,false);assert.equal(credits,1);
  mode='timeout';assert.equal((await sendTenantSMS(1,'998900000000','test')).uncertain,true);assert.equal(credits,0);
 }finally{globalThis.fetch=original;await pool.end();}
});
