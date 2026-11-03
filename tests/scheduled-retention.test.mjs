import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite-legacy";
import {database} from "./sql-fixture.mjs";

const vite=await createServer({configFile:false,cacheDir:".sites-runtime/test-cache-retention-"+process.pid,server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {authorizeRetention,handleRetentionRequest,runScheduledRetention}=await vite.ssrLoadModule("/server/retention.ts");

test("scheduled cleanup rejects missing, malformed and non-ASCII credentials without throwing",()=>{
 assert.equal(authorizeRetention("Bearer test-secret","test-secret"),true);
 for(const [header,secret] of [[null,"test-secret"],["Bearer anything",""],["Bearer Xest-secret","test-secret"],["Bearer t\u00e9st-secret","test-secret"],["Basic test-secret","test-secret"]])assert.equal(authorizeRetention(header,secret),false);
});

test("the cleanup endpoint denies bad credentials before storage and never caches or exposes storage failures",async()=>{
 const secret="test-secret",request=value=>new Request("https://fictional.test/api/maintenance/retention",{headers:value?{authorization:value}:{}});
 let touched=false;
 for(const header of [null,"Bearer wrong-secret","Bearer t\u00e9st-secret"]){
  const response=await handleRetentionRequest(request(header),secret,()=>{touched=true;throw new Error("must not execute");});
  assert.equal(response.status,401);assert.match(response.headers.get("cache-control"),/no-store/);assert.equal(touched,false);
 }
 for(const storage of [()=>null,()=>{throw new Error("provider secret diagnostic");}]){
  const response=await handleRetentionRequest(request("Bearer "+secret),secret,storage);
  assert.equal(response.status,503);assert.match(response.headers.get("cache-control"),/no-store/);assert.doesNotMatch(await response.text(),/provider secret diagnostic|test-secret/);
 }
 const db=database();try{
  const response=await handleRetentionRequest(request("Bearer "+secret),secret,()=>db);
  assert.equal(response.status,200);assert.match(response.headers.get("cache-control"),/no-store/);assert.deepEqual(await response.json(),{ok:true});
 }finally{db.close();}
});

test("scheduled cleanup applies each fictional team's retention without deleting active or open records",async()=>{
 const db=database(),now=Date.parse("2026-11-02T12:00:00.000Z"),day=86400000,at=days=>new Date(now-days*day).toISOString();
 try{
  const sql=db.sqlite;
  const settings=sql.prepare("INSERT INTO team_privacy(team_id,revision_retention_days,updated) VALUES(?,?,?)");
  settings.run("short",7,at(0));settings.run("long",30,at(0));
  const revision=sql.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) VALUES(?,?,1,'fictional',?,'{}')");
  revision.run("short-old","short",at(8));revision.run("short-new","short",at(6));revision.run("long-old","long",at(31));revision.run("long-new","long",at(8));revision.run("default-old","default",at(31));revision.run("default-new","default",at(29));
  const invite=sql.prepare("INSERT INTO invitations(id,team_id,hash,role,expires,used_by,created_by) VALUES(?,?,?,'student',?,?,'fictional')");
  invite.run("expired","short","hash-1",at(1),null);invite.run("used","long","hash-2",at(-1),"fictional");invite.run("valid","long","hash-3",at(-1),null);
  const request=sql.prepare("INSERT INTO privacy_requests(id,team_id,user_id,kind,message,status,created,updated) VALUES(?,?,'fictional','concern','fictional',?,?,?)");
  request.run("resolved-old","short","resolved",at(40),at(31));request.run("rejected-old","long","rejected",at(40),at(31));request.run("resolved-recent","short","resolved",at(40),at(29));request.run("open-old","long","open",at(40),at(40));
  const message=sql.prepare("INSERT INTO chat_messages(id,team_id,sender_id,body,created) VALUES(?,?,'fictional','fictional',?)");
  sql.prepare("INSERT INTO chat_settings(team_id,retention_days,updated) VALUES('short',1,?)").run(at(0));message.run("chat-old","short",at(2));message.run("chat-new","short",at(0));
  sql.prepare("INSERT INTO auth_verification_tokens(identifier,token,expires) VALUES('fictional','expired',?),('fictional','valid',?)").run(now,now+day);
  sql.prepare("INSERT INTO auth_email_rate(id,recipient_hash,created) VALUES('old','fictional',?),('new','fictional',?)").run(now-2*day,now);
  await runScheduledRetention(db,now);
  const ids=table=>sql.prepare(`SELECT id FROM ${table} ORDER BY id`).all().map(row=>row.id);
  assert.deepEqual(ids("revisions"),["default-new","long-new","short-new"]);
  assert.deepEqual(ids("invitations"),["valid"]);
  assert.deepEqual(ids("privacy_requests"),["open-old","resolved-recent"]);
  assert.deepEqual(ids("chat_messages"),["chat-new"]);
  assert.deepEqual(sql.prepare("SELECT token FROM auth_verification_tokens").all().map(row=>row.token),["valid"]);
  assert.deepEqual(ids("auth_email_rate"),["new"]);
 }finally{db.close();}
});

test("cleanup reads the current team retention inside its transaction and rolls back when a later query fails",async()=>{
 const db=database(),now=Date.parse("2026-11-02T12:00:00.000Z"),old=new Date(now-10*86400000).toISOString();
 try{
  db.sqlite.prepare("INSERT INTO team_privacy(team_id,revision_retention_days,updated) VALUES('fictional',7,?)").run(old);
  db.sqlite.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) VALUES('kept','fictional',1,'fictional',?,'{}')").run(old);
  db.beforeRun=sql=>{if(sql.startsWith("DELETE FROM revisions")){db.beforeRun=null;db.sqlite.prepare("UPDATE team_privacy SET revision_retention_days=30 WHERE team_id='fictional'").run();}};
  await runScheduledRetention(db,now);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM revisions WHERE id='kept'").get().n,1);
  db.sqlite.prepare("INSERT INTO auth_verification_tokens(identifier,token,expires) VALUES('fictional','must-survive',?)").run(now-1);
  db.beforeRun=sql=>{if(sql.startsWith("DELETE FROM invitations"))throw new Error("simulated failure");};
  await assert.rejects(runScheduledRetention(db,now),/simulated failure/);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM auth_verification_tokens WHERE token='must-survive'").get().n,1);
 }finally{db.close();}
});

test("scheduled cleanup keeps at most 30 newest revisions separately for each fictional team",async()=>{
 const db=database(),now=Date.parse("2026-11-02T12:00:00.000Z"),recent=new Date(now-86400000).toISOString();
 try{
  const insert=db.sqlite.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) VALUES(?,?,?,'fictional',?,'{}')");
  for(const [team,count] of [["alpha",35],["beta",32],["gamma",5]])for(let index=0;index<count;index++)insert.run(`${team}-${index}`,team,index,recent);
  await runScheduledRetention(db,now);
  const versions=team=>db.sqlite.prepare("SELECT version FROM revisions WHERE team_id=? ORDER BY version").all(team).map(row=>row.version);
  assert.deepEqual(versions("alpha"),Array.from({length:30},(_,i)=>i+5));
  assert.deepEqual(versions("beta"),Array.from({length:30},(_,i)=>i+2));
  assert.deepEqual(versions("gamma"),[0,1,2,3,4]);
 }finally{db.close();}
});
