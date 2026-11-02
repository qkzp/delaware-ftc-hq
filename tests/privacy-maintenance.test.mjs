import test,{after} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer,{act} from "react-test-renderer";
import {createServer} from "vite-legacy";
import {JSDOM} from "jsdom";
import axe from "axe-core";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const events=new Map(),on=(name,handler)=>{const handlers=events.get(name)||new Set();handlers.add(handler);events.set(name,handlers);},off=(name,handler)=>events.get(name)?.delete(handler);
Object.defineProperties(globalThis,{
 window:{value:{addEventListener:on,removeEventListener:off},configurable:true},
 document:{value:{visibilityState:"visible",body:{style:{}},activeElement:{focus(){}},addEventListener:on,removeEventListener:off},configurable:true},
});
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {default:PrivacyMaintenance}=await vite.ssrLoadModule("/src/components/PrivacyMaintenance.tsx");
const button=(app,label)=>app.root.findAllByType("button").find(node=>node.children.includes(label));
const field=(app,label)=>app.root.findAllByType("label").find(node=>node.findAllByType("span").some(span=>span.children.includes(label))).findAll(node=>["input","textarea","select"].includes(node.type))[0];
const session=(user="account-a",role="admin")=>({user:{userId:user},teams:["a","b"].map(letter=>({id:`team-${letter}`,teamName:`Fictional team ${letter.toUpperCase()}`,name:"Fictional alias",role}))});

