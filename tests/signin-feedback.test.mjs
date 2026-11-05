import test,{after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "vite-legacy";
import {renderToStaticMarkup} from "react-dom/server";

const vite=await createServer({configFile:false,cacheDir:".sites-runtime/signin-feedback-"+process.pid,esbuild:{jsx:"automatic"},plugins:[{
 name:"fictional-session",enforce:"pre",
 resolveId(id,importer){
  if(id==="server-only")return "\0server-only-test";
  if(id==="../auth-identity"&&importer?.replaceAll("\\","/").endsWith("/app/enroll/page.tsx"))return "\0fictional-session";
 },
 load(id){
  if(id==="\0server-only-test")return "export {}";
  if(id==="\0fictional-session")return "export async function getCurrentUser(){return globalThis.__testSignInUser ?? null}";
 }
}],server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(async()=>{delete globalThis.__testSignInUser;await vite.close();});
const {default:LoginPage}=await vite.ssrLoadModule("/app/signin/page.tsx");
const {default:EnrollmentPage}=await vite.ssrLoadModule("/app/enroll/page.tsx");
const {assessReadiness,checklistIds}=await vite.ssrLoadModule("/server/readiness.ts");

function findProvider(node){
 if(!node||typeof node!=="object")return null;
 if(Array.isArray(node))return node.map(findProvider).find(Boolean)||null;
 if(node.props?.provider==="google")return node;
 return findProvider(node.props?.children);
}
function approvedRecord(){
 const now=Date.now(),approvedAt=new Date(now-60000).toISOString(),expiresAt=new Date(now+86400000).toISOString();
 const releaseId=JSON.parse(readFileSync("server/release-manifest.json","utf8")).releaseId;
 return {schemaVersion:1,releaseId,origin:"https://team.test",scope:"team-pilot",adultOwner:"Reviewer A",organization:"Robotics organization",supportEmail:"support@school.test",privacyEmail:"privacy@school.test",approvedAt,expiresAt,minimumAge:13,maximumAge:18,minorPermissionConfirmed:true,allowedAccountIds:["adult-a"],adultAccountIds:["adult-a"],allowedTeamIds:["team-a"],teamCreationAccountIds:[],checklist:Object.fromEntries(checklistIds.map(id=>[id,{decision:"PASS",evidence:"review/"+id,reviewer:"Reviewer A",reviewedAt:approvedAt}]))};
}
const names=["NODE_ENV","NEXTAUTH_SECRET","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","MYFTC_DATA_ENABLED","MYFTC_SERVICE_PAUSED","MYFTC_READINESS_RECORD","MYFTC_SELF_SERVICE_ENABLED"];
async function withEnvironment(fn){
 const original=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try{
  for(const name of names)delete process.env[name];
  Object.assign(process.env,{NODE_ENV:"production",NEXTAUTH_SECRET:"fictional",GOOGLE_CLIENT_ID:"fictional",GOOGLE_CLIENT_SECRET:"fictional"});
  await fn();
 }finally{
  for(const name of names){if(original[name]===undefined)delete process.env[name];else process.env[name]=original[name];}
 }
}

test("closed production sign-in defaults to setup and preserves explicitly requested safe routes",()=>withEnvironment(async()=>{
 const callback=async params=>findProvider(await LoginPage({searchParams:Promise.resolve(params)})).props.callbackUrl;
 assert.equal(await callback({}),"/enroll");
 assert.equal(await callback({callbackUrl:"/maintenance"}),"/maintenance");
 assert.equal(await callback({callbackUrl:"/#settings"}),"/#settings");
 assert.equal(await callback({callbackUrl:"//evil.test/"}),"/enroll");
 assert.equal(await callback({callbackUrl:"/api/admin"}),"/enroll");
 assert.equal(await callback({callbackUrl:"https://evil.test/"}),"/enroll");
 process.env.NODE_ENV="development";
 assert.equal(await callback({}),"/");
}));

test("an approved release retains the normal root callback",()=>withEnvironment(async()=>{
 const record=approvedRecord();
 process.env.MYFTC_DATA_ENABLED="true";
 process.env.MYFTC_READINESS_RECORD=JSON.stringify(record);
 assert.equal(assessReadiness({MYFTC_DATA_ENABLED:"true",MYFTC_READINESS_RECORD:JSON.stringify(record)}).enabled,true);
 assert.equal(findProvider(await LoginPage({searchParams:Promise.resolve({})})).props.callbackUrl,"/");
}));

test("setup acknowledges an authenticated user without implying the team gate is open",()=>withEnvironment(async()=>{
 globalThis.__testSignInUser={userId:"fictional-provider-id"};
 const markup=renderToStaticMarkup(await EnrollmentPage());
 assert.match(markup,/You are signed in\. Team access is still being prepared\./);
 assert.match(markup,/Self-service team creation is not open yet/);
 assert.match(markup,/Account ID for a roster-based release/);
 assert.doesNotMatch(markup,/Continue to team settings/);
 globalThis.__testSignInUser=null;
 const signedOut=renderToStaticMarkup(await EnrollmentPage());
 assert.doesNotMatch(signedOut,/You are signed in/);
 assert.match(signedOut,/Sign in for roster-based release setup/);
}));

test("an approved roster-based release describes organization-managed access",()=>withEnvironment(async()=>{
 const record=approvedRecord();
 process.env.MYFTC_DATA_ENABLED="true";
 process.env.MYFTC_READINESS_RECORD=JSON.stringify(record);
 globalThis.__testSignInUser={userId:"adult-a"};
 const markup=renderToStaticMarkup(await EnrollmentPage());
 assert.match(markup,/You are signed in\. Your organization manages team access\./);
 assert.doesNotMatch(markup,/Team access is still being prepared/);
 assert.doesNotMatch(markup,/service is still being prepared/);
 assert.match(markup,/Self-service team creation is not available/);
 assert.match(markup,/Account ID for a roster-based release/);
 assert.doesNotMatch(markup,/Continue to team settings/);
 globalThis.__testSignInUser=null;
}));
