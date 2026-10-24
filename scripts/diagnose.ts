import { join } from 'node:path';
import { homedir } from 'node:os';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { filesUnder } from '../packages/task-bridge/src/adapters/codex.ts';
const home=process.env.CODEX_HOME??join(homedir(),'.codex');
const files=(await filesUnder(join(home,'sessions'))).slice(-12);
for(const f of files){const counts:Record<string,number>={};let meta={};
  for await(const line of createInterface({input:createReadStream(f),crlfDelay:Infinity})){
    try{const r=JSON.parse(line),p=r.payload;if(r.type==='session_meta')meta={originator:p.originator,source:typeof p.source==='string'?p.source:'subagent',thread_source:p.thread_source,version:p.cli_version};if(r.type==='event_msg'&&typeof p.type==='string')counts[p.type]=(counts[p.type]??0)+1;}catch{}
  }
  console.log(JSON.stringify({meta,events:counts}));
}
console.log('Read-only diagnostics: no prompts, tool arguments, credentials, or database access.');
