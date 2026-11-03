import {timingSafeEqual} from "node:crypto";

export function authorizeRetention(provided:string|null,secret:string):boolean{
 if(!secret||!provided)return false;
 const actual=Buffer.from(provided),expected=Buffer.from(`Bearer ${secret}`);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
export async function handleRetentionRequest(request:Request,secret:string,storage:()=>D1Database|null):Promise<Response>{
 if(!authorizeRetention(request.headers.get("authorization"),secret))return response({error:"Unauthorized"},401);
 try{
  const db=storage();
  if(!db)return response({error:"Storage unavailable"},503);
  await runScheduledRetention(db);
  return response({ok:true});
 }catch{return response({error:"Storage unavailable"},503);}
}

export async function runScheduledRetention(db:D1Database,now=Date.now()){
 const iso=new Date(now).toISOString();
 await db.batch([
  db.prepare("DELETE FROM auth_verification_tokens WHERE expires<=?").bind(now),
  db.prepare("DELETE FROM auth_email_rate WHERE created<?").bind(now-86400000),
  db.prepare("DELETE FROM chat_messages WHERE created<strftime('%Y-%m-%dT%H:%M:%fZ',?,'unixepoch','-'||MIN(30,MAX(1,COALESCE((SELECT retention_days FROM chat_settings WHERE chat_settings.team_id=chat_messages.team_id),30)))||' days')").bind(now/1000),
  db.prepare("DELETE FROM revisions WHERE created<strftime('%Y-%m-%dT%H:%M:%fZ',?,'unixepoch','-'||MIN(30,MAX(1,COALESCE((SELECT revision_retention_days FROM team_privacy WHERE team_privacy.team_id=revisions.team_id),30)))||' days') OR id IN (SELECT id FROM (SELECT id,ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY version DESC,created DESC) AS position FROM revisions) WHERE position>30)").bind(now/1000),
  db.prepare("DELETE FROM invitations WHERE expires<=? OR used_by IS NOT NULL").bind(iso),
  db.prepare("DELETE FROM privacy_requests WHERE status IN ('resolved','rejected') AND updated<?").bind(new Date(now-30*86400000).toISOString()),
 ]);
}
