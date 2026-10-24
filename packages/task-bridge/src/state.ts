import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eventId, validateEvent, type TaskEvent } from './events.ts';
export interface Cursor {offset:number; identity:string; anchor:string; sessionId?:string; taskId?:string; desktop?:boolean; project?:string; discard?:boolean}
export interface Entry {seq:number; id:string; value:TaskEvent; notify:boolean}
export interface Data {version:1; epoch:string; seq:number; tasks:Record<string,TaskEvent>; seen:Record<string,true>; entries:Entry[]; cursors:Record<string,Cursor>; baseline?:string}
export function atomicWrite(file:string,value:unknown) {
  mkdirSync(dirname(file),{recursive:true}); const tmp=file+'.tmp';
  writeFileSync(tmp,JSON.stringify(value),{mode:0o600}); renameSync(tmp,file);
}
export class State {
  data:Data;
  readonly file:string;
  constructor(file:string) {
    this.file=file;
    this.data=existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : {version:1,epoch:randomUUID(),seq:0,tasks:{},seen:{},entries:[],cursors:{}};
    if(this.data.version!==1 || !this.data.epoch || !this.data.cursors) throw new Error('Unsupported or damaged state; preserve it and restore a backup.');
  }
  save(){atomicWrite(this.file,this.data);}
  accept(e:TaskEvent,notify=true):Entry|undefined {
    if(!validateEvent(e)) throw new Error('Invalid task event');
    const id=eventId(e); if(this.data.seen[id]) return;
    const key=JSON.stringify([e.source,e.sessionId,e.taskId]); const previous=this.data.tasks[key];
    if(previous && Date.parse(e.timestamp)<Date.parse(previous.timestamp)) return;
    if(previous && ['completed','failed','cancelled'].includes(previous.event)) return;
    if(previous?.event===e.event && e.event==='needs_attention')return;
    if(previous?.event==='running' && e.event==='running' && Date.parse(e.timestamp)-Date.parse(previous.timestamp)<5000)return;
    this.data.seen[id]=true;
    this.data.tasks[key]=e;
    const entry={seq:++this.data.seq,id,value:e,notify}; this.data.entries.push(entry);
    // Consumer cursors older than this window receive a reset, never a historical alert flood.
    if(this.data.entries.length>2000) this.data.entries.shift();
    return entry;
  }
  snapshot(){return {epoch:this.data.epoch,seq:this.data.seq,tasks:Object.values(this.data.tasks)};}
}
