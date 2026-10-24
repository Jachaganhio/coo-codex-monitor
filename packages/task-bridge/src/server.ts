import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { State } from './state.ts';
import { validateEvent, makeEvent } from './events.ts';
export function createBridge(state:State,token:string) {
  if(token.length<32)throw new Error('Token must contain at least 32 characters');
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    const reply=(code:number,data:unknown)=>{res.writeHead(code);res.end(JSON.stringify(data));};
    const auth=Buffer.from(req.headers.authorization??'');const expected=Buffer.from('Bearer '+token);
    if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host??'') || req.headers.origin || req.headers['sec-fetch-site'])return reply(403,{error:'Browser access disabled'});
    if(auth.length!==expected.length || !timingSafeEqual(auth,expected))return reply(401,{error:'Unauthorized'});
    const url=new URL(req.url??'/','http://127.0.0.1');
    if(req.method==='GET' && url.pathname==='/v1/state')return reply(200,state.snapshot());
    if(req.method==='GET' && url.pathname==='/v1/events') {
      const after=Number(url.searchParams.get('after'));const epoch=url.searchParams.get('epoch');
      if(!Number.isSafeInteger(after)||after<0)return reply(400,{error:'Invalid cursor'});
      const reset=epoch!==state.data.epoch || after>state.data.seq || after<(state.data.entries[0]?.seq??1)-1;
      return reply(200,{epoch:state.data.epoch,seq:state.data.seq,reset,events:reset?[]:state.data.entries.filter(e=>e.seq>after)});
    }
    if(req.method==='POST' && url.pathname==='/v1/events') {
      if(req.headers['content-type']!=='application/json')return reply(415,{error:'Expected JSON'});
      let body='';let bytes=0;
      try {
        for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){reply(413,{error:'Too large'});req.destroy();return;}body+=chunk;}
        const e=JSON.parse(body);if(!validateEvent(e)||e.evidence!=='hook')return reply(400,{error:'Invalid hook event'});
        // Ignore any arbitrary title/detail supplied by a caller, even one with the local token.
        const entry=state.accept(makeEvent(e.sessionId,e.taskId,e.event,e.timestamp,'hook'));state.save();
        return reply(200,{accepted:!!entry});
      }catch{return reply(400,{error:'Invalid request'});}
    }
    reply(404,{error:'Not found'});
  });
}
