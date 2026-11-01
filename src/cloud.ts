import { useEffect, useRef, useState } from "react";
import type { AppData, Member, Role } from "./types";
import { rebaseWorkspace } from "../server/policy";
import { createDemoData } from "./seed";
export type Session = {user: {userId:string}|null; teams:{id:string;teamName:string;name:string;role:Role}[]};
type Shared = {id:string;version:number;role:Role;members:Member[];updated:string};
export async function api(path:string, method="GET", body?:unknown) {
 const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const payload:any=await response.json(); if(!response.ok) throw Object.assign(new Error(payload.error||"Request failed."),{status:response.status}); return payload;
}
export function useCloud(data:AppData, replace:(data:AppData)=>void, {enabled=true,autoOpen=false}:{enabled?:boolean;autoOpen?:boolean}={}) {
 const [ready,setReady]=useState(!enabled);
 const [session,setSession]=useState<Session>({user:null,teams:[]}),[shared,setShared]=useState<Shared|null>(null),[status,setStatus]=useState(""),[error,setError]=useState("");
 const active=useRef<Shared|null>(null),latest=useRef(data),dirty=useRef(false),saving=useRef(false),blocked=useRef(false),alive=useRef(true),replaceRef=useRef(replace);
 const sessionRef=useRef<Session>({user:null,teams:[]});
 latest.current=data;replaceRef.current=replace;
 function lock(message:string,nextSession:Session={user:null,teams:[]}) {
  active.current=null;dirty.current=false;blocked.current=true;
  replaceRef.current(createDemoData());setShared(null);setStatus("");setError(message);
  sessionRef.current=nextSession;setSession(nextSession);
  try{localStorage.removeItem('myftcspace:team');}catch{/* A blocked preference store must not prevent locking. */}
 }
 const refreshSession=async()=>{
  if(!enabled)return {user:null,teams:[]} as Session;
  const next:Session=await api('/api/session');
  if(active.current && next.user?.userId!==sessionRef.current.user?.userId)lock("Your account session changed. Sign in again or reopen your team.",next);
  else if(active.current && !next.teams.some(t=>t.id===active.current?.id))lock("Your team access was removed. Private records have been cleared from this tab.",next);
  else if(!active.current)setError("");
  sessionRef.current=next;setSession(next);return next;
 };
 function accept(id:string,result:any){const next={id,version:result.version,role:result.role,members:result.members,updated:result.updated};active.current=next;setShared(next);}
 const openTeam=async(id:string)=>{
  if(!enabled)throw new Error("Sign in to open a private team.");
  if(dirty.current||saving.current)throw new Error("Save or download your unsaved changes, then reload before switching teams.");
  const identity=sessionRef.current.user?.userId,result=await api(`/api/teams/${id}`),current=await refreshSession();
  if(!current.user || (identity && current.user.userId!==identity) || !current.teams.some(t=>t.id===id))throw new Error("Your account or team access changed. Sign in again before opening this team.");
  accept(id,result);blocked.current=false;dirty.current=false;setError("");setStatus("Synced");replaceRef.current(result.data);
  try{localStorage.setItem('myftcspace:team',id);}catch{/* Team preferences are optional. */}
 };
 const reload=async()=>{if(!active.current)return;const id=active.current.id;const result=await api(`/api/teams/${id}`);dirty.current=false;blocked.current=false;accept(id,result);replaceRef.current(result.data);setError("");setStatus("Synced");};
 const save=async()=>{
  const team=active.current;if(!team||!dirty.current||saving.current||blocked.current)return;
  saving.current=true;const snapshot=latest.current;setStatus("Saving…");
  try{
   const current=await refreshSession();if(active.current?.id!==team.id||!current.user)return;
   if(current.teams.find(t=>t.id===team.id)?.role!==team.role){await reload();setError("Your team role changed. Records were reloaded with your current permissions.");return;}
   const result=await api(`/api/teams/${team.id}`,"PUT",{baseVersion:team.version,data:snapshot,accountId:current.user.userId});
   if(active.current?.id!==team.id)return;accept(team.id,result);if(latest.current===snapshot){dirty.current=false;replaceRef.current(result.data);}else{const rebased=rebaseWorkspace(snapshot,latest.current,result.data);latest.current=rebased;replaceRef.current(rebased);}setError("");setStatus(dirty.current?"Changes waiting to save":"Synced");
  }
  catch(e){if(active.current?.id!==team.id)return;const code=(e as Error & {status?:number}).status;if(code===401){lock("Your session ended. Sign in again to access your private team.");return;}blocked.current=!!code&&code>=400&&code<500;setError((e as Error).message);setStatus("Not synced");}
  finally{saving.current=false;}
 };
 const markDirty=()=>{if(active.current){dirty.current=true;setStatus("Changes waiting to save");}};
 const useDemo=()=>{if(dirty.current||saving.current)throw new Error("Download unsaved changes and reload before leaving this team.");active.current=null;setShared(null);setError("");setStatus("");localStorage.removeItem('myftcspace:team');};
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
  return()=>{alive.current=false;};
 },[enabled,autoOpen]);
 useEffect(()=>{if(!shared)return;const timer=setTimeout(()=>void save(),500);return()=>clearTimeout(timer);},[data,shared?.version]);
 useEffect(()=>{
  if(!shared||!enabled)return;
  let checking=false;
  const sync=async()=>{
   if(checking||!active.current)return;checking=true;
   try{
    const s=await refreshSession();if(!active.current)return;
    const team=active.current,membership=s.teams.find(t=>t.id===team.id);
    if(membership?.role!==team.role){const result=await api(`/api/teams/${team.id}`);if(active.current?.id!==team.id)return;dirty.current=false;blocked.current=false;accept(team.id,result);replaceRef.current(result.data);setStatus("Synced");setError("Your team role changed. Records were reloaded with your current permissions.");return;}
    if(dirty.current){if(!blocked.current&&navigator.onLine)await save();return;}if(saving.current)return;
    const result=await api(`/api/teams/${team.id}`);if(!dirty.current&&!saving.current&&active.current?.id===team.id&&(result.version!==team.version||result.role!==team.role||JSON.stringify(result.members)!==JSON.stringify(team.members))){accept(team.id,result);replaceRef.current(result.data);setStatus("Synced");}
   }catch(e){const code=(e as Error & {status?:number}).status;if(code===401||code===403)lock("Your session or team access ended. Sign in again to reopen your team.");else{setError((e as Error).message);setStatus("Connection needs attention");}}
   finally{checking=false;}
  };
  const timer=setInterval(()=>void sync(),5000);
  const focus=()=>void sync(),visible=()=>{if(document.visibilityState==='visible')void sync();};window.addEventListener('focus',focus);window.addEventListener('pageshow',focus);document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus);document.removeEventListener('visibilitychange',visible);};
 },[shared?.id,enabled]);
 useEffect(()=>{const handler=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue="";}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[]);
 return {ready,session,shared,status,error,markDirty,openTeam,reload,refreshSession,useDemo,save,retry:()=>{blocked.current=false;void save();},hasUnsaved:()=>dirty.current||saving.current};
}
export type Cloud = ReturnType<typeof useCloud>;
