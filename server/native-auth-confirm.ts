import {createNativeConfirmation,issueNativeTicket,nativeSessionMatches,readNativeFlow,validNativeConfirmation} from "./native-auth-handoff";
import {matchesNativeOrigin} from "./native-auth-origin";

type ConfirmContext={secret:string;origin:string;db:D1Database;token:Record<string,unknown>|null;now?:number};
const csrfCookie="__Host-myftc-native-confirm";
const safeHeaders={"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const error=(status=400)=>new Response("This sign-in request could not be verified. Return to the iPhone app and try again.",{status,headers:{...safeHeaders,"Content-Type":"text/plain; charset=utf-8"}});
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||""));
function onlyParams(params:URLSearchParams,keys:string[]):boolean {
 return [...params.keys()].every(key=>keys.includes(key))&&keys.every(key=>params.getAll(key).length===1);
}
function cookieValue(header:string|null,name:string):string|null {
 if(!header||header.length>16384)return null;
 const matches=header.split(";").map(item=>item.trim()).filter(item=>item.startsWith(name+"="));
 return matches.length===1?matches[0].slice(name.length+1):null;
}
async function readForm(request:Request):Promise<URLSearchParams|null>{
 if(!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers.get("content-type")||""))return null;
 const length=request.headers.get("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>8192))return null;
 if(!request.body)return null;
 const reader=request.body.getReader(),parts:Uint8Array[]=[];let count=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>8192){await reader.cancel();return null;}parts.push(value);}
  return new URLSearchParams(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(parts)));
 }catch{return null;}finally{reader.releaseLock();}
}
export async function handleNativeConfirmation(request:Request,context:ConfirmContext):Promise<Response>{
 const {origin,secret,db,token}=context,now=context.now??Date.now();
 let url:URL;try{url=new URL(request.url);}catch{return error();}
 if(url.origin!==origin||url.pathname!=="/ios/auth/confirm"||!matchesNativeOrigin(request.headers,origin,request.method==="POST"))return error(403);
 if(request.method==="GET"){
  if(!onlyParams(url.searchParams,["flow"]))return error();
  const signed=url.searchParams.get("flow"),flow=readNativeFlow(signed,secret,now);
  if(!flow||!nativeSessionMatches(flow,token)||typeof token?.sub!=="string")return error(403);
  const confirmation=createNativeConfirmation(flow,token.sub,secret);
  if(!confirmation)return error(403);
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm iPhone sign-in</title><style>body{font:17px system-ui;background:#171717;color:#fff;max-width:36rem;margin:4rem auto;padding:1.5rem;line-height:1.6}button{font:inherit;font-weight:600;background:#ff9b62;color:#161616;border:0;border-radius:.4rem;padding:.8rem 1.2rem}code{overflow-wrap:anywhere}</style></head><body><main><h1>Continue to your iPhone?</h1><p>You selected a Google account for MyFTCSpace. Continue only if you started this sign-in in the app.</p><p>Account ID: <code>'+escapeHtml(token.sub)+'</code></p><form method="post" action="/ios/auth/confirm"><input type="hidden" name="flow" value="'+escapeHtml(signed||"")+'"><input type="hidden" name="csrf" value="'+escapeHtml(confirmation.token)+'"><button type="submit">Continue to iPhone</button></form></main></body></html>';
  return new Response(html,{headers:{...safeHeaders,"Content-Type":"text/html; charset=utf-8","Set-Cookie":csrfCookie+"="+confirmation.cookie+"; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Strict"}});
 }
 if(request.method!=="POST"||url.search)return error(405);
 const form=await readForm(request);
 if(!form||!onlyParams(form,["flow","csrf"]))return error();
 const flow=readNativeFlow(form.get("flow"),secret,now);
 if(!flow||!nativeSessionMatches(flow,token)||typeof token?.sub!=="string"||
    !validNativeConfirmation(flow,token.sub,form.get("csrf"),cookieValue(request.headers.get("cookie"),csrfCookie),secret))return error(403);
 try{
  const ticket=await issueNativeTicket(db,flow,token.sub,secret,now);
  if(!ticket)return error(409);
  const destination=new URL("com.myftcspace.ios.auth://complete/");
  destination.searchParams.set("state",flow.state);destination.searchParams.set("ticket",ticket);
  return new Response(null,{status:303,headers:{...safeHeaders,"Location":destination.toString(),"Set-Cookie":csrfCookie+"=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict"}});
 }catch{return error(503);}
}
