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
async function fixture({signedIn=true,member=true,demoMode=false,pending=false}={},check){
 const values=new Map([['myftcspace:team',teamId]]),writes=[],requests=[];
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,String(v));writes.push(String(v));},removeItem:k=>values.delete(k)};
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
 const data=createDemoData();data.teamName='PRIVATE TEAM SENTINEL';
 const state={user:signedIn?'account-a':null,member,role:pending?'lead':'admin',pending,selfService:pending,data,putStatus:200,version:1};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(path,options={})=>{
  const method=options.method||'GET';requests.push({path,method});
  if(path==='/api/session')return Response.json({user:state.user?{userId:state.user}:null,accessModel:state.selfService?'self-service':'allowlist',teams:state.user&&state.member?[{id:state.teamId||teamId,teamName:state.data.teamName,name:'Student A',role:state.role,...(state.selfService?{studentFounder:state.role==='lead',adultSupervisionPending:state.pending}:{})}]:[]});
  if(!state.user)return Response.json({error:'Sign in required'},{status:401});
  if(!state.member)return Response.json({error:'Membership removed'},{status:403});
  if(method==='PUT'&&state.putStatus!==200)return Response.json({error:'Sign in required'},{status:state.putStatus});
  if(path===`/api/teams/${state.teamId||teamId}`){if(method==='PUT'){state.data=JSON.parse(options.body).data;state.version++;}return Response.json({data:structuredClone(state.data),version:state.version,role:state.role,members:[{userId:state.user,name:'Student A',role:state.role}],updated:'2026-11-01',...(method==='PUT'?{}:{canInvite:state.role==='lead',adultSupervisionPending:state.pending})});}
  if(path===`/api/teams/${teamId}/privacy/consent-review`&&method==='POST'){
   const body=JSON.parse(options.body),record=state.data.evidence.find(e=>e.id===body.evidenceId);
   assert.equal(body.confirmation,'REVIEWED COLLECTION CONSENT');assert.equal(body.baseVersion,state.version);
   record.consentReviewedAt='2026-11-01T12:00:00Z';record.consentReviewedBy=state.user;state.version++;return Response.json({ok:true});
  }
  if(path.startsWith(`/api/teams/${teamId}/files?evidence=`)&&method==='POST')return Response.json({id:'uploaded-private-file'});
  throw new Error(`Unexpected fixture request: ${path}`);
 };
 let context,renderer;
 function Probe(){context=useHQ();return React.createElement(AccountWorkspace);}
 const previousError=console.error;
 console.error=(...args)=>{if(!String(args[0]).startsWith('react-test-renderer is deprecated'))previousError(...args);};
 const app={state,requests,writes,values,get context(){return context;},get root(){return renderer.root;},get text(){return JSON.stringify(renderer.toJSON());},async update(callback){await act(async()=>{await callback();});},async focus(){await act(async()=>{for(const callback of [...events.get('focus')||[]])callback();});},holdNext(path,method='GET'){
  const previous=globalThis.fetch;let consumed=false,release,entered;const started=new Promise(resolve=>entered=resolve);
  globalThis.fetch=async(p,options={})=>{const response=await previous(p,options);if(!consumed&&p===path&&(options.method||'GET')===method){consumed=true;entered();return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
  return {started,release(){assert.ok(release,'The held request must have started');release();}};
 }};
 try{
  await act(async()=>{renderer=TestRenderer.create(React.createElement(HQProvider,{accountMode:!demoMode,demoMode},React.createElement(Probe)));});
  await check(app);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=originalFetch;console.error=previousError;}
}

test('signed-out accounts see a real sign-in link; signed-in nonmembers see team setup without sample records',async()=>{
 await fixture({signedIn:false},async app=>{
  assert.match(app.text,/Sign in to your team/);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);
  const signIn=app.root.findAllByType('a').find(a=>a.props.href==='/signin');
  assert.ok(signIn);assert.deepEqual(app.writes,[]);
 });
 await fixture({member:false},async app=>{assert.match(app.text,/Create private team|Join team/);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);assert.deepEqual(app.writes,[]);});
});
test('private account records open for an existing member and never enter browser demo storage',async()=>{
 await fixture({},async app=>{assert.ok(app.context.cloud.shared);assert.match(app.text,/PRIVATE TEAM SENTINEL/);assert.equal(app.values.has(STORAGE_KEY),false);assert.ok(app.writes.every(v=>!v.includes('PRIVATE TEAM SENTINEL')));});
});
test('a student founder can open the workspace before an adult joins',async()=>{
 await fixture({pending:true},async app=>{
  assert.match(app.text,/Main navigation/);
  assert.equal(app.context.cloud.shared.canInvite,true);
  assert.equal(app.context.cloud.shared.adultSupervisionPending,true);
  app.state.pending=false;await app.update(()=>app.context.cloud.refreshSession());
  assert.doesNotMatch(app.text,/Your team is ready for a responsible adult to join/);
  assert.match(app.text,/Main navigation/);
  await app.update(()=>app.context.setData(d=>({...d,teamName:'Changed team'})));
  await app.update(()=>app.context.cloud.save());
  assert.equal(app.context.cloud.shared.canInvite,true);
  assert.equal(app.context.cloud.shared.adultSupervisionPending,false);
 });
});
test('sign-out in another tab clears private records on focus and returns to sign-in',async()=>{
 await fixture({},async app=>{app.state.user=null;await app.focus();assert.equal(app.context.cloud.shared,null);assert.equal(app.context.cloud.session.user,null);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);assert.match(app.text,/Sign in/);assert.equal(app.values.has(STORAGE_KEY),false);});
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
test('a delayed reload cannot resurrect private records after the account changes',async()=>{
 await fixture({},async app=>{const held=app.holdNext(`/api/teams/${teamId}`);let pending;await app.update(()=>{pending=app.context.cloud.reload();pending.catch(()=>{});});await held.started;app.state.user='account-b';app.state.member=false;await app.focus();assert.equal(app.context.cloud.shared,null);await app.update(async()=>{held.release();await assert.rejects(pending,/account|permissions|team changed/i);});assert.equal(app.context.cloud.session.user.userId,'account-b');assert.equal(app.context.cloud.shared,null);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);});
});
test('a delayed team-open response cannot restore access removed by a newer session check',async()=>{
 await fixture({},async app=>{const held=app.holdNext(`/api/teams/${teamId}`);let pending;await app.update(()=>{pending=app.context.cloud.openTeam(teamId);pending.catch(()=>{});});await held.started;app.state.user='account-b';app.state.member=false;await app.focus();await app.update(async()=>{held.release();await assert.rejects(pending,/account|permissions|team changed/i);});assert.equal(app.context.cloud.shared,null);assert.doesNotMatch(app.text,/PRIVATE TEAM SENTINEL|Main navigation/);});
});
test('an older session response cannot replace the newer signed-in identity',async()=>{
 await fixture({},async app=>{const held=app.holdNext('/api/session');let pending;await app.update(()=>{pending=app.context.cloud.refreshSession();});await held.started;app.state.user='account-b';app.state.member=false;await app.focus();await app.update(async()=>{held.release();await pending;});assert.equal(app.context.cloud.session.user.userId,'account-b');assert.equal(app.context.cloud.shared,null);assert.doesNotMatch(app.context.data.teamName,/PRIVATE/);});
});
test('a delayed save response cannot restore old permissions after a role reduction',async()=>{
 await fixture({},async app=>{await app.update(()=>app.context.setData(d=>({...d,teamName:'OLD ADMIN PRIVATE DRAFT'})));const held=app.holdNext(`/api/teams/${teamId}`,'PUT');let pending;await app.update(()=>{pending=app.context.cloud.save();});await held.started;app.state.role='student';app.state.data={...app.state.data,teamName:'Student team view',sponsors:[]};await app.focus();assert.equal(app.context.cloud.shared.role,'student');await app.update(async()=>{held.release();await pending;});assert.equal(app.context.cloud.shared.role,'student');assert.equal(app.context.data.teamName,'Student team view');assert.deepEqual(app.context.data.sponsors,[]);assert.doesNotMatch(app.text,/OLD ADMIN PRIVATE DRAFT/);});
});
test('reload waits for an in-flight save instead of treating discarded data as a new edit',async()=>{
 await fixture({},async app=>{await app.update(()=>app.context.setData(d=>({...d,teamName:'A real saved edit'})));const held=app.holdNext(`/api/teams/${teamId}`,'PUT');let pending;await app.update(()=>{pending=app.context.cloud.save();});await held.started;await app.update(()=>assert.rejects(app.context.cloud.reload(),/current save|reload to finish/i));assert.equal(app.context.data.teamName,'A real saved edit');await app.update(async()=>{held.release();await pending;});assert.equal(app.context.data.teamName,'A real saved edit');assert.equal(app.context.cloud.status,'Synced');});
});

