import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite-legacy";
import {database} from "./sql-fixture.mjs";

const vite=await createServer({configFile:false,cacheDir:".sites-runtime/test-cancel-"+process.pid,server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {service}=await vite.ssrLoadModule("/server/service.ts");
const {isMaintenanceRequest}=await vite.ssrLoadModule("/server/readiness.ts");
const scope={accessModel:"self-service",allowedTeamIds:[],adultAccountIds:[],teamCreationAccountIds:[]};
function fixture(){
 const db=database(),bucket={fail:false,async delete(){if(this.fail)throw new Error("synthetic outage");},async get(){return null;},async put(){}};
 return {db,bucket,request(user,path,method="GET",body){return service(new Request("https://team.test/api"+path,{method,headers:{origin:"https://team.test","Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)}),db,bucket,user?{userId:user}:null,scope);}};
}
async function pendingTeam(f){
 const r=await f.request("founder","/teams","POST",{creatorType:"student",studentConfirmed:true,teamName:"Test team",name:"A."});
 assert.equal(r.status,201);return (await r.json()).id;
}
const cancel=(f,id,user="founder",data={baseVersion:1,confirmation:"Test team"})=>f.request(user,`/teams/${id}/privacy/erase`,"DELETE",data);

test("only the pending founder can cancel a correctly confirmed team",async()=>{
 const f=fixture();try{
  const id=await pendingTeam(f);
  assert.notEqual((await cancel(f,id,"other")).status,200);
  assert.equal((await cancel(f,id,"founder",{baseVersion:1,confirmation:"wrong"})).status,409);
  assert.equal((await cancel(f,id)).status,200);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM teams WHERE id=?").get(id).n,0);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM memberships WHERE team_id=?").get(id).n,0);
  assert.equal(f.db.sqlite.prepare("SELECT status FROM team_erasures WHERE team_id=?").get(id).status,"complete");
 }finally{f.db.close();}
});

test("an adult joining before the cancellation claim prevents deletion",async()=>{
 const f=fixture();try{
  const id=await pendingTeam(f);
  f.db.beforeRun=sql=>{if(sql.startsWith("INSERT OR IGNORE INTO team_erasures")){f.db.beforeRun=null;f.db.sqlite.prepare("INSERT INTO memberships(team_id,user_id,name,role) VALUES(?,?,?,'admin')").run(id,"adult","Coach");}};
  assert.equal((await cancel(f,id)).status,409);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM teams WHERE id=?").get(id).n,1);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM team_erasures WHERE team_id=?").get(id).n,0);
 }finally{f.db.close();}
});

test("a founder cannot delete a team after another student joins",async()=>{
 const f=fixture();try{
  const id=await pendingTeam(f);
  const invite=await (await f.request("founder",`/teams/${id}/invites`,"POST",{role:"student"})).json();
  assert.equal((await f.request("teammate","/join","POST",{token:invite.token,name:"B.",studentConfirmed:true})).status,200);
  assert.equal((await cancel(f,id)).status,409);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM memberships WHERE team_id=?").get(id).n,2);
 }finally{f.db.close();}
});

test("simultaneous cancellation requests create only one cleanup claim",async()=>{
 const f=fixture();try{
  const id=await pendingTeam(f);
  const responses=await Promise.all([cancel(f,id),cancel(f,id)]),statuses=responses.map(r=>r.status).sort();
  assert.equal(statuses.filter(status=>status===200).length,1);
  assert.ok([403,409].includes(statuses.find(status=>status!==200)));
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM team_erasures WHERE team_id=?").get(id).n,1);
 }finally{f.db.close();}
});

test("pending storage cleanup is actor-bound, recoverable, and blocks an adult invitation",async()=>{
 const f=fixture();try{
  const id=await pendingTeam(f);
  const invitation=await (await f.request("founder",`/teams/${id}/invites`,"POST",{role:"admin"})).json();
  f.db.sqlite.prepare("INSERT INTO files(id,team_id,evidence_id,name,type,size,actor,created,upload_state) VALUES(?,?,?,?,?,?,?,?,?)").run("file",id,"e","file.pdf","application/pdf",1,"founder",new Date().toISOString(),"ready");
  f.bucket.fail=true;const first=await cancel(f,id);assert.equal(first.status,202);const job=await first.json();assert.equal(job.status,"pending");
  assert.equal((await f.request("adult","/join","POST",{token:invitation.token,name:"Coach",adultConfirmed:true})).status,423);
  assert.notEqual((await cancel(f,id,"other",{jobId:job.jobId})).status,200);
  const receipt=await (await f.request("founder",`/teams/${id}/privacy/erase`)).json();assert.equal(receipt.job.jobId,job.jobId);
  f.bucket.fail=false;const retry=await cancel(f,id,"founder",{jobId:job.jobId});assert.equal(retry.status,200);assert.equal((await retry.json()).status,"complete");
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM teams WHERE id=?").get(id).n,0);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM memberships WHERE team_id=?").get(id).n,0);
  assert.equal((await cancel(f,id,"founder",{jobId:job.jobId})).status,200);
  assert.equal((await (await f.request("founder",`/teams/${id}/privacy/erase`)).json()).job.status,"complete");
 }finally{f.db.close();}
});

test("founder erasure uses the narrowly allowed maintenance route while the release is paused",()=>{
 assert.equal(isMaintenanceRequest(new Request("https://team.test/api/teams/team-a/privacy/erase",{method:"DELETE"})),true);
 assert.equal(isMaintenanceRequest(new Request("https://team.test/api/teams/team-a/pending-team",{method:"DELETE"})),false);
});
