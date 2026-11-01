import type { AppData, Member, Role } from "../src/types";
import { createWorkspaceData } from "../src/workspace-data";
import { validateData } from "../src/persistence";
import { ApiError, manages, reviews, view, visibleEvidence, mergeWorkspace, rebaseWorkspace, assertTaskGraph, type Envelope } from "./policy";
type User = {userId: string};
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
export async function service(request: Request, db: D1Database, bucket: R2Bucket, user: User | null): Promise<Response> {
 try {
  const url = new URL(request.url), path = url.pathname.split("/").filter(Boolean).slice(1);
  if (path[0] === "session") {
   if (!user) return json({user:null,teams:[]});
   const {results} = await db.prepare("SELECT m.team_id AS id,m.name,m.role,json_extract(t.data,'$.workspace.teamName') AS teamName FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.user_id=?").bind(user.userId).all();
   return json({user:{userId:user.userId},teams:results});
  }
  if (!user) throw new ApiError(401,"Sign in with ChatGPT to use a private team workspace.");
  if (!['GET','HEAD'].includes(request.method) && request.headers.get("origin") !== url.origin) throw new ApiError(403,"This change must come from MyFTCSpace.");
  if (path[0] === "teams" && path.length === 1 && request.method === "POST") {
   const input = await body(request), name = cleanName(input.name), teamName = String(input.teamName || "").trim().slice(0,80);
   if (!name || !teamName) throw new ApiError(400,"Enter a team name and your display name.");
   const count = await db.prepare("SELECT count(*) AS n FROM memberships WHERE user_id=?").bind(user.userId).first<{n:number}>();
   if ((count?.n || 0) >= 10) throw new ApiError(400,"You can belong to at most ten teams.");
   const teamId=crypto.randomUUID();
   const d=createWorkspaceData({teamId,teamName,county:["New Castle","Kent","Sussex","Statewide"].includes(input.county)?input.county:"Statewide"});
   const env:Envelope = {workspace:d,rsvps:{},learning:{}};
   await db.batch([db.prepare("INSERT INTO teams(id,data,version,updated) VALUES(?,?,1,?)").bind(teamId,JSON.stringify(env),new Date().toISOString()),db.prepare("INSERT INTO memberships(team_id,user_id,name,role) VALUES(?,?,?,'admin')").bind(teamId,user.userId,name)]);
   return json({id:teamId},201);
  }
  if (path[0] === "join" && request.method === "POST") {
   const input=await body(request), name=cleanName(input.name); if(!name || typeof input.token!=="string" || input.token.length>200) throw new ApiError(400,"Enter your invitation code and display name.");
   const digest=await hash(input.token.trim()), invite=await db.prepare("SELECT * FROM invitations WHERE hash=? AND used_by IS NULL AND expires>?").bind(digest,new Date().toISOString()).first<any>();
   if(!invite) throw new ApiError(400,"Invitation expired, revoked, or already used.");
   if(await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND user_id=?").bind(invite.team_id,user.userId).first()) throw new ApiError(400,"You already belong to this team.");
   const r=await db.batch([db.prepare("INSERT INTO memberships(team_id,user_id,name,role) SELECT team_id,?,?,role FROM invitations WHERE id=? AND used_by IS NULL AND expires>?").bind(user.userId,name,invite.id,new Date().toISOString()),db.prepare("UPDATE invitations SET used_by=? WHERE id=? AND used_by IS NULL").bind(user.userId,invite.id)]);
   if(!r[0].meta.changes) throw new ApiError(409,"This invitation was already used.");
   return json({id:invite.team_id});
  }
  if (path[0] !== "teams" || !path[1]) throw new ApiError(404,"Endpoint not found.");
  const teamId=path[1];
  const member=await db.prepare("SELECT user_id AS userId,name,role FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,user.userId).first<Member>();
  if(!member) throw new ApiError(403,"You are not a member of this team.");
  const row=await db.prepare("SELECT * FROM teams WHERE id=?").bind(teamId).first<any>(); if(!row) throw new ApiError(404,"Team not found.");
  const envelope=JSON.parse(row.data) as Envelope;
  const members=async()=> (await db.prepare("SELECT user_id AS userId,name,role FROM memberships WHERE team_id=? ORDER BY name").bind(teamId).all<Member>()).results;
  if(path.length===2 && request.method==="GET") return json({data:view(envelope,member.role,user.userId),version:row.version,members:await members(),role:member.role,updated:row.updated});
  if(path.length===2 && request.method==="PUT") {
   const input=await body(request);
   if(input.accountId!==undefined&&input.accountId!==user.userId)throw new ApiError(401,"Your signed-in account changed. Reopen the workspace before saving.");
   if(!validateData(input.data)||!Number.isInteger(input.baseVersion)||input.baseVersion<1)throw new ApiError(400,"Invalid workspace or starting revision.");
   let submitted=input.data;
   if(input.baseVersion !== row.version){const prior=await db.prepare("SELECT data FROM revisions WHERE team_id=? AND version=? ORDER BY created DESC LIMIT 1").bind(teamId,input.baseVersion).first<any>();if(!prior)throw new ApiError(409,"The starting revision is unavailable. Reload before saving.");submitted=rebaseWorkspace(view(JSON.parse(prior.data),member.role,user.userId),input.data,view(envelope,member.role,user.userId));}
   const next=mergeWorkspace(envelope,submitted,member.role,user.userId);
   for(const evidence of next.workspace.evidence || []) if(evidence.fileId && !(await db.prepare("SELECT 1 FROM files WHERE id=? AND team_id=? AND evidence_id=?").bind(evidence.fileId,teamId,evidence.id).first())) throw new ApiError(400,"Media file does not belong to this evidence record.");
   const now=new Date().toISOString();
   const r=await db.batch([
    db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role),
    db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(JSON.stringify(next),now,teamId,row.version,teamId,user.userId,member.role)
   ]);
   if(!r[1].meta.changes) throw new ApiError(409,"Your workspace or membership changed. Reload before saving.");
   return json({data:view(next,member.role,user.userId),version:row.version+1,members:await members(),role:member.role,updated:now});
  }
  if(path[2]==="invites") {
   if(member.role!=="admin") throw new ApiError(403,"Only a team admin can manage invitations.");
   if(request.method==="GET") return json({invites:(await db.prepare("SELECT id,role,expires,used_by IS NOT NULL AS used FROM invitations WHERE team_id=? ORDER BY expires DESC").bind(teamId).all()).results});
   if(request.method==="POST") {const input=await body(request); if(!roles.includes(input.role) || input.role==="admin") throw new ApiError(400,"Invite a student, student lead, or mentor."); const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),expires=new Date(Date.now()+48*3600000).toISOString(); await db.prepare("INSERT INTO invitations(id,team_id,hash,role,expires,created_by) VALUES(?,?,?,?,?,?)").bind(id,teamId,await hash(token),input.role,expires,user.userId).run(); return json({token,expires});}
   if(request.method==="DELETE") {await db.prepare("DELETE FROM invitations WHERE id=? AND team_id=? AND used_by IS NULL").bind(path[3],teamId).run(); return json({ok:true});}
  }
  if(path[2]==="members" && request.method==="PUT") {
   const input=await body(request);
   if(input.userId===user.userId && input.name && input.role===member.role) {await db.prepare("UPDATE memberships SET name=? WHERE team_id=? AND user_id=?").bind(cleanName(input.name),teamId,user.userId).run();return json({ok:true});}
   if(member.role!=="admin" || !roles.includes(input.role)) throw new ApiError(403,"Only an admin can change member roles.");
   if(input.userId===user.userId) throw new ApiError(400,"You cannot demote your own admin membership.");
   await db.prepare("UPDATE memberships SET role=? WHERE team_id=? AND user_id=?").bind(input.role,teamId,input.userId).run();return json({ok:true});
  }
  if(path[2]==="members" && request.method==="DELETE") {
   if(member.role!=="admin" || path[3]===user.userId) throw new ApiError(403,"An admin may remove another member.");
   await db.prepare("DELETE FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,path[3]).run();return json({ok:true});
  }
  if(path[2]==="learning" && request.method==="GET") { if(!reviews(member.role))throw new ApiError(403,"A mentor can review skill sign-offs.");return json({learning:(await members()).map(m=>({userId:m.userId,steps:envelope.learning[m.userId]?.steps||[],skills:envelope.learning[m.userId]?.skills||[]}))}); }
  if(path[2]==="learning" && request.method==="PUT") {
   if(!reviews(member.role)) throw new ApiError(403,"A mentor must sign off skills.");
   const input=await body(request); if(!Array.isArray(input.skills)|| !input.skills.every((s:unknown)=>['shop-safety','battery-safety','robot-startup','first-task'].includes(String(s)))) throw new ApiError(400,"Invalid skill sign-off.");
   if(!(await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,input.userId).first())) throw new ApiError(400,"Choose a team member.");
   const next=structuredClone(envelope); next.learning[input.userId]={steps:next.learning[input.userId]?.steps||[],skills:input.skills};
   const now=new Date().toISOString(); const r=await db.batch([db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role),db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(JSON.stringify(next),now,teamId,row.version,teamId,user.userId,member.role)]);
   if(!r[1].meta.changes) throw new ApiError(409,"Workspace or membership changed. Reload before signing off skills."); return json({ok:true});
  }
  if(path[2]==="history") {
   if(!reviews(member.role)) throw new ApiError(403,"A mentor or admin can review private backups.");
   if(request.method==="GET") return json({history:(await db.prepare("SELECT id,version,actor,created FROM revisions WHERE team_id=? ORDER BY version DESC LIMIT 30").bind(teamId).all()).results});
   if(request.method==="POST") { const input=await body(request); if(member.role!=="admin") throw new ApiError(403,"An admin must restore a shared revision."); if(input.baseVersion!==row.version) throw new ApiError(409,"Reload before restoring a revision.");const revision=await db.prepare("SELECT data FROM revisions WHERE team_id=? AND id=?").bind(teamId,input.id).first<any>();if(!revision)throw new ApiError(404,"Revision not found.");const candidate=JSON.parse(revision.data);if(!validateData(candidate.workspace)) throw new ApiError(400,"Revision is not valid.");const now=new Date().toISOString();const result=await db.batch([db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role),db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(revision.data,now,teamId,row.version,teamId,user.userId,member.role)]);if(!result[1].meta.changes)throw new ApiError(409,"Workspace or membership changed. Reload before restoring a revision.");return json({ok:true}); }
  }
  if(path[2]==="import" && request.method==="POST") {
   if(member.role!=="admin")throw new ApiError(403,"Only an admin can restore a shared backup.");
   const input=await body(request);if(input.baseVersion!==row.version)throw new ApiError(409,"Reload before importing a shared backup.");if(!validateData(input.data))throw new ApiError(400,"Choose a valid MyFTCSpace backup.");
   const candidate=structuredClone(input.data) as AppData,roster=await members(),ids=new Set(roster.map(m=>m.userId));
   candidate.teamId=teamId;candidate.seasonId=envelope.workspace.seasonId;candidate.onboarding=[];candidate.skills=[];
   const missingFiles:string[]=[];
   for(const key of ['tasks','events','sponsors','grants','resources','announcements','evidence'] as const){for(const record of candidate[key]||[]){record.teamId=teamId;record.seasonId=candidate.seasonId;if('owner' in record&&!ids.has(record.owner))record.owner=key==='evidence'?user.userId:'Unassigned';if(key==='events'){const event=record as AppData['events'][number];event.rsvp=false;event.verification='needs-review';event.verifiedAt='';event.verifiedBy='';}if(key==='resources')(record as AppData['resources'][number]).approved=false;if(key==='sponsors')(record as AppData['sponsors'][number]).draftStatus='Needs review';if(key==='evidence'){const evidence=record as NonNullable<AppData['evidence']>[number];evidence.approved=false;evidence.reviewedAt='';evidence.reviewedBy='';if(evidence.fileId&&!(await db.prepare('SELECT 1 FROM files WHERE id=? AND team_id=? AND evidence_id=?').bind(evidence.fileId,teamId,evidence.id).first())){missingFiles.push(evidence.title);evidence.fileId='';}}}}
   if(!validateData(candidate))throw new ApiError(400,"The backup could not be converted to this team.");
   assertTaskGraph(candidate.tasks);
   for(const grant of candidate.grants){grant.confirmed=false;grant.stale=true;}
   for(const sponsor of candidate.sponsors)sponsor.stale=true;
   const next={...envelope,workspace:candidate},now=new Date().toISOString();
   const result=await db.batch([db.prepare("INSERT INTO revisions(id,team_id,version,actor,created,data) SELECT ?,id,version,?,?,data FROM teams WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(crypto.randomUUID(),user.userId,now,teamId,row.version,teamId,user.userId,member.role),db.prepare("UPDATE teams SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?)").bind(JSON.stringify(next),now,teamId,row.version,teamId,user.userId,member.role)]);
   if(!result[1].meta.changes)throw new ApiError(409,"Workspace or membership changed. Review the latest revision.");return json({ok:true,missingFiles});
  }
  if(path[2]==="files") {
   if(request.method==="POST") {
    const evidenceId=url.searchParams.get("evidence")||"",evidence=envelope.workspace.evidence?.find(e=>e.id===evidenceId);
    if(!evidence || (!manages(member.role)&&evidence.owner!==user.userId)) throw new ApiError(403,"Save your evidence record before adding a file.");
    const type=request.headers.get("content-type")?.split(";")[0]||"";
    if(!['image/png','image/jpeg','image/webp','application/pdf','video/mp4'].includes(type)) throw new ApiError(400,"Use PNG, JPEG, WebP, PDF, or MP4.");
    const bytes=await limitedBody(request,12*1024*1024,"Choose a file under 12 MB.");if(!bytes.byteLength)throw new ApiError(413,"Choose a file under 12 MB.");
    const head=new Uint8Array(bytes), sig=new TextDecoder().decode(head.slice(0,16));
    const valid= type==='image/png'?head[0]===137&&sig.slice(1,4)==='PNG':type==='image/jpeg'?head[0]===255&&head[1]===216:type==='image/webp'?sig.startsWith('RIFF')&&sig.slice(8,12)==='WEBP':type==='application/pdf'?sig.startsWith('%PDF-'):sig.slice(4,8)==='ftyp';
    if(!valid)throw new ApiError(400,"File contents do not match its type.");
    const id=crypto.randomUUID(), name=(request.headers.get("x-file-name")||"evidence").replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,100);
    await bucket.put(`${teamId}/${id}`,bytes,{httpMetadata:{contentType:type}});
    try {await db.prepare("INSERT INTO files(id,team_id,evidence_id,name,type,size,actor,created) VALUES(?,?,?,?,?,?,?,?)").bind(id,teamId,evidenceId,name,type,bytes.byteLength,user.userId,new Date().toISOString()).run();}catch(error){await bucket.delete(`${teamId}/${id}`);throw error;}
    return json({id,name},201);
   }
   if(request.method==="GET" && path[3]) {
    const file=await db.prepare("SELECT * FROM files WHERE id=? AND team_id=?").bind(path[3],teamId).first<any>();
    const evidence=file&&envelope.workspace.evidence?.find(e=>e.id===file.evidence_id);
    if(!file || !evidence || !visibleEvidence(evidence,member.role,user.userId)) throw new ApiError(404,"File is unavailable.");
    const object=await bucket.get(`${teamId}/${file.id}`);if(!object)throw new ApiError(404,"File not found.");
    return new Response(object.body,{headers:{"Content-Type":file.type,"Content-Disposition":`attachment; filename="${file.name}"`,"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}});
   }
  }
  throw new ApiError(404,"Endpoint not found.");
 } catch(error) {return json({error:error instanceof ApiError?error.message:"The server could not complete this request. Your saved records are unchanged."},error instanceof ApiError?error.status:500);}
}
