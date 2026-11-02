import test,{after} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer,{act} from "react-test-renderer";
import {createServer} from "vite-legacy";
import {JSDOM} from "jsdom";
import axe from "axe-core";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const listeners=new Map(),on=(name,handler)=>{const handlers=listeners.get(name)||new Set();handlers.add(handler);listeners.set(name,handlers);},off=(name,handler)=>listeners.get(name)?.delete(handler),location={hash:"#resources"};
Object.defineProperties(globalThis,{location:{value:location,configurable:true},window:{value:{location,addEventListener:on,removeEventListener:off,scrollTo(){}},configurable:true},document:{value:{body:{style:{}},activeElement:{focus(){}},addEventListener:on,removeEventListener:off},configurable:true}});
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {HQProvider,useHQ}=await vite.ssrLoadModule("/src/store.tsx");
const {default:Resources}=await vite.ssrLoadModule("/src/screens/Resources.tsx");
const {createWorkspaceData}=await vite.ssrLoadModule("/src/workspace-data.ts");
const {STORAGE_KEY}=await vite.ssrLoadModule("/src/persistence.ts");
const {resourceReview}=await vite.ssrLoadModule("/src/components/ResourceSpaces.tsx");
const today=()=>new Date().toLocaleDateString("en-CA");
function data(){
 const workspace=createWorkspaceData();
 const base={teamId:workspace.teamId,seasonId:workspace.seasonId,category:"Programming",level:"Beginner",kind:"Guide",description:"Fictional team guidance",url:"https://docs.example.org/robot",content:"Synthetic handoff notes",owner:"Fictional mentor",reviewed:today(),official:false,visibility:"team",approved:true,tags:["handoff"],demo:true};
 workspace.resources=[
  {...base,id:"ready",title:"Reviewed startup guide"},
  {...base,id:"pending",title:"Pending code handoff",kind:"Code",approved:false,reviewed:""},
  {...base,id:"old",title:"Old wiring diagram",category:"Wiring",kind:"Wiring",reviewed:"2020-01-01"},
  {...base,id:"private",title:"PRIVATE DOCUMENT SENTINEL",category:"Secret engineering space",visibility:"private"},
  {...base,id:"hidden-pending",title:"UNAPPROVED DOCUMENT SENTINEL",category:"Unapproved space sentinel",approved:false},
  {...base,id:"archive",title:"Archived CAD reference",category:"CAD",kind:"CAD",archived:true},
 ];return workspace;
}
const byText=(app,text)=>app.root.findAllByType("button").find(button=>button.children.some(child=>typeof child==="string"&&child.trim()===text));
const field=(app,label,type="input")=>app.root.findAllByType("label").find(labelNode=>labelNode.props.className==="field"&&labelNode.findAllByType("span").some(span=>span.children.includes(label))).findByType(type);
const cards=app=>app.root.findAllByType("button").filter(button=>button.props.className?.split(" ").includes("resource-card"));
const card=(app,title)=>cards(app).find(button=>button.findAllByType("h2").some(heading=>heading.children.includes(title)));
const space=(app,label)=>app.root.findByProps({"aria-label":"Knowledge spaces"}).findAllByType("button").find(button=>button.findAllByType("span").some(span=>span.children.includes(label)));
const review=(app,label)=>app.root.findByProps({className:"knowledge-review-views"}).findAllByType("button").find(button=>button.findAllByType("span").some(span=>span.children.includes(label)));
async function fixture({role="lead",initial=data()}={},check){
 const previousError=console.error;const values=new Map([[STORAGE_KEY,JSON.stringify(initial)]]);
 Object.defineProperty(globalThis,"localStorage",{value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},configurable:true});
 console.error=(...args)=>{if(!String(args[0]).startsWith("react-test-renderer is deprecated"))previousError(...args);};
 let current,renderer;function Probe(){current=useHQ();return React.createElement(Resources);}
 const app={get context(){return current;},get root(){return renderer.root;},get text(){return JSON.stringify(renderer.toJSON());},async update(action){await act(async()=>{await action(current);});}};
 try{await app.update(()=>{renderer=TestRenderer.create(React.createElement(HQProvider,{demoMode:true},React.createElement(Probe)));});await app.update(context=>context.setRole(role));await check(app);}
 finally{if(renderer)await app.update(()=>renderer.unmount());console.error=previousError;}
}

