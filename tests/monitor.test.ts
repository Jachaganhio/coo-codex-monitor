import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,appendFileSync,mkdirSync,readFileSync,renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { State } from '../packages/task-bridge/src/state.ts';
import { CodexAdapter } from '../packages/task-bridge/src/adapters/codex.ts';
import { makeEvent } from '../packages/task-bridge/src/events.ts';
import { hookEvent } from '../packages/task-bridge/src/adapters/hooks.ts';
import { createBridge } from '../packages/task-bridge/src/server.ts';
import { BridgeClient } from '../packages/coopanion-world/src/client.ts';
import { MonitorWorld } from '../packages/coopanion-world/src/index.ts';
const line=(x:unknown)=>JSON.stringify(x)+'\n';
const now=()=>new Date().toISOString();
const meta=(id='s')=>line({type:'session_meta',payload:{id,originator:'Codex Desktop',source:'vscode',thread_source:'user',cwd:'C:\\private\\project'}});
const evt=(type:string,turn_id='t',timestamp=now())=>line({type:'event_msg',timestamp,payload:{type,turn_id}});
function setup(){const dir=mkdtempSync(join(tmpdir(),'coo-test-'));const sessions=join(dir,'sessions');mkdirSync(sessions);const state=new State(join(dir,'state.json'));return {dir,sessions,state,adapter:new CodexAdapter(sessions,state),file:join(sessions,'r.jsonl')};}
test('new files, two parallel sessions, explicit completion and persistent offsets',async()=>{
  const x=setup();await x.adapter.poll();writeFileSync(x.file,meta()+evt('task_started'));
  writeFileSync(join(x.sessions,'b.jsonl'),meta('b')+evt('task_started','b-turn'));await x.adapter.poll();
  assert.equal(Object.keys(x.state.data.tasks).length,2);appendFileSync(x.file,evt('task_complete'));await x.adapter.poll();
  assert.equal(x.state.data.entries.filter(e=>e.value.event==='completed').length,1);
  const state=new State(x.state.file);await new CodexAdapter(x.sessions,state).poll();assert.equal(state.data.seq,x.state.data.seq);
  assert.equal(Object.values(state.data.tasks).filter(e=>e.event==='started').length,1);
});
test('history is reconstructed silently, historical unfinished task is unknown',async()=>{
  const x=setup();writeFileSync(x.file,meta()+evt('task_started','t','2000-01-01T00:00:00Z')+evt('task_complete','t','2000-01-01T00:00:01Z')+evt('task_started','u','2000-01-01T00:00:02Z'));
  await x.adapter.poll();assert.ok(x.state.data.entries.every(e=>!e.notify));assert.ok(Object.values(x.state.data.tasks).some(e=>e.event==='unknown'));
});
test('partial lines survive restart; malformed lines do not block following events',async()=>{
  const x=setup();await x.adapter.poll();const text=meta()+evt('task_started');writeFileSync(x.file,text.slice(0,-4));await x.adapter.poll();
  const s=new State(x.state.file);appendFileSync(x.file,text.slice(-4)+'{broken}\n'+evt('task_complete'));await new CodexAdapter(x.sessions,s).poll();
  assert.equal(Object.values(s.data.tasks)[0].event,'completed');
});
test('truncation, replacement and rotation deduplicate terminal records',async()=>{
  const x=setup();await x.adapter.poll();const text=meta()+evt('task_started')+evt('task_complete');writeFileSync(x.file,text);await x.adapter.poll();
  renameSync(x.file,join(x.sessions,'rotated.jsonl'));writeFileSync(x.file,text);await x.adapter.poll();
  writeFileSync(x.file,meta()+evt('task_started','new'));await x.adapter.poll();
  assert.equal(x.state.data.entries.filter(e=>e.value.event==='completed').length,1);
  assert.equal(Object.values(x.state.data.tasks).length,2);
});
test('same-size rewrite behind the offset is detected by the anchor',async()=>{
  const x=setup();await x.adapter.poll();const stamp=now();
  const a=meta()+evt('task_started','a',stamp),b=meta()+evt('task_started','b',stamp);
  assert.equal(Buffer.byteLength(a),Buffer.byteLength(b));writeFileSync(x.file,a);await x.adapter.poll();
  writeFileSync(x.file,b);await x.adapter.poll();assert.equal(Object.values(x.state.data.tasks).length,2);
});
test('silence is never completion; generic activity does not resolve permissions',async()=>{
  const x=setup();await x.adapter.poll();writeFileSync(x.file,meta()+evt('task_started'));await x.adapter.poll();await x.adapter.poll();
  assert.equal(Object.values(x.state.data.tasks)[0].event,'started');
  x.state.accept(makeEvent('s','t','needs_attention',now(),'hook'));appendFileSync(x.file,evt('token_count'));await x.adapter.poll();assert.equal(Object.values(x.state.data.tasks)[0].event,'needs_attention');
});
test('internal reviewers and non-Desktop sessions are excluded; text never stored',async()=>{
  const x=setup();await x.adapter.poll();writeFileSync(x.file,line({type:'session_meta',payload:{id:'private',originator:'Codex Desktop',source:{subagent:{other:'guardian'}},thread_source:'guardian_review'}})+evt('task_started'));
  await x.adapter.poll();assert.equal(x.state.data.seq,0);
  writeFileSync(x.file,meta()+line({type:'event_msg',timestamp:now(),payload:{type:'task_started',turn_id:'real',prompt:'SECRET_SOURCE'}}));await x.adapter.poll();
  assert.ok(!readFileSync(x.state.file,'utf8').includes('SECRET_SOURCE'));assert.ok(!readFileSync(x.state.file,'utf8').includes('private\\\\project'));
});
test('hook semantics require turn ID; Stop is not completion; interruption is cancellation',()=>{
  assert.equal(hookEvent({hook_event_name:'Stop',session_id:'s',turn_id:'t'})?.event,'unknown');
  assert.equal(hookEvent({hook_event_name:'Interrupt',session_id:'s',turn_id:'t'})?.event,'cancelled');
  assert.equal(hookEvent({hook_event_name:'PermissionRequest',session_id:'s'}),undefined);
});
test('failed shell/tool calls do not mean task failure',async()=>{
  const x=setup();await x.adapter.poll();writeFileSync(x.file,meta()+evt('task_started')+line({type:'response_item',payload:{type:'function_call_output',output:'exit code 1'}}));await x.adapter.poll();assert.equal(Object.values(x.state.data.tasks)[0].event,'started');
});
test('real HTTP authentication, browser rejection, input validation, restart-safe consumer',async(t)=>{
  const x=setup(), token='a'.repeat(64);const server=createBridge(x.state,token);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const addr=server.address() as {port:number};const url=`http://127.0.0.1:${addr.port}`;const headers={Authorization:'Bearer '+token};
  assert.equal((await fetch(url+'/v1/state')).status,401);
  assert.equal((await fetch(url+'/v1/state',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(url+'/v1/events',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,400);
  const tokenFile=join(x.dir,'token');writeFileSync(tokenFile,token);const connection=join(x.dir,'connection.json');writeFileSync(connection,JSON.stringify({url,tokenFile}));
  const cursor=join(x.dir,'consumer.json'),client=new BridgeClient(connection,cursor);let shown=0;
  await client.poll(async()=>{shown++;return true;});
  x.state.accept(makeEvent('s','t','completed',now(),'rollout'));x.state.save();
  await client.poll(async()=>{shown++;return true;});assert.equal(shown,1);
  await new BridgeClient(connection,cursor).poll(async()=>{shown++;return true;});assert.equal(shown,1);
  const fresh=new BridgeClient(connection,join(x.dir,'new-consumer'));await fresh.poll(async()=>{shown++;return true;});assert.equal(shown,1);
});
test('World uses no model by default; bubble sink queues and unavailable sink retries',async()=>{
  const x=setup();let modelCalls=0,bubbles=0;const host={pushEvent:async()=>{modelCalls++;}};
  const cfg={enabled:true,mode:'status' as const,connectionFile:'',notifyStarted:false};
  const entry={seq:1,id:'id',notify:true,value:makeEvent('s','t','completed',now(),'rollout')};
  assert.equal(await new MonitorWorld(cfg,x.dir).deliver(entry,host),true);assert.equal(modelCalls,0);
  const world=new MonitorWorld(cfg,x.dir,{ready:()=>true,show:async()=>{bubbles++;return true;}});
  await world.deliver(entry,host);assert.equal(bubbles,1);assert.equal(modelCalls,0);
  assert.equal(await new MonitorWorld(cfg,x.dir,{ready:()=>false,show:async()=>true}).deliver(entry,host),false);
});
