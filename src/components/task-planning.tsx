import {useMemo,useState} from "react";
import {ArrowUpRight,Play} from "lucide-react";
import type {Task} from "../types";
import {Badge} from "./ui";
import "./task-planning.css";

type PlanningProps={
 tasks:Task[]; allTasks:Task[]; members:string[]; today:string;
 memberName:(owner:string)=>string; canWork:(task:Task)=>boolean;
 onOpen:(task:Task)=>void; onFocus:(task:Task)=>void;
};
const dayNumber=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(`${value}T12:00:00Z`);
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?Math.floor(date.getTime()/86400000):null;
};
const ownerKey=(owner:string)=>["","Team","Unassigned"].includes(owner)?"Unassigned":owner;
const dueLabel=(task:Task)=>dayNumber(task.due)===null?task.due?"Check due date":"No due date":new Date(`${task.due}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const groups=[
 {id:"overdue",title:"Overdue",hint:"Agree a new plan with the owner."},
 {id:"blocked",title:"Blocked",hint:"Other blocked work. Resolve the dependency or ask for help."},
 {id:"today",title:"Due today",hint:"Check what can be finished today."},
 {id:"week",title:"Next 7 days",hint:"Prepare the next handoff."},
 {id:"later",title:"Later",hint:"Upcoming work beyond this week."},
 {id:"undated",title:"No confirmed date",hint:"Set a due date in task details."},
] as const;
type GroupId=typeof groups[number]["id"];

/** This is a due-date plan. Existing task records do not contain start dates or capacity. */
export default function TaskPlanning({tasks,allTasks,members,today,memberName,canWork,onOpen,onFocus}:PlanningProps){
 const [selectedOwner,setSelectedOwner]=useState("");
 const todayNumber=dayNumber(today)!;
 const byId=useMemo(()=>new Map(allTasks.map(task=>[task.id,task])),[allTasks]);
 const blockedDetails=(task:Task)=>task.status==="Done"?[]:[
  ...(task.blockedReason?.trim()?[task.blockedReason.trim()]:[]),
  ...task.dependencies.filter(id=>byId.get(id)?.status!=="Done").map(id=>byId.get(id)?.title||"Unavailable linked task"),
 ];
 const bucket=(task:Task):GroupId=>{
  const due=dayNumber(task.due);
  return due!==null&&due<todayNumber?"overdue":blockedDetails(task).length>0?"blocked":due===null?"undated":due===todayNumber?"today":due<=todayNumber+7?"week":"later";
 };
 const active=tasks.filter(task=>task.status!=="Done");
 const owners=Array.from(new Set([...members,...tasks.map(task=>task.owner)].map(ownerKey))).map(owner=>{
  const assigned=active.filter(task=>ownerKey(task.owner)===owner);
  return {owner,name:owner==="Unassigned"?"Unassigned":memberName(owner),tasks:assigned,
   overdue:assigned.filter(task=>bucket(task)==="overdue").length,
   blocked:assigned.filter(task=>blockedDetails(task).length>0).length,
   inProgress:assigned.filter(task=>task.status==="In progress").length};
 }).sort((a,b)=>Number(a.owner==="Unassigned")-Number(b.owner==="Unassigned")||b.tasks.length-a.tasks.length||a.name.localeCompare(b.name));
 const owner=owners.some(item=>item.owner===selectedOwner)?selectedOwner:"";
 const ownerName=owners.find(item=>item.owner===owner)?.name;
 const visible=tasks.filter(task=>!owner||ownerKey(task.owner)===owner);
 const open=visible.filter(task=>task.status!=="Done");
 const completed=visible.filter(task=>task.status==="Done");
 const largest=Math.max(1,...owners.map(item=>item.tasks.length));
 const taskRow=(task:Task)=>{
  const blockers=blockedDetails(task);
  return <li className="task-plan-row" key={task.id}>
   <div className="task-plan-due"><time dateTime={dayNumber(task.due)!==null?task.due:undefined}>{dueLabel(task)}</time><span>{task.effort||"Effort not set"}</span></div>
   <div className="task-plan-detail">
    <button className="task-plan-task-title" aria-label={`Open task ${task.title}`} onClick={()=>onOpen(task)}>{task.title}<ArrowUpRight size={15} aria-hidden="true"/></button>
    <p>{memberName(task.owner)||"Unassigned"} · {task.area}{task.subsystem?` · ${task.subsystem}`:""}</p>
    <div className="task-plan-labels"><Badge>{task.status}</Badge><Badge tone={task.priority==="High"?"amber":"gray"}>{task.priority} priority</Badge>{task.demo&&<Badge>Demo</Badge>}</div>
    {blockers.length>0&&<p className="task-plan-blocked"><strong>Blocked:</strong> {blockers.join("; ")}</p>}
   </div>
   <button className="btn btn-secondary task-plan-focus" aria-label={`Start focus session for ${task.title}`} disabled={!canWork(task)||task.status==="Done"} onClick={()=>{if(canWork(task)&&task.status!=="Done")onFocus(task);}}><Play size={14} aria-hidden="true"/>Focus</button>
  </li>;
 };
 return <section className="task-planning" aria-labelledby="task-plan-heading">
  <div className="task-plan-heading"><div><p className="eyebrow">PLAN THE HANDOFF</p><h2 id="task-plan-heading">Who has what next?</h2><p>Compare open assignments and due dates using the current filters. Overdue work comes first, followed by other blocked tasks and upcoming dates. Counts show tasks, not available hours or individual capacity.</p></div><button className="btn btn-secondary" aria-pressed={!owner} onClick={()=>setSelectedOwner("")}>All owners</button></div>
  <div className="task-plan-workload" role="group" aria-label="Owner workload">
   {owners.map(item=><button key={item.owner} className={`task-plan-owner ${owner===item.owner?"is-selected":""}`} aria-pressed={owner===item.owner} aria-label={`${item.name} workload: ${item.tasks.length} open, ${item.inProgress} in progress, ${item.overdue} overdue, ${item.blocked} blocked`} onClick={()=>setSelectedOwner(owner===item.owner?"":item.owner)}>
    <span className="task-plan-owner-heading"><strong>{item.name}</strong><span>{item.tasks.length} open</span></span>
    <span className="task-plan-load-track" aria-hidden="true"><span style={{width:`${item.tasks.length/largest*100}%`}}/></span>
    <span className="task-plan-owner-counts"><span>{item.inProgress} in progress</span><span>{item.overdue} overdue</span><span>{item.blocked} blocked</span></span>
   </button>)}
  </div>
  <p className="task-plan-selection" role="status">{ownerName?`${ownerName}: `:"All owners: "}{open.length} open task{open.length===1?"":"s"}{completed.length?` · ${completed.length} completed`:""}. Select an owner to inspect their assignments.</p>
  {open.length===0&&<div className="task-plan-empty"><h3>No open assignments{ownerName?` for ${ownerName}`:""}.</h3><p>{completed.length?"Completed work is listed below.":"Change the owner or task filters to see more work."}</p>{owner&&<button className="text-link" onClick={()=>setSelectedOwner("")}>Show all owners</button>}</div>}
  <div className="task-plan-timeline">{groups.map(group=>{
   const items=open.filter(task=>bucket(task)===group.id).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")||a.title.localeCompare(b.title));
   return items.length>0&&<section key={group.id} className={`task-plan-group task-plan-group-${group.id}`} aria-labelledby={`task-plan-${group.id}`}><div className="task-plan-group-heading"><h3 id={`task-plan-${group.id}`}>{group.title}<span>{items.length}</span></h3><p>{group.hint}</p></div><ul>{items.map(taskRow)}</ul></section>;
  })}</div>
  {completed.length>0&&<details className="task-plan-completed"><summary>Completed tasks ({completed.length})</summary><ul>{completed.map(taskRow)}</ul></details>}
 </section>;
}
