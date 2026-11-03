import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite-legacy";
import {fixture} from "./sql-fixture.mjs";
const vite=await createServer({configFile:false,cacheDir:".sites-runtime/test-cache-"+process.pid,server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {service}=await vite.ssrLoadModule("/server/service.ts");
const scope={accessModel:"self-service",allowedTeamIds:[],adultAccountIds:[],teamCreationAccountIds:[]};

test("self-service requires adult attestation and keeps independent teams private",async()=>{
 const f=fixture(service);
 try {
  assert.equal((await f.request("coach","/teams","POST",{name:"Coach",teamName:"Robots"},scope)).status,400);
  const first=await f.request("coach","/teams","POST",{name:"Coach",teamName:"Robots",adultConfirmed:true},scope);
  assert.equal(first.status,201);const team=(await first.json()).id;
  const second=await f.request("other","/teams","POST",{name:"Other",teamName:"Another team",adultConfirmed:true},scope);
  assert.equal(second.status,201);const otherTeam=(await second.json()).id;
  assert.notEqual(team,otherTeam);
  assert.equal((await f.request("other",`/teams/${team}`,"GET",undefined,scope)).status,403);
  assert.equal((await f.request("coach",`/teams/${otherTeam}`,"GET",undefined,scope)).status,403);
  const session=await (await f.request("coach","/session","GET",undefined,scope)).json();
  assert.deepEqual(session.teams.map(x=>x.id),[team]);
 } finally {f.db.close();}
});

test("adult invitations require confirmation and students cannot be promoted around it",async()=>{
 const f=fixture(service);
 try {
  const created=await f.request("coach","/teams","POST",{name:"Coach",teamName:"Robots",adultConfirmed:true},scope);
  const team=(await created.json()).id;
  const invite=async role=>(await(await f.request("coach",`/teams/${team}/invites`,"POST",{role},scope)).json()).token;
  const studentToken=await invite("student");
  assert.equal((await f.request("student","/join","POST",{name:"Student",token:studentToken},scope)).status,400);
  assert.equal((await f.request("student","/join","POST",{name:"Student",token:studentToken,studentConfirmed:true},scope)).status,200);
  assert.equal((await f.request("coach",`/teams/${team}/members`,"PUT",{userId:"student",role:"admin"},scope)).status,403);
  const adultToken=await invite("mentor");
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken},scope)).status,400);
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken,adultConfirmed:true},scope)).status,200);
  assert.equal((await f.request("coach",`/teams/${team}/members`,"PUT",{userId:"adult",role:"admin"},scope)).status,200);
  assert.equal((await f.request("student",`/teams/${team}/invites`,"POST",{role:"admin"},scope)).status,403);
 } finally {f.db.close();}
});