test("freshness distinguishes approval, explicit flags, invalid dates and the 90-day review boundary",()=>{
 const resource=data().resources[0],now=Date.parse("2026-11-01T12:00:00Z"),within=new Date(now-90*86400000).toISOString().slice(0,10),older=new Date(now-91*86400000).toISOString().slice(0,10);
 assert.equal(resourceReview({...resource,reviewed:within},now).needed,false);
 assert.equal(resourceReview({...resource,reviewed:older},now).label,"Review due");
 assert.equal(resourceReview({...resource,reviewed:within,stale:true},now).label,"Flagged for review");
 assert.equal(resourceReview({...resource,reviewed:within,approved:false},now).label,"Awaiting approval");
 for(const reviewed of ["","2026-02-30","2099-01-01","not-a-date"])assert.equal(resourceReview({...resource,reviewed},now).label,"Review date needed");
});

test("knowledge spaces combine category, document type, owner search and review filters",async()=>{
 await fixture({},async app=>{
  await app.update(()=>space(app,"Programming").props.onClick());assert.equal(cards(app).length,2);
  await app.update(()=>review(app,"Needs review").props.onClick());assert.deepEqual(cards(app).map(button=>button.findByType("h2").children.join("")),["Pending code handoff"]);
  await app.update(()=>review(app,"Reviewed").props.onClick());assert.equal(card(app,"Reviewed startup guide")!==undefined,true);
  await app.update(()=>review(app,"All resources").props.onClick());
  await app.update(()=>app.root.findByProps({"aria-label":"Filter resource type"}).props.onChange({target:{value:"Code"}}));assert.equal(cards(app).length,1);
  await app.update(()=>app.root.findByProps({"aria-label":"Search resources"}).props.onChange({target:{value:"Fictional mentor"}}));assert.equal(cards(app).length,1);
  await app.update(()=>app.root.findByProps({"aria-label":"Search resources"}).props.onChange({target:{value:"missing synthetic guide"}}));assert.equal(cards(app).length,0);
  await app.update(()=>byText(app,"Clear filters").props.onClick());assert.equal(cards(app).length,5);
 });
});

test("new resources inherit the selected knowledge space and remain in the existing schema",async()=>{
 await fixture({},async app=>{
  await app.update(()=>space(app,"Programming").props.onClick());await app.update(()=>byText(app,"Add resource").props.onClick());
  assert.equal(field(app,"Work area","select").props.value,"Programming");
  await app.update(()=>field(app,"Resource title").props.onChange({target:{value:"Fictional code handoff"}}));
  await app.update(()=>field(app,"What will this help someone do?","textarea").props.onChange({target:{value:"Start the robot safely"}}));
  await app.update(()=>field(app,"Team notes or build log","textarea").props.onChange({target:{value:"Synthetic startup procedure"}}));
  await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  const resource=app.context.data.resources.find(resource=>resource.title==="Fictional code handoff");assert.ok(resource);assert.equal(resource.category,"Programming");assert.equal(resource.visibility,"private");assert.equal(resource.approved,false);assert.equal("spaceId" in resource,false);
 });
});

test("the mentor review queue approves drafts and refreshes old guidance through guarded saves",async()=>{
 await fixture({role:"mentor"},async app=>{
  await app.update(()=>space(app,"Programming").props.onClick());await app.update(()=>review(app,"Needs review").props.onClick());
  await app.update(()=>byText(app,"Open next review item").props.onClick());assert.match(app.text,/Who can see this record/);
  await app.update(()=>byText(app,"Approve").props.onClick());
  const approved=app.context.data.resources.find(resource=>resource.id==="pending");assert.equal(approved.approved,true);assert.equal(approved.reviewed,today());assert.equal(approved.stale,false);
  await app.update(()=>app.root.findByProps({"aria-label":"Close dialog"}).props.onClick());assert.equal(cards(app).length,0);
  await app.update(()=>space(app,"Wiring").props.onClick());await app.update(()=>byText(app,"Open next review item").props.onClick());
  await app.update(()=>byText(app,"Mark reviewed").props.onClick());assert.equal(app.context.data.resources.find(resource=>resource.id==="old").reviewed,today());
 });
});

