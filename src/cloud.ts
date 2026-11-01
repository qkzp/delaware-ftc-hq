import { useEffect, useRef, useState } from "react";
import type { AppData, Member, Role } from "./types";
import { rebaseWorkspace } from "../server/policy";
export type Session = {user: {userId:string}|null; teams:{id:string;teamName:string;name:string;role:Role}[]};
type Shared = {id:string;version:number;role:Role;members:Member[];updated:string};
export async function api(path:string, method="GET", body?:unknown) {
 const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const payload:any=await response.json(); if(!response.ok) throw Object.assign(new Error(payload.error||"Request failed."),{status:response.status}); return payload;
}
export function useCloud(data:AppData, replace:(data:AppData)=>void) {
 const [session,setSession]=useState<Session>({user:null,teams:[]}),[shared,setShared]=useState<Shared|null>(null),[status,setStatus]=useState(""),[error,setError]=useState("");
 const active=useRef<Shared|null>(null),latest=useRef(data),dirty=useRef(false),saving=useRef(false),blocked=useRef(false),alive=useRef(true),replaceRef=useRef(replace);
 latest.current=data;replaceRef.current=replace;
 const refreshSession=async()=>{const s=await api('/api/session');setSession(s);setError("");return s as Session;};
 function accept(id:string,result:any){const next={id,version:result.version,role:result.role,members:result.members,updated:result.updated};active.current=next;setShared(next);}
 const openTeam=async(id:string)=>{if(dirty.current||saving.current)throw new Error("Save or download your unsaved changes, then reload before switching teams.");const result=await api(`/api/teams/${id}`);accept(id,result);blocked.current=false;dirty.current=false;setError("");setStatus("Synced");replaceRef.current(result.data);localStorage.setItem('myftcspace:team',id);await refreshSession();};
 const reload=async()=>{if(!active.current)return;const id=active.current.id;const result=await api(`/api/teams/${id}`);dirty.current=false;blocked.current=false;accept(id,result);replaceRef.current(result.data);setError("");setStatus("Synced");};
 const save=async()=>{
  const team=active.current;if(!team||!dirty.current||saving.current||blocked.current)return;
  saving.current=true;const snapshot=latest.current;setStatus("Saving…");
  try{const result=await api(`/api/teams/${team.id}`,"PUT",{baseVersion:team.version,data:snapshot});if(active.current?.id!==team.id)return;accept(team.id,result);if(latest.current===snapshot){dirty.current=false;replaceRef.current(result.data);}else{const rebased=rebaseWorkspace(snapshot,latest.current,result.data);latest.current=rebased;replaceRef.current(rebased);}setError("");setStatus(dirty.current?"Changes waiting to save":"Synced");}
  catch(e){const code=(e as Error & {status?:number}).status;blocked.current=!!code&&code>=400&&code<500;setError((e as Error).message);setStatus("Not synced");}
  finally{saving.current=false;}
 };
 const markDirty=()=>{if(active.current){dirty.current=true;setStatus("Changes waiting to save");}};
 const useDemo=()=>{if(dirty.current||saving.current)throw new Error("Download unsaved changes and reload before leaving this team.");active.current=null;setShared(null);setError("");setStatus("");localStorage.removeItem('myftcspace:team');};
 useEffect(()=>{alive.current=true;refreshSession().then(s=>{const id=localStorage.getItem('myftcspace:team');if(alive.current&&id&&s.teams.some(t=>t.id===id))openTeam(id).catch(e=>setError(e.message));}).catch(()=>{if(alive.current)setError("Shared team connection is unavailable. The demo remains available; retry the connection before editing your real team.");});return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!shared)return;const timer=setTimeout(()=>void save(),500);return()=>clearTimeout(timer);},[data,shared?.version]);
 useEffect(()=>{if(!shared)return;const timer=setInterval(async()=>{
  if(dirty.current){if(!blocked.current&&navigator.onLine)await save();return;}if(saving.current||!active.current)return;
  try{const result=await api(`/api/teams/${active.current.id}`);if(!dirty.current&&!saving.current&&active.current&&(result.version!==active.current.version||result.role!==active.current.role||JSON.stringify(result.members)!==JSON.stringify(active.current.members))){accept(active.current.id,result);replaceRef.current(result.data);setStatus("Synced");}}
  catch(e){setError((e as Error).message);setStatus("Connection needs attention");}
 },5000);return()=>clearInterval(timer);},[shared?.id]);
 useEffect(()=>{const handler=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue="";}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[]);
 return {session,shared,status,error,markDirty,openTeam,reload,refreshSession,useDemo,save,retry:()=>{blocked.current=false;void save();},hasUnsaved:()=>dirty.current||saving.current};
}
export type Cloud = ReturnType<typeof useCloud>;
