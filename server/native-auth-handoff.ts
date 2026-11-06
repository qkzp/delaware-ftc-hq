import {createHash,createHmac,randomBytes,timingSafeEqual} from "node:crypto";

// The deployed Google provider has both OAuth state and PKCE checks. Other
// providers require their own callback/cookie review before native handoff.
export const NATIVE_AUTH_PROVIDERS=["google"] as const;
export type NativeProvider=typeof NATIVE_AUTH_PROVIDERS[number];
export type NativeFlow={provider:NativeProvider;state:string;challenge:string;snapshot:string;callbackUrl:string;id:string;issued:number;expires:number};
const randomValue=()=>randomBytes(32).toString("base64url");
const encodedRandom=/^[A-Za-z0-9_-]{43}$/;
const sha=(value:string)=>createHash("sha256").update(value).digest("base64url");
const signature=(value:string,secret:string)=>createHmac("sha256",secret).update(value).digest("base64url");
const safeEqual=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const goodSecret=(secret:string)=>typeof secret==="string"&&Buffer.byteLength(secret)>=32;
export const nativeFlowHash=(id:string)=>sha(id);
export const nativeSessionMarker=(flow:NativeFlow,userId:string)=>sha("native-session-v1."+flow.id+"."+userId);
const snapshotPattern=/^\d{13}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/;

export function nativeSessionIdentity(value:unknown):string|null {
 return typeof value==="string"&&value.length>0&&value.length<=300&&!/[\u0000-\u001f\u007f]/.test(value)?value:null;
}
export function createNativeSnapshot(identity:string|null,secret:string,now=Date.now()):string|null {
 if(!goodSecret(secret)||(identity!==null&&nativeSessionIdentity(identity)!==identity))return null;
 const expires=String(now+15*60*1000),nonce=randomValue(),subject=identity===null?"anonymous":"user."+sha(identity);
 return expires+"."+nonce+"."+signature("native-snapshot-v1."+expires+"."+nonce+"."+subject,secret);
}
export function validNativeSnapshot(snapshot:unknown,identity:string|null,secret:string,now=Date.now()):boolean {
 if(!goodSecret(secret)||(identity!==null&&nativeSessionIdentity(identity)!==identity)||typeof snapshot!=="string"||!snapshotPattern.test(snapshot))return false;
 const [expires,nonce,proof]=snapshot.split("."),subject=identity===null?"anonymous":"user."+sha(identity);
 return Number(expires)>now&&Number(expires)<=now+15*60*1000&&safeEqual(proof,signature("native-snapshot-v1."+expires+"."+nonce+"."+subject,secret));
}

