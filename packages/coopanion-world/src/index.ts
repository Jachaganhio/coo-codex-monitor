import { join } from 'node:path';
import { BridgeClient, type Entry } from './client.ts';
// Structural subset of Cortico api=6. No runtime dependency on private Core objects.
interface Host {pushEvent(event:{type:string;ts:string;source:string;senderKey:string;text:string}):Promise<unknown>}
interface Config {enabled:boolean;connectionFile:string;mode:'status'|'model';notifyStarted:boolean}
interface Context {cfg:Config;dataDir:string}
export interface BubbleSink {
  ready():boolean;
  show(text:string):Promise<boolean>;
}
const messages:Record<string,string>={completed:'你的 Codex 任务已经完成啦！记得检查结果。',needs_attention:'Codex 需要你确认一下，请打开任务窗口。',cancelled:'Codex 任务已中断。',failed:'Codex 报告任务失败，请查看任务窗口。',started:'Codex 开始执行任务啦！'};
export class MonitorWorld {
  readonly id='codex-monitor';
  readonly client:BridgeClient;
  private stopped=true;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private pending:Promise<void>|undefined;
  readonly cfg:Config; readonly sink?:BubbleSink;
  constructor(cfg:Config,dataDir:string,sink?:BubbleSink){
    this.cfg=cfg;this.sink=sink;
    this.client=new BridgeClient(cfg.connectionFile,join(dataDir,'codex-monitor','cursor.json'));
  }
  envPromptVars(){return null;}
  tools(){return [{name:'codex_tasks',description:'Read last observed local Codex states. Running means recent evidence, not guaranteed current liveness. Never infer completion from silence.',tags:['read'] as const,parameters:{type:'object',properties:{},additionalProperties:false},handler:async()=>JSON.stringify({connected:this.client.online,...this.client.snapshot})}];}
  webUi(){
    const tasks=this.client.snapshot.tasks;
    return {label:'Codex Task Monitor',lamps:[{label:'Local Bridge',state:this.client.online?'online' as const:'offline' as const,hint:this.sink?'Model-free bubbles enabled':'Status only by default; model mode uses subscription/API'}],badges:[{label:'最近观察到运行',value:tasks.filter(t=>['started','running'].includes(t.event)).length},{label:'等待操作',value:tasks.filter(t=>t.event==='needs_attention').length},{label:'已完成',value:tasks.filter(t=>t.event==='completed').length}],panels:[{id:'tasks',title:'任务状态',getMethods:['list']}],invoke:async(panel:string,method:string)=>{if(panel!=='tasks'||method!=='list')throw new Error('Unknown method');return {connected:this.client.online,...this.client.snapshot};}};
  }
  async deliver(e:Entry,host:Host):Promise<boolean>{
    let text=messages[e.value.event];if(!text || e.value.event==='started'&&!this.cfg.notifyStarted)return true;
    if(e.value.event==='completed')text=`Codex 本轮已结束。\n${e.value.summary ? '答复摘录：\n'+e.value.summary : '暂无可提取的结论，请在 Codex 查看结果。'}`;
    if(this.sink){if(!this.sink.ready())return false;return this.sink.show(text);}
    if(this.cfg.mode==='model')await host.pushEvent({type:'codex-monitor.notice',ts:e.value.timestamp,source:this.id,senderKey:e.value.sessionId,text:`${text} Task ${e.value.taskId}. Use pet_say to tell the person.`});
    return true;
  }
  async start(host:Host){this.stopped=false;const tick=()=>{if(this.stopped)return;this.pending=this.client.poll(e=>this.deliver(e,host)).finally(()=>{if(!this.stopped)this.timer=setTimeout(tick,1000);});};tick();}
  async stop(){this.stopped=true;clearTimeout(this.timer);await this.pending;}
}
export function createMonitorDefinition(sink?:BubbleSink){return {
  id:'codex-monitor',label:'Codex Task Monitor',
  defaults:():Config=>({enabled:false,connectionFile:process.env.COO_MONITOR_CONNECTION??'',mode:'status',notifyStarted:true}),
  preflight:(ctx:Context)=>{if(!ctx.cfg.connectionFile)throw new Error('Set COO_MONITOR_CONNECTION to Bridge connection.json');},
  create:(ctx:Context)=>new MonitorWorld(ctx.cfg,ctx.dataDir,sink),
  describe:{tools:[{name:'codex_tasks',description:'Read observed local Codex tasks.',tags:['read'] as const,parameters:{type:'object',properties:{},additionalProperties:false}}],events:[{type:'codex-monitor.notice',description:{zh:'明确观察到的 Codex 任务变化。',en:'An observed Codex task transition.'}}]},
};}
export default createMonitorDefinition();
