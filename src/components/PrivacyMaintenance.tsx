"use client";
import {userError} from "../user-errors";
import {useEffect,useRef,useState,type FormEvent} from "react";
import TeamContactDetails from "./TeamContactDetails";
import {validTeamContacts} from "../team-contacts";
import type {TeamContacts} from "../types";
import type {Session} from "../cloud";
import {Field,Modal} from "./ui";

type Team=Session["teams"][number];
type PrivacyRequest={id:string;kind:string;message:string;status:string;updated:string;note?:string;created?:string;requester?:string};
type Settings={paused:boolean;uploadsEnabled:boolean;revisionRetentionDays:number;updated:string};
type Cleanup={jobId:string;evidenceId?:string;kind:"team"|"evidence"};
type Payload={teamContacts?:TeamContacts|null;error?:string;job?:{jobId:string;status:string}|null;requests?:PrivacyRequest[];pendingCleanups?:{jobId:string;evidenceId:string}[];settings?:Settings;status?:string;pendingCleanup?:boolean;pendingFileCleanup?:number};
const kinds=[["access","Access or export"],["correction","Correction"],["withdrawal","Consent withdrawal"],["erasure","Deletion request"],["concern","Safety or abuse concern"]] as const;

/** Privacy maintenance deliberately never requests a workspace, roster or attachment. */
export default function PrivacyMaintenance({initialSession}:{initialSession:Session}){
 const accountScope=JSON.stringify([initialSession.user?.userId,initialSession.teams.map(t=>[t.id,t.role])]);
 return <MaintenanceAccount key={accountScope} session={initialSession}/>;
}
function MaintenanceAccount({session}:{session:Session}){
 const [teamId,setTeamId]=useState(session.teams[0]?.id||"");
 const [accessEnded,setAccessEnded]=useState(false);
 const team=session.teams.find(t=>t.id===teamId);
 return <div className="privacy-page privacy-maintenance-page">
  <a className="privacy-skip-link" href="#maintenance-content">Skip to privacy maintenance</a>
  <header className="privacy-header"><a className="privacy-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" width="36" height="36" alt=""/><strong>MyFTCSpace</strong></a><a className="privacy-workspace-link" href="/privacy">Privacy and data help</a></header>
  <main className="privacy-content" id="maintenance-content">
   <div className="privacy-intro"><h1>Privacy and safety maintenance</h1><p>Request help and finish approved cleanup while normal team access is paused.</p></div>
   <p>This page opens privacy records without loading team tasks, student work or files. Use your existing school channel for urgent concerns.</p>
   {accessEnded?<p role="alert">Your account or permissions changed. Private maintenance records have been cleared. <a className="text-link" href="/maintenance">Reload authorized access</a>.</p>:!session.user?<p role="alert">Your session is unavailable. Reload this page and sign in with your own approved account.</p>:!team?<p>No approved team membership is available. Contact the responsible coach or school privacy office through your existing school channel.</p>:<>
    <Field label="Team for privacy maintenance"><select value={teamId} onChange={e=>setTeamId(e.target.value)}>{session.teams.map(t=><option key={t.id} value={t.id}>{t.teamName}</option>)}</select></Field>
    <MaintenanceTeam key={JSON.stringify([session.user.userId,team.id,team.role])} accountId={session.user.userId} team={team} onAccessEnded={()=>setAccessEnded(true)}/>
   </>}
   <p><a className="text-link" href="/">Return to team access</a></p>
  </main>
 </div>;
}
function MaintenanceTeam({accountId,team,onAccessEnded}:{accountId:string;team:Team;onAccessEnded:()=>void}){
 const admin=team.role==="admin",staff=admin||team.role==="mentor",base=`/api/teams/${encodeURIComponent(team.id)}/privacy`;
 const alive=useRef(true),running=useRef(false),readGeneration=useRef(0),accessEnded=useRef(false),accessEpoch=useRef(0),operation=useRef(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [contacts,setContacts]=useState<TeamContacts|null|undefined>(undefined);
 const [records,setRecords]=useState<PrivacyRequest[]>([]),[jobs,setJobs]=useState<Cleanup[]>([]),[settings,setSettings]=useState<Settings|null>(null),[complete,setComplete]=useState(false),[locked,setLocked]=useState(false),[pendingFiles,setPendingFiles]=useState(0);
 const [kind,setKind]=useState<string>("concern"),[message,setMessage]=useState("");
 const [review,setReview]=useState<PrivacyRequest|null>(null),[reviewNote,setReviewNote]=useState(""),[reviewStatus,setReviewStatus]=useState("in-progress");
 const stale=new Error("This privacy maintenance session changed.");
 function check(){if(!alive.current||accessEnded.current)throw stale;}
 function endAccess(){accessEnded.current=true;readGeneration.current++;setContacts(undefined);setRecords([]);setJobs([]);setSettings(null);setPendingFiles(0);setReview(null);setReviewNote("");setMessage("");setNotice("");setLocked(true);onAccessEnded();}
 async function call(path:string,method="GET",body?:unknown){
  check();const epoch=accessEpoch.current;
  const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",headers:{"X-MyFTC-Account":accountId,...(body===undefined?{}:{"Content-Type":"application/json"})},body:body===undefined?undefined:JSON.stringify(body)});
  let payload:Payload={};try{payload=await response.json() as Payload;}catch{/* Authentication failures must still clear the page if an upstream returns HTML. */}
  check();if(epoch!==accessEpoch.current)throw stale;
  if(!response.ok){
   if(response.status===401||response.status===403){endAccess();throw new Error("Your account or permissions changed. Reload this page before continuing.");}
   throw new Error(payload.error||"Privacy maintenance could not complete. Your draft is kept.");
  }
  return payload;
 }
 async function load(){
  const generation=++readGeneration.current;
  const erasure=admin?await call(base+"/erase"):null;check();
  if(generation!==readGeneration.current)return;
  if(erasure?.job){
   setContacts(undefined);setRecords([]);setSettings(null);setPendingFiles(0);
   if(erasure.job.status==="pending"){setJobs([{jobId:erasure.job.jobId,kind:"team"}]);setComplete(false);}
   else {setJobs([]);setComplete(true);}
   return;
  }
  const result=await call(base+"/requests");check();if(generation!==readGeneration.current)return;
  const policy=admin?await call(base):null;check();if(generation!==readGeneration.current)return;
  const contact=await call(base+"/contacts").catch(()=>null);check();if(generation!==readGeneration.current)return;
  setContacts(contact?.teamContacts===null?null:contact?.teamContacts&&validTeamContacts(contact.teamContacts)?contact.teamContacts:undefined);setRecords(result.requests||[]);setJobs((result.pendingCleanups||[]).map((job:{jobId:string;evidenceId:string})=>({...job,kind:"evidence" as const})));setSettings(policy?.settings||null);setPendingFiles(policy?.pendingFileCleanup||0);
 }
 async function run(action:()=>Promise<void>){
  if(!alive.current||running.current||accessEnded.current)return;const current=++operation.current;running.current=true;setBusy(true);setError("");setNotice("");
  try{await action();}catch(caught){if(alive.current&&current===operation.current&&caught!==stale)setError(userError(caught));}
  finally{if(current===operation.current){running.current=false;if(alive.current)setBusy(false);}}
 }
 useEffect(()=>{
  alive.current=true;void run(load);
  const focus=()=>{
   if(accessEnded.current)return;
   // Revalidate account-bound maintenance access before displaying old private
   // records after the user returns from another tab or account.
   accessEpoch.current++;readGeneration.current++;operation.current++;running.current=false;
   setContacts(undefined);setRecords([]);setJobs([]);setSettings(null);setPendingFiles(0);setReview(null);setReviewNote("");setMessage("");setNotice("");
   void run(load);
  };
  const visibility=()=>{if(document.visibilityState==="visible")focus();};
  window.addEventListener("focus",focus);document.addEventListener("visibilitychange",visibility);
  return()=>{alive.current=false;readGeneration.current++;window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visibility);};
 },[]);
 async function submit(event:FormEvent){
  event.preventDefault();if(!message.trim())return;
  await run(async()=>{await call(base+"/requests","POST",{kind,message:message.trim()});check();setMessage("");await load();check();setNotice("Request recorded for your approved coach, mentor or admin to review.");});
 }
 async function retry(job:Cleanup){
  const result=await call(base+(job.kind==="team"?"/erase":"/withdraw-evidence"),job.kind==="team"?"DELETE":"POST",{jobId:job.jobId,...(job.evidenceId?{evidenceId:job.evidenceId}:{})});check();
  if(result.status==="pending"||result.pendingCleanup){setNotice("Access remains withdrawn. Storage cleanup is still pending; keep this receipt and retry later.");return;}
  if(job.kind==="team"){setJobs([]);setContacts(undefined);setRecords([]);setSettings(null);setPendingFiles(0);setComplete(true);setNotice("Team erased from application storage. The responsible adult must confirm provider, backup and downloaded copies separately.");}
  else {await load();check();setNotice("Evidence cleanup completed in application storage. External copies need separate adult follow-up.");}
 }
 const erasing=jobs.some(job=>job.kind==="team");
 return <section className="card settings-section" aria-labelledby="maintenance-team-title" aria-busy={busy}>
  <h2 id="maintenance-team-title">{team.teamName}</h2>
  {!locked&&<TeamContactDetails contacts={contacts}/>}
  <p>Your approved role: {team.role}. {staff?"Approved coaches, mentors and admins review team requests.":"You can see your own requests."}</p>
  {error&&<p className="settings-info" role="alert">{error}</p>}
  {notice&&<p className="settings-info" role="status">{notice}</p>}
  {locked?<p>Private maintenance records have been cleared. <a href="/maintenance" className="text-link">Reload authorized access</a>.</p>:<>
   {complete?<p role="status">Team erasure is complete in application storage.</p>:<>
    {jobs.length>0&&<div><h3>Pending storage cleanup</h3><p>A cleanup retry never restores access. Keep the receipt in your approved school process.</p>{jobs.map(job=><p key={job.jobId}>Receipt: <code>{job.jobId}</code> <button type="button" disabled={busy} className="btn btn-secondary" onClick={()=>void run(()=>retry(job))}>Retry {job.kind} cleanup</button></p>)}</div>}
    {!erasing&&<>
     <p>Requests are visible to you and approved coaches, mentors and admins. Keep private student details, passwords and invitation codes out of reports.</p>
     <form className="stack" onSubmit={submit}>
      <Field label="Request type"><select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}>{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Request or concern" hint="Describe the screen or record using a safe reference. An adult verifies identity and follows up through your existing school channel."><textarea required maxLength={2000} rows={4} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)}/></Field>
      <button className="btn btn-primary" disabled={busy||!message.trim()}>Record request</button>
     </form>
     <div aria-live="polite"><h3>{staff?"Team requests":"Your requests"}</h3>{records.length?records.map(record=><article className="settings-info" key={record.id}><strong>{kinds.find(([value])=>value===record.kind)?.[1]||record.kind} · {record.status}</strong><p>{record.message}</p>{record.note&&<p>Adult response: {record.note}</p>}{staff&&<button type="button" disabled={busy} className="btn btn-secondary" onClick={()=>{setReview(record);setReviewNote(record.note||"");setReviewStatus(record.status);}}>Review request</button>}</article>):<p>No requests recorded.</p>}</div>
     {admin&&settings&&<div><h3>Team pause control</h3><p>{settings.paused?"Normal team operations are paused.":"The team has not been paused by its admin."} The release review gate remains in force.</p>{pendingFiles>0&&<p role="status">{pendingFiles} interrupted or pending file operations remain tracked. Ask the responsible operator to reconcile storage before confirming full deletion.</p>}{settings.paused&&<button type="button" disabled={busy} className="btn btn-secondary" onClick={()=>void run(async()=>{await call(base,"PUT",{paused:false,uploadsEnabled:settings.uploadsEnabled,revisionRetentionDays:settings.revisionRetentionDays,expectedUpdated:settings.updated});check();await load();check();setNotice("The team pause was removed. Normal access still requires a valid release review.");})}>Remove team pause</button>}</div>}
    </>}
   </>}
   {!complete&&<button type="button" disabled={busy} className="text-link" onClick={()=>void run(load)}>Refresh privacy records</button>}
  </>}
  {review&&!locked&&<Modal title="Review privacy or safety request" onClose={()=>{if(!busy)setReview(null);}}><p>{review.message}</p><p>Verify identity and authority through your school process. Track applicable deadlines and external copies before marking the request resolved.</p><form className="stack" onSubmit={event=>{event.preventDefault();void run(async()=>{await call(base+"/requests/"+encodeURIComponent(review.id),"PUT",{status:reviewStatus,note:reviewNote,expectedUpdated:review.updated});check();setReview(null);await load();check();setNotice("Request review recorded.");});}}>
   <Field label="Request status"><select disabled={busy} value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}>{["open","in-progress","resolved","rejected"].map(status=><option key={status}>{status}</option>)}</select></Field>
   <Field label="Follow-up record" hint="Record safe references to verified actions and deadlines."><textarea maxLength={2000} rows={4} disabled={busy} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></Field>
   <button disabled={busy} className="btn btn-primary">Save request review</button>
  </form></Modal>}
 </section>;
}