export function safeNativeCallback(value:unknown):value is string {
 if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")||value.length>1024||/[\\\u0000-\u001f\u007f]/.test(value))return false;
 try{
  const url=new URL(value,"https://native-callback.invalid");
  return url.origin==="https://native-callback.invalid"&&url.pathname!=="/api"&&!url.pathname.startsWith("/api/")&&
   url.pathname!=="/ios/auth"&&!url.pathname.startsWith("/ios/auth/");
 }catch{return false;}
}
export function validNativeIdentity(value:unknown,provider?:NativeProvider):value is string {
 if(typeof value!=="string"||value.length>300||/[\u0000-\u001f\u007f]/.test(value))return false;
 return NATIVE_AUTH_PROVIDERS.some(name=>(!provider||name===provider)&&value.startsWith(name+":")&&value.length>name.length+1);
}
function validFlow(value:unknown,now:number):value is NativeFlow {
 if(!value||typeof value!=="object")return false;
 const f=value as NativeFlow;
 return NATIVE_AUTH_PROVIDERS.includes(f.provider)&&encodedRandom.test(f.state)&&encodedRandom.test(f.challenge)&&encodedRandom.test(f.id)&&
  typeof f.snapshot==="string"&&snapshotPattern.test(f.snapshot)&&Number(f.snapshot.split(".")[0])>=f.expires&&
  f.state!==f.challenge&&safeNativeCallback(f.callbackUrl)&&Number.isSafeInteger(f.issued)&&Number.isSafeInteger(f.expires)&&
  f.issued<=now+30000&&f.expires>now&&f.expires-f.issued===10*60*1000;
}
export function createNativeFlow(input:{provider:string;state:string;challenge:string;snapshot:string;callbackUrl:string},secret:string,now=Date.now()):string|null {
 if(!goodSecret(secret))return null;
 const flow={...input,id:randomValue(),issued:now,expires:now+10*60*1000};
 if(!validFlow(flow,now))return null;
 const payload=Buffer.from(JSON.stringify(flow)).toString("base64url");
 return payload+"."+signature("native-flow-v1."+payload,secret);
}
export function readNativeFlow(value:unknown,secret:string,now=Date.now()):NativeFlow|null {
 if(!goodSecret(secret)||typeof value!=="string"||value.length>4096)return null;
 const parts=value.split(".");
 if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!encodedRandom.test(parts[1])||
    !safeEqual(signature("native-flow-v1."+parts[0],secret),parts[1]))return null;
 try{const flow:unknown=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));return validFlow(flow,now)?flow:null;}catch{return null;}
}
export function nativeSessionMatches(flow:NativeFlow,token:Record<string,unknown>|null):boolean {
 return !!token&&validNativeIdentity(token.sub,flow.provider)&&typeof token.nativeAuthFlow==="string"&&safeEqual(token.nativeAuthFlow,nativeSessionMarker(flow,token.sub));
}
export function createNativeConfirmation(flow:NativeFlow,userId:string,secret:string):{token:string;cookie:string}|null {
 if(!goodSecret(secret)||!validNativeIdentity(userId,flow.provider))return null;
 const token=randomValue(),proof=signature("native-confirm-v1."+flow.id+"."+sha(userId)+"."+token,secret);
 return {token,cookie:token+"."+proof};
}
export function validNativeConfirmation(flow:NativeFlow,userId:string,token:unknown,cookie:unknown,secret:string):boolean {
 if(!goodSecret(secret)||!validNativeIdentity(userId,flow.provider)||typeof token!=="string"||!encodedRandom.test(token)||typeof cookie!=="string")return false;
 const parts=cookie.split(".");
 return parts.length===2&&encodedRandom.test(parts[0])&&encodedRandom.test(parts[1])&&safeEqual(parts[0],token)&&
  safeEqual(parts[1],signature("native-confirm-v1."+flow.id+"."+sha(userId)+"."+token,secret));
}
export async function issueNativeTicket(db:D1Database,flow:NativeFlow,userId:string,secret:string,now=Date.now()):Promise<string|null> {
 if(!goodSecret(secret)||!validFlow(flow,now)||!validNativeIdentity(userId,flow.provider))return null;
 await db.batch([
  db.prepare("DELETE FROM native_auth_tickets WHERE expires<=?").bind(now),
  db.prepare("DELETE FROM native_auth_used_flows WHERE expires<=?").bind(now),
  db.prepare("DELETE FROM native_auth_rate WHERE expires<=?").bind(now),
 ]);
 const window=Math.floor(now/600000),rateKey=signature("native-rate-v1."+window+"."+sha(userId),secret);
 const rate=await db.prepare("INSERT INTO native_auth_rate(rate_key,count,expires) VALUES(?,1,?) ON CONFLICT(rate_key) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count").bind(rateKey,(window+1)*600000).all<{count:number}>();
 if(!rate.results.length)return null;
 const used=await db.prepare("INSERT INTO native_auth_used_flows(flow_hash,expires) VALUES(?,?) ON CONFLICT(flow_hash) DO NOTHING RETURNING flow_hash").bind(nativeFlowHash(flow.id),flow.expires).all<{flow_hash:string}>();
 if(!used.results.length)return null;
 const ticket=randomValue();
 await db.prepare("INSERT INTO native_auth_tickets(ticket_hash,challenge,snapshot,user_id,expires) VALUES(?,?,?,?,?)").bind(sha(ticket),flow.challenge,flow.snapshot,userId,Math.min(now+120000,flow.expires)).run();
 return ticket;
}
export async function redeemNativeTicket(db:D1Database,ticket:unknown,verifier:unknown,snapshot:unknown,identity:string|null,secret:string,now=Date.now()):Promise<string|null> {
 if(typeof ticket!=="string"||typeof verifier!=="string"||!encodedRandom.test(ticket)||!encodedRandom.test(verifier)||!validNativeSnapshot(snapshot,identity,secret,now))return null;
 const result=await db.prepare("DELETE FROM native_auth_tickets WHERE ticket_hash=? AND challenge=? AND snapshot=? AND expires>? RETURNING user_id").bind(sha(ticket),sha(verifier),snapshot,now).all<{user_id:string}>();
 const user=result.results[0]?.user_id;
 return validNativeIdentity(user)?user:null;
}
