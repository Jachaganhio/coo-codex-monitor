// Hook input can include source code and prompts. Only the allowlisted metadata leaves this process.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
let data='';let bytes=0;
try {
  for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>8*1024*1024)throw new Error('Input too large');data+=chunk;}
  const input=JSON.parse(data);
  const map={UserPromptSubmit:'started',PreToolUse:'running',PostToolUse:'running',PermissionRequest:'needs_attention',Interrupt:'cancelled',Stop:'unknown'};
  const event=map[input.hook_event_name];
  if(event && /^[\w.-]{1,160}$/.test(input.session_id??'') && /^[\w.-]{1,160}$/.test(input.turn_id??'')){
    const c=JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),'connection.json'),'utf8'));
    const url=new URL(c.url);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password)throw new Error('Nonlocal bridge');
    const e={source:'codex',sessionId:input.session_id,taskId:input.turn_id,event,title:'Codex task',detail:'Observed hook',timestamp:new Date().toISOString(),evidence:'hook'};
    await fetch(url.origin+'/v1/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+readFileSync(c.tokenFile,'utf8').trim()},body:JSON.stringify(e),signal:AbortSignal.timeout(700),redirect:'error'});
  }
} catch { /* Notifications must not block or change the user's coding turn. Rollouts recover completion. */ }
// Stop requires JSON; this adds no context and never changes permission/continuation decisions.
process.stdout.write('{}');
