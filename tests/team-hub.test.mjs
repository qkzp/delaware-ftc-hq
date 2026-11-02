import test,{after} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer,{act} from "react-test-renderer";
import {createServer} from "vite-legacy";
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const location={hash:"#team"},listeners=new Map();
const on=(event,handler)=>{const set=listeners.get(event)||new Set();set.add(handler);listeners.set(event,set);};
const off=(event,handler)=>listeners.get(event)?.delete(handler);
Object.defineProperties(globalThis,{
 location:{value:location,configurable:true},window:{value:{location,addEventListener:on,removeEventListener:off,scrollTo(){}},configurable:true},
 document:{value:{body:{style:{}},activeElement:{focus(){}},addEventListener:on,removeEventListener:off},configurable:true},
 navigator:{value:{onLine:true,clipboard:{writeText:async()=>{}}},configurable:true},
});
const vite=await createServer({configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {HQProvider,useHQ}=await vite.ssrLoadModule("/src/store.tsx");
const {createDemoData}=await vite.ssrLoadModule("/src/seed.ts");
const {validateData,STORAGE_KEY}=await vite.ssrLoadModule("/src/persistence.ts");
const {default:TeamHub}=await vite.ssrLoadModule("/src/screens/TeamHub.tsx");
const {Workspace}=await vite.ssrLoadModule("/src/App.tsx");
const {navigation,pageLabels}=await vite.ssrLoadModule("/src/navigation.ts");
const text=node=>JSON.stringify(node.toJSON());
const button=(root,label)=>root.findAllByType("button").find(node=>node.children.some(child=>typeof child==="string"&&child.trim()===label)||node.findAllByType("span").some(span=>span.children.includes(label)));
const field=(root,label)=>root.findAllByType("label").find(node=>node.findAllByType("span").some(span=>span.children.includes(label))).findAll(node=>["input","textarea","select"].includes(node.type))[0];
const openTask=(root,title)=>root.findAllByType("button").find(node=>node.findAllByType("strong").some(strong=>strong.children.includes(title)));
async function fixture(check,{role="lead",page=TeamHub}={}){
 location.hash="#team";
 const values=new Map([[STORAGE_KEY,JSON.stringify(createDemoData())]]);
 Object.defineProperty(globalThis,"localStorage",{value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},configurable:true});
 let current,renderer;function Probe(){current=useHQ();return React.createElement(page);}
 const originalError=console.error;console.error=(...args)=>{if(!String(args[0]).startsWith("react-test-renderer is deprecated"))originalError(...args);};
 try{
  await act(async()=>{renderer=TestRenderer.create(React.createElement(HQProvider,{demoMode:true},React.createElement(Probe)));});
  if(role!=="lead")await act(async()=>current.setRole(role));
  await check({get root(){return renderer.root;},get context(){return current;},get text(){return text(renderer);},update:async fn=>act(async()=>fn(current))});
 }finally{if(renderer)await act(async()=>renderer.unmount());console.error=originalError;}
}
test("the team hub is a first-class navigable workspace section",()=>{
 assert.equal(navigation.find(item=>item.page==="team")?.label,"Team hub");assert.equal(pageLabels.team,"Team hub");
});
test("workstream channels filter task conversations and search actual reply content",async()=>{
 await fixture(async app=>{
  const mechanical=app.context.data.tasks.find(task=>task.area==="Mechanical"),other=app.context.data.tasks.find(task=>task.area!=="Mechanical");
  await app.update(()=>button(app.root,"Mechanical").props.onClick());
  assert.ok(openTask(app.root,mechanical.title));assert.equal(openTask(app.root,other.title),undefined);
  await app.update(context=>context.setData(data=>({...data,tasks:data.tasks.map(task=>task.id===mechanical.id?{...task,comments:[...task.comments,{text:"fictional-calibration-marker",date:"2026-11-01T12:00:00Z",author:"Alex (you)"}]}:task)})));
  await app.update(()=>field(app.root,"Find a task conversation").props.onChange({target:{value:"fictional-calibration-marker"}}));
  assert.ok(openTask(app.root,mechanical.title));
 });
});
test("task replies preserve teammate edits and other task reply drafts",async()=>{
 await fixture(async app=>{
  const [first,second]=app.context.data.tasks;
  await app.update(()=>openTask(app.root,first.title).props.onClick());
  await app.update(()=>field(app.root,"Reply to this task").props.onChange({target:{value:"Fictional task-specific reply"}}));
  await app.update(()=>openTask(app.root,second.title).props.onClick());
  assert.equal(field(app.root,"Reply to this task").props.value,"");
  await app.update(()=>openTask(app.root,first.title).props.onClick());
  assert.equal(field(app.root,"Reply to this task").props.value,"Fictional task-specific reply");
  await app.update(context=>context.setData(data=>({...data,tasks:data.tasks.map(task=>task.id===first.id?{...task,priority:"Low",comments:[...task.comments,{text:"New teammate context",date:"2026-11-01T10:00:00Z",author:"Teammate"}]}:task)})));
  await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  const saved=app.context.data.tasks.find(task=>task.id===first.id);
  assert.equal(saved.priority,"Low");assert.ok(saved.comments.some(comment=>comment.text==="New teammate context"));assert.ok(saved.comments.some(comment=>comment.text==="Fictional task-specific reply"));
  assert.equal(validateData(app.context.data),true);
 });
});
test("students can reply to team tasks while private resources and announcement creation stay unavailable",async()=>{
 await fixture(async app=>{
  assert.equal(button(app.root,"Post team update"),undefined);
  const task=app.context.data.tasks.find(task=>task.owner!==app.context.myOwner);
  await app.update(()=>openTask(app.root,task.title).props.onClick());
  await app.update(()=>field(app.root,"Reply to this task").props.onChange({target:{value:"A fictional student question"}}));
  await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  assert.ok(app.context.data.tasks.find(item=>item.id===task.id).comments.some(comment=>comment.text==="A fictional student question"));
  for(const resource of app.context.data.resources.filter(resource=>resource.visibility==="private"||!resource.approved))assert.equal(app.text.includes(resource.title),false);
 },{role:"student"});
});
test("a lead records a valid team decision that appears in the brief and activity",async()=>{
 await fixture(async app=>{
  await app.update(()=>button(app.root,"Post team update").props.onClick());
  await app.update(()=>field(app.root,"Title").props.onChange({target:{value:"Fictional drivetrain decision"}}));
  await app.update(()=>field(app.root,"Message").props.onChange({target:{value:"Test the gearing at the next build night."}}));
  await app.update(()=>field(app.root,"Update type").props.onChange({target:{value:"Decision"}}));
  await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
  assert.equal(validateData(app.context.data),true);assert.equal(app.root.findAllByProps({role:"dialog"}).length,0);
  await app.update(()=>button(app.root,"Team brief").props.onClick());assert.match(app.text,/Fictional drivetrain decision/);
  await app.update(()=>button(app.root,"Activity").props.onClick());assert.match(app.text,/Fictional drivetrain decision/);
 });
});
test("a retained reply callback cannot post into a different season and old drafts disappear",async()=>{
 await fixture(async app=>{
  const task=app.context.data.tasks[0];await app.update(()=>openTask(app.root,task.title).props.onClick());
  await app.update(()=>field(app.root,"Reply to this task").props.onChange({target:{value:"Old scoped draft"}}));
  const submit=app.root.findByType("form").props.onSubmit;
  await app.update(context=>context.setData(data=>({...data,seasonId:"next-season",tasks:data.tasks.map(item=>({...item,seasonId:"next-season"}))})));
  await app.update(()=>submit({preventDefault(){}}));
  assert.equal(app.context.data.tasks.some(item=>item.comments.some(comment=>comment.text==="Old scoped draft")),false);assert.equal(app.root.findAllByType("textarea").length,0);
 });
});
test("reply and update drafts survive real workspace navigation without browser storage",async()=>{
 await fixture(async app=>{
  const task=app.context.data.tasks[0];await app.update(()=>openTask(app.root,task.title).props.onClick());
  await app.update(()=>field(app.root,"Reply to this task").props.onChange({target:{value:"Unposted reply kept in tab memory"}}));
  await app.update(()=>button(app.root,"Open task").props.onClick());assert.equal(app.context.page,"tasks");
  await app.update(context=>context.setPage("team"));assert.equal(field(app.root,"Reply to this task").props.value,"Unposted reply kept in tab memory");
  await app.update(()=>button(app.root,"Post team update").props.onClick());
  await app.update(()=>field(app.root,"Title").props.onChange({target:{value:"Unposted team decision"}}));
  await app.update(()=>button(app.root,"Keep draft and close").props.onClick());
  await app.update(context=>context.setPage("calendar"));await app.update(context=>context.setPage("team"));
  await app.update(()=>button(app.root,"Post team update").props.onClick());assert.equal(field(app.root,"Title").props.value,"Unposted team decision");
  const saved=localStorage.getItem(STORAGE_KEY);assert.equal(saved.includes("Unposted reply kept in tab memory"),false);assert.equal(saved.includes("Unposted team decision"),false);
 },{page:Workspace});
});
test("workspace search finds decision text and opens the exact team update",async()=>{
 await fixture(async app=>{
  await app.update(context=>context.setData(data=>({...data,announcements:[...data.announcements,{id:"searched-decision",teamId:data.teamId,seasonId:data.seasonId,title:"Fictional documented choice",body:"unique-decision-search-marker",date:"2026-11-01",author:context.myOwner,type:"Decision"}]})));
  await app.update(()=>app.root.findByProps({className:"workspace-search"}).props.onClick());
  const search=app.root.findAllByProps({"aria-label":"Search workspace"}).find(node=>node.type==="input");
  await app.update(()=>search.props.onChange({target:{value:"unique-decision-search-marker"}}));
  await app.update(()=>button(app.root,"Fictional documented choice").props.onClick());
  assert.equal(app.context.page,"team");assert.equal(app.root.findAllByProps({role:"dialog"}).length,0);assert.match(app.text,/Showing the selected update/);assert.match(app.text,/unique-decision-search-marker/);
 },{page:Workspace});
});
test("an activity jump aligns its conversation workstream and clears an unrelated search",async()=>{
 await fixture(async app=>{
  const task=app.context.data.tasks.find(item=>item.area==="Programming");
  await app.update(context=>context.setData(data=>({...data,tasks:data.tasks.map(item=>item.id===task.id?{...item,comments:[...item.comments,{text:"unique-programming-activity",date:"2040-01-01T12:00:00Z",author:context.myOwner}]}:item)})));
  await app.update(()=>button(app.root,"Mechanical").props.onClick());
  await app.update(()=>field(app.root,"Find a task conversation").props.onChange({target:{value:"unrelated-query"}}));
  await app.update(()=>button(app.root,"Activity").props.onClick());
  const item=app.root.findAllByType("article").find(node=>node.findAllByType("p").some(paragraph=>paragraph.children.includes("unique-programming-activity")));
  await app.update(()=>button(item,"Open conversation").props.onClick());
  assert.equal(button(app.root,"Programming").props["aria-pressed"],true);assert.equal(field(app.root,"Find a task conversation").props.value,"");assert.match(app.text,/unique-programming-activity/);
 });
});
