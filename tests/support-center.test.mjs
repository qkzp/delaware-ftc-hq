import test,{after} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer,{act} from "react-test-renderer";
import {createServer} from "vite-legacy";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const handlers=new Map();
const on=(name,handler)=>{const set=handlers.get(name)||new Set();set.add(handler);handlers.set(name,set);};
const off=(name,handler)=>handlers.get(name)?.delete(handler);
const location={hash:"#settings"};
Object.defineProperties(globalThis,{
 location:{value:location,configurable:true},window:{value:{location,addEventListener:on,removeEventListener:off,scrollTo(){}},configurable:true},
 document:{value:{visibilityState:"visible",body:{style:{}},activeElement:{focus(){}},addEventListener:on,removeEventListener:off},configurable:true},
});
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {HQProvider,useHQ}=await vite.ssrLoadModule("/src/store.tsx");
const {default:SupportCenter,buildSupportSummary}=await vite.ssrLoadModule("/src/components/SupportCenter.tsx");
const {createWorkspaceData}=await vite.ssrLoadModule("/src/workspace-data.ts");
const button=(app,label)=>app.root.findAllByType("button").find(node=>node.children.includes(label));

async function fixture(check){
 const originalFetch=globalThis.fetch,originalError=console.error;
 const calls=[],copies=[],values=new Map([["myftcspace:team","private-team-a"]]);
 const state={online:true,clipboardFails:false,checkResponse:null,holdCheck:null};
 Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
 Object.defineProperty(globalThis,"navigator",{configurable:true,value:{get onLine(){return state.online;},clipboard:{async writeText(text){if(state.clipboardFails)throw new Error('Secret clipboard error');copies.push(text);}}}});
 const teams=Object.fromEntries(["a","b"].map(letter=>{const data=createWorkspaceData();data.teamId=`private-team-${letter}`;data.teamName=`Confidential Team ${letter}`;data.coachInstructions="PRIVATE STUDENT RECORD CONTENT";return [data.teamId,data];}));
 const session=()=>({user:{userId:"private-account-id"},teams:Object.values(teams).map(data=>({id:data.teamId,teamName:data.teamName,name:"Secret Alias",role:"student"}))});
 globalThis.fetch=async(path,options={})=>{
  calls.push({path,method:options.method||"GET",body:options.body});
  if(path==="/api/session"){
   if(state.holdCheck)return state.holdCheck;
   return state.checkResponse?state.checkResponse():Response.json(session());
  }
  const id=String(path).split("/").at(-1);if(teams[id])return Response.json({data:structuredClone(teams[id]),version:1,role:"student",members:[{userId:"private-account-id",name:"Secret Alias",role:"student"}],updated:"2026-11-01"});
  throw new Error(`Unexpected support request: ${path}`);
 };
 console.error=(...args)=>{if(!String(args[0]).startsWith("react-test-renderer is deprecated"))originalError(...args);};
 let context,renderer;
 function Probe(){context=useHQ();return React.createElement(SupportCenter);}
 const app={state,calls,copies,get root(){return renderer.root;},get text(){return JSON.stringify(renderer.toJSON());},get context(){return context;},async update(action){await act(async()=>{await action();});},async emit(name){await act(async()=>{for(const callback of handlers.get(name)||[])callback();});}};
 try{await act(async()=>{renderer=TestRenderer.create(React.createElement(HQProvider,{accountMode:true},React.createElement(Probe)));});await check(app);}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=originalFetch;console.error=originalError;handlers.clear();}
}

test("the support check uses one GET and the copied summary excludes private context and error contents",async()=>{
 await fixture(async app=>{
  const start=app.calls.length;await app.update(()=>button(app,"Run read-only check").props.onClick());
  assert.deepEqual(app.calls.slice(start).map(call=>({path:call.path,method:call.method,body:call.body})),[{path:"/api/session",method:"GET",body:undefined}]);
  assert.match(app.text,/Current sign-in and membership confirmed/);
  await app.update(()=>button(app,"Copy support summary").props.onClick());assert.equal(app.copies.length,1);
  assert.doesNotMatch(app.copies[0],/private-team|Confidential Team|private-account-id|Secret Alias|PRIVATE STUDENT|https?:|token=/);
  assert.match(app.copies[0],/Active role: Student/);
  app.state.checkResponse=()=>Response.json({error:"PRIVATE STUDENT RECORD CONTENT invitation=do-not-share"},{status:503});
  await app.update(()=>button(app,"Run read-only check").props.onClick());assert.match(app.text,/Server check unavailable/);assert.doesNotMatch(app.text,/PRIVATE STUDENT|do-not-share/);
 });
});

