import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createSuperAdminAuth } from '../server/security';

test('platform admin routes reject anonymous, forged, expired and legacy tokens', async () => {
  let time=1_790_000_000_000;
  const auth=createSuperAdminAuth('old-public-secret','private-session-secret',()=>time);
  const token=auth.generate();
  assert.ok(auth.verify(token));
  assert.ok(!token.includes('old-public-secret'));
  assert.equal(auth.verify(Buffer.from(`${time}:nonce:old-public-secret`).toString('base64')),false);
  assert.equal(auth.verify(token.slice(0,-1)+'!'),false);
  time+=24*60*60*1000+1;assert.equal(auth.verify(token),false);
  time-=24*60*60*1000+2;assert.equal(auth.verify(token),false);
  time++;
  assert.equal(createSuperAdminAuth('', 'private-session-secret').verify(token),false);
  const app=express();app.use('/api/admin',auth.requireAuth);app.get('/api/admin/stats',(_req,res)=>res.json({ok:true}));
  const server=createServer(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const address=server.address() as {port:number};const url=`http://127.0.0.1:${address.port}/api/admin/stats`;
    assert.equal((await fetch(url)).status,401);
    assert.equal((await fetch(url,{headers:{Authorization:'Bearer forged'}})).status,401);
    assert.equal((await fetch(url,{headers:{Authorization:`Bearer ${token}`}})).status,200);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
