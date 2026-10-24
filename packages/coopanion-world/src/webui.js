// Cortico WebUiClientBundle; no direct browser access to the authenticated Bridge.
export default {panels:{tasks:{mount(ctx){
  const status=document.createElement('p');
  const table=document.createElement('table');
  const head=document.createElement('tr');
  for(const label of ['任务','项目','最后明确状态','观察时间']){const th=document.createElement('th');th.textContent=label;head.append(th);}
  const body=document.createElement('tbody');table.append(head,body);ctx.root.append(status,table);
  const labels={started:'开始',running:'运行活动',needs_attention:'需要操作',completed:'轮次完成',cancelled:'中断',failed:'失败',unknown:'未知'};
  let busy=false;
  async function refresh(){if(busy)return;busy=true;try{
    const s=await ctx.invoke('list');status.textContent=s.connected?'Bridge 已连接；状态是最近观察结果，不代表实时存活保证。':'Bridge 未连接；以下是缓存状态。';
    body.replaceChildren();
    for(const task of [...s.tasks].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).slice(0,100)){
      const row=document.createElement('tr');for(const value of [task.taskId.slice(0,12),task.project??'未启用项目名',labels[task.event]??'未知',new Date(task.timestamp).toLocaleString()]){const td=document.createElement('td');td.textContent=value;td.style.padding='6px 12px';row.append(td);}body.append(row);
    }
  }catch{status.textContent='暂时无法读取任务状态。';}finally{busy=false;}}
  void refresh();ctx.interval(()=>void refresh(),2000);
}}}};
