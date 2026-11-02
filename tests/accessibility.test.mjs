import test,{after} from "node:test";
import assert from "node:assert/strict";
import React,{act,useState} from "react";
import {JSDOM} from "jsdom";
import axe from "axe-core";
import {createServer} from "vite-legacy";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dom=new JSDOM('<!doctype html><html lang="en"><head><title>MyFTCSpace accessibility checks</title></head><body><div id="root"></div></body></html>',{url:"https://team.test",pretendToBeVisual:true,runScripts:"outside-only"});
const media=()=>({matches:false,media:"",addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
dom.window.matchMedia=media;dom.window.scrollTo=()=>{};
Object.defineProperties(globalThis,{
 window:{value:dom.window,configurable:true},document:{value:dom.window.document,configurable:true},
 navigator:{value:dom.window.navigator,configurable:true},location:{value:dom.window.location,configurable:true},
 localStorage:{value:dom.window.localStorage,configurable:true},HTMLElement:{value:dom.window.HTMLElement,configurable:true},
 getComputedStyle:{value:dom.window.getComputedStyle.bind(dom.window),configurable:true},matchMedia:{value:media,configurable:true},
});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const {createRoot}=await import("react-dom/client");
dom.window.eval(axe.source);
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(async()=>{await vite.close();dom.window.close();});
const {Modal,Field}=await vite.ssrLoadModule("/src/components/ui.tsx");
const {default:ReviewHold}=await vite.ssrLoadModule("/src/components/ReviewHold.tsx");
const {HQProvider}=await vite.ssrLoadModule("/src/store.tsx");
async function mounted(element,check){
 const container=document.getElementById("root"),root=createRoot(container);
 try{await act(async()=>root.render(element));await check(container);}
 finally{await act(async()=>root.unmount());localStorage.clear();}
}
async function audit(container){
 // jsdom does not render layout. Color contrast, zoom and assistive technology remain manual checks.
 const result=await dom.window.axe.run(container,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]},rules:{"color-contrast":{enabled:false}}});
 assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.html)})),null,2));
}
test("dialog keyboard focus wraps, Escape closes, and focus returns to its opener",async()=>{
 function Harness(){const [open,setOpen]=useState(false);return React.createElement("main",null,
  React.createElement("h1",null,"Team task"),React.createElement("button",{id:"opener",onClick:()=>setOpen(true)},"Edit task"),
  open&&React.createElement(Modal,{title:"Edit task",onClose:()=>setOpen(false)},
   React.createElement(Field,{label:"Task title"},React.createElement("input",{id:"draft-title",defaultValue:"Fictional task"})),
   React.createElement("button",{id:"last",onClick:()=>setOpen(false)},"Save task")));
 }
 await mounted(React.createElement(Harness),async container=>{
  const opener=container.querySelector("#opener");opener.focus();
  await act(async()=>opener.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));
  const dialog=container.querySelector('[role="dialog"]');assert.ok(dialog);assert.equal(dialog.getAttribute("aria-modal"),"true");
  assert.equal(document.activeElement.id,"draft-title");
  const first=dialog.querySelector("button"),last=dialog.querySelector("#last");
  last.focus();const forward=new dom.window.KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true});
  document.dispatchEvent(forward);assert.equal(forward.defaultPrevented,true);assert.equal(document.activeElement,first);
  const backward=new dom.window.KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true});
  document.dispatchEvent(backward);assert.equal(backward.defaultPrevented,true);assert.equal(document.activeElement,last);
  await audit(container);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
  assert.equal(container.querySelector('[role="dialog"]'),null);assert.equal(document.activeElement,opener);assert.equal(document.body.style.overflow,"");
 });
});
test("the production review hold has named help links and no team sign-in or data-collection form",async()=>{
 await mounted(React.createElement(ReviewHold),async container=>{
  assert.equal(container.querySelector("form"),null);
  assert.ok(container.querySelector('a[href="/enroll"]'));
  assert.match(container.textContent,/13–18/);await audit(container);
 });
});
test("all core pages pass automated accessibility semantics in fictional-data mode",async()=>{
 for(const page of ["Home","TeamHub","Tasks","Calendar","Sponsors","Grants","Resources","Onboarding","Pit","Settings","Evidence","Opportunities"]){
  const {default:Page}=await vite.ssrLoadModule("/src/screens/"+page+".tsx");
  await mounted(React.createElement(HQProvider,{demoMode:true},React.createElement("main",null,React.createElement(Page))),async container=>{
   try{await audit(container);}catch(error){error.message=page+": "+error.message;throw error;}
  });
 }
});
test("team hub conversations, briefs, activity, guided help and update dialog have accessible semantics",async()=>{
 const {default:TeamHub}=await vite.ssrLoadModule("/src/screens/TeamHub.tsx");
 await mounted(React.createElement(HQProvider,{demoMode:true},React.createElement("main",null,React.createElement(TeamHub))),async container=>{
  const click=async button=>act(async()=>button.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));
  await click(container.querySelector(".team-hub-task-list>button"));await audit(container);
  for(const view of ["Team brief","Activity","Help desk"]){
   await click([...container.querySelectorAll(".team-hub-views button")].find(button=>button.textContent===view));await audit(container);
  }
  await click([...container.querySelectorAll("button")].find(button=>button.textContent.includes("Post team update")));await audit(container);
 });
});
test("the sidebar workspace and mobile section picker keep accessible navigation and real pages",async()=>{
 const {Workspace}=await vite.ssrLoadModule("/src/App.tsx");
 await mounted(React.createElement(HQProvider,{demoMode:true},React.createElement(Workspace)),async container=>{
  assert.ok(container.querySelector('aside[aria-label="Workspace sidebar"]'));
  assert.ok(container.querySelector('.workspace-topbar'));
  assert.equal(container.querySelector('main h1').textContent,'My work');
  await audit(container);
  const picker=container.querySelector('select[aria-label="Workspace section"]');
  await act(async()=>{picker.value="tasks";picker.dispatchEvent(new dom.window.Event("change",{bubbles:true}));});
  assert.equal(container.querySelector('nav [aria-current="page"]').textContent.trim().replace(/\d+$/, ""),"Tasks");
  assert.equal(container.querySelector('main h1').textContent,"Tasks");await audit(container);
 });
});
test("the redesigned sign-in page has accessible landmarks and a clear approved-account action",async()=>{
 const {default:SignIn}=await vite.ssrLoadModule("/src/components/SignIn.tsx");
 await mounted(React.createElement(SignIn),async container=>{
  assert.ok(container.querySelector('main'));
  assert.ok(container.querySelector('a[href="/signin"]'));
  assert.match(container.textContent,/13–18/);await audit(container);
 });
});
