import {userError} from "../user-errors";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {useHQ} from "../store";
import {api} from "../cloud";
import {Field,Modal} from "./ui";

type Settings={paused:boolean;uploadsEnabled:boolean;revisionRetentionDays:number;updated?:string};
type RequestRecord={id:string;kind:string;message:string;status:string;created?:string;updated?:string;note?:string;requester?:string;userId?:string};
type CleanupJob={jobId:string;evidenceId?:string;kind:"evidence"|"team"};
const kinds=[["access","Access or export"],["correction","Correction"],["withdrawal","Consent withdrawal"],["erasure","Deletion request"],["concern","Safety or abuse concern"]] as const;
export default function PrivacyControls(){
 const {cloud}=useHQ();
 return cloud.shared?<PrivacyPanel key={`${cloud.session.user?.userId}:${cloud.shared.id}:${cloud.shared.role}`}/>:null;
}
function PrivacyPanel(){
 const {cloud,data,myOwner,memberName,notify}=useHQ();
 const shared=cloud.shared!,base=`/api/teams/${shared.id}/privacy`,admin=shared.role==="admin",staff=admin||shared.role==="mentor";
 const alive=useRef(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[kind,setKind]=useState<string>("concern");
 const [requests,setRequests]=useState<RequestRecord[]>([]),[settings,setSettings]=useState<Settings|null>(null),[draft,setDraft]=useState<Settings|null>(null);
 const [erase,setErase]=useState<{name:string;version:number}|null>(null),[confirmation,setConfirmation]=useState("");
 const [withdraw,setWithdraw]=useState(""),[withdrawConfirm,setWithdrawConfirm]=useState("");
 const [jobs,setJobs]=useState<CleanupJob[]>([]),[review,setReview]=useState<RequestRecord|null>(null),[reviewNote,setReviewNote]=useState(""),[reviewStatus,setReviewStatus]=useState("in-progress");
 const [pendingFiles,setPendingFiles]=useState(0);
 async function load(){
  const erasure=admin?await api(base+"/erase"):null;
  if(!alive.current)return;
  if(erasure?.job?.status==="pending"){
   setJobs([{jobId:erasure.job.jobId,kind:"team"}]);setRequests([]);setSettings(null);setDraft(null);return;
  }
  const result=await api(base+"/requests");
  if(!alive.current)return;
  const policy=admin?await api(base):null;
  if(!alive.current)return;
  setRequests(result.requests||[]);
  setJobs((result.pendingCleanups||[]).map((job:{jobId:string;evidenceId:string})=>({...job,kind:"evidence" as const})));
  if(policy){const next=policy.settings||policy;setSettings(next);setDraft(next);setPendingFiles(policy.pendingFileCleanup||0);}
 }
 async function finishCleanup(job:CleanupJob){
  const result=await api(base+(job.kind==="team"?"/erase":"/withdraw-evidence"),job.kind==="team"?"DELETE":"POST",{jobId:job.jobId,evidenceId:job.evidenceId});
  if(!alive.current)return;
  if(result.status==="pending"||result.pendingCleanup){setError("Access is withdrawn. Storage cleanup is still pending; retry this job or contact the responsible adult.");return;}
  setJobs(current=>current.filter(j=>j.jobId!==job.jobId));
  if(job.kind==="team"){notify("Team erased from application storage. The adult owner must confirm provider and exported copies separately.");await cloud.refreshSession();}
  else {await load();if(alive.current)notify("Evidence cleanup completed in application storage.");}
 }
 useEffect(()=>{alive.current=true;void load().catch(e=>{if(alive.current)setError(userError(e));});return()=>{alive.current=false;};},[]);
 async function run(action:()=>Promise<void>){
  if(busy)return;setBusy(true);setError("");
  try{await action();}catch(e){if(alive.current)setError(userError(e));}
  finally{if(alive.current)setBusy(false);}
 }
 async function submit(event:FormEvent){
  event.preventDefault();
  if(!message.trim())return;
  await run(async()=>{
   await api(base+"/requests","POST",{kind,message:message.trim()});
   if(!alive.current)return;
   setMessage("");await load();if(alive.current)notify("Request recorded. An approved coach, mentor or admin must review it; use your school channel for urgent concerns.");
  });
 }
 const evidence=(data.evidence||[]).filter(e=>admin||e.owner===myOwner);
 return <section className="card settings-section privacy-controls" aria-labelledby="privacy-controls-title">
  <h2 id="privacy-controls-title">Privacy and safety</h2>
  <p>Requests are visible to you and approved coaches, mentors and admins. Keep student details, passwords, invitation codes and sensitive files out of the message. For urgent safety concerns, contact a trusted adult directly.</p>
  <p><a className="text-link" href="/privacy" target="_blank" rel="noreferrer">Read the privacy and data help page</a></p>
  {error&&<p className="settings-info" role="alert">{error}</p>}
  {admin&&pendingFiles>0&&<p role="status">{pendingFiles} private upload cleanup item(s) need adult review. Interrupted uploads remain inaccessible and tracked. Use the approved evidence withdrawal process or contact the hosting operator to reconcile an interrupted upload.</p>}
  <form className="stack" onSubmit={submit}>
   <Field label="Request type"><select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}>{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
   <Field label="Request or concern" hint="Describe the screen and record involved without adding private student information. An adult verifies and follows up through your existing school channel."><textarea required maxLength={2000} rows={4} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)}/></Field>
   <button className="btn btn-primary" disabled={busy||!message.trim()}>Record request</button>
  </form>
  <div aria-live="polite"><h3>{staff?"Team requests":"Your requests"}</h3>{!requests.length?<p>No requests recorded.</p>:requests.map(r=><article className="settings-info" key={r.id}><strong>{kinds.find(([v])=>v===r.kind)?.[1]||r.kind} · {r.status}</strong><p>{r.message}</p>{r.created&&<p>Recorded {new Date(r.created).toLocaleDateString("en-US")}. An adult must verify the requester and applicable deadline.</p>}{staff&&(r.requester||r.userId)&&<p>From {memberName(r.requester||r.userId||"")}</p>}{r.note&&<p>Admin response: {r.note}</p>}{staff&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{setReview(r);setReviewNote(r.note||"");setReviewStatus(r.status);}}>Review request</button>}</article>)}</div>
  <button type="button" className="text-link" disabled={busy} onClick={()=>void run(load)}>Refresh privacy records</button>
  {jobs.length>0&&<div role="status"><h3>Pending storage cleanup</h3><p>Keep the cleanup receipt in your approved school process. A retry never restores access.</p>{jobs.map(job=><p key={job.jobId}>Receipt: <code>{job.jobId}</code> <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void run(()=>finishCleanup(job))}>Retry {job.kind} cleanup</button></p>)}</div>}
  <details><summary>Permanently withdraw evidence</summary><p>This removes the entire evidence record from current records and retained revisions, then queues all its private files for deletion. Downloaded copies and external providers need a separate adult follow-up. This action cannot be undone through revision restore.</p>
   <Field label="Evidence to withdraw"><select value={withdraw} disabled={busy} onChange={e=>{setWithdraw(e.target.value);setWithdrawConfirm("");}}><option value="">Choose your evidence</option>{evidence.map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select></Field>
   <Field label="Type WITHDRAW EVIDENCE to confirm"><input value={withdrawConfirm} disabled={busy} autoComplete="off" onChange={e=>setWithdrawConfirm(e.target.value)}/></Field>
   <button type="button" className="btn btn-secondary" disabled={busy||!withdraw||withdrawConfirm!=="WITHDRAW EVIDENCE"||cloud.hasUnsaved()} onClick={()=>void run(async()=>{
    const result=await api(base+"/withdraw-evidence","POST",{evidenceId:withdraw,baseVersion:shared.version,confirmation:withdrawConfirm});
    if(!alive.current)return;
    if(result.status==="pending"||result.pendingCleanup)setJobs(current=>[...current.filter(j=>j.jobId!==result.jobId),{jobId:result.jobId,evidenceId:withdraw,kind:"evidence"}]);
    setWithdrawConfirm("");setWithdraw("");await cloud.reload();if(alive.current)notify(result.status==="pending"||result.pendingCleanup?"Evidence access withdrawn. Retry the pending storage cleanup.":"Evidence withdrawn from app records and stored attachments.");
   })}>Permanently withdraw selected evidence</button>
  </details>
  {admin&&<><h3>Team privacy controls</h3><p>Uploads start disabled. Enable them only after the school's consent and malware-handling process is approved. Pausing the team blocks normal edits and files while privacy requests and cleanup remain available.</p>
   <form className="stack" onSubmit={e=>{e.preventDefault();if(!draft||!settings)return;void run(async()=>{
    await api(base,"PUT",{paused:draft.paused,uploadsEnabled:draft.uploadsEnabled,revisionRetentionDays:draft.revisionRetentionDays,expectedUpdated:settings.updated});
    if(!alive.current)return;await load();if(alive.current)notify("Team privacy settings saved.");
   });}}>
    <label className="inline"><input type="checkbox" disabled={busy||!draft} checked={draft?.paused||false} onChange={e=>setDraft(d=>d?{...d,paused:e.target.checked}:d)}/>Pause normal team operations</label>
    <label className="inline"><input type="checkbox" disabled={busy||!draft} checked={draft?.uploadsEnabled||false} onChange={e=>setDraft(d=>d?{...d,uploadsEnabled:e.target.checked}:d)}/>Enable reviewed evidence uploads</label>
    <Field label="Revision retention in days" hint="1–30 days, at most 30 snapshots. The operator must run and verify maintenance for inactive teams."><input type="number" min={1} max={30} step={1} required disabled={busy||!draft} value={draft?.revisionRetentionDays||30} onChange={e=>setDraft(d=>d?{...d,revisionRetentionDays:Number(e.target.value)}:d)}/></Field>
    <button className="btn btn-primary" disabled={busy||!draft}>Save privacy controls</button>
   </form>
   <h3>Permanent team erasure</h3><p>Erasure closes team access, deletes application records and stored evidence, and cannot be recovered through revision history. Provider backups/logs and exported copies require separate confirmed handling by the adult owner.</p>
   <button type="button" className="btn btn-secondary" disabled={busy||cloud.hasUnsaved()} onClick={()=>{setErase({name:data.teamName,version:shared.version});setConfirmation("");}}>Review permanent team erasure</button>
  </>}
  {erase&&<Modal title="Permanently erase this team?" onClose={()=>{if(!busy)setErase(null);}}><p>All current team records, retained revisions, invitations, memberships and private evidence files will be removed from application storage. This cannot be undone. If cleanup fails, the team stays blocked until an admin retries.</p><p>Team: <strong>{erase.name}</strong></p><Field label="Type the exact team name to confirm"><input value={confirmation} disabled={busy} autoComplete="off" onChange={e=>setConfirmation(e.target.value)}/></Field><div className="form-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setErase(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy||confirmation!==erase.name} onClick={()=>void run(async()=>{
   const result=await api(base+"/erase","DELETE",{baseVersion:erase.version,confirmation});
   if(!alive.current)return;
   if(result.status==="pending"||result.pendingCleanup){setJobs(current=>[...current.filter(j=>j.jobId!==result.jobId),{jobId:result.jobId,kind:"team"}]);setErase(null);setError("Team access is blocked. File cleanup is still pending; use the cleanup receipt to retry.");return;}
   setErase(null);notify("Team erased from application storage. Follow up on provider and exported copies.");await cloud.refreshSession();
  })}>Permanently erase team</button></div></Modal>}
  {review&&<Modal title="Review privacy or safety request" onClose={()=>{if(!busy)setReview(null);}}><p>{review.message}</p><p>Verify identity and authorization through your school channel. Record vendor, backup and export follow-up before marking a request resolved.</p><form className="stack" onSubmit={event=>{event.preventDefault();void run(async()=>{
   await api(base+"/requests/"+review.id,"PUT",{status:reviewStatus,note:reviewNote,expectedUpdated:review.updated});
   if(!alive.current)return;setReview(null);await load();if(alive.current)notify("Request review recorded.");
  });}}><Field label="Request status"><select value={reviewStatus} disabled={busy} onChange={e=>setReviewStatus(e.target.value)}>{["open","in-progress","resolved","rejected"].map(status=><option key={status}>{status}</option>)}</select></Field><Field label="Follow-up record" hint="Use safe references to verified actions and deadlines; do not add student details."><textarea value={reviewNote} maxLength={2000} rows={4} disabled={busy} onChange={e=>setReviewNote(e.target.value)}/></Field><button className="btn btn-primary" disabled={busy}>Save request review</button></form></Modal>}
 </section>;
}
