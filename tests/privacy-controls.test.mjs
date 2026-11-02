import test,{after} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer,{act} from "react-test-renderer";
import {createServer} from "vite-legacy";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const events=new Map(),on=(name,handler)=>{const handlers=events.get(name)||new Set();handlers.add(handler);events.set(name,handlers);},off=(name,handler)=>events.get(name)?.delete(handler);
const location={hash:"#settings"};
Object.defineProperties(globalThis,{
 location:{value:location,configurable:true},window:{value:{location,addEventListener:on,removeEventListener:off,scrollTo(){}},configurable:true},
 document:{value:{visibilityState:"visible",body:{style:{}},activeElement:{focus(){}},addEventListener:on,removeEventListener:off},configurable:true},navigator:{value:{onLine:true},configurable:true},
});
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {HQProvider,useHQ}=await vite.ssrLoadModule("/src/store.tsx");
const {default:PrivacyControls}=await vite.ssrLoadModule("/src/components/PrivacyControls.tsx");
const {createWorkspaceData}=await vite.ssrLoadModule("/src/workspace-data.ts");
const button=(app,label)=>app.root.findAllByType("button").find(node=>node.children.includes(label));
const field=(app,label)=>app.root.findAllByType("label").find(node=>node.findAllByType("span").some(span=>span.children.includes(label))).findAll(node=>["input","textarea","select"].includes(node.type))[0];

async function fixture(options,check){
 const originalFetch=globalThis.fetch,originalError=console.error,requests=[],values=new Map([["myftcspace:team","team-a"]]);
 const state={member:true,role:"admin",postFailure:false,reviewConflict:false,cleanupStatus:"complete",teamJob:null,pendingCleanups:[],records:[],...options};
 const teams=Object.fromEntries(["a","b"].map(letter=>{const data=createWorkspaceData();data.teamId=`team-${letter}`;data.teamName=`Fictional team ${letter.toUpperCase()}`;return [data.teamId,data];}));
 Object.defineProperty(globalThis,"localStorage",{value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},configurable:true});
 globalThis.fetch=async(path,options={})=>{
  const method=options.method||"GET",body=options.body?JSON.parse(options.body):null;requests.push({path,method,body});
  if(path==="/api/session")return Response.json({user:{userId:"account-a"},teams:state.member?Object.values(teams).map(data=>({id:data.teamId,teamName:data.teamName,name:"Fictional alias",role:state.role})):[]});
  const match=path.match(/^\/api\/teams\/(team-[ab])(?:\/(.+))?$/);if(!match)throw new Error(`Unexpected fixture request: ${method} ${path}`);
  const [,id,resource]=match;
  if(!resource)return Response.json({data:structuredClone(teams[id]),version:1,role:state.role,members:[{userId:"account-a",name:"Fictional alias",role:state.role}],updated:"2026-11-01"});
  if(resource==="privacy/erase"){
   if(method==="GET")return Response.json({job:state.teamJob});
   if(state.cleanupStatus==="complete"){state.teamJob=null;state.member=false;}
   return Response.json({ok:true,status:state.cleanupStatus,pendingCleanup:state.cleanupStatus==="pending",jobId:body.jobId});
  }
  if(resource==="privacy/requests"){
   if(method==="GET")return Response.json({requests:structuredClone(state.records),pendingCleanups:structuredClone(state.pendingCleanups)});
   if(state.postFailure)return Response.json({error:"Fictional request limit. Keep your draft and contact the adult."},{status:429});
   state.records.push({id:"request-a",...body,status:"open",created:"2026-11-01",updated:"revision-1",requester:"account-a"});return Response.json({id:"request-a"}, {status:201});
  }
  if(resource==="privacy/requests/request-a"&&method==="PUT"){
   if(state.reviewConflict)return Response.json({error:"Request changed. Reload before reviewing."},{status:409});
   Object.assign(state.records[0],{status:body.status,note:body.note,updated:"revision-2"});return Response.json({ok:true});
  }
  if(resource==="privacy/withdraw-evidence"){
   if(state.cleanupStatus==="complete")state.pendingCleanups=[];
   return Response.json({ok:true,status:state.cleanupStatus,pendingCleanup:state.cleanupStatus==="pending",jobId:body.jobId});
  }
  if(resource==="privacy")return Response.json({settings:{paused:false,uploadsEnabled:false,revisionRetentionDays:30,updated:"policy-1"}});
  throw new Error(`Unexpected fixture request: ${method} ${path}`);
 };
 console.error=(...args)=>{if(!String(args[0]).startsWith("react-test-renderer is deprecated"))originalError(...args);};
 let context,renderer;
 function Probe(){context=useHQ();return React.createElement(PrivacyControls);}
 const app={state,requests,get context(){return context;},get root(){return renderer.root;},get text(){return JSON.stringify(renderer.toJSON());},async update(action){await act(async()=>{await action();});},holdNext(path){
  const previous=globalThis.fetch;let consumed=false,release,entered;const started=new Promise(resolve=>entered=resolve);
  globalThis.fetch=async(p,options={})=>{const response=await previous(p,options);if(!consumed&&p===path&&(options.method||"GET")==="GET"){consumed=true;entered();return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
  return {started,release(){assert.ok(release);release();}};
 }};
 try{await act(async()=>{renderer=TestRenderer.create(React.createElement(HQProvider,{accountMode:true},React.createElement(Probe)));});await check(app);}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=originalFetch;console.error=originalError;}
}

