import test, {after} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer, {act} from "react-test-renderer";
import {createServer} from "vite-legacy";
import {JSDOM} from "jsdom";
import axe from "axe-core";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const events=new Map();
const on=(event,handler)=>{const handlers=events.get(event)||new Set();handlers.add(handler);events.set(event,handlers);};
const off=(event,handler)=>events.get(event)?.delete(handler);
const location={hash:"#settings"};
Object.defineProperties(globalThis,{
 window:{value:{location,addEventListener:on,removeEventListener:off,scrollTo(){}},configurable:true},
 document:{value:{visibilityState:"visible",body:{style:{}},activeElement:{focus(){}},addEventListener:on,removeEventListener:off},configurable:true},
 location:{value:location,configurable:true},navigator:{value:{onLine:true},configurable:true},
});
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {HQProvider,useHQ}=await vite.ssrLoadModule("/src/store.tsx");
const {default:TeamAccess}=await vite.ssrLoadModule("/src/components/TeamAccess.tsx");
const {createWorkspaceData}=await vite.ssrLoadModule("/src/workspace-data.ts");
const button=(app,text)=>app.root.findAllByType("button").find(node=>node.children.includes(text));

async function fixture(check){
 const originalFetch=globalThis.fetch,originalFormData=globalThis.FormData,originalError=console.error;
 const values=new Map([["myftcspace:team","team-a"]]),requests=[];
 const state={user:"account-a",role:"admin",accessModel:undefined,extraMembers:[],canInvite:false,adultSupervisionPending:false};
 Object.defineProperty(globalThis,"localStorage",{value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},configurable:true});
 globalThis.FormData=class {constructor(form){this.values=form.values;}get(key){return this.values[key];}};
 const teams=Object.fromEntries(["a","b"].map(letter=>{const data=createWorkspaceData();data.teamId=`team-${letter}`;data.teamName=`Fictional team ${letter.toUpperCase()}`;return [data.teamId,data];}));
 globalThis.fetch=async(path,options={})=>{
  const method=options.method||"GET";requests.push({path,method});
  if(path==="/api/session")return Response.json({user:{userId:state.user},accessModel:state.accessModel,teams:Object.values(teams).map(data=>({id:data.teamId,teamName:data.teamName,name:"Fictional alias",role:state.role}))});
  const match=path.match(/^\/api\/teams\/(team-[ab])(?:\/(.+))?$/);
  if(!match)throw new Error(`Unexpected test request: ${method} ${path}`);
  const [,id,resource]=match;
  if(!resource)return Response.json({data:structuredClone(teams[id]),version:1,role:state.role,members:[{userId:state.user,name:"Fictional alias",role:state.role},...state.extraMembers],updated:"2026-11-01",canInvite:state.canInvite,adultSupervisionPending:state.adultSupervisionPending});
  if(resource==="invites")return Response.json(method==="POST"?{token:`PRIVATE-CODE-${id}`}:{invites:[{id:`invite-${id}`,role:"student",expires:"2099-01-01",used:false}]});
  if(resource==="privacy/erase"&&method==="DELETE")return Response.json({ok:true,status:"pending",pendingCleanup:true,jobId:"receipt"},{status:202});
  if(resource==="history")return Response.json({history:[{id:`revision-${id}`,version:id==="team-a"?411:922,created:"2026-11-01",actor:`PRIVATE-HISTORY-${id}`}]});
  if(resource==="learning")return Response.json({learning:[{userId:`PRIVATE-LEARNING-${id}`,steps:["fictional"],skills:[]}]});
  throw new Error(`Unexpected test request: ${method} ${path}`);
 };
 console.error=(...args)=>{if(!String(args[0]).startsWith("react-test-renderer is deprecated"))originalError(...args);};
 let context,renderer;
 function Probe(){context=useHQ();return React.createElement(TeamAccess);}
 const app={state,requests,get context(){return context;},get root(){return renderer.root;},get text(){return JSON.stringify(renderer.toJSON());},async update(action){await act(async()=>{await action();});},holdNext(path,method="GET"){
  const previous=globalThis.fetch;let consumed=false,release,entered;const started=new Promise(resolve=>entered=resolve);
  globalThis.fetch=async(p,options={})=>{const response=await previous(p,options);if(!consumed&&p===path&&(options.method||"GET")===method){consumed=true;entered();return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
  return {started,release(){assert.ok(release,"The request must have started");release();}};
 },async invite(){await this.update(()=>this.root.findByType("form").props.onSubmit({preventDefault(){},currentTarget:{values:{role:"student"}}}));}};
 try{
  await act(async()=>{renderer=TestRenderer.create(React.createElement(HQProvider,{accountMode:true},React.createElement(Probe)));});
  assert.equal(context.cloud.shared.id,"team-a");await check(app);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=originalFetch;globalThis.FormData=originalFormData;console.error=originalError;}
}

test("self-service members must accept an adult invitation instead of being promoted directly",async()=>{
 await fixture(async app=>{
  app.state.accessModel="self-service";app.state.extraMembers=[{userId:"student-b",name:"Student B",role:"student"},{userId:"mentor-c",name:"Mentor C",role:"mentor"}];
  await app.update(()=>app.context.cloud.reload());
  const options=name=>app.root.findByProps({"aria-label":`Role for ${name}`}).findAllByType("option").map(option=>option.props.value||option.children[0]);
  assert.deepEqual(options("Student B"),["student","lead"]);
  assert.deepEqual(options("Mentor C"),["student","lead","mentor","admin"]);
  assert.match(app.text,/remove their access and send them an adult invitation/);
  app.state.accessModel="allowlist";await app.update(()=>app.context.cloud.refreshSession());
  assert.deepEqual(options("Student B"),["student","lead","mentor","admin"]);
  assert.doesNotMatch(app.text,/remove their access and send them an adult invitation/);
 });
});

test("a student founder can invite teammates and delete an unshared team",async()=>{
 await fixture(async app=>{
  app.state.accessModel="self-service";app.state.role="lead";app.state.canInvite=true;app.state.adultSupervisionPending=true;
  await app.update(()=>app.context.cloud.refreshSession());
  assert.doesNotMatch(app.text,/waiting for a responsible adult/);
  assert.ok(button(app,"Create one-use invitation"));
  assert.equal(app.root.findByProps({name:"role"}).props.defaultValue,"student");
  assert.equal(button(app,"Review saved revisions"),undefined);
  await app.update(()=>button(app,"Delete this unshared team").props.onClick());
  assert.equal(button(app,"Delete team").props.disabled,true);
  await app.update(()=>app.root.findAllByType("input").find(input=>input.props.value==="").props.onChange({target:{value:"Fictional team A"}}));
  await app.update(()=>button(app,"Delete team").props.onClick());
  assert.match(app.text,/cleanup is still pending/);
  assert.match(app.text,/privacy and safety maintenance/);
  assert.equal(app.requests.some(request=>request.path==="/api/teams/team-a/privacy/erase"&&request.method==="DELETE"),true);
 });
});

test("a student founder can remove student teammates even when a mentor has joined",async()=>{
 await fixture(async app=>{
  app.state.accessModel="self-service";app.state.role="lead";app.state.canInvite=true;app.state.adultSupervisionPending=true;
  app.state.extraMembers=[{userId:"student-b",name:"Student B",role:"student"}];
  await app.update(()=>app.context.cloud.refreshSession());
  await app.update(()=>app.context.cloud.reload());
  assert.ok(app.root.findByProps({"aria-label":"Remove access for Student B"}));
  app.state.extraMembers.push({userId:"mentor-c",name:"Mentor C",role:"mentor"});
  await app.update(()=>app.context.cloud.reload());
  assert.ok(app.root.findByProps({"aria-label":"Remove access for Student B"}));
  assert.equal(app.root.findAllByProps({"aria-label":"Remove access for Mentor C"}).length,0);
  assert.equal(button(app,"Delete this unshared team"),undefined);
 });
});

test("the real team picker clears invitation codes, history, learning, and restore confirmations",async()=>{
 await fixture(async app=>{
  await app.invite();assert.match(app.text,/PRIVATE-CODE-team-a/);
  await app.update(()=>button(app,"Review saved revisions").props.onClick());
  await app.update(()=>button(app,"Review rookie skill sign-offs").props.onClick());
  assert.match(app.text,/PRIVATE-HISTORY-team-a/);assert.match(app.text,/PRIVATE-LEARNING-team-a/);
  const pickB=app.root.findAllByType("button").find(node=>node.children.includes("Fictional team B"));assert.ok(pickB);
  await app.update(()=>pickB.props.onClick());
  assert.equal(app.context.cloud.shared.id,"team-b");assert.doesNotMatch(app.text,/PRIVATE-(?:CODE|HISTORY|LEARNING)-team-a/);
  assert.equal(app.root.findAllByProps({role:"dialog"}).length,0);
  const pickA=app.root.findAllByType("button").find(node=>node.children.includes("Fictional team A"));assert.ok(pickA);
  await app.update(()=>pickA.props.onClick());assert.equal(app.context.cloud.shared.id,"team-a");
  assert.doesNotMatch(app.text,/PRIVATE-(?:CODE|HISTORY|LEARNING)-team-a/);
  await app.update(()=>button(app,"Review saved revisions").props.onClick());
  await app.update(()=>button(app,"Restore").props.onClick());assert.equal(app.root.findAllByProps({role:"dialog"}).length,1);
  // Session checks can change the current team while a confirmation is open.
  await app.update(()=>app.context.cloud.openTeam("team-b"));
  assert.equal(app.root.findAllByProps({role:"dialog"}).length,0);
 });
});

test("role and account changes clear sensitive access state even when the team ID stays the same",async()=>{
 await fixture(async app=>{
  await app.invite();app.state.role="mentor";await app.update(()=>app.context.cloud.refreshSession());
  assert.equal(app.context.cloud.shared.role,"mentor");assert.doesNotMatch(app.text,/PRIVATE-CODE-team-a|Create one-use invitation/);
  await app.update(()=>button(app,"Review saved revisions").props.onClick());assert.match(app.text,/PRIVATE-HISTORY-team-a/);
  app.state.user="account-b";await app.update(()=>app.context.cloud.refreshSession());
  assert.equal(app.context.cloud.shared,null);assert.doesNotMatch(app.text,/PRIVATE-HISTORY-team-a/);
  await app.update(()=>app.context.cloud.openTeam("team-a"));assert.doesNotMatch(app.text,/PRIVATE-HISTORY-team-a/);
 });
});

for(const [name,resource,method,trigger] of [
 ["invitation creation","invites","POST",app=>app.invite()],
 ["revision history","history","GET",app=>app.update(()=>button(app,"Review saved revisions").props.onClick())],
 ["learning details","learning","GET",app=>app.update(()=>button(app,"Review rookie skill sign-offs").props.onClick())],
])test(`a delayed ${name} response cannot repopulate another team's panel`,async()=>{
 await fixture(async app=>{
  const held=app.holdNext(`/api/teams/team-a/${resource}`,method);await trigger(app);await held.started;
  await app.update(()=>app.context.cloud.openTeam("team-b"));
  await app.update(()=>held.release());
  assert.equal(app.context.cloud.shared.id,"team-b");assert.doesNotMatch(app.text,/PRIVATE-(?:CODE|HISTORY|LEARNING)-team-a/);
  if(method==="POST")assert.equal(app.requests.some(request=>request.path==="/api/teams/team-a/invites"&&request.method==="GET"),false,"A stale creation must not start another request");
  assert.equal(button(app,"Review saved revisions").props.disabled,false,"The old operation must not leave the new panel busy");
 });
});

test("a delayed learning update cannot reload or report success in the newly selected team",async()=>{
 await fixture(async app=>{
  await app.update(()=>button(app,"Review rookie skill sign-offs").props.onClick());
  const held=app.holdNext("/api/teams/team-a/learning","PUT");
  await app.update(()=>app.root.findAllByType("input").find(input=>input.props.type==="checkbox").props.onChange({target:{checked:true}}));await held.started;
  await app.update(()=>app.context.cloud.openTeam("team-b"));
  const requestCount=app.requests.length;await app.update(()=>held.release());
  assert.equal(app.requests.length,requestCount,"The stale update must not fetch details or reload the new team");
  assert.doesNotMatch(app.text,/PRIVATE-LEARNING-team-a/);
 });
});

test("signed-in team access, invitations, history and learning have accessible names and semantics",async()=>{
 await fixture(async()=>{
  const dom=new JSDOM('<!doctype html><html lang="en"><head><title>Fictional team access</title></head><body><main><h1>Team settings</h1><div id="root"></div></main></body></html>',{url:"https://team.test",pretendToBeVisual:true,runScripts:"outside-only"});
  const previous=Object.fromEntries(["window","document","location","navigator","HTMLElement","getComputedStyle","FormData"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperties(globalThis,{
   window:{value:dom.window,configurable:true},document:{value:dom.window.document,configurable:true},location:{value:dom.window.location,configurable:true},
   navigator:{value:dom.window.navigator,configurable:true},HTMLElement:{value:dom.window.HTMLElement,configurable:true},getComputedStyle:{value:dom.window.getComputedStyle.bind(dom.window),configurable:true},FormData:{value:dom.window.FormData,configurable:true,writable:true},
  });
  dom.window.HTMLCanvasElement.prototype.getContext=()=>null;dom.window.eval(axe.source);
  const {createRoot}=await import("react-dom/client");
  const container=document.getElementById("root"),root=createRoot(container);
  const click=async text=>{const control=[...container.querySelectorAll("button")].find(node=>node.textContent===text);assert.ok(control,text);await act(async()=>control.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));};
  try{
   await act(async()=>root.render(React.createElement(HQProvider,{accountMode:true},React.createElement(TeamAccess))));
   await act(async()=>container.querySelector("form").dispatchEvent(new dom.window.Event("submit",{bubbles:true,cancelable:true})));
   await click("Review saved revisions");await click("Review rookie skill sign-offs");
   assert.match(container.textContent,/PRIVATE-HISTORY-team-a/);assert.match(container.textContent,/PRIVATE-LEARNING-team-a/);
   assert.equal(container.querySelector("textarea").value,"PRIVATE-CODE-team-a");
   const result=await dom.window.axe.run(container,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]},rules:{"color-contrast":{enabled:false}}});
   assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.html)}))));
  }finally{
   await act(async()=>root.unmount());dom.window.close();
   for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
 });
});
