import test,{after} from "node:test";
import assert from "node:assert/strict";
import React,{act} from "react";
import {JSDOM} from "jsdom";
import axe from "axe-core";
import {createServer} from "vite-legacy";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dom=new JSDOM('<!doctype html><html lang="en"><head><title>Task planning checks</title></head><body><main id="root"></main></body></html>',{url:"https://team.test",pretendToBeVisual:true,runScripts:"outside-only"});
const media=()=>({matches:false,addEventListener(){},removeEventListener(){}});
dom.window.matchMedia=media;dom.window.scrollTo=()=>{};dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
Object.defineProperties(globalThis,{
 window:{value:dom.window,configurable:true},document:{value:dom.window.document,configurable:true},navigator:{value:dom.window.navigator,configurable:true},location:{value:dom.window.location,configurable:true},
 localStorage:{value:dom.window.localStorage,configurable:true},HTMLElement:{value:dom.window.HTMLElement,configurable:true},getComputedStyle:{value:dom.window.getComputedStyle.bind(dom.window),configurable:true},matchMedia:{value:media,configurable:true},
});
const {createRoot}=await import("react-dom/client");
dom.window.eval(axe.source);
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(async()=>{await vite.close();dom.window.close();});
const {default:TaskPlanning}=await vite.ssrLoadModule("/src/components/task-planning.tsx");
const {default:Tasks}=await vite.ssrLoadModule("/src/screens/Tasks.tsx");
const {HQProvider,useHQ}=await vite.ssrLoadModule("/src/store.tsx");
const {createDemoData}=await vite.ssrLoadModule("/src/seed.ts");
const {STORAGE_KEY}=await vite.ssrLoadModule("/src/persistence.ts");
const {dateKey}=await vite.ssrLoadModule("/src/utils.ts");
const task=(id,options={})=>({id,teamId:"synthetic-team",seasonId:"synthetic-season",title:id,owner:"Alice",area:"Mechanical",due:"2026-11-01",priority:"Medium",status:"To do",done:"Fictional measurement checked",effort:"30 min",description:"Synthetic test only",dependencies:[],comments:[],...options});
const sample=[
 task("Old task",{due:"2026-10-31",status:"In progress"}),
 task("Today task",{blockedReason:"Waiting for a mentor"}),
 task("Next week task",{due:"2026-11-08",dependencies:["outside-filter"]}),
 task("Later task",{due:"2026-11-09",owner:"Bob"}),
 task("Undated task",{due:"",owner:"Unassigned"}),
 task("Unblocked today task",{owner:"Bob"}),
 task("Unblocked next week task",{due:"2026-11-08",owner:"Bob"}),
 task("Completed task",{due:"2026-10-30",status:"Done"}),
];
const baseProps=()=>({tasks:structuredClone(sample),allTasks:[...structuredClone(sample),task("outside-filter",{title:"Dependency outside current filter",status:"In progress"})],members:["Alice","Bob","Casey","Unassigned"],today:"2026-11-01",memberName:owner=>owner,canWork:()=>true,onOpen(){},onFocus(){}});
async function mounted(element,check){
 const container=document.getElementById("root"),root=createRoot(container);
 try{await act(async()=>root.render(element));await check(container);}
 finally{await act(async()=>root.unmount());localStorage.clear();location.hash="";}
}
const click=element=>act(async()=>{assert.ok(element,"Expected control");element.click();});
const named=(container,name)=>Array.from(container.querySelectorAll("button")).find(button=>button.getAttribute("aria-label")===name||button.textContent.trim()===name);
const group=(container,id)=>container.querySelector(`[aria-labelledby="task-plan-${id}"]`);
async function workspace({tasks=sample,role="lead"}={},check){
 const initial=createDemoData();initial.tasks=structuredClone(tasks).map(t=>({...t,teamId:initial.teamId,seasonId:initial.seasonId}));localStorage.setItem(STORAGE_KEY,JSON.stringify(initial));
 let context;
 function Probe(){context=useHQ();return React.createElement(Tasks);}
 await mounted(React.createElement(HQProvider,{demoMode:true},React.createElement(Probe)),async container=>{
  if(role!=="lead")await act(async()=>context.setRole(role));
  await check({container,get context(){return context;}});
 });
}

test("planning groups actual due dates and counts active ownership, overdue work and hidden dependencies",async()=>{
 await mounted(React.createElement(TaskPlanning,baseProps()),async container=>{
  assert.match(group(container,"overdue").textContent,/Old task/);assert.doesNotMatch(group(container,"overdue").textContent,/Completed task/);
  assert.match(group(container,"today").textContent,/Unblocked today task/);assert.match(group(container,"week").textContent,/Unblocked next week task/);
  assert.match(group(container,"blocked").textContent,/Today task/);assert.match(group(container,"blocked").textContent,/Next week task/);
  assert.match(group(container,"later").textContent,/Later task/);assert.match(group(container,"undated").textContent,/Undated task/);
  assert.match(group(container,"blocked").textContent,/Dependency outside current filter/);
  assert.ok(named(container,"Alice workload: 3 open, 1 in progress, 1 overdue, 2 blocked"));
  assert.ok(named(container,"Casey workload: 0 open, 0 in progress, 0 overdue, 0 blocked"));
  assert.match(container.querySelector("summary").textContent,/Completed tasks \(1\)/);
  assert.match(container.textContent,/not available hours or individual capacity/);
 });
});