function taskField(root,label,type='input') {
 const field=root.findAll(n=>n.type==='label'&&n.props.className==='field').find(n=>n.findAllByType('span').some(s=>s.children.includes(label)));
 assert.ok(field,label+' should exist');return field.findByType(type);
}
const submitTask=app=>app.root.findAllByType('form').find(f=>f.props.className==='stack').props.onSubmit({preventDefault(){}});
async function openTaskDraft(app){const task=app.context.data.tasks[0];await app.update(()=>app.context.openRecord('tasks',task.id));return task;}
test('an open task form preserves a teammate priority update through focus refresh and shared save',async()=>{
 await fixture({},async app=>{
  const task=await openTaskDraft(app),priority=task.priority==='Low'?'High':'Low';
  await app.update(()=>taskField(app.root,'Task name').props.onChange({target:{value:'Independent title edit'}}));
  app.state.data.tasks=app.state.data.tasks.map(t=>t.id===task.id?{...t,priority}:t);app.state.version++;
  await app.focus();assert.equal(app.context.data.tasks.find(t=>t.id===task.id).priority,priority);
  await app.update(()=>submitTask(app));await app.update(()=>app.context.cloud.save());
  const saved=app.state.data.tasks.find(t=>t.id===task.id);assert.equal(saved.title,'Independent title edit');assert.equal(saved.priority,priority);
  assert.equal(app.root.findAllByProps({role:'dialog'}).length,0);
 });
});
test('divergent changes to an open task field reject the save and retain its draft',async()=>{
 await fixture({},async app=>{
  const task=await openTaskDraft(app);await app.update(()=>taskField(app.root,'Task name').props.onChange({target:{value:'My retained draft'}}));
  app.state.data.tasks=app.state.data.tasks.map(t=>t.id===task.id?{...t,title:'New teammate title'}:t);app.state.version++;
  await app.focus();await app.update(()=>submitTask(app));
  assert.equal(app.context.data.tasks.find(t=>t.id===task.id).title,'New teammate title');
  assert.equal(taskField(app.root,'Task name').props.value,'My retained draft');assert.match(app.context.notice.message,/teammate changed title/);
  assert.equal(app.requests.some(r=>r.method==='PUT'),false);
 });
});
test('a deleted task cannot be recreated by saving its open editor',async()=>{
 await fixture({},async app=>{
  const task=await openTaskDraft(app);await app.update(()=>taskField(app.root,'Task name').props.onChange({target:{value:'Deleted record draft'}}));
  app.state.data.tasks=app.state.data.tasks.filter(t=>t.id!==task.id);app.state.version++;await app.focus();await app.update(()=>submitTask(app));
  assert.equal(app.context.data.tasks.some(t=>t.id===task.id),false);assert.equal(taskField(app.root,'Task name').props.value,'Deleted record draft');assert.match(app.context.notice.message,/removed by a teammate/);
 });
});
test('new task comments survive an older open editor save',async()=>{
 await fixture({},async app=>{
  const task=await openTaskDraft(app);await app.update(()=>taskField(app.root,'Task name').props.onChange({target:{value:'Title with new comments'}}));
  const comment={author:'fictional-teammate',date:'2026-11-01T12:00:00Z',text:'New measurement from another teammate'};
  app.state.data.tasks=app.state.data.tasks.map(t=>t.id===task.id?{...t,comments:[...t.comments,comment]}:t);app.state.version++;await app.focus();await app.update(()=>submitTask(app));await app.update(()=>app.context.cloud.save());
  assert.ok(app.state.data.tasks.find(t=>t.id===task.id).comments.some(c=>c.text===comment.text));
 });
});
test('an open draft cannot cross a team or season change',async()=>{
 await fixture({},async app=>{
  const task=await openTaskDraft(app);await app.update(()=>taskField(app.root,'Task name').props.onChange({target:{value:'Original season draft'}}));
  app.state.data={...app.state.data,seasonId:'another-season'};app.state.version++;await app.focus();await app.update(()=>submitTask(app));
  assert.notEqual(app.context.data.tasks.find(t=>t.id===task.id).title,'Original season draft');
  assert.equal(taskField(app.root,'Task name').props.value,'Original season draft');assert.match(app.context.notice.message,/season.*changed/);
 });
});

