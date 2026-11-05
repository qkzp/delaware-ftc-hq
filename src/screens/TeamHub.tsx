import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {ArrowLeft,ArrowUpRight,BookOpen,MessageSquare,Plus,ShieldCheck} from "lucide-react";
import {useHQ} from "../store";
import {Badge,EmptyState,Field,Modal,PageHeader} from "../components/ui";
import SupportCenter from "../components/SupportCenter";
import TeamMessages from "../components/TeamMessages";
import {dateKey,formatDate} from "../utils";
import type {Task} from "../types";
import "./TeamHub.css";
import "./TeamHubSimple.css";

export default function TeamHub(){
 const {draftScope}=useHQ();
 return <TeamSpace key={draftScope}/>;
}
function TeamSpace(){
 const {data,myOwner,memberName,canManage,canReview,cloud,draftScope,saveRecord,openRecord,setPage,page,focusRecord,clearFocusRecord,ephemeralDemo}=useHQ();
 const [messagesVisited,setMessagesVisited]=useState(false);
 const [view,setView]=useState("Conversations"),[channel,setChannel]=useState("All team"),[query,setQuery]=useState("");
 const [selected,setSelected]=useState<string|null>(null),[drafts,setDrafts]=useState<Record<string,string>>({}),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [posting,setPosting]=useState(false),[title,setTitle]=useState(""),[body,setBody]=useState(""),[kind,setKind]=useState<"Update"|"Decision"|"Announcement">("Update");
 const [briefQuery,setBriefQuery]=useState(""),[focusedUpdate,setFocusedUpdate]=useState<string|null>(null);
 const scope=useRef(draftScope),threadRef=useRef<HTMLElement|null>(null),listHeading=useRef<HTMLHeadingElement|null>(null),returnToList=useRef(false);
 useEffect(()=>{if(page!=="team")setPosting(false);},[page]);
 useEffect(()=>{
  if(focusRecord?.page!=="team")return;
  if(data.announcements.some(update=>update.id===focusRecord.id)){setView("Team brief");setFocusedUpdate(focusRecord.id);setBriefQuery("");}
  clearFocusRecord();
 },[focusRecord,data.announcements]);
 const hasDraft=Object.values(drafts).some(text=>text.trim())||!!title.trim()||!!body.trim();
 useEffect(()=>{
  if(!hasDraft)return;
  const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  window.addEventListener("beforeunload",protect);return()=>window.removeEventListener("beforeunload",protect);
 },[hasDraft]);
 const areas=useMemo(()=>[...new Set(data.tasks.map(task=>task.area).filter(Boolean))].sort(),[data.tasks]);
 const channelTasks=data.tasks.filter(task=>channel==="All team"||task.area===channel);
 const conversations=channelTasks.filter(task=>[task.title,task.description,...task.comments.map(comment=>comment.text)].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
 const selectedTask=data.tasks.find(task=>task.id===selected);
 useEffect(()=>{
  if(typeof window.matchMedia!=="function"||!window.matchMedia("(max-width: 760px)").matches)return;
  if(selectedTask){threadRef.current?.scrollIntoView?.({behavior:"auto",block:"start"});threadRef.current?.focus({preventScroll:true});}
  else if(returnToList.current){returnToList.current=false;listHeading.current?.focus();}
 },[selected]);
 const visibleResources=data.resources.filter(resource=>!resource.archived&&(canManage||resource.approved&&resource.visibility!=="private"));
 const referenceAreas:Record<string,string[]>={Mechanical:["Robot design","CAD","Manufacturing","Testing"],Programming:["Programming","Autonomous","Testing"],Electrical:["Wiring","Safety"],Outreach:["Outreach","Fundraising","Judging","Portfolio"]};
 const matchingAreas=[channel,...(referenceAreas[channel]||[])].map(area=>area.toLowerCase());
 const featured=visibleResources.filter(resource=>channel==="All team"||[resource.category,...resource.tags].some(tag=>matchingAreas.includes(tag.toLowerCase())));
 const nextEvent=[...data.events].filter(event=>event.date>=dateKey()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
 const announcements=[...data.announcements].reverse().filter(update=>(!focusedUpdate||update.id===focusedUpdate)&&[update.title,update.body,memberName(update.author),update.type].join(" ").toLowerCase().includes(briefQuery.trim().toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
 const activity=[
  ...data.announcements.map(update=>({id:"update-"+update.id,date:update.date,author:update.author,title:update.title,text:update.body,task:null as Task|null,type:update.type})),
  ...data.tasks.flatMap(task=>task.comments.map((comment,index)=>({id:`reply-${task.id}-${index}`,date:comment.date,author:comment.author,title:task.title,text:comment.text,task,type:"Task reply"}))),
 ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
 const blocked=(task:Task)=>!!task.blockedReason||task.dependencies.some(id=>data.tasks.find(candidate=>candidate.id===id)?.status!=="Done");
 function selectTask(task:Task){setSelected(task.id);setError("");setNotice("");}
 function reply(event:FormEvent){
  event.preventDefault();if(!selectedTask)return;
  const text=(drafts[selectedTask.id]||"").trim();if(!text)return;
  const accepted=saveRecord("tasks",{...selectedTask,comments:[...selectedTask.comments,{text,date:new Date().toISOString(),author:myOwner}]},{original:selectedTask,scope:scope.current});
  if(!accepted){setError("Your reply is still here. Review the workspace message before trying again.");return;}
  setDrafts(current=>({...current,[selectedTask.id]:""}));setError("");setNotice(ephemeralDemo?"Fictional reply added in this tab only.":"Reply added to the task. Wait for your workspace to finish syncing before closing.");
 }
 function postUpdate(event:FormEvent){
  event.preventDefault();if(!canManage||kind==="Announcement"&&!canReview||!title.trim()||!body.trim())return;
  if(!saveRecord("announcements",{id:crypto.randomUUID(),teamId:data.teamId,seasonId:data.seasonId,title:title.trim(),body:body.trim(),type:kind,date:dateKey(),author:myOwner},{original:null,scope:scope.current})){setError("Your update draft is still open. Review the workspace message and try again.");return;}
  if(kind==="Announcement")setView("Team brief");setPosting(false);setTitle("");setBody("");setNotice(ephemeralDemo?"Fictional update added in this tab only.":"Team update added. Wait for the workspace to finish syncing.");
 }
 function openUpdate(){setKind(current=>current==="Announcement"?"Update":current);setPosting(true);setError("");}
 return <>
  <PageHeader title="Team hub" description="Find conversations, updates and team help in one place." actions={<>{canReview&&<button className="btn btn-primary" onClick={()=>{setKind("Announcement");setPosting(true);setError("");}}><Plus size={16}/>Post announcement</button>}{canManage&&<button className="btn btn-secondary" onClick={openUpdate}><Plus size={16}/>Post team update</button>}<Badge>{cloud.shared?"Private team":"Demo workspace"}</Badge></>}/>
  <div className="team-hub-views" role="group" aria-label="Team hub view">{["Conversations","Messages","Team brief","Activity","Help desk"].map(label=><button key={label} className={view===label?"is-active":""} aria-pressed={view===label} onClick={()=>{setView(label);if(label==="Messages")setMessagesVisited(true);setError("");setNotice("");}}>{label}</button>)}</div>
  {notice&&<p className="team-hub-feedback" role="status">{notice}</p>}
  {error&&!posting&&<p className="team-hub-feedback" role="alert">{error}</p>}
  {view==="Conversations"&&<div className="team-hub-layout">
   <section className="team-hub-conversations" aria-labelledby="hub-conversations-title">
    <div className="team-hub-section-head"><div><h2 id="hub-conversations-title" ref={listHeading} tabIndex={-1}>Task conversations</h2><p>Ask questions and keep replies with the task.</p></div><span>{conversations.length} {conversations.length===1?"task":"tasks"}</span></div>
    <div className="team-hub-tools"><Field label="Find a task conversation"><input type="search" placeholder="Search tasks and replies" value={query} onChange={event=>setQuery(event.target.value)}/></Field>
    <details className="team-hub-channels"><summary>Workstream{channel!=="All team"?`: ${channel}`:""}</summary><div role="group" aria-label="Conversation workstream">{["All team",...areas].map(area=><button key={area} aria-pressed={channel===area} className={channel===area?"is-active":""} onClick={()=>{setChannel(area);setSelected(null);setQuery("");setNotice("");setError("");}}><span>{area}</span><small>{data.tasks.filter(task=>area==="All team"||task.area===area).length}</small></button>)}</div></details></div>
    <div className={`team-hub-conversation-body ${selectedTask?"has-thread":""}`}>
     <div className="team-hub-task-list">{conversations.length?conversations.map(task=><button key={task.id} className={selected===task.id?"is-selected":""} aria-pressed={selected===task.id} onClick={()=>selectTask(task)}><span className="team-hub-task-heading"><strong>{task.title}</strong>{task.demo&&<Badge>Demo</Badge>}</span><span>{task.area} &middot; {memberName(task.owner)} &middot; {task.status}</span><span className="team-hub-thread-count"><MessageSquare size={14}/>{task.comments.length} replies{blocked(task)&&task.status!=="Done"?" - Blocked":""}{drafts[task.id]?" - Draft reply":""}</span></button>):<EmptyState title="No matching task conversations." description={data.tasks.length?"Try another workstream or search phrase.":"Start with a team task, then ask questions and record decisions beside it."} action={<button className="btn btn-secondary" onClick={()=>setPage("tasks")}>Open tasks</button>}/>}</div>
     {selectedTask?<article className="team-hub-thread" aria-labelledby="hub-thread-title" ref={threadRef} tabIndex={-1}><header><div><button className="team-hub-back text-link" onClick={()=>{returnToList.current=true;setSelected(null);}}><ArrowLeft size={14} aria-hidden="true"/> Back to conversations</button><span className="eyebrow">Task conversation</span><h3 id="hub-thread-title">{selectedTask.title}</h3></div><button className="text-link" onClick={()=>openRecord("tasks",selectedTask.id)}>Open task <ArrowUpRight size={14}/></button></header><p>{selectedTask.description||"Use this conversation to clarify the next step and record progress."}</p><div className="team-hub-replies">{selectedTask.comments.length?selectedTask.comments.map((comment,index)=><article key={index}><div><strong>{memberName(comment.author)}</strong><time dateTime={comment.date}>{formatDate(comment.date)}</time></div><p>{comment.text}</p></article>):<p className="muted">No replies yet. Start with a question or a useful build update.</p>}</div><form className="stack" onSubmit={reply}><Field label="Reply to this task" hint="Visible to authorized team members. Keep personal student information out of replies. Existing replies stay on the task."><textarea required maxLength={2000} rows={3} value={drafts[selectedTask.id]||""} onChange={event=>setDrafts(current=>({...current,[selectedTask.id]:event.target.value}))}/></Field><div className="team-hub-reply-actions"><button className="btn btn-primary" disabled={!(drafts[selectedTask.id]||"").trim()}>Add task reply</button><a href="/maintenance">Report a concern</a></div></form></article>:selected?<p className="team-hub-feedback" role="status">This task is no longer available. Its reply draft has not been posted.</p>:null}
    </div>
   </section>
   <details className="team-hub-context-details"><summary>Work summary and useful references</summary><aside className="team-hub-context" aria-label="Workstream context"><section className="card"><h2>At a glance</h2><dl><div><dt>Open work</dt><dd>{channelTasks.filter(task=>task.status!=="Done").length}</dd></div><div><dt>Needs an unblock</dt><dd>{channelTasks.filter(task=>task.status!=="Done"&&blocked(task)).length}</dd></div><div><dt>Your open tasks</dt><dd>{channelTasks.filter(task=>task.status!=="Done"&&task.owner===myOwner).length}</dd></div></dl><button className="text-link" onClick={()=>setPage("tasks")}>Plan the work <ArrowUpRight size={14}/></button></section><section className="card"><h2><BookOpen size={17}/>Useful references</h2>{featured.length?featured.slice(0,5).map(resource=><button className="team-hub-resource" key={resource.id} onClick={()=>openRecord("resources",resource.id)}><strong>{resource.title}</strong><span>{resource.category} &middot; {resource.approved?"Reviewed":"Awaiting review"}</span></button>):<p>No matching references yet. Add a reviewed guide in Robot & resources.</p>}<button className="text-link" onClick={()=>setPage("resources")}>Browse knowledge spaces</button></section></aside></details>
  </div>}
  {view==="Team brief"&&<div className="team-hub-brief-grid"><section className="card"><div className="team-hub-section-head"><h2>The team canvas</h2><ShieldCheck size={18}/></div><p className="muted">A shared reference for the current build and the next time you meet.</p><h3>What we're building</h3><p className="team-hub-prose">{data.robot.purpose||"Add the robot purpose in Robot & resources so every teammate knows the goal."}</p><button className="text-link" onClick={()=>openRecord("resources","robot-reference")}>Open robot reference</button><h3>Next on the calendar</h3>{nextEvent?<><strong>{nextEvent.title}</strong><p>{formatDate(nextEvent.date)}{nextEvent.time?` · ${nextEvent.time}`:""}</p><p className="team-hub-prose">{nextEvent.agenda||"An agenda has not been added yet."}</p><button className="text-link" onClick={()=>openRecord("calendar",nextEvent.id)}>Open meeting details</button></>:<p>No upcoming team meeting. Add one in Schedule.</p>}<h3>Coach guidance</h3><p className="team-hub-prose">{data.coachInstructions||"Your coach can add team guidance in the Competition checklist."}</p></section><section className="card"><div className="team-hub-section-head"><h2>Updates and decisions</h2>{canManage&&<button className="text-link" onClick={openUpdate}>Post update</button>}</div><p className="muted">Visible to your authorized team. Decisions remain a searchable part of the team record.</p><Field label="Search team updates"><input type="search" value={briefQuery} onChange={event=>{setBriefQuery(event.target.value);setFocusedUpdate(null);}} placeholder="Search decisions, messages and authors"/></Field>{focusedUpdate&&<p role="status">Showing the selected update. <button className="text-link" onClick={()=>setFocusedUpdate(null)}>Show all team updates</button></p>}{announcements.length?announcements.map(update=><article className="team-hub-update" key={update.id}><div><Badge tone={update.type==="Decision"?"purple":"blue"}>{update.type}</Badge><time dateTime={update.date}>{formatDate(update.date)}</time>{update.demo&&<Badge>Demo</Badge>}</div><h3>{update.title}</h3><p className="team-hub-prose">{update.body}</p><small>{memberName(update.author)}</small></article>):<EmptyState title="A clear place for team decisions." description="Leads and mentors can record a build decision or an update for everyone here."/>}</section></div>}
  {view==="Activity"&&<section className="card team-hub-activity" aria-labelledby="hub-activity-title"><div className="team-hub-section-head"><h2 id="hub-activity-title">Recent team activity</h2><span>Latest 30 posted updates and task replies</span></div><p className="muted">A feed of saved record content. This view does not track who read an item.</p>{activity.length?activity.map(item=><article key={item.id}><div className="team-hub-activity-icon"><MessageSquare size={17}/></div><div><div className="team-hub-activity-meta"><strong>{memberName(item.author)}</strong><span>{item.type}</span><time dateTime={item.date}>{formatDate(item.date)}</time></div><h3>{item.title}</h3><p className="team-hub-prose">{item.text}</p>{item.task&&<button className="text-link" onClick={()=>{setChannel(item.task!.area||"All team");setQuery("");selectTask(item.task!);setView("Conversations");}}>Open conversation</button>}</div></article>):<EmptyState title="Your team's activity starts here." description="Add a task reply or post a team update to start the feed."/>}</section>}
  <div hidden={view!=="Messages"}>{(messagesVisited||view==="Messages")&&<TeamMessages active={page==="team"&&view==="Messages"}/>}</div>
  {view==="Help desk"&&<SupportCenter/>}
  {posting&&<Modal title="Post a team update" onClose={()=>setPosting(false)}><form className="stack" onSubmit={postUpdate}><p>{ephemeralDemo?"This fictional update stays in this tab. Do not enter personal information.":"Visible to every authorized team member. Use safe team notes and keep personal student information out."}</p>{error&&<p role="alert">{error}</p>}<Field label="Update type"><select value={kind} onChange={event=>setKind(event.target.value as "Update"|"Decision"|"Announcement")}><option>Update</option><option>Decision</option>{canReview&&<option>Announcement</option>}</select></Field><Field label="Title"><input required maxLength={160} value={title} onChange={event=>setTitle(event.target.value)}/></Field><Field label="Message"><textarea required maxLength={4000} rows={5} value={body} onChange={event=>setBody(event.target.value)}/></Field><div className="form-actions"><button type="button" className="btn btn-secondary" onClick={()=>setPosting(false)}>Keep draft and close</button><button className="btn btn-primary" disabled={!title.trim()||!body.trim()}>{kind==="Announcement"?"Post announcement":"Post team update"}</button></div></form></Modal>}
 </>;
}
