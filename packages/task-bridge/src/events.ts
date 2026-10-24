import { createHash } from 'node:crypto';
export const eventTypes = ['started','running','needs_attention','completed','failed','cancelled','unknown'] as const;
export type EventType = typeof eventTypes[number];
export interface TaskEvent {
  source: 'codex'; sessionId: string; taskId: string; event: EventType;
  title: string; timestamp: string; detail: string; project?: string;
  evidence: 'hook' | 'rollout';
}
export const details: Record<EventType,string> = {
  started:'Codex 开始执行任务', running:'观察到 Codex 活动', needs_attention:'Codex 正在请求人工操作',
  completed:'Codex 已结束当前轮次，请检查结果', failed:'Codex 明确报告任务失败',
  cancelled:'Codex 任务已被中断', unknown:'当前任务状态无法确认',
};
export function eventId(e: TaskEvent): string {
  // Terminal notifications deduplicate across hooks, rollouts, rotations and restarts.
  return createHash('sha256').update(JSON.stringify([e.source,e.sessionId,e.taskId,e.event,
    ['completed','failed','cancelled','started'].includes(e.event) ? '' : e.timestamp])).digest('hex');
}
export function validateEvent(x: unknown): x is TaskEvent {
  if (!x || typeof x !== 'object') return false;
  const e = x as TaskEvent;
  return e.source === 'codex' && ['hook','rollout'].includes(e.evidence) && eventTypes.includes(e.event)
    && [e.sessionId,e.taskId].every(v=>typeof v==='string' && /^[\w.-]{1,160}$/.test(v))
    && typeof e.timestamp==='string' && Number.isFinite(Date.parse(e.timestamp))
    && typeof e.title==='string' && e.title.length<=160 && typeof e.detail==='string' && e.detail.length<=200
    && (e.project===undefined || typeof e.project==='string' && e.project.length<=100);
}
export function makeEvent(sessionId:string,taskId:string,event:EventType,timestamp:string,evidence:TaskEvent['evidence'],project?:string):TaskEvent {
  return {source:'codex',sessionId,taskId,event,title:'Codex 任务',timestamp,detail:details[event],evidence,...(project ? {project} : {})};
}
