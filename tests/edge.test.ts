import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {State} from '../packages/task-bridge/src/state.ts';
import {CodexAdapter} from '../packages/task-bridge/src/adapters/codex.ts';
import {createBridge} from '../packages/task-bridge/src/server.ts';
import {makeEvent} from '../packages/task-bridge/src/events.ts';
import {BridgeClient} from '../packages/coopanion-world/src/client.ts';
test('oversized JSON line is skipped without losing following valid events',async()=>{
  const d=mkdtempSync(join(tmpdir(),'coo-large-'));mkdirSync(join(d,'sessions'));const state=new State(join(d,'state'));const a=new CodexAdapter(join(d,'sessions'),state);await a.poll();
  const meta={type:'session_meta',payload:{id:'s',originator:'Codex Desktop',source:'vscode'}};
  const record={type:'event_msg',timestamp:new Date().toISOString(),payload:{type:'task_started',turn_id:'t'}};
  writeFileSync(join(d,'sessions','a.jsonl'),JSON.stringify(meta)+'\n'+JSON.stringify({huge:'x'.repeat(5*1024*1024)})+'\n'+JSON.stringify(record)+'\n');
  await a.poll();assert.equal(Object.values(state.data.tasks)[0].event,'started');
});
test('real hook relay posts sanitized metadata without keys or model access',async(t)=>{
  const d=mkdtempSync(join(tmpdir(),'coo-relay-')),s=new State(join(d,'state')),token='z'.repeat(64),server=createBridge(s,token);
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const url=`http://127.0.0.1:${(server.address() as any).port}`;
  writeFileSync(join(d,'token'),token);writeFileSync(join(d,'connection.json'),JSON.stringify({url,tokenFile:join(d,'token')}));copyFileSync('scripts/hook-relay.mjs',join(d,'relay.mjs'));
  const child=spawn(process.execPath,[join(d,'relay.mjs')],{env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}});let output='';child.stdout.on('data',d=>output+=d);
  child.stdin.end(JSON.stringify({hook_event_name:'PermissionRequest',session_id:'s',turn_id:'t',prompt:'PRIVATE PROMPT',tool_input:{command:'SECRET CODE'}}));
  const exit=await new Promise(r=>child.on('exit',r));assert.equal(exit,0);assert.equal(output,'{}');assert.equal(Object.values(s.data.tasks)[0].event,'needs_attention');
  assert.ok(!readFileSync(s.file,'utf8').includes('PRIVATE'));assert.ok(!readFileSync(s.file,'utf8').includes('SECRET'));
});
test('consumer retries unavailable UI; persisted claim prevents duplicate after crash',async(t)=>{
  const d=mkdtempSync(join(tmpdir(),'coo-claim-')),s=new State(join(d,'state')),token='x'.repeat(64),server=createBridge(s,token);
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  writeFileSync(join(d,'token'),token);const connection=join(d,'connection'),cursor=join(d,'cursor');writeFileSync(connection,JSON.stringify({url:`http://127.0.0.1:${(server.address() as any).port}`,tokenFile:join(d,'token')}));
  const client=new BridgeClient(connection,cursor);await client.poll(async()=>true);s.accept(makeEvent('s','t','completed',new Date().toISOString(),'rollout'));
  await client.poll(async()=>false);let attempts=0;
  await client.poll(async()=>{attempts++;throw new Error('simulated crash after UI display');});
  await new BridgeClient(connection,cursor).poll(async()=>{attempts++;return true;});assert.equal(attempts,1);
});
