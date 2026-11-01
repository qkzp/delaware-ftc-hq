import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {createServer} from 'vite-legacy';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const events=new Map();
const on=(name,callback)=>{const set=events.get(name)||new Set();set.add(callback);events.set(name,set);};
const off=(name,callback)=>events.get(name)?.delete(callback);
const location={hash:'#home'};
const media=()=>({matches:false,addEventListener(){},removeEventListener(){}});
Object.defineProperties(globalThis,{
 window:{value:{location,addEventListener:on,removeEventListener:off,matchMedia:media,scrollTo(){}},configurable:true},
 document:{value:{visibilityState:'visible',body:{style:{}},activeElement:{focus(){}},addEventListener:on,removeEventListener:off},configurable:true},
 location:{value:location,configurable:true},
 navigator:{value:{onLine:true},configurable:true},
 matchMedia:{value:media,configurable:true},
});
const vite=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,watch:null,hmr:false},appType:'custom',logLevel:'silent'});
after(()=>vite.close());
const {HQProvider,useHQ}=await vite.ssrLoadModule('/src/store.tsx');
const {AccountWorkspace}=await vite.ssrLoadModule('/src/App.tsx');
const {createDemoData}=await vite.ssrLoadModule('/src/seed.ts');
const {STORAGE_KEY}=await vite.ssrLoadModule('/src/persistence.ts');
const teamId='private-team';
async function fixture({signedIn=true,member=true,demoMode=false}={},check){
 const values=new Map([['myftcspace:team',teamId]]),writes=[],requests=[];
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,String(v));writes.push(String(v));},removeItem:k=>values.delete(k)};
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
 const data=createDemoData();data.teamName='PRIVATE TEAM SENTINEL';
 const state={user:signedIn?'account-a':null,member,role:'admin',data,putStatus:200};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(path,options={})=>{
  const method=options.method||'GET';requests.push({path,method});
  if(path==='/api/session')return Response.json({user:state.user?{userId:state.user}:null,teams:state.user&&state.member?[{id:teamId,teamName:state.data.teamName,name:'Student A',role:state.role}]:[]});
  if(!state.user)return Response.json({error:'Sign in required'},{status:401});
  if(!state.member)return Response.json({error:'Membership removed'},{status:403});
  if(method==='PUT'&&state.putStatus!==200)return Response.json({error:'Sign in required'},{status:state.putStatus});
  if(path===`/api/teams/${teamId}`)return Response.json({data:structuredClone(state.data),version:1,role:state.role,members:[{userId:state.user,name:'Student A',role:state.role}],updated:'2026-11-01'});
  throw new Error(`Unexpected fixture request: ${path}`);
 };
 let context,renderer;
 function Probe(){context=useHQ();return React.createElement(AccountWorkspace);}
 const previousError=console.error;
 console.error=(...args)=>{if(!String(args[0]).startsWith('react-test-renderer is deprecated'))previousError(...args);};
 const app={state,requests,writes,values,get context(){return context;},get root(){return renderer.root;},get text(){return JSON.stringify(renderer.toJSON());},async update(callback){await act(async()=>{await callback();});},async focus(){await act(async()=>{for(const callback of [...events.get('focus')||[]])callback();});}};
 try{
  await act(async()=>{renderer=TestRenderer.create(React.createElement(HQProvider,{accountMode:!demoMode,demoMode},React.createElement(Probe)));});
  await check(app);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=originalFetch;console.error=previousError;}
}

test('signed-out accounts see a real sign-in link; signed-in nonmembers see team setup without sample records',async()=>{
 await fixture({signedIn:false},async app=>{
  assert.match(app.text,/Sign in to your team/);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);
  const signIn=app.root.findAllByType('a').find(a=>a.props.href.startsWith('/signin-with-chatgpt'));
  assert.equal(signIn.props.target,'_top');assert.deepEqual(app.writes,[]);
 });
 await fixture({member:false},async app=>{assert.match(app.text,/Create private team|Join team/);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);assert.deepEqual(app.writes,[]);});
});
test('private account records open for an existing member and never enter browser demo storage',async()=>{
 await fixture({},async app=>{assert.ok(app.context.cloud.shared);assert.match(app.text,/PRIVATE TEAM SENTINEL/);assert.equal(app.values.has(STORAGE_KEY),false);assert.ok(app.writes.every(v=>!v.includes('PRIVATE TEAM SENTINEL')));});
});
test('sign-out in another tab clears private records on focus and returns to sign-in',async()=>{
 await fixture({},async app=>{app.state.user=null;await app.focus();assert.equal(app.context.cloud.shared,null);assert.equal(app.context.cloud.session.user,null);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);assert.match(app.text,/Continue with ChatGPT/);assert.equal(app.values.has(STORAGE_KEY),false);});
});
test('revocation and account switching lock even an unsaved workspace before another save',async()=>{
 for(const reason of ['revoked','switched'])await fixture({},async app=>{
  await app.update(()=>app.context.setData(d=>({...d,teamName:'PRIVATE UNSAVED SENTINEL'})));
  if(reason==='revoked')app.state.member=false;else app.state.user='account-b';
  await app.focus();assert.equal(app.context.cloud.shared,null);assert.doesNotMatch(app.context.data.teamName,/PRIVATE (?:TEAM|UNSAVED) SENTINEL/);assert.doesNotMatch(app.text,/PRIVATE UNSAVED SENTINEL|Main navigation/);assert.equal(app.requests.some(r=>r.method==='PUT'),false);assert.equal(app.values.has(STORAGE_KEY),false);
 });
});
test('an expired session during a save clears private memory instead of retaining a stale editable workspace',async()=>{
 await fixture({},async app=>{await app.update(()=>app.context.setData(d=>({...d,teamName:'PRIVATE UNSAVED SENTINEL'})));app.state.putStatus=401;await app.update(()=>app.context.cloud.save());assert.equal(app.context.cloud.shared,null);assert.match(app.text,/Your session ended/);assert.doesNotMatch(app.text,/PRIVATE (?:TEAM|UNSAVED) SENTINEL/);assert.equal(app.values.has(STORAGE_KEY),false);});
});
test('saving rechecks account identity before sending a draft prepared by another account',async()=>{
 await fixture({},async app=>{await app.update(()=>app.context.setData(d=>({...d,teamName:'PRIVATE UNSAVED SENTINEL'})));app.state.user='account-b';await app.update(()=>app.context.cloud.save());assert.equal(app.context.cloud.shared,null);assert.equal(app.requests.some(r=>r.method==='PUT'),false);assert.doesNotMatch(app.context.data.teamName,/PRIVATE/);});
});
test('role reduction reloads authorized server data even when the old workspace has unsaved edits',async()=>{
 await fixture({},async app=>{await app.update(()=>app.context.setData(d=>({...d,teamName:'OLD PRIVATE DRAFT'})));app.state.role='student';app.state.data={...app.state.data,teamName:'Student team view',sponsors:[]};await app.focus();assert.equal(app.context.cloud.shared.role,'student');assert.equal(app.context.data.teamName,'Student team view');assert.match(app.context.cloud.error,/role changed/);assert.equal(app.requests.some(r=>r.method==='PUT'),false);});
});
test('the explicit demo does not request a session or reopen a remembered private team',async()=>{
 await fixture({demoMode:true},async app=>{assert.equal(app.requests.length,0);assert.equal(app.context.cloud.shared,null);assert.equal(app.context.cloud.session.user,null);assert.ok(app.writes.every(v=>!v.includes('PRIVATE TEAM SENTINEL')));});
});