test("a student founder can invite and manage teammates without an adult operator",async()=>{
 const f=fixture(service);
 try {
  const create={name:"Student A.",teamName:"Student team",creatorType:"student"};
  assert.equal((await f.request("founder","/teams","POST",create,scope)).status,400);
  const created=await f.request("founder","/teams","POST",{...create,studentConfirmed:true},scope);
  assert.equal(created.status,201);const team=(await created.json()).id;
  const teamState=await(await f.request("founder",`/teams/${team}`,"GET",undefined,scope)).json();
  assert.equal(teamState.role,"lead");assert.equal(teamState.canInvite,true);assert.equal(teamState.adultSupervisionPending,true);
  assert.equal((await f.request("founder",`/teams/${team}/chat`,"GET",undefined,scope)).status,200);
  assert.equal((await f.request("founder",`/teams/${team}`,"PUT",{data:teamState.data,baseVersion:teamState.version},scope)).status,200);
  assert.equal((await f.request("founder",`/teams/${team}/members`,"PUT",{userId:"founder",role:"admin"},scope)).status,403);
  const invite=async role=>(await(await f.request("founder",`/teams/${team}/invites`,"POST",{role},scope)).json()).token;
  const studentToken=await invite("student");
  assert.equal((await f.request("teammate","/join","POST",{name:"Teammate",token:studentToken},scope)).status,400);
  assert.equal((await f.request("teammate","/join","POST",{name:"Teammate",token:studentToken,studentConfirmed:true},scope)).status,200);
  assert.equal((await f.request("teammate",`/teams/${team}/invites`,"POST",{role:"student"},scope)).status,403);
  const mentorToken=await invite("mentor");
  assert.equal((await f.request("mentor","/join","POST",{name:"Mentor",token:mentorToken,adultConfirmed:true},scope)).status,200);
  assert.notEqual((await f.request("founder",`/teams/${team}/members/mentor`,"DELETE",undefined,scope)).status,200);
  assert.equal((await f.request("founder",`/teams/${team}/members/founder`,"DELETE",undefined,scope)).status,403);
  assert.equal((await f.request("founder",`/teams/${team}/members/teammate`,"DELETE",undefined,scope)).status,200);
  const replacement=await invite("student");
  assert.equal((await f.request("teammate","/join","POST",{name:"Teammate",token:replacement,studentConfirmed:true},scope)).status,200);
  const adultToken=await invite("admin");
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken},scope)).status,400);
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken,adultConfirmed:true},scope)).status,200);
  assert.notEqual((await f.request("founder",`/teams/${team}/members/adult`,"DELETE",undefined,scope)).status,200);
  const after=await(await f.request("founder",`/teams/${team}`,"GET",undefined,scope)).json();
  assert.equal(after.adultSupervisionPending,false);assert.equal(after.canInvite,true);
  const leadToken=await invite("lead");
  assert.equal((await f.request("otherlead","/join","POST",{name:"Other lead",token:leadToken,studentConfirmed:true},scope)).status,200);
  assert.equal((await f.request("otherlead",`/teams/${team}/invites`,"POST",{role:"admin"},scope)).status,403);
  assert.equal((await f.request("founder",`/teams/${team}/members`,"PUT",{userId:"founder",role:"admin"},scope)).status,403);
  assert.equal((await f.request("adult",`/teams/${team}/members`,"PUT",{userId:"founder",role:"student"},scope)).status,200);
  assert.equal((await f.request("adult",`/teams/${team}/members`,"PUT",{userId:"founder",role:"lead"},scope)).status,200);
  assert.equal((await f.request("founder",`/teams/${team}/invites`,"POST",{role:"student"},scope)).status,403);
 } finally {f.db.close();}
});

test("student founder invite creation rechecks the founder role atomically",async()=>{
 const f=fixture(service);
 try {
  const created=await f.request("founder","/teams","POST",{name:"Student",teamName:"Team",creatorType:"student",studentConfirmed:true},scope);
  const team=(await created.json()).id;
  f.db.beforeRun=sql=>{if(sql.startsWith("INSERT INTO invitations")){f.db.beforeRun=null;f.db.sqlite.prepare("UPDATE memberships SET role='student',student_founder=0 WHERE team_id=? AND user_id=?").run(team,"founder");}};
  assert.equal((await f.request("founder",`/teams/${team}/invites`,"POST",{role:"admin"},scope)).status,409);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM invitations WHERE team_id=?").get(team).n,0);
 } finally {f.db.close();}
});

test("student founder removal rechecks adult and target roles atomically",async()=>{
 for(const change of ["adult-joins","target-becomes-adult","founder-demoted"]){
  const f=fixture(service);try{
   const created=await f.request("founder","/teams","POST",{name:"Student",teamName:"Team",creatorType:"student",studentConfirmed:true},scope);
   const team=(await created.json()).id;
   const invitation=await(await f.request("founder",`/teams/${team}/invites`,"POST",{role:"student"},scope)).json();
   assert.equal((await f.request("student","/join","POST",{name:"Peer",token:invitation.token,studentConfirmed:true},scope)).status,200);
   f.db.beforeRun=sql=>{if(sql.startsWith("DELETE FROM memberships")){f.db.beforeRun=null;if(change==="adult-joins")f.db.sqlite.prepare("INSERT INTO memberships(team_id,user_id,name,role) VALUES(?,?,?,'admin')").run(team,"adult","Adult");else if(change==="target-becomes-adult")f.db.sqlite.prepare("UPDATE memberships SET role='mentor' WHERE team_id=? AND user_id='student'").run(team);else f.db.sqlite.prepare("UPDATE memberships SET role='student',student_founder=0 WHERE team_id=? AND user_id='founder'").run(team);}};
   assert.equal((await f.request("founder",`/teams/${team}/members/student`,"DELETE",undefined,scope)).status,409);
   assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM memberships WHERE team_id=? AND user_id='student'").get(team).n,1);
  }finally{f.db.close();}
 }
});