async function openSavedEvidence(app){
 const evidence={id:'synthetic-evidence',teamId:app.context.data.teamId,seasonId:app.context.data.seasonId,title:'Fictional engineering measurement',date:'2026-11-01',county:'Kent',owner:'account-a',kind:'Engineering',activity:'Measured a fictional mechanism',impact:'Synthetic result only',reach:0,measurement:'',awards:[],mediaUrl:'',fileId:'',consent:'Team use only',consentNote:'Fictional approved school reference',visibility:'private',approved:false,reviewedBy:'',reviewedAt:'',archived:false};
 await app.update(()=>app.context.setData(d=>({...d,evidence:[evidence]})));await app.update(()=>app.context.cloud.save());await app.update(()=>app.context.openRecord('evidence',evidence.id));return evidence;
}
test('media upload requires a saved mentor collection review before the upload control becomes available',async()=>{
 await fixture({},async app=>{
  const evidence=await openSavedEvidence(app);const upload=()=>app.root.findByProps({type:'file'});
  assert.equal(upload().props.disabled,true);
  await app.update(()=>upload().props.onChange({target:{files:[{size:20,type:'application/pdf',name:'fictional.pdf'}]}}));
  assert.equal(app.requests.some(r=>r.path.includes('/files?')),false);
  const review=app.root.findAllByType('button').find(b=>b.children.includes('Confirm reviewed collection consent'));
  assert.equal(review.props.disabled,false);await app.update(()=>review.props.onClick());
  assert.equal(app.root.findAllByProps({role:'dialog'}).length,0);
  await app.update(()=>app.context.openRecord('evidence',evidence.id));assert.equal(upload().props.disabled,false);
  await app.update(()=>taskField(app.root,'Consent reference','textarea').props.onChange({target:{value:'Changed unsaved scope'}}));
  assert.equal(upload().props.disabled,true);
 });
});
test('a delayed evidence upload cannot attach a file to a different editor',async()=>{
 await fixture({},async app=>{
  const evidence=await openSavedEvidence(app);const review=app.root.findAllByType('button').find(b=>b.children.includes('Confirm reviewed collection consent'));await app.update(()=>review.props.onClick());
  await app.update(()=>app.context.openRecord('evidence',evidence.id));
  const held=app.holdNext(`/api/teams/${teamId}/files?evidence=${evidence.id}`,'POST');let pending;
  await app.update(()=>{pending=app.root.findByProps({type:'file'}).props.onChange({target:{files:[{size:20,type:'application/pdf',name:'fictional.pdf'}]}});});await held.started;
  await app.update(()=>app.root.findByProps({'aria-label':'Close dialog'}).props.onClick());
  await app.update(()=>app.root.findAllByType('button').find(b=>b.children.includes('Add evidence')).props.onClick());
  await app.update(async()=>{held.release();await pending;});assert.equal(app.text.includes('uploaded-private-file'),false);
  assert.equal(app.root.findAllByType('button').find(b=>b.children.includes('Save evidence')).props.disabled,false);
 });
});