test("offline diagnostics avoid requests and guided upload help routes approval to adults",async()=>{
 await fixture(async app=>{
  app.state.online=false;await app.emit("offline");const start=app.calls.length;
  await app.update(()=>button(app,"Run read-only check").props.onClick());assert.equal(app.calls.length,start);assert.match(app.text,/Browser reports offline/);
  await app.update(()=>app.root.findAllByType("select")[0].props.onChange({target:{value:"uploads"}}));
  await app.update(()=>app.root.findAllByType("select")[1].props.onChange({target:{value:"consent"}}));
  assert.match(app.text,/Only the administrator can enable uploads/);assert.match(app.text,/Student leads can coordinate the request/);
  assert.ok(app.root.findAllByType("a").some(link=>link.props.href==="/privacy"));assert.ok(app.root.findAllByType("a").some(link=>link.props.href==="/maintenance"));
  app.state.online=true;await app.emit("online");assert.match(app.text,/Online signal/);
 });
});

test("a late check result cannot reappear after switching teams",async()=>{
 await fixture(async app=>{
  let release;app.state.holdCheck=new Promise(resolve=>{release=resolve;});
  await app.update(()=>button(app,"Run read-only check").props.onClick());assert.match(app.text,/Checking connection/);
  app.state.holdCheck=null;await app.update(()=>app.context.cloud.openTeam("private-team-b"));assert.match(app.text,/Not run/);assert.doesNotMatch(app.text,/Checking connection/);
  await app.update(()=>release(Response.json({user:{userId:"private-account-id"},teams:[{id:"private-team-a",role:"student"}]})));
  assert.match(app.text,/Read-only check: Not run/);assert.doesNotMatch(app.text,/Current sign-in and membership confirmed/);
 });
});

test("clipboard failures leave a selectable summary and runtime labels are allowlisted",async()=>{
 await fixture(async app=>{app.state.clipboardFails=true;await app.update(()=>button(app,"Copy support summary").props.onClick());assert.match(app.text,/Select and copy the summary below/);assert.doesNotMatch(app.text,/Secret clipboard error/);const summary=app.root.findByType("textarea");assert.equal(summary.props.readOnly,true);assert.match(summary.props.value,/MyFTCSpace support summary/);});
 const summary=buildSupportSummary({topic:"malicious-private-topic",connection:"secret-host",signedIn:true,teamOpen:true,role:"secret-account-id",sync:"secret error token=123",check:"secret result"});
 assert.doesNotMatch(summary,/malicious|secret|token=123/);assert.match(summary,/Topic: Not selected/);assert.match(summary,/Sync: Not confirmed/);
});

test("guided support controls have accessible labels, headings, and live feedback",async()=>{
 const {JSDOM}=await import("jsdom");
 const dom=new JSDOM('<!doctype html><html lang="en"><head><title>Support accessibility</title></head><body><div id="support-root"></div></body></html>',{url:"https://team.test",pretendToBeVisual:true,runScripts:"outside-only"});
 const previous=new Map(["window","document","navigator","location","localStorage","HTMLElement","getComputedStyle"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 dom.window.scrollTo=()=>{};dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
 for(const key of ["window","document","navigator","location","localStorage","HTMLElement"])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 Object.defineProperty(globalThis,"getComputedStyle",{configurable:true,value:dom.window.getComputedStyle.bind(dom.window)});
 const {default:axe}=await import("axe-core");
 const {createRoot}=await import("react-dom/client"),container=document.getElementById("support-root"),root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(HQProvider,{demoMode:true},React.createElement("main",null,React.createElement("h1",null,"Team hub"),React.createElement(SupportCenter)))));
  assert.equal(container.querySelectorAll("label select").length,2);assert.equal(container.querySelector("textarea").readOnly,true);assert.ok(container.querySelector('button[aria-describedby]'));assert.ok(container.querySelector('[role="status"]'));
  dom.window.eval(axe.source);const result=await dom.window.axe.run(container,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]},rules:{"color-contrast":{enabled:false}}});
  assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.html)})),null,2));
 }finally{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
