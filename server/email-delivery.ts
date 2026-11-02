import {normalizeLoginEmail} from "./auth-adapter";

export async function sendLoginEmail(db:D1Database,{identifier,url}:{identifier:string;url:string},{apiKey,from}:{apiKey:string;from:string}){
  const email=normalizeLoginEmail(identifier),now=Date.now();
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(email)))].map(n=>n.toString(16).padStart(2,"0")).join("");
  await db.prepare("DELETE FROM auth_email_rate WHERE created<?").bind(now-86400000).run();
  const admitted=await db.prepare("INSERT INTO auth_email_rate(id,recipient_hash,created) SELECT ?,?,? WHERE (SELECT count(*) FROM auth_email_rate WHERE recipient_hash=? AND created>?)<5 AND (SELECT count(*) FROM auth_email_rate WHERE created>?)<500").bind(crypto.randomUUID(),hash,now,hash,now-3600000,now-3600000).run();
  if(!admitted.meta.changes)throw new Error("Sign-in email is temporarily unavailable. Try again later.");
  const safeUrl=url.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":`login-${crypto.randomUUID()}`},body:JSON.stringify({from,to:[email],subject:"Your MyFTCSpace sign-in link",text:`Sign in to MyFTCSpace using this one-time link. It expires in 15 minutes.\n\n${url}\n\nIf you did not request this email, ignore it. This email does not grant team membership.`,html:`<p>Sign in to MyFTCSpace using this one-time link. It expires in 15 minutes.</p><p><a href="${safeUrl}">Sign in to MyFTCSpace</a></p><p>If you did not request this email, ignore it. This email does not grant team membership.</p>`}),cache:"no-store"});
  if(!response.ok)throw new Error("Sign-in email could not be delivered. Try again later.");
}