test('robot reference editing merges a teammate change to a different reference field',async()=>{
 await fixture({},async app=>{
  await app.update(()=>app.context.openRecord('resources','robot-reference'));
  await app.update(()=>app.root.findAllByType('button').find(b=>b.children.includes(' Edit reference')).props.onClick());
  await app.update(()=>taskField(app.root,'What our robot does','textarea').props.onChange({target:{value:'My revised mechanism purpose'}}));
  app.state.data.robot={...app.state.data.robot,repairs:'Teammate replacement repair log'};app.state.version++;await app.focus();
  await app.update(()=>app.root.findAllByType('form').find(f=>f.props.className==='stack').props.onSubmit({preventDefault(){}}));await app.update(()=>app.context.cloud.save());
  assert.equal(app.state.data.robot.purpose,'My revised mechanism purpose');assert.equal(app.state.data.robot.repairs,'Teammate replacement repair log');
 });
});
test('parts removed while their editor is open cannot be recreated accidentally',async()=>{
 await fixture({},async app=>{
  const part={id:'synthetic-spare',name:'Fictional spare',subsystem:'Intake',quantity:1,location:'Approved storage',source:'',notes:''};
  await app.update(()=>app.context.setData(d=>({...d,parts:[part]})));await app.update(()=>app.context.cloud.save());
  await app.update(()=>app.context.openRecord('resources','robot-reference'));
  await app.update(()=>app.root.findAllByType('button').find(b=>b.children.includes('Edit')).props.onClick());
  await app.update(()=>taskField(app.root,'Part name').props.onChange({target:{value:'Retained part draft'}}));
  app.state.data.parts=[];app.state.version++;await app.focus();
  await app.update(()=>app.root.findAllByType('form').find(f=>f.props.className==='stack').props.onSubmit({preventDefault(){}}));
  assert.deepEqual(app.context.data.parts,[]);assert.equal(taskField(app.root,'Part name').props.value,'Retained part draft');assert.match(app.context.notice.message,/teammate changed parts/);
 });
});

