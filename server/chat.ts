import {ApiError,reviews} from "./policy";
import type {Member} from "../src/types";
type Context={request:Request;db:D1Database;teamId:string;userId:string;member:Member;path:string[];input:any};
type Message={id:string;senderId:string;recipientId:string;body:string;created:string;removed:number};
const fields="id,sender_id AS senderId,recipient_id AS recipientId,body,created,removed";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
export async function chatSettings(db:D1Database,teamId:string){const row=await db.prepare("SELECT dm_enabled,retention_days,updated FROM chat_settings WHERE team_id=?").bind(teamId).first<{dm_enabled:number;retention_days:number;updated:string}>();return {dmEnabled:!!row?.dm_enabled,retentionDays:row?.retention_days??30,updated:row?.updated||""};}
export async function pruneChat(db:D1Database,teamId:string,days:number){await db.prepare("DELETE FROM chat_messages WHERE team_id=? AND created<?").bind(teamId,new Date(Date.now()-days*86400000).toISOString()).run();}
export async function handleChat(c:Context):Promise<Response>{
 const {db,teamId,userId,member,request,path,input}=c,url=new URL(request.url),settings=await chatSettings(db,teamId);
 await pruneChat(db,teamId,settings.retentionDays);
 const guard="EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=? AND role=?) AND NOT EXISTS(SELECT 1 FROM team_erasures WHERE team_id=?) AND NOT EXISTS(SELECT 1 FROM team_privacy WHERE team_id=? AND paused=1)",args=[teamId,userId,member.role,teamId,teamId];
 if(path[3]==="settings"){
  if(request.method==="GET")return json({settings});
  if(request.method!=="PUT"||member.role!=="admin")throw new ApiError(403,"An adult team operator must manage messaging settings.");
  if(typeof input.dmEnabled!=="boolean"||!Number.isInteger(input.retentionDays)||input.retentionDays<1||input.retentionDays>30||input.expectedUpdated!==settings.updated)throw new ApiError(409,"Choose a 1–30 day message limit and reload the current settings before saving.");
  const updated=new Date().toISOString()+":"+crypto.randomUUID();
  const result=await db.prepare("INSERT INTO chat_settings(team_id,dm_enabled,retention_days,updated) SELECT ?,?,?,? WHERE "+guard+" AND COALESCE((SELECT updated FROM chat_settings WHERE team_id=?),'')=? ON CONFLICT(team_id) DO UPDATE SET dm_enabled=excluded.dm_enabled,retention_days=excluded.retention_days,updated=excluded.updated").bind(teamId,+input.dmEnabled,input.retentionDays,updated,...args,teamId,input.expectedUpdated).run();
  if(!result.meta.changes)throw new ApiError(409,"Operator access or messaging settings changed. Reload before retrying.");
  await pruneChat(db,teamId,input.retentionDays);return json({settings:await chatSettings(db,teamId)});
 }
 if(path[3]==="block"&&request.method==="PUT"){
  if(typeof input.peer!=="string"||input.peer===userId||typeof input.blocked!=="boolean")throw new ApiError(400,"Choose another team member.");
  if(input.blocked)await db.prepare("INSERT INTO chat_blocks(team_id,user_id,blocked_user_id,created) SELECT ?,?,?,? WHERE "+guard+" AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=?) ON CONFLICT(team_id,user_id,blocked_user_id) DO NOTHING").bind(teamId,userId,input.peer,new Date().toISOString(),...args,teamId,input.peer).run();
  else await db.prepare("DELETE FROM chat_blocks WHERE team_id=? AND user_id=? AND blocked_user_id=? AND "+guard).bind(teamId,userId,input.peer,...args).run();
  return json({ok:true});
 }
 if(path[3]){
  const message=await db.prepare("SELECT "+fields+" FROM chat_messages WHERE team_id=? AND id=? AND (recipient_id='' OR sender_id=? OR recipient_id=?) AND "+guard).bind(teamId,path[3],userId,userId,...args).first<Message>();
  if(!message)throw new ApiError(404,"Message is unavailable.");
  if(path[4]==="report"&&request.method==="POST"){
   if(message.removed||typeof input.reason!=="string"||!input.reason.trim()||input.reason.length>1000)throw new ApiError(400,"Describe your concern in up to 1000 characters.");
   const sender=await db.prepare("SELECT name FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,message.senderId).first<{name:string}>();
   const now=new Date().toISOString(),report=`Reported ${message.recipientId?"direct":"team"} message ${message.id}\nSender: ${sender?.name||"Former member"}\nMessage: ${message.body}\nConcern: ${input.reason.trim()}`;
   const result=await db.prepare("INSERT INTO privacy_requests(id,team_id,user_id,kind,message,status,created,updated) SELECT ?,?,?,'concern',?,'open',?,? WHERE "+guard+" AND (SELECT count(*) FROM privacy_requests WHERE team_id=? AND user_id=? AND created>?)<10").bind(crypto.randomUUID(),teamId,userId,report,now,now,...args,teamId,userId,new Date(Date.now()-86400000).toISOString()).run();
   if(!result.meta.changes)throw new ApiError(429,"The report could not be recorded. Contact your adult operator directly.");return json({ok:true});
  }
  if(request.method==="DELETE"&&path.length===4){
   if(message.senderId!==userId&&(!reviews(member.role)||!!message.recipientId))throw new ApiError(403,"Only the sender can remove a direct message. Adult operators may also moderate team chat.");
   const result=await db.prepare("UPDATE chat_messages SET body='',removed=1 WHERE team_id=? AND id=? AND "+guard).bind(teamId,message.id,...args).run();
   if(!result.meta.changes)throw new ApiError(409,"Your access changed before removal.");return json({ok:true});
  }
  throw new ApiError(404,"Messaging action not found.");
 }
 const peer=request.method==="GET"?(url.searchParams.get("peer")||""):(typeof input.peer==="string"?input.peer:"");
 if(peer&&(peer===userId||!(await db.prepare("SELECT 1 FROM memberships WHERE team_id=? AND user_id=?").bind(teamId,peer).first())))throw new ApiError(400,"Choose a current teammate for a direct message.");
 const channel=peer?"((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))":"recipient_id=''",channelArgs=peer?[userId,peer,peer,userId]:[];
 if(request.method==="GET"){
  let before="",beforeArgs:string[]=[];const cursor=url.searchParams.get("before");
  if(cursor){const row=await db.prepare("SELECT created,id FROM chat_messages WHERE team_id=? AND id=? AND "+channel+" AND "+guard).bind(teamId,cursor,...channelArgs,...args).first<{created:string;id:string}>();if(!row)throw new ApiError(400,"Message history changed. Reload the conversation.");before=" AND (created<? OR (created=? AND id<?))";beforeArgs=[row.created,row.created,row.id];}
  const result=await db.prepare("SELECT "+fields+" FROM chat_messages WHERE team_id=? AND "+channel+before+" AND "+guard+(peer?" AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=?)":"")+" ORDER BY created DESC,id DESC LIMIT 101").bind(teamId,...channelArgs,...beforeArgs,...args,...(peer?[teamId,peer]:[])).all<Message>();
  const blocked=peer?!!await db.prepare("SELECT 1 FROM chat_blocks WHERE team_id=? AND user_id=? AND blocked_user_id=?").bind(teamId,userId,peer).first():false;
  return json({messages:result.results.slice(0,100).reverse(),hasMore:result.results.length>100,settings,blocked});
 }
 if(request.method==="POST"&&path.length===3){
  if(typeof input.id!=="string"||!/^[a-f0-9-]{36}$/i.test(input.id)||typeof input.body!=="string"||!input.body.trim()||input.body.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.body))throw new ApiError(400,"Write a message of 1–2000 characters.");
  const existing=await db.prepare("SELECT sender_id,recipient_id,body,removed FROM chat_messages WHERE team_id=? AND id=?").bind(teamId,input.id).first<any>();
  if(existing){if(existing.sender_id!==userId||existing.recipient_id!==peer||existing.body!==input.body.trim()||existing.removed)throw new ApiError(409,"This message request cannot be reused.");return json({ok:true,id:input.id});}
  const now=new Date().toISOString(),dmGuard=peer?" AND EXISTS(SELECT 1 FROM memberships WHERE team_id=? AND user_id=?) AND EXISTS(SELECT 1 FROM chat_settings WHERE team_id=? AND dm_enabled=1) AND NOT EXISTS(SELECT 1 FROM chat_blocks WHERE team_id=? AND ((user_id=? AND blocked_user_id=?) OR (user_id=? AND blocked_user_id=?)))":"";
  const result=await db.prepare("INSERT INTO chat_messages(id,team_id,sender_id,recipient_id,body,created,removed) SELECT ?,?,?,?,?,?,0 WHERE "+guard+dmGuard+" AND (SELECT count(*) FROM chat_messages WHERE team_id=? AND sender_id=? AND created>?)<20").bind(input.id,teamId,userId,peer,input.body.trim(),now,...args,...(peer?[teamId,peer,teamId,teamId,userId,peer,peer,userId]:[]),teamId,userId,new Date(Date.now()-60000).toISOString()).run();
  if(!result.meta.changes)throw new ApiError(409,"Messaging access, DM settings or the sending limit changed. Reload or try again shortly.");return json({ok:true,id:input.id},201);
 }
 throw new ApiError(404,"Messaging endpoint not found.");
}
