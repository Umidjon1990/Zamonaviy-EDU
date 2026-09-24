import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {registerRoutes} from '../server/routes';
import {storage,pool} from '../server/storage';

test('role and tenant matrix across the actual CRM routes',async t=>{
 pool.query=(async()=>{throw new Error('Unexpected DB access');}) as any;pool.connect=(async()=>{throw new Error('Unexpected DB access');}) as any;
 let suspended=false,version=0,changed:any=null;
 storage.getTenant=async()=>({id:1,status:suspended?'suspended':'active'}) as any;
 storage.getUser=async(id)=>({id,tenantId:1,role:id==='admin'?'markaz_admin':id==='manager'?'manager':'teacher',authVersion:version,permissions:['edit_group','add_student','remove_student','move_student']}) as any;
 storage.getGroup=async(id,tenant)=>id===99?undefined:({id,tenantId:tenant,teacherId:id===1?'teacher':'other',subjectId:7,archivedAt:null}) as any;
 storage.getTeacher=async(id)=>({id,tenantId:1,role:'teacher'}) as any;
 storage.getStudentsByTeacher=async()=>[{id:1}] as any;
 storage.getStudent=async(id)=>id===99?undefined:({id,tenantId:1,archivedAt:null}) as any;
 storage.getStudentGroups=async(id)=>id===1?[{studentId:id,groupId:1}] as any:[];
 storage.getAttendanceById=async()=>({id:1,studentId:1,groupId:2,status:'present',date:new Date('2026-09-24')}) as any;
 storage.getCashReceipt=async(id)=>id===99?undefined:({id,tenantId:1,submittedBy:id===1?'teacher':'other'}) as any;
 storage.getCashReceiptLogs=async()=>[];
 storage.updateGroup=async(_id,_tenant,body)=>{changed=body;return {id:1,subjectId:7,...body} as any;};
 storage.updateStudent=async(_id,_tenant,body)=>{changed=body;return {id:1,...body} as any;};
 const app=express();app.use(express.json());app.use((req:any,_res,next)=>{const role=String(req.headers['x-role']||'teacher');req.session={userId:role,tenantId:1,role,authVersion:0};next();});const server=createServer(app);await registerRoutes(server,app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const call=(path:string,method='GET',body?:any,role='teacher')=>fetch(base+path,{method,headers:{'x-role':role,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
 await t.test('teacher cannot mutate foreign students/groups or read tenant finance',async()=>{
  for(const [path,method,body] of [['/api/students/2','PATCH',{firstName:'Wrong'}],['/api/students/2','DELETE',{}],['/api/groups/2','PATCH',{name:'Wrong'}],['/api/groups/1','DELETE',{}],['/api/branding','PATCH',{receiptTitle:'Wrong'}],['/api/finance/dashboard','GET',null],['/api/stats','GET',null],['/api/attendance?groupId=2','GET',null]])assert.equal((await call(path as string,method as string,body)).status,403,path as string);
 });
 await t.test('mass assignment, invalid grade, foreign membership and forged balance are rejected',async()=>{
  for(const [path,method,body] of [['/api/groups/1','PATCH',{tenantId:2}],['/api/students/1','PATCH',{balance:999}],['/api/students','POST',{firstName:'A',lastName:'B',telegramChatId:'1'}],['/api/grades','POST',{studentId:1,groupId:1,date:'2026-09-24',grade:999}]])assert.equal((await call(path as string,method as string,body,'admin')).status,400,path as string);
  assert.equal((await call('/api/students/bulk-add','POST',{text:'Sample',groupId:99})).status,404);
  assert.equal((await call('/api/attendance/1','PATCH',{status:'absent'})).status,403);
 });
 await t.test('cash detail and log require both tenant and submitter ownership',async()=>{
  assert.equal((await call('/api/cash-receipts/99/logs')).status,404);
  assert.equal((await call('/api/cash-receipts/2/logs')).status,403);
  assert.equal((await call('/api/cash-receipts/1/logs')).status,200);
 });
 await t.test('authorized partial edit keeps omitted fields and valid teacher student edit succeeds',async()=>{
  const r=await call('/api/groups/1','PATCH',{name:'Renamed'});assert.equal(r.status,200);assert.equal((await r.json()).subjectId,7);assert.equal('subjectId' in changed,false);
  assert.equal((await call('/api/students/1','PATCH',{firstName:'Allowed'})).status,200);assert.equal(changed.firstName,'Allowed');
 });
 await t.test('suspension and password revision immediately stop an existing session',async()=>{
  suspended=true;assert.equal((await call('/api/students/1')).status,403);suspended=false;
  version=1;assert.equal((await call('/api/students/1')).status,401);version=0;
  assert.equal((await call('/api/unknown-route')).status,404);
 });
 }finally{await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
});
