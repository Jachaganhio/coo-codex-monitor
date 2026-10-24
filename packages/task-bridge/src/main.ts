import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, readFileSync, existsSync, writeFileSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { State, atomicWrite } from './state.ts';
import { CodexAdapter } from './adapters/codex.ts';
import { createBridge } from './server.ts';
const dir=resolve(process.env.COO_MONITOR_DATA??'.local');mkdirSync(dir,{recursive:true});
const lock=join(dir,'bridge.lock');
if(existsSync(lock)){const pid=Number(readFileSync(lock,'utf8'));let alive=true;try{process.kill(pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')alive=false;}if(alive)throw new Error('Bridge already running or stale lock needs manual review');unlinkSync(lock);}
const fd=openSync(lock,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);
process.on('exit',()=>{try{unlinkSync(lock);}catch{}});
const tokenFile=join(dir,'token');
if(!existsSync(tokenFile))writeFileSync(tokenFile,randomBytes(32).toString('hex'),{mode:0o600});
const token=readFileSync(tokenFile,'utf8').trim();
const port=Number(process.env.COO_MONITOR_PORT??43129);
const state=new State(join(dir,'state.json'));
for(const task of Object.values(state.data.tasks))if(['started','running','needs_attention'].includes(task.event)){
  task.event='unknown';task.detail='监控曾中断，等待新的明确事件';
}
const adapter=new CodexAdapter(join(process.env.CODEX_HOME??join(homedir(),'.codex'),'sessions'),state,process.env.COO_MONITOR_PROJECT_NAMES==='1');
await adapter.poll();
const server=createBridge(state,token);
await new Promise<void>((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
atomicWrite(join(dir,'connection.json'),{url:`http://127.0.0.1:${port}`,tokenFile});
console.log(`Task Bridge listening on 127.0.0.1:${port}; metadata only; no model/API key`);
let stopped=false;
async function loop(){if(stopped)return;try{await adapter.poll();}catch{console.error('Session scan failed; retrying; task completion is not inferred.');}if(!stopped)setTimeout(loop,1000);}
void loop();
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{stopped=true;server.close();});
