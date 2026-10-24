import { makeEvent, type TaskEvent, type EventType } from '../events.ts';
const mapping:Record<string,EventType>={UserPromptSubmit:'started',PreToolUse:'running',PostToolUse:'running',PermissionRequest:'needs_attention',Interrupt:'cancelled',Stop:'unknown'};
export function hookEvent(input:any,now=new Date().toISOString()):TaskEvent|undefined {
  const event=mapping[input?.hook_event_name];
  if(!event || typeof input.session_id!=='string' || typeof input.turn_id!=='string')return;
  return makeEvent(input.session_id,input.turn_id,event,now,'hook');
}
