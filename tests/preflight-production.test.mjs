import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hostedChecks,preflight,configurationPresence} from "../scripts/release-preflight.mjs";

const origin="https://app.test";
const releaseId=JSON.parse(readFileSync(new URL("../server/release-manifest.json",import.meta.url),"utf8")).releaseId;
const configured={signInMethods:["google"],database:true,privateFiles:true,scheduledCleanup:true};
const env={NEXTAUTH_URL:origin,NEXTAUTH_SECRET:"x".repeat(32),GOOGLE_CLIENT_ID:"fictional",GOOGLE_CLIENT_SECRET:"fictional",CLOUDFLARE_ACCOUNT_ID:"fictional",CLOUDFLARE_D1_DATABASE_ID:"fictional",CLOUDFLARE_D1_API_TOKEN:"fictional",CLOUDFLARE_R2_BUCKET_NAME:"fictional",CLOUDFLARE_R2_ACCESS_KEY_ID:"fictional",CLOUDFLARE_R2_SECRET_ACCESS_KEY:"fictional",CRON_SECRET:"y".repeat(32),MYFTC_READINESS_RECORD:"{}"};

function hosted(configuration= configured,cacheControl="private, no-store"){
 return async url=>{
  const pathname=new URL(url).pathname;
  if(pathname==="/api/deployment/status")return Response.json({schemaVersion:1,releaseId,teamAccess:"enabled",configuration},{headers:{"Cache-Control":cacheControl}});
  if(pathname==="/api/maintenance/retention")return new Response(null,{status:401});
  return Response.json({},{headers:{"Cache-Control":"no-store"}});
 };
}

test("preflight independently blocks each unconfigured hosted service even with local credentials and an enabled label",async()=>{
 const local=configurationPresence(env);
 for(const key of ["sessions","google","database","privateFiles","cleanup"])assert.equal(local[key].configured,true);
 const cases=[
  ["signInMethods",[],"no configured sign-in method"],
  ["database",false,"database configuration is missing or unverified"],
  ["privateFiles",false,"private-file storage configuration is missing or unverified"],
  ["scheduledCleanup",false,"scheduled cleanup configuration is missing or unverified"],
 ];
 for(const [key,value,expected] of cases){
  const result=await preflight({env,origin,fetcher:hosted({...configured,[key]:value})});
  assert.equal(result.hosted.deployment.teamAccess,"enabled");
  assert.equal(result.technicalPreflightPassed,false);
  assert.ok(result.blockers.some(message=>message.includes(expected)),`Missing blocker for ${key}`);
 }
 const complete=await preflight({env,origin,fetcher:hosted()});
 for(const [, ,expected] of cases)assert.ok(!complete.blockers.some(message=>message.includes(expected)));
});

test("deployment status requires an actual no-store directive, independently of matching fingerprint",async()=>{
 for(const cacheControl of ["", "public, max-age=60", "no-store-fake"]){
  const result=await hostedChecks(origin,{fetcher:hosted(configured,cacheControl),expectedRelease:releaseId});
  assert.equal(result.deployment.releaseMatches,true);
  assert.equal(result.checks.find(check=>check.path==="/api/deployment/status").ok,false,cacheControl);
 }
 const valid=await hostedChecks(origin,{fetcher:hosted(configured,"private, No-Store, max-age=0"),expectedRelease:releaseId});
 assert.equal(valid.checks.find(check=>check.path==="/api/deployment/status").ok,true);
});
