import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractConclusion } from '../packages/task-bridge/src/summary.ts';
import { State } from '../packages/task-bridge/src/state.ts';
import { CodexAdapter } from '../packages/task-bridge/src/adapters/codex.ts';
import { MonitorWorld } from '../packages/coopanion-world/src/index.ts';
import { makeEvent } from '../packages/task-bridge/src/events.ts';
test('start and completion excerpts reach bubbles without model calls',async()=>{
  const shown:string[]=[];let calls=0;
  const world=new MonitorWorld({enabled:true,mode:'status',connectionFile:'',notifyStarted:true},mkdtempSync(join(tmpdir(),'bubble-')),{ready:()=>true,show:async text=>{shown.push(text);return true;}});
  const host={pushEvent:async()=>{calls++;}};
  const start=makeEvent('s','t','started',new Date().toISOString(),'rollout');
  await world.deliver({seq:1,id:'start',notify:true,value:start},host);
  await world.deliver({seq:2,id:'end',notify:true,value:{...start,event:'completed',summary:'修改完成，测试尚未运行。'}},host);
  assert.equal(shown.length,2);assert.match(shown[0],/开始/);assert.match(shown[1],/尚未运行/);assert.equal(calls,0);
});
test('excerpts preserve negative verification and redact common credentials',()=>{
  const r=extractConclusion('已修改登录逻辑。\n\n- 测试失败，尚未完成。\n- token=supersecretvalue\n```js\nexecuteDangerousCode()\n```')!;
  assert.match(r.summary,/测试失败/);assert.doesNotMatch(r.summary,/executeDangerous/);
  assert.doesNotMatch(r.finalAnswer,/supersecretvalue/);
  assert.equal(extractConclusion(undefined),undefined);
  assert.ok(extractConclusion('x'.repeat(100000))!.finalAnswer.length<=64000);
});
test('only explicit completion carries its own answer; historical answers are not collected',()=>{
  const state=new State(join(mkdtempSync(join(tmpdir(),'conclusion-')),'state.json'));
  const adapter=new CodexAdapter('',state);const c={offset:0,identity:'test',anchor:'',desktop:true,sessionId:'session'};
  const send=(type:string,turn_id:string,timestamp:string,answer?:string)=>adapter.record({type:'event_msg',timestamp,payload:{type,turn_id,last_agent_message:answer}},c,'2026-01-01T00:00:00Z');
  send('task_complete','old','2025-12-01T00:00:00Z','旧结论');
  send('task_started','new','2026-01-02T00:00:00Z');
  send('task_complete','new','2026-01-02T00:01:00Z','修改完成，测试尚未运行。');
  send('task_complete','other','2026-01-02T00:02:00Z');
  const tasks=state.snapshot().tasks;
  assert.equal(tasks[0].finalAnswer,undefined);assert.match(tasks[1].summary!,/尚未运行/);assert.equal(tasks[2].summary,undefined);
});
