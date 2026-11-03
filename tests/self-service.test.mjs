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