test("owner workload controls filter actual records and offer open and authorized focus actions",async()=>{
 const props=baseProps(),opened=[],focused=[];props.onOpen=t=>opened.push(t.id);props.onFocus=t=>focused.push(t.id);props.canWork=t=>t.owner==="Alice";
 await mounted(React.createElement(TaskPlanning,props),async container=>{
  const alice=named(container,"Alice workload: 3 open, 1 in progress, 1 overdue, 2 blocked");await click(alice);
  assert.equal(alice.getAttribute("aria-pressed"),"true");assert.equal(named(container,"Open task Later task"),undefined);
  await click(named(container,"Open task Today task"));await click(named(container,"Start focus session for Today task"));assert.deepEqual(opened,["Today task"]);assert.deepEqual(focused,["Today task"]);
  await click(named(container,"Casey workload: 0 open, 0 in progress, 0 overdue, 0 blocked"));assert.match(container.textContent,/No open assignments for Casey/);
  await click(named(container,"All owners"));const forbidden=named(container,"Start focus session for Later task");assert.equal(forbidden.disabled,true);await click(forbidden);assert.deepEqual(focused,["Today task"]);
  assert.equal(named(container,"Start focus session for Completed task").disabled,true);
 });
});

test("the real task page preserves board/list and applies its status filters to Plan view",async()=>{
 await workspace({},async app=>{
  const {container}=app;await click(named(container,"Plan view"));assert.equal(named(container,"Plan view").getAttribute("aria-pressed"),"true");
  assert.ok(container.querySelector('[aria-labelledby="task-plan-heading"]'));
  const filter=container.querySelector('[aria-label="Filter task status"]');await act(async()=>{filter.value="Blocked";filter.dispatchEvent(new dom.window.Event("change",{bubbles:true}));});
  assert.ok(named(container,"Open task Today task"));assert.ok(named(container,"Open task Next week task"));assert.equal(named(container,"Open task Later task"),undefined);
  await click(named(container,"List view"));assert.ok(container.querySelector(".tc-task-list"));await click(named(container,"Board view"));assert.ok(container.querySelector(".tc-board"));
 });
});

test("Plan opens the existing protected task editor and keeps its draft on a conflict",async()=>{
 await workspace({},async app=>{
  const {container}=app;await click(named(container,"Plan view"));await click(named(container,"Open task Today task"));
  const input=Array.from(container.querySelectorAll("label.field")).find(label=>label.querySelector("span")?.textContent==="Task name").querySelector("input");
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,"value").set.call(input,"My planning draft");input.dispatchEvent(new dom.window.Event("input",{bubbles:true}));});
  assert.equal(input.value,"My planning draft");
  await act(async()=>app.context.setData(data=>({...data,tasks:data.tasks.map(t=>t.id==="Today task"?{...t,title:"New teammate title"}:t)})));
  await act(async()=>container.querySelector('[role="dialog"] form').dispatchEvent(new dom.window.Event("submit",{bubbles:true,cancelable:true})));
  assert.equal(app.context.data.tasks.find(t=>t.id==="Today task").title,"New teammate title");assert.equal(input.value,"My planning draft");assert.match(app.context.notice.message,/teammate changed title/);
 });
});

test("Plan focus follows task ownership and is dismissed when the workspace scope changes",async()=>{
 const tasks=[task("My assignment",{owner:"Alex (you)",due:dateKey()}),task("Another assignment",{owner:"Fictional teammate",due:dateKey()})];
 await workspace({tasks,role:"student"},async app=>{
  const {container}=app;await click(named(container,"Plan view"));assert.equal(named(container,"Start focus session for Another assignment").disabled,true);
  await click(named(container,"Start focus session for My assignment"));assert.match(container.querySelector('[role="dialog"]').textContent,/My assignment/);
  await act(async()=>app.context.setData(data=>({...data,seasonId:"new-synthetic-season"})));assert.equal(container.querySelector('[role="dialog"]'),null);
 });
});

test("Plan view passes automated accessibility semantics with named selection and focus controls",async()=>{
 await workspace({},async({container})=>{
  await click(named(container,"Plan view"));
  const result=await dom.window.axe.run(container,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]},rules:{"color-contrast":{enabled:false}}});
  assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)})),null,2));
 });
});
