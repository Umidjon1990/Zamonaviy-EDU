import test from 'node:test';
import assert from 'node:assert/strict';
import { runBotPolling } from '../server/bot-polling';

test('Telegram conflict and network failure recover without crashing the server', async () => {
  let attempts=0;const delays:number[]=[];const errors:unknown[]=[];
  await runBotPolling(async()=>{
    attempts++;
    if(attempts===1)throw {error_code:409};
    if(attempts===2)throw new Error('network unavailable');
  },{stopped:()=>false,sleep:async ms=>{delays.push(ms);},onError:(code,retrying)=>errors.push({code,retrying})});
  assert.equal(attempts,3);assert.deepEqual(delays,[5000,10000]);assert.ok(errors.every((e:any)=>e.retrying));
});

test('invalid bot token stops retries; shutdown cancels recovery',async()=>{
  let attempts=0;
  await runBotPolling(async()=>{attempts++;throw {error_code:401};},{stopped:()=>false,onError:()=>{},sleep:async()=>assert.fail('must not retry')});
  assert.equal(attempts,1);
  let stopped=false;
  await runBotPolling(async()=>{throw {error_code:409};},{stopped:()=>stopped,onError:()=>{},sleep:async()=>{stopped=true;}});
  assert.equal(stopped,true);
});
