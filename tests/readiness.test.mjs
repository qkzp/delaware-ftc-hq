import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite-legacy";
import {fingerprint,writeReleaseFingerprint} from "../scripts/release-fingerprint.mjs";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
const vite=await createServer({configFile:false,server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {assessReadiness,checklistIds,isMaintenanceRequest}=await vite.ssrLoadModule("/server/readiness.ts");
const now=Date.parse("2026-11-01T12:00:00Z"),releaseId="sha256:"+"a".repeat(64);
function approved(){
 return {schemaVersion:1,releaseId,origin:"https://team.test",scope:"team-pilot",adultOwner:"Reviewer A.",organization:"Robotics organization",supportEmail:"support@school.test",privacyEmail:"privacy@school.test",approvedAt:"2026-10-31T12:00:00Z",expiresAt:"2026-11-30T12:00:00Z",minimumAge:13,maximumAge:18,minorPermissionConfirmed:true,allowedAccountIds:["adult-a","student-a"],adultAccountIds:["adult-a"],allowedTeamIds:["team-a"],teamCreationAccountIds:[],checklist:Object.fromEntries(checklistIds.map(id=>[id,{decision:"PASS",evidence:"private-review/"+id,reviewer:"Reviewer A.",reviewedAt:"2026-10-31T12:00:00Z"}]))};
}
const assess=(record,extra={})=>assessReadiness({MYFTC_DATA_ENABLED:"true",MYFTC_READINESS_RECORD:JSON.stringify(record),...extra},{now,releaseId,origin:"https://team.test"});
test("real-data access is closed without a complete externally managed review",()=>{
 assert.equal(checklistIds.length,43);
 assert.equal(assessReadiness({},{now,releaseId}).enabled,false);
 assert.equal(assessReadiness({MYFTC_DATA_ENABLED:"true",MYFTC_READINESS_RECORD:"{"},{now,releaseId}).enabled,false);
 const record=approved();assert.equal(assess(record).enabled,true);
 for(const id of checklistIds){const incomplete=structuredClone(record);delete incomplete.checklist[id];assert.equal(assess(incomplete).enabled,false,id);}
 assert.equal(assess(record,{MYFTC_DATA_ENABLED:"false"}).enabled,false);
 assert.equal(assess(record,{MYFTC_SERVICE_PAUSED:"true"}).enabled,false);
});
test("self-service requires explicit public-scope review and a separate operator switch",()=>{
 const record={...approved(),scope:"public-multi-team",accessModel:"self-service",allowedAccountIds:[],adultAccountIds:[],allowedTeamIds:[],teamCreationAccountIds:[],selfServiceReview:{evidence:"review/self-service",reviewer:"Reviewer A.",reviewedAt:"2026-10-31T12:00:00Z"}};
 assert.equal(assess(record).enabled,false);
 const enabled={MYFTC_SELF_SERVICE_ENABLED:"true"};
 assert.equal(assess(record,enabled).enabled,true);
 for(const patch of [{scope:"team-pilot"},{selfServiceReview:undefined},{selfServiceReview:{...record.selfServiceReview,evidence:""}},{selfServiceReview:{...record.selfServiceReview,reviewedAt:"2026-11-01T11:00:00Z"}},{accessModel:"unexpected"}])assert.equal(assess({...record,...patch},enabled).enabled,false);
 const missingChecklist=structuredClone(record);delete missingChecklist.checklist["1.1"];assert.equal(assess(missingChecklist,enabled).enabled,false);
 assert.equal(assess(record,{...enabled,MYFTC_DATA_ENABLED:"false"}).enabled,false);
});
test("approval cannot outlive its release, origin, dates, roster or permitted ages",()=>{
 for(const patch of [{releaseId:"sha256:"+"b".repeat(64)},{origin:"https://another.test"},{minimumAge:12},{maximumAge:19},{minorPermissionConfirmed:false},{adultAccountIds:["not-approved"]},{teamCreationAccountIds:["student-a"]},{allowedTeamIds:[]},{supportEmail:"support@example.com"},{expiresAt:"2027-11-01T12:00:00Z"},{expiresAt:"2026-11-01T11:59:00Z"},{approvedAt:"2026-11-02T12:00:00Z"}])assert.equal(assess({...approved(),...patch}).enabled,false,JSON.stringify(patch));
});
test("N/A requires a reviewer, evidence and recorded rationale; pending is never a pass",()=>{
 const record=approved();record.checklist["5.7"].decision="N/A";
 assert.equal(assess(record).enabled,false);
 record.checklist["5.7"].rationale="No email sender is enabled in the reviewed release.";
 assert.equal(assess(record).enabled,true);
 record.checklist["5.7"].reviewer="";assert.equal(assess(record).enabled,false);
 record.checklist["5.7"].decision="PENDING";assert.equal(assess(record).enabled,false);
});
test("malformed review timestamps never throw or normalize impossible dates into approval",()=>{
 for(const invalid of [null,0,{}, {toString:0,valueOf:0},"2026-02-30T12:00:00Z","2026-10-31","2026-10-31T12:00:00-04:00"]){
  for(const field of ["approvedAt","expiresAt"]){const record=approved();record[field]=invalid;assert.equal(assess(record).enabled,false);}
  const record=approved();record.checklist["1.1"].reviewedAt=invalid;assert.equal(assess(record).enabled,false);
 }
 const afterApproval=approved();afterApproval.checklist["1.1"].reviewedAt="2026-11-01T11:00:00Z";
 assert.equal(assess(afterApproval).enabled,false,"row decisions must exist before final approval");
});
test("a closed release retains only narrowly routed data-rights operations",()=>{
 for(const endpoint of ["privacy","privacy/requests","privacy/requests/request-a","privacy/withdraw-evidence","privacy/erase"])assert.equal(isMaintenanceRequest(new Request("https://team.test/api/teams/team-a/"+endpoint)),true);
 for(const endpoint of ["files/private-file","history","invites","privacy/authorize-evidence","privacy/requests/x/extra"])assert.equal(isMaintenanceRequest(new Request("https://team.test/api/teams/team-a/"+endpoint)),false);
});
test("release fingerprints change with source and policy, are deterministic, and ignore generated identity",()=>{
 const root=mkdtempSync(path.join(tmpdir(),"myftc-fingerprint-"));
 try{
  mkdirSync(path.join(root,"src"));mkdirSync(path.join(root,"server"));mkdirSync(path.join(root,"docs"));
  writeFileSync(path.join(root,"src","app.ts"),"export const value=1;\n");
  writeFileSync(path.join(root,"vercel.json"),JSON.stringify({framework:"nextjs",buildCommand:"npm run build"},null,2));
  const first=fingerprint(root);assert.equal(first,fingerprint(root));
  writeFileSync(path.join(root,"src","app.ts"),"export const value=1;\r\n");assert.equal(first,fingerprint(root));
  writeFileSync(path.join(root,"vercel.json"),JSON.stringify({framework:"nextjs",buildCommand:"npm run build"})+"\n");assert.equal(first,fingerprint(root));
  writeFileSync(path.join(root,"server","release-manifest.json"),'{"releaseId":"different"}');assert.equal(first,fingerprint(root));
  writeReleaseFingerprint(root);
  writeFileSync(path.join(root,"docs","policy.md"),"Policy changed.");assert.notEqual(first,fingerprint(root));
  const changed=writeReleaseFingerprint(root);assert.deepEqual(changed.sourceChanges,["docs/policy.md"]);assert.equal(changed.sources["src/app.ts"].sha256.length,64);
  assert.deepEqual(writeReleaseFingerprint(root).sourceChanges,[]);
  writeFileSync(path.join(root,"vercel.json"),JSON.stringify({framework:"nextjs",buildCommand:"different command"}));assert.notEqual(changed.releaseId,fingerprint(root));assert.deepEqual(writeReleaseFingerprint(root).sourceChanges,["vercel.json"]);
 }finally{
  const resolved=path.resolve(root),expected=path.resolve(tmpdir())+path.sep;
  assert.ok(resolved.startsWith(expected)&&path.basename(resolved).startsWith("myftc-fingerprint-"));
  rmSync(resolved,{recursive:true,force:true});
 }
});
