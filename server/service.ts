import type { AppData, Member, Role } from "../src/types";
import { createWorkspaceData } from "../src/workspace-data";
import { validateData } from "../src/persistence";
import { ApiError, manages, reviews, view, visibleEvidence, mergeWorkspace, rebaseWorkspace, assertTaskGraph, type Envelope } from "./policy";
import { actorHash, collectionAuthorized, handlePrivacy, privacySettings, pruneRetention, teamErasing, eraseTeam, cancelPendingStudentTeam, assertNoErasedEvidence, removeErasedEvidence } from "./privacy";
import {handleChat} from "./chat";
type User = {userId: string};
export type ServiceScope = {allowedTeamIds:string[];teamCreationAccountIds:string[];adultAccountIds:string[];accessModel?:"allowlist"|"self-service"};
const roles = ["student", "lead", "mentor", "admin"];
const json = (data: unknown, status = 200) => Response.json(data, {status,headers:{"Cache-Control":"no-store, private", "X-Content-Type-Options":"nosniff"}});
const hash = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2,"0")).join("");
const cleanName = (name: unknown) => String(name || "").trim().slice(0,40);
async function limitedBody(request:Request,limit:number,message:string):Promise<ArrayBuffer> {
 if(Number(request.headers.get("content-length")||0)>limit){void request.body?.cancel().catch(()=>{});throw new ApiError(413,message);}
 const reader=request.body?.getReader();if(!reader)return new ArrayBuffer(0);
 const chunks:Uint8Array[]=[];let length=0;
 try{
  while(true){const result=await reader.read();if(result.done)break;length+=result.value.byteLength;if(length>limit){void reader.cancel().catch(()=>{});throw new ApiError(413,message);}chunks.push(result.value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes.buffer;
}
async function body(request: Request) { const bytes=await limitedBody(request,2_000_000,"Workspace exceeds the 2 MB record limit. Store media as files.");try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,"Invalid JSON.");} }
export async function service(request: Request, db: D1Database, bucket: R2Bucket, user: User | null, scope?: ServiceScope): Promise<Response> {
 try {
  const url = new URL(request.url), path = url.pathname.split("/").filter(Boolean).slice(1);
  const selfService=scope?.accessModel==="self-service";
  if (path[0] === "session") {
   if (!user) return json({user:null,teams:[],accessModel:selfService?"self-service":"allowlist"});
   const query=selfService?"SELECT m.team_id AS id,m.name,m.role,json_extract(t.data,'$.workspace.teamName') AS teamName,CASE WHEN m.student_founder=1 AND m.role='lead' THEN 1 ELSE 0 END AS studentFounder,CASE WHEN NOT EXISTS(SELECT 1 FROM memberships a WHERE a.team_id=m.team_id AND a.role='admin') THEN 1 ELSE 0 END AS adultSupervisionPending FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.user_id=?":"SELECT m.team_id AS id,m.name,m.role,json_extract(t.data,'$.workspace.teamName') AS teamName FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.user_id=?";
   const {results} = await db.prepare(query).bind(user.userId).all();
   if(selfService)for(const team of results as any[]){team.studentFounder=!!team.studentFounder;team.adultSupervisionPending=!!team.adultSupervisionPending;}
   return json({user:{userId:user.userId},teams:results.filter((team:any)=>!scope||selfService||scope.allowedTeamIds.includes(team.id)),accessModel:selfService?"self-service":"allowlist"});
  }
  if (!user) throw new ApiError(401,"Sign in with your approved account to use a private team workspace.");
  if (!['GET','HEAD'].includes(request.method) && request.headers.get("origin") !== url.origin) throw new ApiError(403,"This change must come from MyFTCSpace.");
  if (path[0] === "teams" && path.length === 1 && request.method === "POST") {
   if(scope&&!selfService&&!scope.teamCreationAccountIds.includes(user.userId))throw new ApiError(403,"Team creation requires the approved adult operator.");
   const input = await body(request), name = cleanName(input.name), teamName = String(input.teamName || "").trim().slice(0,80);
   const studentFounder=selfService&&input.creatorType==="student";
   if(selfService&&input.creatorType!==undefined&&!['student','adult'].includes(input.creatorType))throw new ApiError(400,"Choose whether you are a student or adult.");
   if(studentFounder&&input.studentConfirmed!==true)throw new ApiError(400,"Confirm you are age 13–18 and have the required parent or guardian permission.");
   if(selfService&&!studentFounder&&input.adultConfirmed!==true)throw new ApiError(400,"Confirm that you are an adult age 18 or older before creating a team.");
   if (!name || !teamName) throw new ApiError(400,"Enter a team name and your display name.");
   const count = await db.prepare("SELECT count(*) AS n FROM memberships WHERE user_id=?").bind(user.userId).first<{n:number}>();
   if ((count?.n || 0) >= 10) throw new ApiError(400,"You can belong to at most ten teams.");
   let teamId=crypto.randomUUID();
   if(scope&&!selfService){
    const vacant=[];for(const approvedId of scope.allowedTeamIds)if(!(await db.prepare("SELECT 1 FROM teams WHERE id=? UNION ALL SELECT 1 FROM team_erasures WHERE team_id=?").bind(approvedId,approvedId).first()))vacant.push(approvedId);
    if(!vacant.length)throw new ApiError(403,"No unused team is included in the approved release. The adult owner must review an additional team before creation.");
    teamId=vacant[0];
   }
   const d=createWorkspaceData({teamId,teamName,county:["New Castle","Kent","Sussex","Statewide"].includes(input.county)?input.county:"Statewide"});
   const env:Envelope = {workspace:d,rsvps:{},learning:{}};
   const membership=studentFounder?db.prepare("INSERT INTO memberships(team_id,user_id,name,role,student_founder) SELECT id,?,?,'lead',1 FROM teams WHERE id=? AND changes()=1").bind(user.userId,name,teamId):db.prepare("INSERT INTO memberships(team_id,user_id,name,role) SELECT id,?,?,'admin' FROM teams WHERE id=? AND changes()=1").bind(user.userId,name,teamId);
   const result=await db.batch([db.prepare("INSERT INTO teams(id,data,version,updated) SELECT ?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM teams WHERE id=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?)").bind(teamId,JSON.stringify(env),new Date().toISOString(),teamId,teamId),membership]);
   if(!result[0].meta.changes||!result[1].meta.changes)throw new ApiError(409,"An approved team slot was used concurrently. Reload before creating a team.");
   return json({id:teamId},201);
  }
  if (path[0] === "join" && request.method === "POST") {
   const input=await body(request), name=cleanName(input.name); if(!name || typeof input.token!=="string" || input.token.length>200) throw new ApiError(400,"Enter your invitation code and display name.");
   const digest=await hash(input.token.trim()), invite=await db.prepare("SELECT * FROM invitations WHERE hash=? AND used_by IS NULL AND expires>?").bind(digest,new Date().toISOString()).first<any>();
   if(!invite) throw new ApiError(400,"Invitation expired, revoked, or already used.");
   if(scope&&!selfService&&!scope.allowedTeamIds.includes(invite.team_id))throw new ApiError(403,"This team is outside the approved release scope.");
   if(scope&&!selfService&&reviews(invite.role)&&!scope.adultAccountIds.includes(user.userId))throw new ApiError(403,"A mentor invitation requires an approved adult account.");
   if(selfService&&reviews(invite.role)&&input.adultConfirmed!==true)throw new ApiError(400,"Confirm that you are an adult age 18 or older to accept an adult invitation.");
   if(selfService&&!reviews(invite.role)&&!(await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND role='admin'").bind(invite.team_id).first()))throw new ApiError(403,"A responsible adult operator must join before students can join this team.");
   if(await teamErasing(db,invite.team_id))throw new ApiError(423,"This team is being permanently erased.");
   if(await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND user_id=?").bind(invite.team_id,user.userId).first()) throw new ApiError(400,"You already belong to this team.");
   const supervisedJoin=selfService&&!reviews(invite.role)?" AND EXISTS(SELECT 1 FROM memberships WHERE team_id=invitations.team_id AND role='admin')":"";
   const r=await db.batch([db.prepare("INSERT INTO memberships(team_id,user_id,name,role) SELECT team_id,?,?,role FROM invitations WHERE id=? AND used_by IS NULL AND expires>? AND EXISTS(SELECT 1 FROM teams WHERE id=invitations.team_id) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=invitations.team_id) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=invitations.team_id AND paused=1)"+supervisedJoin).bind(user.userId,name,invite.id,new Date().toISOString()),db.prepare("UPDATE invitations SET used_by=? WHERE id=? AND used_by IS NULL AND EXISTS(SELECT 1 FROM memberships WHERE team_id=invitations.team_id AND user_id=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=invitations.team_id)").bind(user.userId,invite.id,user.userId)]);
   if(!r[0].meta.changes) throw new ApiError(409,"This invitation was already used.");
   return json({id:invite.team_id});
  }
  if (path[0] !== "teams" || !path[1]) throw new ApiError(404,"Endpoint not found.");
  const teamId=path[1];
  if(scope&&!selfService&&!scope.allowedTeamIds.includes(teamId))throw new ApiError(403,"This team is outside the approved release scope.");
  if(path[2]==="privacy"&&path[3]==="erase"&&path.length===4&&request.method==="GET"){
   const job=await db.prepare("SELECT job_id AS jobId,status FROM team_erasures WHERE team_id=? AND actor_hash=?").bind(teamId,await actorHash(teamId,user.userId)).first();
   const canInspect=await db.prepare(selfService?"SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND (role='admin' OR (role='lead' AND student_founder=1))":"SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role='admin'").bind(teamId,user.userId).first();
   if(!job&&!canInspect)throw new ApiError(403,"Only an authorized admin can inspect team erasure.");
   return json({job});
  }
  if(path[2]==="privacy"&&path[3]==="erase"&&path.length===4&&request.method==="DELETE"){
   if(scope&&!selfService&&!scope.adultAccountIds.includes(user.userId))throw new ApiError(403,"The approved adult must authorize erasure.");
   if(selfService&&await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role='lead' AND student_founder=1").bind(teamId,user.userId).first())return await cancelPendingStudentTeam(request,db,bucket,teamId,user.userId,await body(request));
   return await eraseTeam(request,db,bucket,teamId,user.userId,await body(request));
  }
  if(await teamErasing(db,teamId))throw new ApiError(423,"This team is being permanently erased; normal access is closed.");
  const member=await db.prepare(selfService?"SELECT user_id AS userId,name,role,student_founder FROM memberships WHERE team_id=? AND user_id=?":"SELECT user_id AS userId,name,role FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,user.userId).first<Member & {student_founder?:number}>();
  if(!member) throw new ApiError(403,"You are not a member of this team.");
  const founder=selfService&&member.role==="lead"&&member.student_founder===1;
  const adultSupervisionPending=selfService&&!(await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND role='admin'").bind(teamId).first());
  if(scope&&!selfService&&reviews(member.role)&&!scope.adultAccountIds.includes(user.userId))throw new ApiError(403,"This adult role is outside the approved adult roster.");
  const row=await db.prepare("SELECT * FROM teams WHERE id=?").bind(teamId).first<any>(); if(!row) throw new ApiError(404,"Team not found.");
  const envelope=JSON.parse(row.data) as Envelope;
  await pruneRetention(db,teamId);
  if(path[2]==="privacy") {
   if(scope&&!selfService&&!scope.adultAccountIds.includes(user.userId)&&(path[3]==="consent-review"||path.length===3&&request.method==="PUT"||path[3]==="requests"&&request.method==="PUT"))throw new ApiError(403,"An approved adult must perform this review.");
   return await handlePrivacy({request,db,bucket,teamId,userId:user.userId,member,row,envelope,path,input:['GET','HEAD'].includes(request.method)?{}:await body(request)});
  }
  const privacy=await privacySettings(db,teamId);
  if(privacy.paused&&!(path.length===2&&request.method==="GET"))throw new ApiError(423,"The team admin paused normal operations. Privacy requests and erasure remain available.");
  if(adultSupervisionPending&&path[2]==="chat")throw new ApiError(423,"A responsible adult operator must join before team chat opens.");
  if(adultSupervisionPending&&!['GET','HEAD'].includes(request.method)&&path[2]!=="invites"&&path[2]!=="privacy")throw new ApiError(423,"A responsible adult operator must join before shared team activity opens.");
  if(path[2]==="chat")return await handleChat({request,db,teamId,userId:user.userId,member,path,input:['GET','HEAD','DELETE'].includes(request.method)?{}:await body(request)});
  const members=async()=> (await db.prepare("SELECT user_id AS userId,name,role FROM memberships WHERE team_id=? ORDER BY name").bind(teamId).all<Member>()).results;
  const accessGuard=" AND EXISTS(SELECT 1 FROM memberships AS actor WHERE actor.team_id=? AND actor.user_id=? AND actor.role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)";
  const accessArgs=[teamId,user.userId,member.role,teamId,teamId];
  if(path.length===2 && request.method==="GET") return json({data:view(envelope,member.role,user.userId),version:row.version,members:await members(),role:member.role,updated:row.updated,canInvite:member.role==="admin"||founder,adultSupervisionPending});
  if(path.length===2 && request.method==="PUT") {
   const input=await body(request);
   if(input.accountId!==undefined&&input.accountId!==user.userId)throw new ApiError(401,"Your signed-in account changed. Reopen the workspace before saving.");
   if(!validateData(input.data)||!Number.isInteger(input.baseVersion)||input.baseVersion<1)throw new ApiError(400,"Invalid workspace or starting revision.");
   await assertNoErasedEvidence(db,teamId,input.data);
   let submitted=input.data;
   if(input.baseVersion !== row.version){const prior=await db.prepare("SELECT data FROM revisions WHERE team_id=? AND version=? ORDER BY created DESC LIMIT 1").bind(teamId,input.baseVersion).first<any>();if(!prior)throw new ApiError(409,"The starting revision is unavailable. Reload before saving.");submitted=rebaseWorkspace(view(JSON.parse(prior.data),member.role,user.userId),input.data,view(envelope,member.role,user.userId));}
   const next=mergeWorkspace(envelope,submitted,member.role,user.userId);
   await assertNoErasedEvidence(db,teamId,next.workspace);
   for(const evidence of next.workspace.evidence || []) if(evidence.fileId && !(await db.prepare("SELECT 1 FROM files WHERE id=? AND team_id=? AND evidence_id=? AND upload_state='ready'").bind(evidence.fileId,teamId,evidence.id).first())) throw new ApiError(400,"Media file does not belong to this evidence record.");
   const now=new Date().toISOString();
   const r=await db.batch([
    db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId),
    db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(JSON.stringify(next),now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId)
   ]);
   if(!r[1].meta.changes) throw new ApiError(409,"Your workspace or membership changed. Reload before saving.");
   await pruneRetention(db,teamId);
   return json({data:view(next,member.role,user.userId),version:row.version+1,members:await members(),role:member.role,updated:now});
  }
  if(path[2]==="invites") {
   if(member.role!=="admin"&&!founder) throw new ApiError(403,"Only a team admin or student founder can manage invitations.");
   const founderGuard=founder?" AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role='lead' AND student_founder=1)":"";
   const founderArgs=founder?[teamId,user.userId]:[];
   if(request.method==="GET") return json({invites:(await (founder?db.prepare("SELECT id,role,expires,used_by IS NOT NULL AS used FROM invitations WHERE team_id=? AND created_by=? ORDER BY expires DESC").bind(teamId,user.userId):db.prepare("SELECT id,role,expires,used_by IS NOT NULL AS used FROM invitations WHERE team_id=? ORDER BY expires DESC").bind(teamId)).all()).results});
   if(request.method==="POST") {const input=await body(request); if(!roles.includes(input.role)) throw new ApiError(400,"Choose a student, lead, coach or adult operator role."); const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),expires=new Date(Date.now()+48*3600000).toISOString(); const result=await db.prepare("INSERT INTO invitations(id,team_id,hash,role,expires,created_by) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM teams WHERE id=?)"+accessGuard+founderGuard).bind(id,teamId,await hash(token),input.role,expires,user.userId,teamId,...accessArgs,...founderArgs).run();if(!result.meta.changes)throw new ApiError(409,"Team access changed before invitation creation."); return json({token,expires});}
   if(request.method==="DELETE") {await db.prepare("DELETE FROM invitations WHERE id=? AND team_id=? AND used_by IS NULL"+(founder?" AND created_by=?":"")+accessGuard+founderGuard).bind(path[3],teamId,...(founder?[user.userId]:[]),...accessArgs,...founderArgs).run(); return json({ok:true});}
  }
  if(path[2]==="members" && request.method==="PUT") {
   const input=await body(request);
   if(input.userId===user.userId && input.name && input.role===member.role) {const result=await db.prepare("UPDATE memberships SET name=? WHERE team_id=? AND user_id=?"+accessGuard).bind(cleanName(input.name),teamId,user.userId,...accessArgs).run();if(!result.meta.changes)throw new ApiError(409,"Membership changed before renaming.");return json({ok:true});}
   if(member.role!=="admin" || !roles.includes(input.role)) throw new ApiError(403,"Only an admin can change member roles.");
   if(scope&&!selfService&&reviews(input.role)&&!scope.adultAccountIds.includes(input.userId))throw new ApiError(403,"Mentor and administrator roles require an approved adult account.");
   if(selfService&&reviews(input.role)){
    const target=await db.prepare("SELECT role FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,input.userId).first<{role:Role}>();
    if(!target||!reviews(target.role))throw new ApiError(403,"Adult roles require a new adult invitation and confirmation by the invitee.");
   }
   if(input.userId===user.userId) throw new ApiError(400,"You cannot demote your own admin membership.");
   const result=await db.prepare("UPDATE memberships SET role=?"+(selfService?",student_founder=CASE WHEN ?='lead' THEN student_founder ELSE 0 END":"")+" WHERE team_id=? AND user_id=?"+(selfService&&reviews(input.role)?" AND role IN ('mentor','admin')":"")+accessGuard).bind(input.role,...(selfService?[input.role]:[]),teamId,input.userId,...accessArgs).run();if(!result.meta.changes)throw new ApiError(409,"Membership changed before role assignment.");return json({ok:true});
  }
  if(path[2]==="members" && request.method==="DELETE") {
   if(member.role!=="admin" || path[3]===user.userId) throw new ApiError(403,"An admin may remove another member.");
   const result=await db.prepare("DELETE FROM memberships WHERE team_id=? AND user_id=?"+accessGuard).bind(teamId,path[3],...accessArgs).run();if(!result.meta.changes)throw new ApiError(409,"Membership changed before removal.");return json({ok:true});
  }
  if(path[2]==="learning" && request.method==="GET") { if(!reviews(member.role))throw new ApiError(403,"A mentor can review skill sign-offs.");return json({learning:(await members()).map(m=>({userId:m.userId,steps:envelope.learning[m.userId]?.steps||[],skills:envelope.learning[m.userId]?.skills||[]}))}); }
  if(path[2]==="learning" && request.method==="PUT") {
   if(!reviews(member.role)) throw new ApiError(403,"A mentor must sign off skills.");
   const input=await body(request); if(!Array.isArray(input.skills)|| !input.skills.every((s:unknown)=>['shop-safety','battery-safety','robot-startup','first-task'].includes(String(s)))) throw new ApiError(400,"Invalid skill sign-off.");
   if(!(await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,input.userId).first())) throw new ApiError(400,"Choose a team member.");
   const next=structuredClone(envelope); next.learning[input.userId]={steps:next.learning[input.userId]?.steps||[],skills:input.skills};
   const now=new Date().toISOString(); const r=await db.batch([db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId),db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(JSON.stringify(next),now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId)]);
   if(!r[1].meta.changes) throw new ApiError(409,"Workspace or membership changed. Reload before signing off skills."); await pruneRetention(db,teamId);return json({ok:true});
  }
  if(path[2]==="history") {
   if(!reviews(member.role)) throw new ApiError(403,"A mentor or admin can review private backups.");
   if(request.method==="GET") return json({history:(await db.prepare("SELECT id,version,actor,created FROM revisions WHERE team_id=? ORDER BY version DESC LIMIT 30").bind(teamId).all()).results});
   if(request.method==="POST") { const input=await body(request); if(member.role!=="admin") throw new ApiError(403,"An admin must restore a shared revision."); if(input.baseVersion!==row.version) throw new ApiError(409,"Reload before restoring a revision.");const revision=await db.prepare("SELECT data FROM revisions WHERE team_id=? AND id=?").bind(teamId,input.id).first<any>();if(!revision)throw new ApiError(404,"Revision not found.");const candidate=JSON.parse(revision.data);await removeErasedEvidence(db,teamId,candidate.workspace);if(!validateData(candidate.workspace)) throw new ApiError(400,"Revision is not valid.");const now=new Date().toISOString();const result=await db.batch([db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId),db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(JSON.stringify(candidate),now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId)]);if(!result[1].meta.changes)throw new ApiError(409,"Workspace or membership changed. Reload before restoring a revision.");await pruneRetention(db,teamId);return json({ok:true}); }
  }
  if(path[2]==="import" && request.method==="POST") {
   if(member.role!=="admin")throw new ApiError(403,"Only an admin can restore a shared backup.");
   const input=await body(request);if(input.baseVersion!==row.version)throw new ApiError(409,"Reload before importing a shared backup.");if(!validateData(input.data))throw new ApiError(400,"Choose a valid MyFTCSpace backup.");
   const candidate=structuredClone(input.data) as AppData,roster=await members(),ids=new Set(roster.map(m=>m.userId));
   candidate.teamId=teamId;candidate.seasonId=envelope.workspace.seasonId;candidate.onboarding=[];candidate.skills=[];
   const missingFiles:string[]=[];
   for(const key of ['tasks','events','sponsors','grants','resources','announcements','evidence'] as const){for(const record of candidate[key]||[]){record.teamId=teamId;record.seasonId=candidate.seasonId;if('owner' in record&&!ids.has(record.owner))record.owner=key==='evidence'?user.userId:'Unassigned';if(key==='events'){const event=record as AppData['events'][number];event.rsvp=false;event.verification='needs-review';event.verifiedAt='';event.verifiedBy='';}if(key==='resources')(record as AppData['resources'][number]).approved=false;if(key==='sponsors')(record as AppData['sponsors'][number]).draftStatus='Needs review';if(key==='evidence'){const evidence=record as NonNullable<AppData['evidence']>[number];evidence.approved=false;evidence.reviewedAt='';evidence.reviewedBy='';evidence.consentReviewedAt='';evidence.consentReviewedBy='';if(evidence.fileId&&!(await db.prepare("SELECT 1 FROM files WHERE id=? AND team_id=? AND evidence_id=? AND upload_state='ready'").bind(evidence.fileId,teamId,evidence.id).first())){missingFiles.push(evidence.title);evidence.fileId='';}}}}
   await removeErasedEvidence(db,teamId,candidate);
   if(!validateData(candidate))throw new ApiError(400,"The backup could not be converted to this team.");
   assertTaskGraph(candidate.tasks);
   for(const grant of candidate.grants){grant.confirmed=false;grant.stale=true;}
   for(const sponsor of candidate.sponsors)sponsor.stale=true;
   const next={...envelope,workspace:candidate},now=new Date().toISOString();
   const result=await db.batch([db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId),db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(JSON.stringify(next),now,teamId,row.version,teamId,user.userId,member.role,teamId,teamId)]);
   if(!result[1].meta.changes)throw new ApiError(409,"Workspace or membership changed. Review the latest revision.");await pruneRetention(db,teamId);return json({ok:true,missingFiles});
  }
  if(path[2]==="files") {
   if(request.method==="POST") {
    const evidenceId=url.searchParams.get("evidence")||"",evidence=envelope.workspace.evidence?.find(e=>e.id===evidenceId);
    if(!evidence || (!manages(member.role)&&evidence.owner!==user.userId)) throw new ApiError(403,"Save your evidence record before adding a file.");
    if(!privacy.uploadsEnabled)throw new ApiError(403,"Uploads are disabled until the team adult approves the collection and file-handling process.");
    if(!collectionAuthorized(evidence))throw new ApiError(403,"A mentor must review the saved collection-consent reference before uploading media.");
    const type=request.headers.get("content-type")?.split(";")[0]||"";
    if(!['image/png','image/jpeg','image/webp','application/pdf','video/mp4'].includes(type)) throw new ApiError(400,"Use PNG, JPEG, WebP, PDF, or MP4.");
    const bytes=await limitedBody(request,12*1024*1024,"Choose a file under 12 MB.");if(!bytes.byteLength)throw new ApiError(413,"Choose a file under 12 MB.");
    const head=new Uint8Array(bytes), sig=new TextDecoder().decode(head.slice(0,16));
    const valid= type==='image/png'?head[0]===137&&sig.slice(1,4)==='PNG':type==='image/jpeg'?head[0]===255&&head[1]===216:type==='image/webp'?sig.startsWith('RIFF')&&sig.slice(8,12)==='WEBP':type==='application/pdf'?sig.startsWith('%PDF-'):sig.slice(4,8)==='ftyp';
    if(!valid)throw new ApiError(400,"File contents do not match its type.");
    const id=crypto.randomUUID(), name=(request.headers.get("x-file-name")||"evidence").replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,100);
    const staging=await db.prepare("INSERT INTO files(id,team_id,evidence_id,name,type,size,actor,created,upload_state) SELECT ?,?,?,?,?,?,?,?,'uploading' WHERE EXISTS(SELECT 1 FROM teams WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=0 AND uploads_enabled=1) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM evidence_erasures WHERE team_id=? AND evidence_id=?)").bind(id,teamId,evidenceId,name,type,bytes.byteLength,user.userId,new Date().toISOString(),teamId,row.version,teamId,user.userId,member.role,teamId,teamId,teamId,evidenceId).run();
    if(!staging.meta.changes)throw new ApiError(409,"Evidence or team access changed before upload. Reload before retrying.");
    try {
     await bucket.put(`${teamId}/${id}`,bytes,{httpMetadata:{contentType:type}});
     const saved=await db.prepare("UPDATE files SET upload_state='ready' WHERE id=? AND team_id=? AND upload_state='uploading' AND EXISTS(SELECT 1 FROM teams WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=0 AND uploads_enabled=1) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM evidence_erasures WHERE team_id=? AND evidence_id=?)").bind(id,teamId,teamId,row.version,teamId,user.userId,member.role,teamId,teamId,teamId,evidenceId).run();
     if(!saved.meta.changes)throw new ApiError(409,"Evidence, consent, membership or privacy settings changed during upload. Reload and review before retrying.");
    }catch(error){
     // Keep durable ownership of failed/partial objects until storage deletion succeeds.
     try{await db.prepare("UPDATE files SET upload_state='cleanup' WHERE id=? AND team_id=?").bind(id,teamId).run();}catch{}
     try{await bucket.delete(`${teamId}/${id}`);await db.prepare("DELETE FROM files WHERE id=? AND team_id=? AND upload_state!='ready'").bind(id,teamId).run();}
     catch{throw new ApiError(503,"The upload was not accepted. Its private storage cleanup is tracked and must be retried by the team adult.");}
     throw error;
    }
    return json({id,name},201);
   }
   if(request.method==="GET" && path[3]) {
    const file=await db.prepare("SELECT * FROM files WHERE id=? AND team_id=?").bind(path[3],teamId).first<any>();
    const evidence=file&&envelope.workspace.evidence?.find(e=>e.id===file.evidence_id);
    const privileged=manages(member.role)||evidence?.owner===user.userId;
    if(!file || file.upload_state!=='ready' || !evidence || !visibleEvidence(evidence,member.role,user.userId) || !privileged&&evidence.fileId!==file.id || await db.prepare("SELECT 1 FROM evidence_erasures WHERE team_id=? AND evidence_id=?").bind(teamId,file.evidence_id).first()) throw new ApiError(404,"File is unavailable.");
    const object=await bucket.get(`${teamId}/${file.id}`);if(!object)throw new ApiError(404,"File not found.");
    return new Response(object.body,{headers:{"Content-Type":file.type,"Content-Disposition":`attachment; filename="${file.name}"`,"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}});
   }
  }
  throw new ApiError(404,"Endpoint not found.");
 } catch(error) {return json({error:error instanceof ApiError?error.message:"The server could not complete this request. Your saved records are unchanged."},error instanceof ApiError?error.status:500);}
}
