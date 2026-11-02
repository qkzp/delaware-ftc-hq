import {useEffect,useId,useRef,useState} from "react";
import {useHQ} from "../store";
import type {Cloud} from "../cloud";
import {Field} from "./ui";
import "./SupportCenter.css";

type Topic="sync"|"invitations"|"uploads"|"permissions";
type Connection="online"|"offline"|"unknown";
type Check="not-run"|"checking"|"passed"|"signed-out"|"access-changed"|"unavailable"|"offline";
type Choice={id:string;label:string;steps:string[]};
const guides:Record<Topic,{label:string;question:string;choices:Choice[]}>= {
 sync:{label:"Saving and sync",question:"What is happening with your work?",choices:[
  {id:"waiting",label:"Changes are waiting to save",steps:["Keep this tab open and check the browser connection indicator below. An online signal alone does not confirm the server is reachable.","Run the read-only connection check. If you are offline or signed out, restore your connection or use your own approved account.","Open Team & settings to review the sync message. Preserve unsaved work using the approved download option before reloading or switching teams."]},
  {id:"conflict",label:"A teammate changed the same record",steps:["Keep your draft open. A conflict means the app needs you to review a teammate's newer work.","Preserve your unsaved work through Team & settings before reloading shared records. Treat that download as private team data.","Compare the latest record with your draft and reapply the intended change. Ask the team lead for routine coordination; involve the coach or mentor if the conflict remains."]},
  {id:"session",label:"My session or team changed",steps:["Preserve any unsaved draft through the app's approved download option before closing this tab.","Use your own approved account and choose the intended team in Team & settings. Avoid changing teams while a save is pending.","If access was removed, contact your coach or mentor through your existing school channel. An administrator must review access; a connection check cannot restore it."]},
 ]},
 invitations:{label:"Joining a team",question:"What is happening with the invitation?",choices:[
  {id:"used",label:"The code expired or was already used",steps:["Ask the coach or mentor to confirm that you are on the approved team roster.","Ask the team administrator for a new one-use invitation for the intended team and role. Codes expire after 48 hours.","Use your own approved account. Share invitation codes only with the intended teammate; keep them out of support summaries and screenshots."]},
  {id:"wrong-team",label:"I see the wrong team or role",steps:["Check the active team and role in Team & settings before entering new work.","Stop using a code meant for another team. Ask the coach or mentor to confirm the intended membership.","An administrator can correct membership after checking the approved roster. A student lead can help locate the right team but cannot grant administrator access."]},
 ]},
 uploads:{label:"Evidence and uploads",question:"Where does the upload stop?",choices:[
  {id:"consent",label:"Consent review or uploads are disabled",steps:["Save the evidence record with the consent scope and its approved external reference. Keep student media out of the app until collection is authorized.","Ask an approved coach or mentor to review collection consent on the saved record. A changed record may need a new review.","Only the administrator can enable uploads after the approved consent and file-handling process is in place. Student leads can coordinate the request; they cannot approve consent."]},
  {id:"format",label:"The file is rejected or unavailable",steps:["Use PNG, JPEG, WebP, PDF, or MP4 within the 12 MiB limit. Changing a filename extension does not convert the file.","Check the connection and wait for the current save to finish. If the record changed during upload, reopen its latest version and review consent before retrying.","Other students can open only the current attachment of approved, visible evidence. The owner and managing roles can inspect available drafts. Ask the coach or mentor about review or pending cleanup."]},
 ]},
 permissions:{label:"Access and permissions",question:"Which access issue do you see?",choices:[
  {id:"role",label:"An action or record is unavailable",steps:["Check your active role below and the intended team in Team & settings. Some records and actions are restricted by role.","Students can work on assigned tasks and their own evidence. Student leads help coordinate team work; coaches and mentors handle consent, evidence review, and privacy concerns.","Ask the coach or mentor to review the need for access. An administrator makes approved membership changes. Repeated retries do not grant additional permissions."]},
  {id:"paused",label:"The service or team is paused",steps:["Follow the pause message and preserve any unsaved work. Normal edits and files may be blocked while review or cleanup is pending.","Open privacy maintenance for request intake, pause controls, and authorized cleanup receipts. Access remains limited to approved team members and roles.","The coach or mentor is the primary escalation contact. The administrator or adult owner must resolve the pause; student leads can help with routine coordination."]},
 ]},
};
const checkLabels:Record<Check,string>={"not-run":"Not run",checking:"Checking",passed:"Current sign-in and membership confirmed","signed-out":"Sign-in needed","access-changed":"Account or team access needs review",unavailable:"Server check unavailable",offline:"Browser reports offline"};
const roleLabels:Record<string,string>={student:"Student",lead:"Student lead",mentor:"Mentor / coach",admin:"Administrator"};
function syncLabel(cloud:Cloud){
 if(!cloud.shared)return "No shared team open";
 if(cloud.error)return "Needs attention";
 if(cloud.hasUnsaved())return "Unsaved work or save in progress";
 return cloud.status==="Synced"?"Synced":"Not confirmed";
}
export function buildSupportSummary(input:{topic:Topic;connection:Connection;signedIn:boolean;teamOpen:boolean;role:string;sync:string;check:Check}){
 // Construct an allowlist of fixed labels. Never serialize cloud state or error text.
 const topic=Object.hasOwn(guides,input.topic)?guides[input.topic].label:"Not selected";
 const connection=["online","offline","unknown"].includes(input.connection)?input.connection:"unknown";
 const sync=["No shared team open","Needs attention","Unsaved work or save in progress","Synced","Not confirmed"].includes(input.sync)?input.sync:"Not confirmed";
 const role=Object.hasOwn(roleLabels,input.role)?roleLabels[input.role]:"Not available";
 const check=Object.hasOwn(checkLabels,input.check)?checkLabels[input.check]:"Not run";
 return ["MyFTCSpace support summary",`Topic: ${topic}`,`Browser connection signal: ${connection}`,`Signed in: ${input.signedIn===true?"Yes":"No"}`,`Shared team open: ${input.teamOpen===true?"Yes":"No"}`,`Active role: ${input.teamOpen===true?role:"Not available"}`,`Sync: ${sync}`,`Read-only check: ${check}`,"No team names, account IDs, record contents, invitation codes, or tokens are included."].join("\n");
}
export default function SupportCenter(){
 const {cloud}=useHQ();
 return <SupportPanel key={JSON.stringify([cloud.session.user?.userId,cloud.shared?.id,cloud.shared?.role])}/>;
}
function SupportPanel(){
 const {cloud,setPage}=useHQ(),heading=useId(),checkHint=useId();
 const [topic,setTopic]=useState<Topic>("sync"),[choice,setChoice]=useState("");
 const [connection,setConnection]=useState<Connection>("unknown"),[check,setCheck]=useState<Check>("not-run"),[copyMessage,setCopyMessage]=useState("");
 const alive=useRef(true),running=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  alive.current=true;
  const update=()=>setConnection(typeof navigator.onLine==="boolean"?(navigator.onLine?"online":"offline"):"unknown");
  update();window.addEventListener("online",update);window.addEventListener("offline",update);
  return()=>{alive.current=false;controller.current?.abort();window.removeEventListener("online",update);window.removeEventListener("offline",update);};
 },[]);
 async function runCheck(){
  if(running.current)return;
  if(connection==="offline"){setCheck("offline");return;}
  running.current=true;setCheck("checking");
  const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),10000);
  try{
   const response=await fetch("/api/session",{method:"GET",credentials:"same-origin",cache:"no-store",signal:abort.signal});
   let result:Check="unavailable";
   if(response.status===401)result="signed-out";
   else if(response.status===403)result="access-changed";
   else if(response.ok){
    const payload=await response.json();
    const session=payload&&typeof payload==="object"?payload as {reviewClosed?:unknown;user?:{userId?:unknown}|null;teams?:unknown}:null;
    if(session?.reviewClosed)result="unavailable";
    else if(session?.user===null)result="signed-out";
    else if(typeof session?.user?.userId==="string"&&Array.isArray(session.teams)){
     result=session.user.userId===cloud.session.user?.userId&&(!cloud.shared||session.teams.some((team:unknown)=>!!team&&typeof team==="object"&&"id" in team&&"role" in team&&team.id===cloud.shared!.id&&team.role===cloud.shared!.role))?"passed":"access-changed";
    }
   }
   if(alive.current)setCheck(result);
  }catch{if(alive.current)setCheck("unavailable");}
  finally{clearTimeout(timeout);running.current=false;if(controller.current===abort)controller.current=null;}
 }
 const guide=guides[topic],selected=guide.choices.find(item=>item.id===choice),sync=syncLabel(cloud);
 const summary=buildSupportSummary({topic,connection,signedIn:!!cloud.session.user,teamOpen:!!cloud.shared,role:cloud.shared?.role||"",sync,check});
 async function copySummary(){
  try{if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");await navigator.clipboard.writeText(summary);if(alive.current)setCopyMessage("Summary copied. Review it before sharing through your approved school support channel.");}
  catch{if(alive.current)setCopyMessage("Copy is unavailable. Select and copy the summary below.");}
 }
 return <section className="card support-center" aria-labelledby={heading}>
  <div className="support-center-heading"><div><p className="eyebrow">GUIDED HELP</p><h2 id={heading}>Resolve a workspace issue</h2></div><span className="support-center-label">Checks only</span></div>
  <p>Start with a short check, then follow the steps for your issue. These tools read connection status and leave team records unchanged.</p>
  <div className="support-center-grid">
   <div className="support-center-guide">
    <Field label="What do you need help with?"><select value={topic} onChange={event=>{setTopic(event.target.value as Topic);setChoice("");setCopyMessage("");}}>{(Object.keys(guides) as Topic[]).map(key=><option value={key} key={key}>{guides[key].label}</option>)}</select></Field>
    <Field label={guide.question}><select value={choice} onChange={event=>setChoice(event.target.value)}><option value="">Choose what you see</option>{guide.choices.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select></Field>
    <div className="support-center-next" aria-live="polite">{selected?<><h3>Your next steps</h3><ol>{selected.steps.map(step=><li key={step}>{step}</li>)}</ol></>:<p>Choose the situation closest to yours to see the next steps.</p>}</div>
    <button type="button" className="btn btn-secondary" onClick={()=>setPage("settings")}>Open Team & settings</button>
   </div>
   <div className="support-center-diagnostics">
    <h3>Connection check</h3>
    <dl className="support-center-status"><div><dt>Browser signal</dt><dd>{connection==="online"?"Online signal":connection==="offline"?"Offline signal":"Not available"}</dd></div><div><dt>Account</dt><dd>{cloud.session.user?"Signed in":"Not signed in"}</dd></div><div><dt>Active role</dt><dd>{cloud.shared?roleLabels[cloud.shared.role]:"No shared team open"}</dd></div><div><dt>Sync</dt><dd>{sync}</dd></div></dl>
    <p id={checkHint}>The check reads your current sign-in and team membership. It does not save, retry a mutation, open files, or reload your draft.</p>
    <button type="button" className="btn btn-secondary" disabled={check==="checking"} aria-describedby={checkHint} onClick={()=>void runCheck()}>{check==="checking"?"Checking connection…":"Run read-only check"}</button>
    <p role="status" className="support-center-result">{checkLabels[check]}</p>
   </div>
  </div>
  <div className="support-center-escalation"><h3>Bring in the right person</h3><p>Your coach or mentor is the primary contact for unresolved access, consent, privacy, safety, or service issues. A student lead can help next with routine navigation and team coordination. Use your existing school contact channel.</p><p>For an urgent safety concern, contact a trusted adult directly.</p><div className="support-center-links"><a className="text-link" href="/privacy">Privacy and data help</a><a className="text-link" href="/maintenance">Privacy requests and maintenance</a></div></div>
  <Field label="Sanitized support summary" hint="Review before sharing. Do not add student details, invitation codes, screenshots of private records, or passwords."><textarea className="support-center-summary" readOnly rows={10} value={summary} onFocus={event=>event.currentTarget.select()}/></Field>
  <button type="button" className="btn btn-secondary" onClick={()=>void copySummary()}>Copy support summary</button>
  <p role="status" className="support-center-result">{copyMessage}</p>
 </section>;
}
