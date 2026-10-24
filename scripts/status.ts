import { resolve, join } from 'node:path';
import { BridgeClient } from '../packages/coopanion-world/src/client.ts';
const dir=resolve(process.env.COO_MONITOR_DATA??'.local');
const client=new BridgeClient(join(dir,'connection.json'),join(dir,'status-cursor-unused'));
const state=await client.request('/v1/state');
console.table(state.tasks.map((t:any)=>({task:t.taskId,project:t.project??'(hidden)',state:t.event,observed:t.timestamp})));
