import { useState } from "react";
import { api } from "../cloud";
import { useHQ } from "../store";
import { Field, Modal } from "./ui";
import { downloadFile, dateKey } from "../utils";
export default function TeamAccess() {
 const {cloud,data,notify,memberName}=useHQ();
 const [busy,setBusy]=useState(false),[token,setToken]=useState(""),[invites,setInvites]=useState<any[]>([]),[history,setHistory]=useState<any[]>([]),[restore,setRestore]=useState<string|null>(null),[reload,setReload]=useState(false),[learning,setLearning]=useState<any[]>([]);
 async function run(action:()=>Promise<void>){setBusy(true);try{await action();}catch(e){notify((e as Error).message);}finally{setBusy(false);}}
 const base=cloud.shared?`/api/teams/${cloud.shared.id}`:"";
 return <section className="card settings-section team-access" aria-labelledby="team-access-title">
  <h2 id="team-access-title">{cloud.shared?"Your private team":"Connect your team"}</h2>
  <p className="muted">{cloud.session.user ? "Signed in with ChatGPT. Team records are private to invited members, with permissions assigned by your team admin." : "Sign in with your own ChatGPT account to create or join a private team."}</p>
  {!cloud.shared&&cloud.error&&<div className="settings-info" role="alert"><p>{cloud.error}</p><button className="btn btn-secondary" onClick={()=>void run(async()=>{await cloud.refreshSession();notify('Team connection restored.');})}>Retry connection</button></div>}
  {!cloud.session.user?<a className="btn btn-primary" href="/signin-with-chatgpt?return_to=%2F%23settings" target="_top">Sign in with ChatGPT</a>:<>
   <div className="team-picker">{cloud.session.teams.map(t=><button disabled={busy||cloud.shared?.id===t.id} className="btn btn-secondary" key={t.id} onClick={()=>void run(()=>cloud.openTeam(t.id))}>{t.teamName} · {t.role}</button>)}</div>
   {!cloud.shared&&<div className="access-forms">
    <form className="stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{const result=await api('/api/teams','POST',Object.fromEntries(f));await cloud.refreshSession();await cloud.openTeam(result.id);notify("Private team created. Invite your teammates below.");});}}>
     <h3>Create a team</h3><Field label="Team name"><input name="teamName" required maxLength={80}/></Field>
     <Field label="Your display name" hint="Use your first name and last initial. Do not enter a full student name or email."><input name="name" required maxLength={40}/></Field>
     <Field label="County"><select name="county"><option>New Castle</option><option>Kent</option><option>Sussex</option><option>Statewide</option></select></Field><button disabled={busy} className="btn btn-primary">Create private team</button>
    </form>
    <form className="stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{const result=await api('/api/join','POST',Object.fromEntries(f));await cloud.refreshSession();await cloud.openTeam(result.id);notify("You joined the team.");});}}>
     <h3>Join your team</h3><Field label="Invitation code"><input name="token" required autoComplete="off"/></Field><Field label="Your display name" hint="First name and last initial only."><input name="name" required maxLength={40}/></Field><button disabled={busy} className="btn btn-secondary">Join team</button>
    </form>
   </div>}
   {cloud.shared&&<>
    <p className="sync-detail" role="status">{cloud.status} · Shared revision {cloud.shared.version} · Your role: {cloud.shared.role}</p>
    {cloud.error&&<div className="settings-info" role="alert"><p>{cloud.error}</p><div className="inline"><button className="btn btn-secondary" onClick={()=>downloadFile(`myftcspace-unsaved-${dateKey()}.json`,JSON.stringify(data,null,2))}>Download unsaved changes</button><button className="btn btn-secondary" onClick={()=>setReload(true)}>Reload shared records</button><button className="btn btn-secondary" onClick={cloud.retry}>Retry save</button></div></div>}
    <div className="member-list">{cloud.shared.members.map(m=><div key={m.userId} className="member-row"><span><strong>{m.name}</strong>{m.userId===cloud.session.user?.userId&&" (you)"}</span>{cloud.shared?.role==='admin'&&m.userId!==cloud.session.user?.userId?<><select aria-label={`Role for ${m.name}`} value={m.role} disabled={busy} onChange={e=>void run(async()=>{await api(`${base}/members`,'PUT',{userId:m.userId,role:e.target.value});await cloud.reload();})}>{['student','lead','mentor','admin'].map(r=><option key={r}>{r}</option>)}</select><button className="btn btn-ghost" onClick={()=>void run(async()=>{await api(`${base}/members/${m.userId}`,'DELETE');await cloud.reload();notify("Team access removed.");})}>Remove access</button></>:<span className="muted">{m.role}</span>}</div>)}</div>
    {cloud.shared.role==='admin'&&<div className="stack">
     <form className="inline" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{const result=await api(`${base}/invites`,'POST',{role:f.get('role')});setToken(result.token);setInvites((await api(`${base}/invites`)).invites);});}}><Field label="Invite as"><select name="role"><option value="student">Student</option><option value="lead">Student lead</option><option value="mentor">Mentor / coach</option></select></Field><button disabled={busy} className="btn btn-primary">Create one-use invitation</button></form>
     {token&&<Field label="Invitation code" hint="Share privately with the intended teammate. Expires in 48 hours and works once."><textarea readOnly value={token} rows={3} onFocus={e=>e.target.select()}/></Field>}
     <button className="text-link" onClick={()=>void run(async()=>setInvites((await api(`${base}/invites`)).invites))}>View invitations</button>
     {invites.filter(i=>!i.used&&new Date(i.expires)>new Date()).map(i=><div className="member-row" key={i.id}><span>{i.role} · expires {new Date(i.expires).toLocaleString()}</span><button className="btn btn-ghost" onClick={()=>void run(async()=>{await api(`${base}/invites/${i.id}`,'DELETE');setInvites((await api(`${base}/invites`)).invites);})}>Revoke invitation</button></div>)}
    </div>}
    {['mentor','admin'].includes(cloud.shared.role)&&<div className="stack">
     <button className="btn btn-secondary" onClick={()=>void run(async()=>setHistory((await api(`${base}/history`)).history))}>Review saved revisions</button>
     {history.map(h=><div key={h.id} className="member-row"><span>Revision {h.version} · {new Date(h.created).toLocaleString()} · {memberName(h.actor)}</span>{cloud.shared?.role==='admin'&&<button className="btn btn-secondary" onClick={()=>setRestore(h.id)}>Restore</button>}</div>)}
     <button className="btn btn-secondary" onClick={()=>void run(async()=>setLearning((await api(`${base}/learning`)).learning))}>Review rookie skill sign-offs</button>
     {learning.map(l=><fieldset key={l.userId}><legend>{memberName(l.userId)}</legend><p className="muted">{l.steps.length} onboarding steps completed</p>{['shop-safety','battery-safety','robot-startup','first-task'].map(skill=><label className="skill-review" key={skill}><input type="checkbox" checked={l.skills.includes(skill)} onChange={e=>void run(async()=>{await api(`${base}/learning`,'PUT',{userId:l.userId,skills:e.target.checked?[...l.skills,skill]:l.skills.filter((s:string)=>s!==skill)});setLearning((await api(`${base}/learning`)).learning);await cloud.reload();})}/>{skill.replaceAll('-',' ')}</label>)}</fieldset>)}
    </div>}
    <a className="text-link" href="/demo" onClick={e=>{if(cloud.hasUnsaved()){e.preventDefault();notify("Save or download your changes before opening the demo.");}}}>Explore demo</a>
   </>}
   <a className="text-link" href="/signout-with-chatgpt?return_to=%2F" target="_top" onClick={e=>{if(cloud.hasUnsaved()){e.preventDefault();notify("Wait for your changes to save, or download them before signing out.");}}}>Sign out</a>
  </>}
  {(restore||reload)&&<Modal title={restore?"Restore a saved team revision?":"Reload the shared workspace?"} onClose={()=>{setRestore(null);setReload(false);}}><p>{restore?"This saves the current revision to history, then restores the selected revision for every teammate.":"Download your unsaved changes first. Reloading replaces this tab’s unsaved changes with the saved team version."}</p><div className="form-actions"><button className="btn btn-secondary" onClick={()=>{setRestore(null);setReload(false);}}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={()=>void run(async()=>{if(restore)await api(`${base}/history`,'POST',{id:restore,baseVersion:cloud.shared?.version});await cloud.reload();setRestore(null);setReload(false);notify("Shared workspace loaded.");})}>{restore?"Restore revision":"Reload saved records"}</button></div></Modal>}
 </section>;
}
