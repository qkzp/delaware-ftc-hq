import { useEffect, useRef, useState } from "react";
import type { AppData, Member, Role } from "./types";
import { rebaseWorkspace } from "../server/policy";
import { createWorkspaceData } from "./workspace-data";
import {userError} from "./user-errors";
export type Session = {user: {userId:string}|null; teams:{id:string;teamName:string;name:string;role:Role}[]};
type Shared = {id:string;version:number;role:Role;members:Member[];updated:string};
const pendingWrites=new Map<string,Promise<any>>();let requestAccount="",sessionSequence=0;
export function api(path:string, method="GET", body?:unknown):Promise<any> {
 const sequence=path==="/api/session"?++sessionSequence:0;
 const encoded=body===undefined?undefined:JSON.stringify(body),write=!["GET","HEAD"].includes(method),key=JSON.stringify([requestAccount,path,method,encoded]);
 if(write&&pendingWrites.has(key))return pendingWrites.get(key)!;
 const result=(async()=>{let response:Response;try{response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",headers:body===undefined?{}:{"Content-Type":"application/json"},body:encoded});}catch(error){throw Object.assign(new Error(userError(error)),{status:0});}
 let payload:any;try{payload=await response.json();}catch{throw Object.assign(new Error("The service could not finish its response. Keep this tab open and try again."),{status:response.ok?502:response.status});}
 if(!response.ok)throw Object.assign(new Error(userError(payload.error)),{status:response.status});
 if(path==="/api/session"&&sequence===sessionSequence){const account=payload.user?.userId||"";if(account!==requestAccount){requestAccount=account;pendingWrites.clear();}}
 return payload;})();
 if(write){pendingWrites.set(key,result);const clear=()=>{if(pendingWrites.get(key)===result)pendingWrites.delete(key);};void result.then(clear,clear);}return result;
}
export function useCloud(data:AppData, replace:(data:AppData)=>void, {enabled=true,autoOpen=false}:{enabled?:boolean;autoOpen?:boolean}={}) {
 const [ready,setReady]=useState(!enabled);
 const [session,setSession]=useState<Session>({user:null,teams:[]}),[shared,setShared]=useState<Shared|null>(null),[status,setStatus]=useState(""),[error,setError]=useState("");
 const active=useRef<Shared|null>(null),latest=useRef(data),dirty=useRef(false),saving=useRef(false),blocked=useRef(false),alive=useRef(true),replaceRef=useRef(replace);
 const sessionRef=useRef<Session>({user:null,teams:[]});
 const accessGeneration=useRef(0),sessionRequest=useRef(0),saveRequest=useRef(0),readRequest=useRef(0),editRevision=useRef(0),reading=useRef(false);
 latest.current=data;replaceRef.current=replace;
 const validAccess=(generation:number,id:string,userId:string|undefined,role:Role)=>alive.current&&generation===accessGeneration.current&&sessionRef.current.user?.userId===userId&&sessionRef.current.teams.some(t=>t.id===id&&t.role===role);
 const validResult=(generation:number,id:string,userId:string|undefined,role:Role,result:any)=>validAccess(generation,id,userId,role)&&result.role===role&&(active.current?.id!==id||result.version>=active.current.version);
 const changedAccess=()=>new Error("Your account, permissions, or team changed. Reopen the current team before continuing.");
 function lock(message:string,nextSession:Session={user:null,teams:[]}) {
  accessGeneration.current++;sessionRequest.current++;saveRequest.current++;readRequest.current++;saving.current=false;reading.current=false;
  active.current=null;dirty.current=false;blocked.current=true;
  replaceRef.current(createWorkspaceData());setShared(null);setStatus("");setError(message);
  sessionRef.current=nextSession;setSession(nextSession);
  try{localStorage.removeItem('myftcspace:team');}catch{/* A blocked preference store must not prevent locking. */}
 }
 const refreshSession=async()=>{
  if(!enabled)return {user:null,teams:[]} as Session;
  const request=++sessionRequest.current;
  const next:Session=await api('/api/session');
  if(!alive.current||request!==sessionRequest.current)return sessionRef.current;
  const previousRole=sessionRef.current.teams.find(t=>t.id===active.current?.id)?.role,nextRole=next.teams.find(t=>t.id===active.current?.id)?.role;
  if(active.current && next.user?.userId!==sessionRef.current.user?.userId)lock("Your account session changed. Sign in again or reopen your team.",next);
  else if(active.current && !next.teams.some(t=>t.id===active.current?.id))lock("Your team access was removed. Private records have been cleared from this tab.",next);
  else if(active.current&&nextRole&&previousRole!==nextRole){
   const team=active.current;lock("Your team role changed. Checking current permissions…",next);active.current={...team,role:nextRole};
   void readTeam(true).then(()=>{if(active.current?.id===team.id&&active.current.role===nextRole)setError("Your team role changed. Records were reloaded with your current permissions.");}).catch(e=>{if(active.current?.id===team.id)setError(userError(e));});
  }
  else if(!active.current)setError("");
  sessionRef.current=next;setSession(next);return next;
 };
 function accept(id:string,result:any){const next={id,version:result.version,role:result.role,members:result.members,updated:result.updated};active.current=next;setShared(next);}
 const openTeam=async(id:string)=>{
  if(!enabled)throw new Error("Sign in to open a private team.");
  if(dirty.current||saving.current||reading.current)throw new Error("Save or download your unsaved changes, then reload before switching teams.");
  const generation=++accessGeneration.current,identity=sessionRef.current.user?.userId,revision=editRevision.current;
  const result=await api(`/api/teams/${id}`),current=await refreshSession(),role=current.teams.find(t=>t.id===id)?.role;
  if(!current.user||!role||current.user.userId!==identity||!validResult(generation,id,identity,role,result))throw changedAccess();
  if(editRevision.current!==revision||dirty.current)throw new Error("New changes were made while this team was opening. Save them before switching teams.");
  accept(id,result);blocked.current=false;dirty.current=false;setError("");setStatus("Synced");latest.current=result.data;replaceRef.current(result.data);
  try{localStorage.setItem('myftcspace:team',id);}catch{/* Team preferences are optional. */}
 };
 const readTeam=async(allowSaving=false)=>{
  if(!active.current)return;
  if(reading.current||(!allowSaving&&saving.current))throw new Error("Wait for the current save or reload to finish before reloading shared records.");
  const id=active.current.id,identity=sessionRef.current.user?.userId,previousRole=active.current.role,revision=editRevision.current,request=++readRequest.current;
  reading.current=true;let generation=++accessGeneration.current;
  try{
   const current=await refreshSession();
   if(!alive.current||request!==readRequest.current||active.current?.id!==id||current.user?.userId!==identity)throw changedAccess();
   const role=current.teams.find(t=>t.id===id)?.role;if(!role)throw changedAccess();
   generation=++accessGeneration.current;
   const result=await api(`/api/teams/${id}`);await refreshSession();
   if(request!==readRequest.current||active.current?.id!==id||!validResult(generation,id,identity,role,result))throw changedAccess();
   if(role===previousRole&&editRevision.current!==revision)throw new Error("New changes were made during reload. Your draft was kept; save or download it before reloading again.");
   dirty.current=false;blocked.current=false;accept(id,result);latest.current=result.data;replaceRef.current(result.data);setError("");setStatus("Synced");
  }catch(e){if(request===readRequest.current&&generation===accessGeneration.current&&[401,403].includes((e as Error&{status?:number}).status||0))lock("Your session or team access ended. Sign in again to reopen your team.");throw e;}
  finally{if(request===readRequest.current)reading.current=false;}
 };
 const reload=()=>readTeam();
 const save=async()=>{
  const team=active.current;if(!team||!dirty.current||saving.current||reading.current||blocked.current)return;
  const generation=accessGeneration.current,identity=sessionRef.current.user?.userId,request=++saveRequest.current;
  saving.current=true;const snapshot=latest.current;setStatus("Saving…");
  try{
   const current=await refreshSession();if(active.current?.id!==team.id||!current.user||current.user.userId!==identity)return;
   if(current.teams.find(t=>t.id===team.id)?.role!==team.role){if(!reading.current)await readTeam(true);return;}
   if(!validAccess(generation,team.id,identity,team.role))return;
   const result=await api(`/api/teams/${team.id}`,"PUT",{baseVersion:team.version,data:snapshot,accountId:current.user.userId});
   if(active.current?.id!==team.id||!validResult(generation,team.id,identity,team.role,result))return;accept(team.id,result);if(latest.current===snapshot){dirty.current=false;latest.current=result.data;replaceRef.current(result.data);}else{const rebased=rebaseWorkspace(snapshot,latest.current,result.data);dirty.current=true;latest.current=rebased;replaceRef.current(rebased);}setError("");setStatus(dirty.current?"Changes waiting to save":"Synced");
  }
  catch(e){if(active.current?.id!==team.id||generation!==accessGeneration.current)return;const code=(e as Error & {status?:number}).status;if(code===401){lock("Your session ended. Sign in again to access your private team.");return;}blocked.current=!!code&&code>=400&&code<500;setError(userError(e));setStatus("Not synced");}
  finally{if(request===saveRequest.current)saving.current=false;}
 };
 const markDirty=()=>{if(active.current){editRevision.current++;dirty.current=true;setStatus("Changes waiting to save");}};
 useEffect(()=>{
  alive.current=true;
  if(!enabled){setReady(true);return()=>{alive.current=false;};}
  void (async()=>{
   try{
    const s=await refreshSession();let preference:string|null=null;
    try{preference=localStorage.getItem('myftcspace:team');}catch{/* Optional preference. */}
    const id=s.teams.some(t=>t.id===preference)?preference:autoOpen&&s.teams.length===1?s.teams[0].id:null;
    if(alive.current&&id)await openTeam(id);
   }catch{if(alive.current)setError("Your team connection could not be checked. Retry before opening private records.");}
   finally{if(alive.current)setReady(true);}
  })();
  return()=>{alive.current=false;accessGeneration.current++;sessionRequest.current++;saveRequest.current++;readRequest.current++;};
 },[enabled,autoOpen]);
 useEffect(()=>{if(!shared)return;const timer=setTimeout(()=>void save(),500);return()=>clearTimeout(timer);},[data,shared?.version]);
 useEffect(()=>{
  if(!shared||!enabled)return;
  let checking=false;
  const sync=async()=>{
   if(checking||!active.current)return;checking=true;
   const generation=accessGeneration.current,identity=sessionRef.current.user?.userId,team=active.current;
   try{
    const s=await refreshSession();if(active.current?.id!==team.id||s.user?.userId!==identity)return;
    const membership=s.teams.find(t=>t.id===team.id);
    if(membership?.role!==team.role){if(!reading.current)await readTeam(true);return;}
    if(reading.current)return;
    if(!validAccess(generation,team.id,identity,team.role))return;
    if(dirty.current){if(!blocked.current&&navigator.onLine)await save();return;}if(saving.current)return;
    const result=await api(`/api/teams/${team.id}`);await refreshSession();if(!dirty.current&&!saving.current&&active.current?.id===team.id&&validResult(generation,team.id,identity,team.role,result)&&(result.version!==active.current.version||JSON.stringify(result.members)!==JSON.stringify(active.current.members))){accept(team.id,result);latest.current=result.data;replaceRef.current(result.data);setStatus("Synced");}
   }catch(e){if(generation!==accessGeneration.current||active.current?.id!==team.id)return;const code=(e as Error & {status?:number}).status;if(code===401||code===403)lock("Your session or team access ended. Sign in again to reopen your team.");else{setError(userError(e));setStatus("Connection needs attention");}}
   finally{checking=false;}
  };
  const timer=setInterval(()=>void sync(),5000);
  const focus=()=>{void refreshSession().then(()=>void sync()).catch(()=>{});},visible=()=>{if(document.visibilityState==='visible')focus();};window.addEventListener('focus',focus);window.addEventListener('pageshow',focus);document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus);document.removeEventListener('visibilitychange',visible);};
 },[shared?.id,enabled]);
 useEffect(()=>{const handler=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue="";}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[]);
 return {ready,session,shared,status,error,markDirty,openTeam,reload,refreshSession,save,retry:()=>{blocked.current=false;void save();},hasUnsaved:()=>dirty.current||saving.current};
}
export type Cloud = ReturnType<typeof useCloud>;