test("students cannot discover hidden document names, spaces or counts and stale selections close",async()=>{
 await fixture({role:"student"},async app=>{
  assert.doesNotMatch(app.text,/PRIVATE DOCUMENT SENTINEL|Secret engineering space|UNAPPROVED DOCUMENT SENTINEL|Unapproved space sentinel|Pending code handoff/);
  assert.equal(space(app,"All spaces").findByType("strong").children[0],"2");
  await app.update(()=>card(app,"Reviewed startup guide").props.onClick());assert.equal(app.root.findAllByProps({role:"dialog"}).length,1);
  await app.update(context=>context.setData(current=>({...current,resources:current.resources.map(resource=>resource.id==="ready"?{...resource,visibility:"private"}:resource)})));
  assert.equal(app.root.findAllByProps({role:"dialog"}).length,0);assert.doesNotMatch(app.text,/Reviewed startup guide/);
 });
 await fixture({},async app=>{
  await app.update(()=>card(app,"PRIVATE DOCUMENT SENTINEL").props.onClick());await app.update(()=>byText(app,"Edit resource").props.onClick());
  await app.update(context=>context.setRole("student"));assert.doesNotMatch(app.text,/PRIVATE DOCUMENT SENTINEL|Secret engineering space/);assert.equal(app.root.findAllByProps({role:"dialog"}).length,0);
 });
});

test("resource edits preserve independent teammate changes and keep a conflicting draft open",async()=>{
 await fixture({},async app=>{
  await app.update(()=>card(app,"Reviewed startup guide").props.onClick());await app.update(()=>byText(app,"Edit resource").props.onClick());
  await app.update(()=>field(app,"Resource title").props.onChange({target:{value:"Edited synthetic title"}}));
  await app.update(context=>context.setData(current=>({...current,resources:current.resources.map(resource=>resource.id==="ready"?{...resource,owner:"Another fictional owner"}:resource)})));
  await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  assert.equal(app.context.data.resources.find(resource=>resource.id==="ready").owner,"Another fictional owner");
  await app.update(()=>byText(app,"Edit resource").props.onClick());await app.update(()=>field(app,"Resource title").props.onChange({target:{value:"Conflicting draft title"}}));
  await app.update(context=>context.setData(current=>({...current,resources:current.resources.map(resource=>resource.id==="ready"?{...resource,title:"A teammate's newer title"}:resource)})));
  await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  assert.equal(field(app,"Resource title").props.value,"Conflicting draft title");assert.equal(app.context.data.resources.find(resource=>resource.id==="ready").title,"A teammate's newer title");
 });
});

test("knowledge spaces, review filters and document details have accessible semantics",async()=>{
 await fixture({role:"mentor"},async()=>{
  const dom=new JSDOM('<!doctype html><html lang="en"><head><title>Fictional resource spaces</title></head><body><main id="root"></main></body></html>',{url:"https://team.test",pretendToBeVisual:true,runScripts:"outside-only"});
  const previous=Object.fromEntries(["window","document","location","navigator","HTMLElement","getComputedStyle"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperties(globalThis,{window:{value:dom.window,configurable:true},document:{value:dom.window.document,configurable:true},location:{value:dom.window.location,configurable:true},navigator:{value:dom.window.navigator,configurable:true},HTMLElement:{value:dom.window.HTMLElement,configurable:true},getComputedStyle:{value:dom.window.getComputedStyle.bind(dom.window),configurable:true}});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>null;dom.window.eval(axe.source);const {createRoot}=await import("react-dom/client"),container=document.getElementById("root"),root=createRoot(container);
  const audit=async()=>{const result=await dom.window.axe.run(container,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]},rules:{"color-contrast":{enabled:false}}});assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.html)}))));};
  try{await act(async()=>root.render(React.createElement(HQProvider,{demoMode:true},React.createElement(Resources))));await audit();
   const target=[...container.querySelectorAll(".resource-card")].find(node=>node.textContent.includes("Reviewed startup guide"));assert.ok(target);await act(async()=>target.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));await audit();
  }finally{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
 });
});