test("privacy request errors preserve the message and a retry records the request",async()=>{
 await fixture({postFailure:true},async app=>{
  await app.update(()=>field(app,"Request or concern").props.onChange({target:{value:"Fictional correction request"}}));
  await app.update(()=>app.root.findAllByType("form")[0].props.onSubmit({preventDefault(){}}));
  assert.match(app.text,/Fictional request limit/);assert.equal(field(app,"Request or concern").props.value,"Fictional correction request");
  app.state.postFailure=false;await app.update(()=>app.root.findAllByType("form")[0].props.onSubmit({preventDefault(){}}));
  assert.equal(field(app,"Request or concern").props.value,"");assert.equal(app.state.records.length,1);assert.match(app.text,/Fictional correction request/);
 });
});

test("admin request review preserves a conflicted draft and sends the reviewed revision",async()=>{
 await fixture({records:[{id:"request-a",kind:"correction",message:"Fictional record correction",status:"open",updated:"revision-1",requester:"account-a"}],reviewConflict:true},async app=>{
  await app.update(()=>button(app,"Review request").props.onClick());
  await app.update(()=>field(app,"Request status").props.onChange({target:{value:"in-progress"}}));
  await app.update(()=>field(app,"Follow-up record").props.onChange({target:{value:"Verified school workflow reference"}}));
  const submit=()=>app.root.findAllByType("form").at(-1).props.onSubmit({preventDefault(){}});
  await app.update(submit);assert.match(app.text,/Request changed/);assert.equal(field(app,"Follow-up record").props.value,"Verified school workflow reference");
  app.state.reviewConflict=false;await app.update(submit);
  assert.equal(app.root.findAllByProps({role:"dialog"}).length,0);assert.equal(app.state.records[0].status,"in-progress");
  const change=app.requests.filter(request=>request.method==="PUT").at(-1);assert.equal(change.body.expectedUpdated,"revision-1");assert.match(app.text,/Verified school workflow reference/);
 });
});

test("a mentor can monitor and review team concerns without admin privacy controls",async()=>{
 await fixture({role:"mentor",records:[{id:"request-a",kind:"concern",message:"Fictional team safety concern",status:"open",updated:"revision-1",requester:"student-a"}]},async app=>{
  assert.match(app.text,/Team requests|Fictional team safety concern/);
  assert.doesNotMatch(app.text,/Save privacy controls|Review permanent team erasure/);
  await app.update(()=>button(app,"Review request").props.onClick());
  await app.update(()=>field(app,"Request status").props.onChange({target:{value:"resolved"}}));
  await app.update(()=>field(app,"Follow-up record").props.onChange({target:{value:"Coach followed the approved school process"}}));
  await app.update(()=>app.root.findAllByType("form").at(-1).props.onSubmit({preventDefault(){}}));
  assert.equal(app.state.records[0].status,"resolved");assert.match(app.text,/Coach followed the approved school process/);
  assert.equal(app.requests.some(request=>request.path.endsWith("privacy/erase")),false,"Mentors do not inspect administrator erasure jobs");
 });
});

test("pending evidence cleanup receipts survive a remount and remain retryable after storage fails",async()=>{
 await fixture({pendingCleanups:[{evidenceId:"evidence-a",jobId:"receipt-a",status:"pending"}],cleanupStatus:"pending"},async app=>{
  assert.match(app.text,/receipt-a/);await app.update(()=>button(app,"Retry ").props.onClick());
  assert.match(app.text,/Storage cleanup is still pending/);assert.match(app.text,/receipt-a/);
  app.state.cleanupStatus="complete";await app.update(()=>button(app,"Retry ").props.onClick());
  assert.doesNotMatch(app.text,/receipt-a/);
  const change=app.requests.filter(request=>request.path.endsWith("withdraw-evidence")).at(-1);assert.deepEqual(change.body,{jobId:"receipt-a",evidenceId:"evidence-a"});
 });
});

test("pending team erasure is recovered before blocked normal privacy endpoints and retries to completion",async()=>{
 await fixture({teamJob:{jobId:"team-receipt-a",status:"pending"},cleanupStatus:"pending"},async app=>{
  assert.match(app.text,/team-receipt-a/);
  assert.equal(app.requests.some(request=>request.path.endsWith("privacy/requests")),false);
  assert.equal(app.requests.some(request=>request.path.endsWith("/privacy")),false);
  await app.update(()=>button(app,"Retry ").props.onClick());assert.match(app.text,/Storage cleanup is still pending/);
  app.state.cleanupStatus="complete";await app.update(()=>button(app,"Retry ").props.onClick());
  assert.equal(app.context.cloud.shared,null);assert.doesNotMatch(app.text,/team-receipt-a/);
  const change=app.requests.filter(request=>request.method==="DELETE").at(-1);assert.deepEqual(change.body,{jobId:"team-receipt-a"});
 });
});

test("a delayed privacy refresh cannot fetch the old team's settings after a team switch",async()=>{
 await fixture({},async app=>{
  const held=app.holdNext("/api/teams/team-a/privacy/requests");
  await app.update(()=>button(app,"Refresh privacy records").props.onClick());await held.started;
  await app.update(()=>app.context.cloud.openTeam("team-b"));
  const requestCount=app.requests.length;await app.update(()=>held.release());
  assert.equal(app.context.cloud.shared.id,"team-b");assert.equal(app.requests.length,requestCount,"A stale response must not start another team-scoped fetch");
 });
});
