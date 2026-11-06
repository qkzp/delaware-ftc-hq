import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createHash,randomBytes} from "node:crypto";
import {createRequire} from "node:module";
import {dirname,join} from "node:path";
import {createServer as createHttpServer} from "node:http";
import {once} from "node:events";
import {createServer} from "vite-legacy";
import {database} from "./sql-fixture.mjs";

const require=createRequire(import.meta.url),root=dirname(require.resolve("next-auth"));
const {AuthHandler}=require(join(root,"core/index.js"));
const {decode,encode}=require("next-auth/jwt");
const vite=await createServer({configFile:false,cacheDir:".sites-runtime/native-auth-"+process.pid,server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {createNativeFlow,readNativeFlow,createNativeSnapshot,validNativeSnapshot,nativeSessionMarker,nativeSessionMatches,issueNativeTicket,redeemNativeTicket}=await vite.ssrLoadModule("/server/native-auth-handoff.ts");
const {nativeOAuthCallbackOptions}=await vite.ssrLoadModule("/server/native-auth-options.ts");
const {nativeHandoffProvider}=await vite.ssrLoadModule("/server/native-auth-provider.ts");
const {minimizeIdentityToken}=await vite.ssrLoadModule("/server/auth-profile.ts");
const {handleNativeConfirmation}=await vite.ssrLoadModule("/server/native-auth-confirm.ts");
const {runScheduledRetention}=await vite.ssrLoadModule("/server/retention.ts");
const secret="fictional-secret-long-enough-for-native-tests",origin="https://team.test";
const random=()=>randomBytes(32).toString("base64url");
const hash=value=>createHash("sha256").update(value).digest("base64url");
function newFlow(identity=null,now=Date.now()){
 const verifier=random(),snapshot=createNativeSnapshot(identity,secret,now),state=random();
 const signed=createNativeFlow({provider:"google",state,challenge:hash(verifier),snapshot,callbackUrl:"/#settings"},secret,now);
 const flow=readNativeFlow(signed,secret,now);
 assert.ok(flow);return {flow,signed,verifier,snapshot,state};
}
function request(url,method="GET",body,extra={}){
 const headers={host:"team.test","x-forwarded-proto":"https",...extra};
 return new Request(url,{method,headers,...(body!==undefined?{body}: {})});
}

test("signed flows, subject-bound marker and snapshots reject tampering and account changes",()=>{
 const now=Date.now(),{flow,signed,snapshot}=newFlow("google:first",now);
 assert.equal(validNativeSnapshot(snapshot,"google:first",secret,now),true);
 assert.equal(validNativeSnapshot(snapshot,"google:second",secret,now),false);
 assert.equal(validNativeSnapshot(snapshot,null,secret,now),false);
 assert.equal(validNativeSnapshot(snapshot,"google:first",secret,now+900000),false);
 assert.equal(readNativeFlow(signed+"x",secret,now),null);
 assert.equal(readNativeFlow(signed,secret,now+600000),null);
 assert.equal(createNativeFlow({provider:"google",state:random(),challenge:random(),snapshot,callbackUrl:"//attacker.test/"},secret,now),null);
 assert.equal(createNativeFlow({provider:"apple",state:random(),challenge:random(),snapshot,callbackUrl:"/"},secret,now),null);
 const marker=nativeSessionMarker(flow,"google:first"),token={sub:"google:first",nativeAuthFlow:marker};
 assert.equal(nativeSessionMatches(flow,token),true);
 assert.equal(nativeSessionMatches(flow,{...token,sub:"google:second"}),false);
 const switched=minimizeIdentityToken({...token},{type:"oauth",provider:"google",providerAccountId:"second"},"second");
 assert.equal(switched.sub,"google:second");
 assert.equal(switched.nativeAuthFlow,undefined);
 assert.equal(nativeSessionMatches(flow,switched),false);
});

test("confirmation requires a fresh matching session, explicit same-origin CSRF-protected POST, and one-time proof",async()=>{
 const db=database(),now=Date.now(),{flow,signed,verifier,snapshot,state}=newFlow(null,now);
 const token={sub:"google:member",nativeAuthFlow:nativeSessionMarker(flow,"google:member")},ctx={secret,origin,db,token,now};
 const url=origin+"/ios/auth/confirm?flow="+encodeURIComponent(signed);
 try{
  assert.equal((await handleNativeConfirmation(request(url),{...ctx,token:{sub:"google:member"}})).status,403);
  assert.equal((await handleNativeConfirmation(request(url),{...ctx,token:{...token,sub:"google:other"}})).status,403);
  const page=await handleNativeConfirmation(request(url),ctx);
  assert.equal(page.status,200);
  assert.match(page.headers.get("cache-control"),/no-store/);
  assert.match(page.headers.get("referrer-policy"),/no-referrer/);
  assert.match(page.headers.get("set-cookie"),/Secure; HttpOnly; SameSite=Strict/);
  const html=await page.text(),csrf=html.match(/name="csrf" value="([^"]+)"/)?.[1];
  const cookie=page.headers.get("set-cookie").split(";")[0];
  assert.ok(csrf&&cookie);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM native_auth_tickets").get().n,0);
  const body=new URLSearchParams({flow:signed,csrf}).toString();
  const headers={"content-type":"application/x-www-form-urlencoded",cookie,origin,"sec-fetch-site":"same-origin"};
  assert.equal((await handleNativeConfirmation(request(origin+"/ios/auth/confirm","POST",body,{...headers,origin:"https://attacker.test"}),ctx)).status,403);
  assert.equal((await handleNativeConfirmation(request(origin+"/ios/auth/confirm","POST",body,{...headers,cookie:""}),ctx)).status,403);
  assert.equal((await handleNativeConfirmation(request(origin+"/ios/auth/confirm","POST",body+"&csrf=duplicate",headers),ctx)).status,400);
  assert.equal((await handleNativeConfirmation(request(origin+"/ios/auth/confirm","POST",body,headers),{...ctx,token:{...token,sub:"google:other"}})).status,403);
  const result=await handleNativeConfirmation(request(origin+"/ios/auth/confirm","POST",body,headers),ctx);
  assert.equal(result.status,303);
  const destination=new URL(result.headers.get("location")),ticket=destination.searchParams.get("ticket");
  assert.equal(destination.origin,"null");
  assert.equal(destination.protocol,"com.myftcspace.ios.auth:");
  assert.equal(destination.host,"complete");
  assert.equal(destination.pathname,"/");
  assert.equal(destination.searchParams.get("state"),state);
  assert.match(ticket,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.headers.get("location").includes(verifier),false);
  assert.equal(await redeemNativeTicket(db,ticket,random(),snapshot,null,secret,now),null);
  assert.equal(await redeemNativeTicket(db,ticket,verifier,snapshot,"google:other",secret,now),null);
  const concurrent=await Promise.all([redeemNativeTicket(db,ticket,verifier,snapshot,null,secret,now),redeemNativeTicket(db,ticket,verifier,snapshot,null,secret,now)]);
  assert.deepEqual(concurrent.sort(),[null,"google:member"].sort());
  assert.equal((await handleNativeConfirmation(request(origin+"/ios/auth/confirm","POST",body,headers),ctx)).status,409);
 }finally{db.close();}
});

test("ticket issuance is subject-rate-limited, expires, and retains replay tombstones",async()=>{
 const db=database(),now=Date.now(),subject="google:member";
 try{
  const attempts=Array.from({length:6},()=>newFlow(null,now));
  const issued=[];
  for(const attempt of attempts)issued.push(await issueNativeTicket(db,attempt.flow,subject,secret,now));
  assert.equal(issued.filter(Boolean).length,5);
  assert.equal(await issueNativeTicket(db,attempts[0].flow,subject,secret,now),null);
  assert.equal(await redeemNativeTicket(db,issued[0],attempts[0].verifier,attempts[0].snapshot,null,secret,now+120000),null);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM native_auth_used_flows").get().n,5);
  assert.ok(!JSON.stringify(db.sqlite.prepare("SELECT rate_key FROM native_auth_rate").all()).includes(subject));
  await runScheduledRetention(db,now+900001);
  for(const table of ["native_auth_tickets","native_auth_used_flows","native_auth_rate"])assert.equal(db.sqlite.prepare("SELECT count(*) n FROM "+table).get().n,0);
 }finally{db.close();}
});

test("simultaneous issuance cannot exceed the per-account limit",async()=>{
 const db=database(),now=Date.now(),attempts=Array.from({length:12},()=>newFlow(null,now));
 let queue=Promise.resolve();
 const serialDb={...db,batch(statements){const job=queue.then(()=>db.batch(statements));queue=job.catch(()=>{});return job;}};
 try{
  const results=await Promise.all(attempts.map(attempt=>issueNativeTicket(serialDb,attempt.flow,"google:member",secret,now)));
  assert.equal(results.filter(Boolean).length,5);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM native_auth_used_flows").get().n,5);
  assert.equal(db.sqlite.prepare("SELECT count FROM native_auth_rate").get().count,5);
 }finally{db.close();}
});

test("real NextAuth credentials callback keeps CSRF, refuses changed WebView identity, and creates the usual session",async()=>{
 const db=database(),previous=process.env.NEXTAUTH_URL;process.env.NEXTAUTH_URL=origin;
 const now=Date.now(),attempt=newFlow("google:old",now);
 const provider=nativeHandoffProvider(()=>db,secret),options={secret,providers:[provider],session:{strategy:"jwt",maxAge:28800},callbacks:{jwt:async({token,account,user})=>minimizeIdentityToken(token,account,user?.id)},logger:{error(){},warn(){},debug(){}}};
 const jar={"__Secure-next-auth.session-token":await encode({secret,token:{sub:"google:old"}})};
 const run=async(action,method,body={})=>AuthHandler({options,req:{action,providerId:action==="callback"?"native-handoff":undefined,method,cookies:jar,query:{},body,headers:{host:"team.test","x-forwarded-proto":"https",cookie:Object.entries(jar).map(([key,value])=>key+"="+encodeURIComponent(value)).join("; ")}}});
 try{
  const ticket=await issueNativeTicket(db,attempt.flow,"google:new",secret,now),csrf=await run("csrf","GET");
  for(const cookie of csrf.cookies||[])if(cookie.value)jar[cookie.name]=cookie.value;
  const body={csrfToken:csrf.body.csrfToken,ticket,verifier:attempt.verifier,snapshot:attempt.snapshot,callbackUrl:origin+"/"};
  const badCsrf=await run("callback","POST",{...body,csrfToken:"wrong"});assert.match(badCsrf.redirect,/csrf=true/);
  delete jar["__Secure-next-auth.session-token"];
  const signedOut=await run("callback","POST",body);assert.match(signedOut.redirect,/CredentialsSignin/);
  jar["__Secure-next-auth.session-token"]=await encode({secret,token:{sub:"google:changed"}});
  const switched=await run("callback","POST",body);assert.match(switched.redirect,/CredentialsSignin/);
  jar["__Secure-next-auth.session-token"]=await encode({secret,token:{sub:"google:old"}});
  const result=await run("callback","POST",body),cookie=result.cookies.find(item=>item.name==="__Secure-next-auth.session-token"&&item.value);
  assert.ok(cookie);assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.secure,true);
  const session=await decode({secret,token:cookie.value});assert.equal(session.sub,"google:new");assert.equal(session.nativeAuthFlow,undefined);
  const replay=await run("callback","POST",body);assert.match(replay.redirect,/CredentialsSignin/);
 }finally{db.close();if(previous===undefined)delete process.env.NEXTAUTH_URL;else process.env.NEXTAUTH_URL=previous;}
});

