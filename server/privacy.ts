import type { AppData, Evidence, Member } from "../src/types";
import { ApiError, reviews, type Envelope } from "./policy";

type Settings = { paused: boolean; uploadsEnabled: boolean; revisionRetentionDays: number; updated: string };
type Job = { job_id: string; actor_hash: string; status: string };
type Context = { request: Request; db: D1Database; bucket: R2Bucket; teamId: string; userId: string; member: Member; row: {data:string;version:number}; envelope: Envelope; path: string[]; input: any };
const response = (data: unknown, status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
export const actorHash = async (teamId:string,userId:string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(teamId+":"+userId)))].map(n=>n.toString(16).padStart(2,"0")).join("");
export function consentContext(e: Evidence): string {
 const {fileId,mediaUrl,approved,reviewedAt,reviewedBy,consentReviewedAt,consentReviewedBy,archived,...context}=e;
 return JSON.stringify(context);
}
export function collectionAuthorized(e: Evidence): boolean {
 return e.consent!=="Not recorded" && !!e.consentNote.trim() && !!e.consentReviewedBy && !!e.consentReviewedAt && Number.isFinite(Date.parse(e.consentReviewedAt));
}
export async function privacySettings(db:D1Database,teamId:string):Promise<Settings> {
 const row=await db.prepare("SELECT * FROM team_privacy WHERE team_id=?").bind(teamId).first<any>();
 return {paused:!!row?.paused,uploadsEnabled:!!row?.uploads_enabled,revisionRetentionDays:row?.revision_retention_days??30,updated:row?.updated||""};
}
export async function teamErasing(db:D1Database,teamId:string) { return !!await db.prepare("SELECT 1 FROM team_erasures WHERE team_id=?").bind(teamId).first(); }
export async function pruneRetention(db:D1Database,teamId:string) {
 const settings=await privacySettings(db,teamId),cutoff=new Date(Date.now()-settings.revisionRetentionDays*86400000).toISOString();
 for(const statement of [
 db.prepare("DELETE FROM revisions WHERE team_id=? AND (created<? OR id NOT IN (SELECT id FROM revisions WHERE team_id=? ORDER BY version DESC,created DESC LIMIT 30))").bind(teamId,cutoff,teamId),
 db.prepare("DELETE FROM invitations WHERE team_id=? AND (expires<=? OR used_by IS NOT NULL)").bind(teamId,new Date().toISOString()),
 db.prepare("DELETE FROM privacy_requests WHERE team_id=? AND status IN ('resolved','rejected') AND updated<?").bind(teamId,new Date(Date.now()-30*86400000).toISOString())])await statement.run();
}
export async function assertNoErasedEvidence(db:D1Database,teamId:string,data:AppData) {
 const {results}=await db.prepare("SELECT evidence_id FROM evidence_erasures WHERE team_id=?").bind(teamId).all<{evidence_id:string}>();
 if((data.evidence||[]).some(e=>results.some(x=>x.evidence_id===e.id)))throw new ApiError(409,"This evidence was permanently withdrawn. Reload; it cannot be restored from a backup.");
}
export async function removeErasedEvidence(db:D1Database,teamId:string,data:AppData) {
 const {results}=await db.prepare("SELECT evidence_id FROM evidence_erasures WHERE team_id=?").bind(teamId).all<{evidence_id:string}>();
 data.evidence=(data.evidence||[]).filter(e=>!results.some(x=>x.evidence_id===e.id));
}
async function deleteObjects(db:D1Database,bucket:R2Bucket,teamId:string,evidenceId?:string):Promise<boolean> {
 const q=evidenceId===undefined?db.prepare("SELECT id,upload_state FROM files WHERE team_id=?").bind(teamId):db.prepare("SELECT id,upload_state FROM files WHERE team_id=? AND evidence_id=?").bind(teamId,evidenceId);
 const {results}=await q.all<{id:string;upload_state:string}>();
 // Do not declare erasure complete while a storage write may still finish.
 // A process interrupted during upload remains tracked for operator reconciliation.
 if(results.some(file=>file.upload_state==='uploading'))return false;
 try {for(const f of results)await bucket.delete(teamId+"/"+f.id);return true;} catch {return false;}
}
export async function eraseTeam(request:Request,db:D1Database,bucket:R2Bucket,teamId:string,userId:string,input:any):Promise<Response> {
 const digest=await actorHash(teamId,userId);let job=await db.prepare("SELECT * FROM team_erasures WHERE team_id=?").bind(teamId).first<Job>();
 if(job){if(input.jobId!==job.job_id||digest!==job.actor_hash)throw new ApiError(403,"Only the initiating authorized admin can retry this cleanup with its job ID.");}
 else {
  const member=await db.prepare("SELECT role FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,userId).first<{role:string}>(),row=await db.prepare("SELECT data,version FROM teams WHERE id=?").bind(teamId).first<any>();
  if(member?.role!=="admin"||!row)throw new ApiError(403,"Only a team admin can permanently erase this team.");
  if(input.baseVersion!==row.version||input.confirmation!==JSON.parse(row.data).workspace.teamName)throw new ApiError(409,"Confirm the exact current team name and revision before permanent erasure.");
  const id=crypto.randomUUID(),created=new Date().toISOString();
  const result=await db.prepare("INSERT INTO team_erasures(team_id,job_id,actor_hash,status,created) SELECT id,?,?,'pending',? FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role='admin')").bind(id,digest,created,teamId,row.version,teamId,userId).run();
  if(!result.meta.changes)throw new ApiError(409,"Team or admin membership changed. Reload before erasing.");
  job={job_id:id,actor_hash:digest,status:"pending"};
 }
 if(job.status==="complete")return response({ok:true,status:"complete",pendingCleanup:false,jobId:job.job_id});
 if(!await deleteObjects(db,bucket,teamId))return response({ok:true,status:"pending",pendingCleanup:true,jobId:job.job_id,message:"Team access is blocked. Storage cleanup will need a retry."},202);
 await db.batch([
 ...["revisions","invitations","files","privacy_requests","evidence_erasures","team_privacy","memberships"].map(table=>db.prepare("DELETE FROM "+table+" WHERE team_id=? AND EXISTS(SELECT 1 FROM team_erasures WHERE team_id=? AND job_id=? AND actor_hash=?)").bind(teamId,teamId,job!.job_id,digest)),
 db.prepare("DELETE FROM teams WHERE id=? AND EXISTS(SELECT 1 FROM team_erasures WHERE team_id=? AND job_id=? AND actor_hash=?)").bind(teamId,teamId,job.job_id,digest),
 db.prepare("UPDATE team_erasures SET status='complete',completed=? WHERE team_id=? AND job_id=? AND actor_hash=?").bind(new Date().toISOString(),teamId,job.job_id,digest)]);
 return response({ok:true,status:"complete",pendingCleanup:false,jobId:job.job_id});
}
async function withdrawEvidence(c:Context):Promise<Response> {
 const {db,bucket,teamId,userId,member,row,envelope,input}=c,id=String(input.evidenceId||""),digest=await actorHash(teamId,userId);
 let job=await db.prepare("SELECT * FROM evidence_erasures WHERE team_id=? AND evidence_id=?").bind(teamId,id).first<Job>();
 if(job){if(job.actor_hash!==digest||input.jobId!==job.job_id)throw new ApiError(403,"Retry this withdrawal with the initiating account and job ID.");}
 else {
  const evidence=envelope.workspace.evidence?.find(e=>e.id===id);
  if(!evidence||(member.role!=="admin"&&evidence.owner!==userId))throw new ApiError(403,"Only the evidence owner or team admin can permanently withdraw it.");
  if(input.baseVersion!==row.version||input.confirmation!=="WITHDRAW EVIDENCE")throw new ApiError(409,"Confirm WITHDRAW EVIDENCE and the current revision.");
  const jobId=crypto.randomUUID(),now=new Date().toISOString(),next=structuredClone(envelope);next.workspace.evidence=(next.workspace.evidence||[]).filter(e=>e.id!==id);
  const revisions=(await db.prepare("SELECT id,data FROM revisions WHERE team_id=?").bind(teamId).all<{id:string;data:string}>()).results;
  const guard="EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?)";
  const statements=[
   db.prepare("INSERT INTO evidence_erasures(team_id,evidence_id,job_id,actor_hash,status,created) SELECT id,?,?,?,'pending',? FROM teams WHERE id=? AND version=? AND "+guard).bind(id,jobId,digest,now,teamId,row.version,teamId,userId,member.role,teamId),
   db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND "+guard+" AND EXISTS(SELECT 1 FROM evidence_erasures WHERE team_id=? AND evidence_id=? AND job_id=?)").bind(JSON.stringify(next),now,teamId,row.version,teamId,userId,member.role,teamId,teamId,id,jobId),
   ...revisions.map(r=>{const saved=JSON.parse(r.data) as Envelope;saved.workspace.evidence=(saved.workspace.evidence||[]).filter(e=>e.id!==id);return db.prepare("UPDATE revisions SET data=? WHERE id=? AND team_id=? AND EXISTS(SELECT 1 FROM evidence_erasures WHERE team_id=? AND evidence_id=? AND job_id=?)").bind(JSON.stringify(saved),r.id,teamId,teamId,id,jobId);})
  ];
  const result=await db.batch(statements);if(!result[1].meta.changes)throw new ApiError(409,"Workspace or membership changed. Reload before withdrawing.");
  job={job_id:jobId,actor_hash:digest,status:"pending"};
 }
 if(job.status==="complete")return response({ok:true,status:"complete",pendingCleanup:false,jobId:job.job_id});
 if(!await deleteObjects(db,bucket,teamId,id))return response({ok:true,status:"pending",pendingCleanup:true,jobId:job.job_id,message:"Evidence is inaccessible. Storage cleanup needs a retry."},202);
 await db.batch([db.prepare("DELETE FROM files WHERE team_id=? AND evidence_id=?").bind(teamId,id),db.prepare("UPDATE evidence_erasures SET status='complete',completed=? WHERE team_id=? AND evidence_id=? AND job_id=?").bind(new Date().toISOString(),teamId,id,job.job_id)]);
 return response({ok:true,status:"complete",pendingCleanup:false,jobId:job.job_id});
}
export async function handlePrivacy(c:Context):Promise<Response> {
 const {request,db,teamId,userId,member,row,envelope,path,input}=c,method=request.method,settings=await privacySettings(db,teamId);
 if(path.length===3&&method==="GET"){
  if(member.role!=="admin")throw new ApiError(403,"Only admins can review team privacy settings.");
  const count=await db.prepare("SELECT count(*) AS n FROM evidence_erasures WHERE team_id=? AND status='pending'").bind(teamId).first<{n:number}>();
  const uploads=await db.prepare("SELECT count(*) AS n FROM files WHERE team_id=? AND upload_state!='ready'").bind(teamId).first<{n:number}>();
  return response({settings,pendingCleanup:count?.n||0,pendingFileCleanup:uploads?.n||0});
 }
 if(path.length===3&&method==="PUT"){
  if(member.role!=="admin")throw new ApiError(403,"Only admins can change privacy settings.");
  if(input.expectedUpdated!==settings.updated)throw new ApiError(409,"Privacy settings changed. Reload before saving.");
  if(typeof input.paused!=="boolean"||typeof input.uploadsEnabled!=="boolean"||!Number.isInteger(input.revisionRetentionDays)||input.revisionRetentionDays<1||input.revisionRetentionDays>30)throw new ApiError(400,"Choose a 1–30 day revision limit and explicit pause/upload settings.");
  const now=new Date().toISOString(),r=await db.prepare("INSERT INTO team_privacy(team_id,paused,uploads_enabled,revision_retention_days,updated) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role='admin') AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND COALESCE((SELECT updated FROM team_privacy WHERE team_id=?),'')=? ON CONFLICT(team_id) DO UPDATE SET paused=excluded.paused,uploads_enabled=excluded.uploads_enabled,revision_retention_days=excluded.revision_retention_days,updated=excluded.updated").bind(teamId,+input.paused,+input.uploadsEnabled,input.revisionRetentionDays,now,teamId,userId,teamId,teamId,input.expectedUpdated).run();
  if(!r.meta.changes)throw new ApiError(409,"Settings or admin membership changed. Reload.");await pruneRetention(db,teamId);return response({settings:await privacySettings(db,teamId)});
 }
 if(path[3]==="requests"){
  if(method==="GET"){
   const fields="id,kind,message,status,resolution AS note,created,updated";
   const q=reviews(member.role)?db.prepare("SELECT "+fields+",user_id AS requester FROM privacy_requests WHERE team_id=? ORDER BY created DESC LIMIT 100").bind(teamId):db.prepare("SELECT "+fields+" FROM privacy_requests WHERE team_id=? AND user_id=? ORDER BY created DESC LIMIT 100").bind(teamId,userId);
   const digest=await actorHash(teamId,userId);
   const cleanup=(await db.prepare("SELECT evidence_id AS evidenceId,job_id AS jobId,status FROM evidence_erasures WHERE team_id=? AND actor_hash=? AND status='pending'").bind(teamId,digest).all()).results;
   return response({requests:(await q.all()).results,pendingCleanups:cleanup});
  }
  if(method==="POST"){
   if(!["access","correction","withdrawal","erasure","concern"].includes(input.kind)||typeof input.message!=="string"||!input.message.trim()||input.message.length>2000)throw new ApiError(400,"Choose a request type and enter a message under 2,000 characters. Do not include sensitive student details.");
   const id=crypto.randomUUID(),now=new Date().toISOString(),cutoff=new Date(Date.now()-86400000).toISOString();
   const r=await db.prepare("INSERT INTO privacy_requests(id,team_id,user_id,kind,message,status,created,updated) SELECT ?,?,?,?,?,'open',?,? WHERE EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND (SELECT count(*) FROM privacy_requests WHERE team_id=? AND user_id=? AND created>?)<10 AND (SELECT count(*) FROM privacy_requests WHERE team_id=?)<100").bind(id,teamId,userId,input.kind,input.message.trim(),now,now,teamId,userId,teamId,teamId,userId,cutoff,teamId).run();
   if(!r.meta.changes)throw new ApiError(429,"Request limit or team access changed. Contact the responsible team adult directly.");return response({id},201);
  }
  if(method==="PUT"&&path[4]){
   if(!reviews(member.role))throw new ApiError(403,"A mentor or team admin must review requests.");
   if(!["open","in-progress","resolved","rejected"].includes(input.status)||typeof(input.note??"")!=="string"||(input.note||"").length>2000||typeof input.expectedUpdated!=="string")throw new ApiError(400,"Choose a request status, revision, and a note under 2,000 characters.");
   const r=await db.prepare("UPDATE privacy_requests SET status=?,resolution=?,reviewer=?,updated=? WHERE id=? AND team_id=? AND updated=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role IN ('mentor','admin')) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?)").bind(input.status,(input.note||"").trim(),userId,new Date().toISOString(),path[4],teamId,input.expectedUpdated,teamId,userId,teamId).run();
   if(!r.meta.changes)throw new ApiError(409,"Request or admin membership changed. Reload.");return response({ok:true});
  }
 }
 if(path[3]==="withdraw-evidence"&&method==="POST")return withdrawEvidence(c);
 if(path[3]==="consent-review"&&method==="POST"){
  if(settings.paused)throw new ApiError(423,"The admin paused team changes.");
  if(!reviews(member.role))throw new ApiError(403,"A mentor or admin must review the real collection-consent reference.");
  const e=envelope.workspace.evidence?.find(e=>e.id===input.evidenceId);
  if(!e||input.baseVersion!==row.version)throw new ApiError(409,"Save the evidence and reload before reviewing collection consent.");
  if(input.confirmation!=="REVIEWED COLLECTION CONSENT"||e.consent==="Not recorded"||!e.consentNote.trim())throw new ApiError(400,"Record the consent scope and external consent reference; then explicitly confirm its review.");
  const next=structuredClone(envelope),updated=next.workspace.evidence!.find(x=>x.id===e.id)!,now=new Date().toISOString();updated.consentReviewedBy=userId;updated.consentReviewedAt=now;updated.approved=false;updated.reviewedAt="";updated.reviewedBy="";
  const r=await db.batch([db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)").bind(crypto.randomUUID(),userId,now,teamId,row.version,teamId,userId,member.role,teamId,teamId),db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1) AND NOT EXISTS(SELECT 1 FROM evidence_erasures WHERE team_id=? AND evidence_id=?)").bind(JSON.stringify(next),now,teamId,row.version,teamId,userId,member.role,teamId,teamId,teamId,e.id)]);
  if(!r[1].meta.changes)throw new ApiError(409,"Evidence, membership, or privacy settings changed. Reload.");await pruneRetention(db,teamId);return response({ok:true});
 }
 throw new ApiError(404,"Privacy endpoint not found.");
}
