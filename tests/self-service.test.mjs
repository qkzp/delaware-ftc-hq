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
  assert.equal((await f.request("student","/join","POST",{name:"Student",token:studentToken},scope)).status,200);
  assert.equal((await f.request("coach",`/teams/${team}/members`,"PUT",{userId:"student",role:"admin"},scope)).status,403);
  const adultToken=await invite("mentor");
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken},scope)).status,400);
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken,adultConfirmed:true},scope)).status,200);
  assert.equal((await f.request("coach",`/teams/${team}/members`,"PUT",{userId:"adult",role:"admin"},scope)).status,200);
  assert.equal((await f.request("student",`/teams/${team}/invites`,"POST",{role:"admin"},scope)).status,403);
 } finally {f.db.close();}
});

test("a student founder can invite a responsible adult while team activity waits for supervision",async()=>{
 const f=fixture(service);
 try {
  const create={name:"Student A.",teamName:"Student team",creatorType:"student"};
  assert.equal((await f.request("founder","/teams","POST",create,scope)).status,400);
  const created=await f.request("founder","/teams","POST",{...create,studentConfirmed:true},scope);
  assert.equal(created.status,201);const team=(await created.json()).id;
  const teamState=await(await f.request("founder",`/teams/${team}`,"GET",undefined,scope)).json();
  assert.equal(teamState.role,"lead");assert.equal(teamState.canInvite,true);assert.equal(teamState.adultSupervisionPending,true);
  assert.equal((await f.request("founder",`/teams/${team}/chat`,"GET",undefined,scope)).status,423);
  assert.equal((await f.request("founder",`/teams/${team}`,"PUT",{data:teamState.data,baseVersion:teamState.version},scope)).status,423);
  assert.equal((await f.request("founder",`/teams/${team}/members`,"PUT",{userId:"founder",role:"admin"},scope)).status,423);
  const invite=async role=>(await(await f.request("founder",`/teams/${team}/invites`,"POST",{role},scope)).json()).token;
  const studentToken=await invite("student");
  assert.equal((await f.request("teammate","/join","POST",{name:"Teammate",token:studentToken},scope)).status,403);
  const adultToken=await invite("admin");
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken},scope)).status,400);
  assert.equal((await f.request("adult","/join","POST",{name:"Adult",token:adultToken,adultConfirmed:true},scope)).status,200);
  assert.equal((await f.request("teammate","/join","POST",{name:"Teammate",token:studentToken},scope)).status,200);
  const after=await(await f.request("founder",`/teams/${team}`,"GET",undefined,scope)).json();
  assert.equal(after.adultSupervisionPending,false);assert.equal(after.canInvite,true);
  const leadToken=await invite("lead");
  assert.equal((await f.request("otherlead","/join","POST",{name:"Other lead",token:leadToken},scope)).status,200);
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