test('removed-record Undo cannot restore a prior team or account record after switching',async()=>{
 for(const change of ['team','account'])await fixture({},async app=>{
  const task=app.context.data.tasks.find(t=>!app.context.data.tasks.some(other=>other.dependencies.includes(t.id)));
  await app.update(()=>app.context.removeRecord('tasks',task.id));const undo=app.context.notice.action;assert.equal(typeof undo,'function');await app.update(()=>app.context.cloud.save());
  if(change==='team')app.state.teamId='second-private-team';else app.state.user='account-b';
  app.state.data={...createDemoData(),teamId:app.state.teamId||teamId,tasks:[]};app.state.version++;await app.focus();
  await app.update(()=>app.context.cloud.openTeam(app.state.teamId||teamId));
  const before=structuredClone(app.context.data);await app.update(()=>undo());
  assert.deepEqual(app.context.data,before);assert.equal(app.context.data.tasks.some(t=>t.id===task.id),false);assert.match(app.context.notice.message,/different account, team, season/);
 });
});
test('removal Undo preserves a record with the same id that was restored by a teammate',async()=>{
 await fixture({},async app=>{
  const task=app.context.data.tasks.find(t=>!app.context.data.tasks.some(other=>other.dependencies.includes(t.id)));
  await app.update(()=>app.context.removeRecord('tasks',task.id));const undo=app.context.notice.action;await app.update(()=>app.context.cloud.save());
  app.state.data.tasks.push({...task,title:'New teammate restored version'});app.state.version++;await app.focus();await app.update(()=>undo());
  assert.equal(app.context.data.tasks.filter(t=>t.id===task.id).length,1);assert.equal(app.context.data.tasks.find(t=>t.id===task.id).title,'New teammate restored version');assert.match(app.context.notice.message,/already exists/);
 });
});