async function fixture(options,check){
 const previousFetch=globalThis.fetch,previousError=console.error,requests=[];
 const state={currentAccount:"account-a",initial:session(),job:null,cleanupStatus:"pending",postFailure:false,paused:false,pendingFiles:0,records:[{id:"request-a",kind:"concern",message:"PRIVATE request team-a account-a",status:"open",updated:"review-1"}],...options};
 globalThis.fetch=async(path,options={})=>{
  const method=options.method||"GET",body=options.body?JSON.parse(options.body):null,account=new Headers(options.headers).get("X-MyFTC-Account");requests.push({path,method,body,account});
  if(account!==state.currentAccount)return Response.json({error:"Account changed"},{status:401});
  const match=path.match(/^\/api\/teams\/(team-[ab])\/privacy(?:\/(.*))?$/);assert.ok(match,`Maintenance must not load normal records: ${path}`);
  const [,team,resource]=match;
  if(resource==="erase"){
   if(method==="GET")return Response.json({job:state.job});
   state.job={...state.job,status:state.cleanupStatus};return Response.json({status:state.cleanupStatus,pendingCleanup:state.cleanupStatus==="pending",jobId:body.jobId});
  }
  if(resource==="requests"){
   if(method==="GET")return Response.json({requests:state.records.map(record=>({...record,message:record.message.replace("team-a",team).replace("account-a",state.currentAccount)})),pendingCleanups:[]});
   if(state.postFailure)return Response.json({error:"Fictional request limit"},{status:429});
   state.records.push({id:"request-new",...body,status:"open",updated:"review-2"});return Response.json({id:"request-new"},{status:201});
  }
  if(resource==="requests/request-a"&&method==="PUT"){Object.assign(state.records[0],{status:body.status,note:body.note,updated:"review-2"});return Response.json({ok:true});}
  if(!resource){if(method==="PUT")state.paused=body.paused;return Response.json({settings:{paused:state.paused,uploadsEnabled:false,revisionRetentionDays:7,updated:"policy-1"},pendingFileCleanup:state.pendingFiles});}
  throw new Error(`Unexpected maintenance request: ${method} ${path}`);
 };
 console.error=(...args)=>{if(!String(args[0]).startsWith("react-test-renderer is deprecated"))previousError(...args);};
 let renderer;
 const app={state,requests,get root(){return renderer.root;},get text(){return JSON.stringify(renderer.toJSON());},async update(action){await act(async()=>{await action();});},async render(next){state.initial=next;await this.update(()=>renderer.update(React.createElement(PrivacyMaintenance,{initialSession:next})));},async reload(){await this.update(()=>renderer.unmount());await this.update(()=>{renderer=TestRenderer.create(React.createElement(PrivacyMaintenance,{initialSession:state.initial}));});},holdNext(path){
  const previous=globalThis.fetch;let consumed=false,release,entered;const started=new Promise(resolve=>entered=resolve);
  globalThis.fetch=async(p,options={})=>{const response=await previous(p,options);if(!consumed&&p===path&&(options.method||"GET")==="GET"){consumed=true;entered();return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
  return {started,release(){assert.ok(release);release();}};
 }};
 try{await app.update(()=>{renderer=TestRenderer.create(React.createElement(PrivacyMaintenance,{initialSession:state.initial}));});await check(app);}
 finally{if(renderer)await app.update(()=>renderer.unmount());globalThis.fetch=previousFetch;console.error=previousError;}
}

test("session-only maintenance loads no workspace and preserves request drafts after a failure",async()=>{
 await fixture({initial:session("account-a","student"),postFailure:true},async app=>{
  assert.match(app.text,/PRIVATE request team-a account-a/);assert.equal(button(app,"Review request"),undefined);
  await app.update(()=>field(app,"Request or concern").props.onChange({target:{value:"Fictional data access request"}}));
  await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  assert.equal(field(app,"Request or concern").props.value,"Fictional data access request");assert.match(app.text,/Fictional request limit/);
  app.state.postFailure=false;await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  assert.equal(field(app,"Request or concern").props.value,"");assert.match(app.text,/Fictional data access request/);
  assert.ok(app.requests.every(request=>request.path.includes("/privacy/requests")));assert.ok(app.requests.every(request=>request.account==="account-a"));
 });
});

test("an initiating admin recovers and retries pending team erasure after a full page-component reload",async()=>{
 await fixture({job:{jobId:"receipt-a",status:"pending"}},async app=>{
  assert.match(app.text,/receipt-a/);await app.reload();assert.match(app.text,/receipt-a/);
  assert.ok(app.requests.every(request=>request.path.endsWith("/privacy/erase")),"No normal team GET or blocked request endpoint is needed");
  await app.update(()=>button(app,"Retry ").props.onClick());assert.match(app.text,/Storage cleanup is still pending/);
  app.state.cleanupStatus="complete";await app.update(()=>button(app,"Retry ").props.onClick());
  assert.match(app.text,/Team erasure is complete/);assert.doesNotMatch(app.text,/receipt-a/);
  assert.deepEqual(app.requests.filter(request=>request.method==="DELETE").at(-1).body,{jobId:"receipt-a"});
 });
});

test("maintenance unpauses a team while preserving reviewed upload and retention settings",async()=>{
 await fixture({paused:true,pendingFiles:2},async app=>{
  assert.match(app.text,/interrupted or pending file operations remain tracked/);
  await app.update(()=>button(app,"Remove team pause").props.onClick());
  const request=app.requests.find(request=>request.method==="PUT");assert.deepEqual(request.body,{paused:false,uploadsEnabled:false,revisionRetentionDays:7,expectedUpdated:"policy-1"});
  assert.match(app.text,/Normal access still requires a valid release review/);
 });
});

test("approved mentors can review requests without administrator controls",async()=>{
 await fixture({initial:session("account-a","mentor")},async app=>{
  await app.update(()=>button(app,"Review request").props.onClick());
  await app.update(()=>field(app,"Request status").props.onChange({target:{value:"resolved"}}));
  await app.update(()=>field(app,"Follow-up record").props.onChange({target:{value:"Verified coach follow-up reference"}}));
  await app.update(()=>app.root.findAllByType("form").at(-1).props.onSubmit({preventDefault(){}}));
  assert.match(app.text,/Verified coach follow-up reference/);assert.equal(app.state.records[0].status,"resolved");
  assert.ok(app.requests.every(request=>request.path.includes("/privacy/requests")));
 });
});

test("late team responses cannot repopulate another maintenance team or start chained reads",async()=>{
 await fixture({},async app=>{
  const held=app.holdNext("/api/teams/team-a/privacy/requests");await app.update(()=>button(app,"Refresh privacy records").props.onClick());await held.started;
  await app.update(()=>field(app,"Team for privacy maintenance").props.onChange({target:{value:"team-b"}}));
  const count=app.requests.length;await app.update(()=>held.release());
  assert.equal(app.requests.length,count);assert.doesNotMatch(app.text,/PRIVATE request team-a account-a/);assert.match(app.text,/PRIVATE request team-b account-a/);
 });
});

test("new server-supplied account props clear old private records and discard delayed responses",async()=>{
 await fixture({},async app=>{
  const held=app.holdNext("/api/teams/team-a/privacy/requests");await app.update(()=>button(app,"Refresh privacy records").props.onClick());await held.started;
  app.state.currentAccount="account-b";await app.render(session("account-b"));
  const count=app.requests.length;await app.update(()=>held.release());assert.equal(app.requests.length,count);
  assert.doesNotMatch(app.text,/PRIVATE request team-a account-a/);assert.match(app.text,/PRIVATE request team-a account-b/);
 });
});

test("focus immediately hides old data and a changed account locks all maintenance actions",async()=>{
 await fixture({},async app=>{
  assert.match(app.text,/PRIVATE request team-a account-a/);app.state.currentAccount="account-b";
  const held=app.holdNext("/api/teams/team-a/privacy/erase");
  await app.update(()=>{for(const handler of events.get("focus")||[])handler();});await held.started;
  assert.doesNotMatch(app.text,/PRIVATE request team-a account-a/);
  await app.update(()=>held.release());assert.match(app.text,/Your account or permissions changed/);assert.match(app.text,/Private maintenance records have been cleared/);
  assert.equal(button(app,"Refresh privacy records"),undefined);assert.equal(app.root.findAllByType("form").length,0);
 });
});

test("privacy maintenance forms and pending-erasure recovery pass accessibility semantics",async()=>{
 await fixture({},async app=>{
  const dom=new JSDOM('<!doctype html><html lang="en"><head><title>Fictional privacy maintenance</title></head><body><div id="root"></div></body></html>',{url:"https://team.test",pretendToBeVisual:true,runScripts:"outside-only"});
  const previous=Object.fromEntries(["window","document","location","navigator","HTMLElement","getComputedStyle"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperties(globalThis,{
   window:{value:dom.window,configurable:true},document:{value:dom.window.document,configurable:true},location:{value:dom.window.location,configurable:true},navigator:{value:dom.window.navigator,configurable:true},HTMLElement:{value:dom.window.HTMLElement,configurable:true},getComputedStyle:{value:dom.window.getComputedStyle.bind(dom.window),configurable:true},
  });
  dom.window.HTMLCanvasElement.prototype.getContext=()=>null;dom.window.eval(axe.source);
  const {createRoot}=await import("react-dom/client"),container=document.getElementById("root"),root=createRoot(container);
  const audit=async()=>{const result=await dom.window.axe.run(container,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]},rules:{"color-contrast":{enabled:false}}});assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.html)}))));};
  try{
   await act(async()=>root.render(React.createElement(PrivacyMaintenance,{initialSession:app.state.initial})));await audit();
   const review=[...container.querySelectorAll("button")].find(node=>node.textContent==="Review request");assert.ok(review);await act(async()=>review.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));await audit();
   app.state.job={jobId:"receipt-a",status:"pending"};await act(async()=>root.render(React.createElement(PrivacyMaintenance,{key:"recovery",initialSession:app.state.initial})));assert.match(container.textContent,/receipt-a/);await audit();
  }finally{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
 });
});