test("real NextAuth Google callback requires OAuth state and PKCE before minting the native marker",async()=>{
 const previous=process.env.NEXTAUTH_URL;process.env.NEXTAUTH_URL=origin;
 const {flow,signed}=newFlow(),subject="google-member";let expectedChallenge="",tokenRequests=0;
 const mock=createHttpServer(async(req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.url==="/token"&&req.method==="POST"){
   let body="";for await(const chunk of req)body+=chunk;
   const params=new URLSearchParams(body);
   if(params.get("code")!=="fictional-code"||hash(params.get("code_verifier")||"")!==expectedChallenge)return res.writeHead(400).end("{}");
   tokenRequests++;return res.end(JSON.stringify({access_token:"fictional",token_type:"Bearer"}));
  }
  if(req.url==="/userinfo")return res.end(JSON.stringify({sub:subject,email:"member@team.test"}));
  res.writeHead(404).end("{}");
 });
 mock.listen(0,"127.0.0.1");await once(mock,"listening");
 const base="http://127.0.0.1:"+mock.address().port;
 const provider={id:"google",name:"Google",type:"oauth",clientId:"fictional",clientSecret:"fictional",issuer:base,authorization:{url:base+"/authorize"},token:{url:base+"/token"},userinfo:{url:base+"/userinfo"},checks:["pkce","state"],idToken:false,profile:profile=>({id:profile.sub,email:profile.email})};
 const options={secret,providers:[provider],session:{strategy:"jwt"},callbacks:{jwt:async({token,account,user})=>minimizeIdentityToken(token,account,user?.id)},logger:{error(){},warn(){},debug(){}}},jar={};
 const run=async(opts,action,method,query={},body={})=>AuthHandler({options:opts,req:{action,providerId:action==="csrf"?undefined:"google",method,cookies:jar,query,body,headers:{host:"team.test","x-forwarded-proto":"https"}}});
 const apply=response=>{for(const cookie of response.cookies||[])if(cookie.value)jar[cookie.name]=cookie.value;};
 try{
  const csrf=await run(options,"csrf","GET");apply(csrf);
  const start=await run(options,"signin","POST",{}, {csrfToken:csrf.body.csrfToken,callbackUrl:origin+"/ios/auth/confirm?flow="+encodeURIComponent(signed)});apply(start);
  const auth=new URL(start.redirect),state=auth.searchParams.get("state");expectedChallenge=auth.searchParams.get("code_challenge");
  assert.ok(state&&expectedChallenge&&jar["__Secure-next-auth.callback-url"]);
  const wrapped=nativeOAuthCallbackOptions(options,["callback","google"],"GET",jar["__Secure-next-auth.callback-url"],origin,secret);
  const invalid=await run(wrapped,"callback","GET",{state:"wrong",code:"fictional-code"});
  assert.match(invalid.redirect,/error=OAuthCallback/);assert.equal(tokenRequests,0);
  for(const name of ["__Secure-next-auth.state","__Secure-next-auth.pkce.code_verifier"]){
   const saved=jar[name];delete jar[name];
   const missing=await run(wrapped,"callback","GET",{state,code:"fictional-code"});
   assert.match(missing.redirect,/error=OAuthCallback/);assert.equal(tokenRequests,0);
   assert.ok(!(missing.cookies||[]).some(cookie=>cookie.name==="__Secure-next-auth.session-token"&&cookie.value));
   jar[name]=saved;
  }
  const complete=await run(wrapped,"callback","GET",{state,code:"fictional-code"});
  const session=complete.cookies.find(cookie=>cookie.name==="__Secure-next-auth.session-token"&&cookie.value);
  assert.ok(session);const token=await decode({secret,token:session.value});
  assert.equal(token.sub,"google:"+subject);assert.equal(nativeSessionMatches(flow,token),true);assert.equal(tokenRequests,1);
  assert.equal(nativeOAuthCallbackOptions(options,["callback","google"],"GET","https://evil.test/ios/auth/confirm?flow="+signed,origin,secret),options);
 }finally{if(previous===undefined)delete process.env.NEXTAUTH_URL;else process.env.NEXTAUTH_URL=previous;await new Promise((resolve,reject)=>mock.close(error=>error?reject(error):resolve()));}
});
