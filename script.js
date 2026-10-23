const $ = (s) => document.querySelector(s);
const tasksBody = $("#tasksTable tbody");
const vmsBody = $("#vmsTable tbody");
const scheduleBody = $("#scheduleTable tbody");
const comparisonBody = $("#comparisonTable tbody");
const defaults = {
  tasks: [
    {id:"T1", duration:4, cpu:1, deps:""},
    {id:"T2", duration:3, cpu:1, deps:"T1"},
    {id:"T3", duration:5, cpu:2, deps:"T1"},
    {id:"T4", duration:2, cpu:1, deps:"T2"},
    {id:"T5", duration:3, cpu:2, deps:"T3,T4"}
  ],
  vms: [{name:"VM-1", cpu:2}, {name:"VM-2", cpu:1}, {name:"VM-3", cpu:2}]
};
let latestCSV = "";

function esc(s){return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderTasks(items=defaults.tasks){
  tasksBody.innerHTML="";
  items.forEach(t=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><input aria-label="Task ID" class="task-id" value="${esc(t.id)}"></td>
    <td><input aria-label="Duration" class="task-duration" type="number" min="1" value="${t.duration}"></td>
    <td><input aria-label="CPU needed" class="task-cpu" type="number" min="1" value="${t.cpu}"></td>
    <td><input aria-label="Dependencies" class="task-deps dep-input" value="${esc(t.deps)}" placeholder="e.g. T1,T2"></td>
    <td><button class="delete-row" title="Remove task" aria-label="Remove task">×</button></td>`;
    tr.querySelector("button").onclick=()=>{tr.remove();updateHeroCounts();};
    tasksBody.appendChild(tr);
  });updateHeroCounts();
}
function renderVMs(items=defaults.vms){
  vmsBody.innerHTML="";
  items.forEach(v=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><input aria-label="VM name" class="vm-name" value="${esc(v.name)}"></td>
    <td><input aria-label="CPU capacity" class="vm-cpu" type="number" min="1" value="${v.cpu}"></td>
    <td><button class="delete-row" title="Remove VM" aria-label="Remove VM">×</button></td>`;
    tr.querySelector("button").onclick=()=>tr.remove();
    vmsBody.appendChild(tr);
  });
}
function readTasks(){
  return [...tasksBody.querySelectorAll("tr")].map(tr=>({
    id:tr.querySelector(".task-id").value.trim(),
    duration:Number(tr.querySelector(".task-duration").value),
    cpu:Number(tr.querySelector(".task-cpu").value),
    deps:tr.querySelector(".task-deps").value.split(",").map(s=>s.trim()).filter(Boolean)
  }));
}
function readVMs(){
  return [...vmsBody.querySelectorAll("tr")].map(tr=>({
    name:tr.querySelector(".vm-name").value.trim(),
    cpu:Number(tr.querySelector(".vm-cpu").value)
  }));
}
function validate(tasks,vms){
  if(!tasks.length)throw Error("Add at least one task.");
  if(!vms.length)throw Error("Add at least one virtual machine.");
  const ids=new Set();
  tasks.forEach(t=>{
    if(!t.id)throw Error("Every task must have a task ID.");
    if(ids.has(t.id))throw Error(`Duplicate task ID: ${t.id}.`);
    ids.add(t.id);
    if(!Number.isInteger(t.duration)||t.duration<1)throw Error(`Task ${t.id}: duration must be a positive whole number.`);
    if(!Number.isInteger(t.cpu)||t.cpu<1)throw Error(`Task ${t.id}: CPU needed must be a positive whole number.`);
  });
  const vmNames=new Set();
  vms.forEach(v=>{
    if(!v.name)throw Error("Every VM must have a name.");
    if(vmNames.has(v.name))throw Error(`Duplicate VM name: ${v.name}.`);
    vmNames.add(v.name);
    if(!Number.isInteger(v.cpu)||v.cpu<1)throw Error(`VM ${v.name}: CPU capacity must be a positive whole number.`);
  });
  tasks.forEach(t=>{
    t.deps.forEach(d=>{
      if(!ids.has(d))throw Error(`Task ${t.id} depends on unknown task ${d}.`);
      if(d===t.id)throw Error(`Task ${t.id} cannot depend on itself.`);
    });
    if(!vms.some(v=>v.cpu>=t.cpu))throw Error(`No VM has enough CPU capacity for task ${t.id}.`);
  });
}
function topoSort(tasks){
  const byId=new Map(tasks.map(t=>[t.id,t]));
  const indeg=new Map(tasks.map(t=>[t.id,t.deps.length]));
  const children=new Map(tasks.map(t=>[t.id,[]]));
  tasks.forEach(t=>t.deps.forEach(d=>children.get(d).push(t.id)));
  const queue=tasks.filter(t=>indeg.get(t.id)===0).map(t=>t.id);
  const order=[];
  while(queue.length){
    const id=queue.shift();order.push(id);
    children.get(id).forEach(child=>{
      indeg.set(child,indeg.get(child)-1);
      if(indeg.get(child)===0)queue.push(child);
    });
  }
  if(order.length!==tasks.length)throw Error("Dependency cycle detected. Dependencies must form a Directed Acyclic Graph (DAG).");
  return {order,byId,children};
}
function criticalPath(tasks, topo){
  const finish={}, pred={};
  topo.order.forEach(id=>{
    const t=topo.byId.get(id);
    let best=0,bestPred="";
    t.deps.forEach(d=>{if(finish[d]>best){best=finish[d];bestPred=d;}});
    finish[id]=best+t.duration;pred[id]=bestPred;
  });
  const end=topo.order.reduce((best,id)=>finish[id]>finish[best]?id:best,topo.order[0]);
  const path=[];let cur=end;
  while(cur){path.unshift(cur);cur=pred[cur];}
  return {duration:finish[end],path};
}
function metricRows(rows,tasks,vms){
  const makespan=rows.reduce((m,r)=>Math.max(m,r.finish),0);
  const work=tasks.reduce((s,t)=>s+t.duration,0);
  const capacity=vms.reduce((s,v)=>s+v.cpu,0);
  const util=makespan&&capacity?Math.min(100,work/(makespan*capacity)*100):0;
  return {makespan,util,throughput:makespan?tasks.length/makespan:0};
}
function schedule(tasks,vms,mode,quantum=2){
  const {order,byId}=topoSort(tasks);
  const vmFree=Object.fromEntries(vms.map(v=>[v.name,0]));
  const finish={}, rows=[], remaining=new Set(order);
  while(remaining.size){
    const ready=order.filter(id=>remaining.has(id)&&byId.get(id).deps.every(d=>finish[d]!==undefined));
    if(!ready.length)throw Error("No ready task exists. Check dependency relationships.");
    let chosen=ready[0];
    if(mode==="greedy")chosen=ready.slice().sort((a,b)=>byId.get(b).duration-byId.get(a).duration||a.localeCompare(b))[0];
    const t=byId.get(chosen);
    const eligible=vms.filter(v=>v.cpu>=t.cpu);
    const depFinish=Math.max(0,...t.deps.map(d=>finish[d]));
    eligible.sort((a,b)=>Math.max(vmFree[a.name],depFinish)-Math.max(vmFree[b.name],depFinish));
    const vm=eligible[0];
    const start=Math.max(vmFree[vm.name],depFinish);
    const end=start+t.duration;
    rows.push({task:chosen,deps:t.deps.join(", ")||"—",vm:vm.name,start,finish:end,duration:t.duration});
    finish[chosen]=end;vmFree[vm.name]=end;remaining.delete(chosen);
  }
  return rows;
}
// Dependency-aware Round Robin: a ready task is assigned to an eligible VM for successive quanta.
// A task releases its VM between slices; dependent tasks become ready only after its final slice.
function scheduleRoundRobin(tasks,vms,quantum){
  if(!Number.isInteger(quantum)||quantum<1)throw Error("Round Robin time quantum must be a positive whole number.");
  const {order,byId}=topoSort(tasks);
  const remainingTime=Object.fromEntries(tasks.map(t=>[t.id,t.duration]));
  const finish={}, vmFree=Object.fromEntries(vms.map(v=>[v.name,0])), rows=[];
  const allSlices={};
  const unscheduled=new Set(order);
  let guard=0;
  while(unscheduled.size){
    if(++guard>tasks.length*10000)throw Error("Round Robin simulation safety limit reached.");
    const ready=order.filter(id=>unscheduled.has(id)&&byId.get(id).deps.every(d=>finish[d]!==undefined));
    if(!ready.length)throw Error("No ready task exists. Check dependency relationships.");
    const id=ready[0], t=byId.get(id);
    const vm=vms.filter(v=>v.cpu>=t.cpu).sort((a,b)=>vmFree[a.name]-vmFree[b.name])[0];
    const dependencyReady=Math.max(0,...t.deps.map(d=>finish[d]));
    const start=Math.max(vmFree[vm.name],dependencyReady);
    const slice=Math.min(quantum,remainingTime[id]), end=start+slice;
    if(!allSlices[id])allSlices[id]=[];
    allSlices[id].push({start,end,vm:vm.name});
    vmFree[vm.name]=end;remainingTime[id]-=slice;
    if(remainingTime[id]===0){
      finish[id]=end;unscheduled.delete(id);
      rows.push({task:id,deps:t.deps.join(", ")||"—",vm:allSlices[id].map(s=>s.vm).join(", "),start:allSlices[id][0].start,finish:end,duration:t.duration,slices:allSlices[id]});
    }
  }
  return rows;
}
function runMode(tasks,vms,mode,quantum){
  const rows=mode==="rr"?scheduleRoundRobin(tasks,vms,quantum):schedule(tasks,vms,mode);
  return {rows,metrics:metricRows(rows,tasks,vms)};
}
function renderSchedule(rows){
  scheduleBody.innerHTML=rows.slice().sort((a,b)=>a.start-b.start||a.task.localeCompare(b.task)).map(r=>`<tr><td><strong>${esc(r.task)}</strong></td><td>${esc(r.deps)}</td><td><span class="tag">${esc(r.vm)}</span></td><td>${r.start}</td><td>${r.finish}</td><td>${r.duration}</td></tr>`).join("");
  $("#scheduleCount").textContent=`${rows.length} tasks scheduled`;
}
function renderDAG(tasks){
  const edges=tasks.flatMap(t=>t.deps.map(d=>`${d} → ${t.id}`));
  $("#dag").innerHTML=tasks.map(t=>`<div class="dag-node"><b>${esc(t.id)}</b><small>${t.duration} time units</small></div>`).join('<span class="dag-arrow">→</span>')+
    (edges.length?`<div class="dag-edge">Dependencies: ${edges.map(esc).join(" · ")}</div>`:'<div class="dag-edge">No dependency edges entered.</div>');
}
function renderComparison(results){
  comparisonBody.innerHTML=results.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.metrics.makespan}</td><td>${r.metrics.util.toFixed(1)}%</td><td>${r.metrics.throughput.toFixed(2)}</td><td>${esc(r.note)}</td></tr>`).join("");
  const max=Math.max(1,...results.map(r=>r.metrics.makespan));
  $("#comparisonChart").innerHTML=results.map(r=>`<div class="bar-row"><span>${esc(r.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${r.metrics.makespan/max*100}%"></div></div><span class="bar-number">${r.metrics.makespan}</span></div>`).join("");
}
function toCSV(rows){
  const head=["Task","Dependencies","VM","Start","Finish","Duration"];
  const quote=s=>`"${String(s).replace(/"/g,'""')}"`;
  return [head.join(","),...rows.map(r=>[r.task,r.deps,r.vm,r.start,r.finish,r.duration].map(quote).join(","))].join("\n");
}
function updateHeroCounts(){
  const tasks=readTasks();
  $("#heroTasks").textContent=tasks.length;
  $("#heroEdges").textContent=tasks.reduce((n,t)=>n+(t.deps?t.deps.split(",").filter(x=>x.trim()).length:0),0);
  $("#heroVMs").textContent=vmsBody.querySelectorAll("tr").length;
}
function showError(message){$("#errorBox").textContent=message;$("#errorBox").classList.remove("hidden");}
function clearError(){$("#errorBox").textContent="";$("#errorBox").classList.add("hidden");}
$("#addTaskBtn").onclick=()=>renderTasks([...readTasks().map(t=>({id:t.id,duration:t.duration,cpu:t.cpu,deps:t.deps.join(",")})),{id:`T${tasksBody.children.length+1}`,duration:2,cpu:1,deps:""}]);
$("#addVmBtn").onclick=()=>renderVMs([...readVMs(),{name:`VM-${vmsBody.children.length+1}`,cpu:2}]);
$("#resetBtn").onclick=()=>{renderTasks();renderVMs();clearError();};
$("#algorithm").onchange=()=>$("#quantumWrap").classList.toggle("hidden",$("#algorithm").value!=="rr");
$("#runBtn").onclick=()=>{
  clearError();
  try{
    const tasks=readTasks(),vms=readVMs();validate(tasks,vms);
    const topo=topoSort(tasks),cp=criticalPath(tasks,topo);
    const mode=$("#algorithm").value,quantum=Number($("#quantum").value);
    const chosen=runMode(tasks,vms,mode,quantum);
    $("#makespan").textContent=chosen.metrics.makespan;
    $("#utilization").textContent=chosen.metrics.util.toFixed(1)+"%";
    $("#throughput").textContent=chosen.metrics.throughput.toFixed(2);
    $("#criticalPath").textContent=cp.path.join(" → ");
    $("#criticalDuration").textContent=`${cp.duration} time units · critical path duration`;
    renderSchedule(chosen.rows);renderDAG(tasks);
    const fcfs=runMode(tasks,vms,"fcfs",quantum);
    const greedy=runMode(tasks,vms,"greedy",quantum);
    const rr=runMode(tasks,vms,"rr",quantum);
    renderComparison([
      {name:"FCFS",metrics:fcfs.metrics,note:"First ready task"},
      {name:"Greedy optimizer",metrics:greedy.metrics,note:"Longest ready task first"},
      {name:"Round Robin",metrics:rr.metrics,note:`Time quantum ${quantum}`}
    ]);
    latestCSV=toCSV(chosen.rows);$("#downloadBtn").disabled=false;
    $("#heroTasks").textContent=tasks.length;$("#heroVMs").textContent=vms.length;
    $("#heroEdges").textContent=tasks.reduce((n,t)=>n+t.deps.length,0);
  }catch(e){showError(e.message||"Could not run the simulation.");}
};
$("#downloadBtn").onclick=()=>{
  if(!latestCSV)return;
  const blob=new Blob([latestCSV],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="cloud-resource-schedule.csv";a.click();URL.revokeObjectURL(url);
};
renderTasks();renderVMs();
