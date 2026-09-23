import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { registerRoutes } from '../server/routes';
import { storage, pool } from '../server/storage';

test('real route registration protects platform APIs and financial mutations', async () => {
  // No production database or credentials. Anything that reaches an unexpected query fails.
  pool.query = (async () => { throw new Error('Unexpected database access'); }) as any;
  pool.connect = (async () => { throw new Error('Unexpected database access'); }) as any;
  storage.getUser = async () => ({id:'test-teacher',tenantId:1,role:'teacher'}) as any;
  const app=express();app.use(express.json());
  app.use((req:any,_res,next)=>{req.session=req.headers['x-test-teacher']?{userId:'test-teacher',tenantId:1,role:'teacher'}:{};next();});
  const server=createServer(app);await registerRoutes(server,app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const {port}=server.address() as {port:number};const url=`http://127.0.0.1:${port}`;
    for(const path of ['/api/admin/plans','/api/admin/tenants','/api/admin/stats','/api/payments','/api/teacher-collected-payments','/api/expenses'])assert.equal((await fetch(url+path)).status,401,path);
    for(const [method,path] of [['POST','/api/payments'],['PUT','/api/payments/1'],['DELETE','/api/payments/1'],['POST','/api/teacher-collected-payments/1/confirm'],['POST','/api/teacher-collected-payments/1/reject']])assert.equal((await fetch(url+path,{method,headers:{'x-test-teacher':'1','Content-Type':'application/json'},body:'{}'})).status,403,path);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();}
});
