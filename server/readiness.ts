import release from "./release-manifest.json" with { type: "json" };

export const checklistIds = [
  ...Array.from({length:5},(_,i)=>`1.${i+1}`),
  ...Array.from({length:5},(_,i)=>`2.${i+1}`),
  ...Array.from({length:8},(_,i)=>`3.${i+1}`),
  ...Array.from({length:8},(_,i)=>`4.${i+1}`),
  ...Array.from({length:7},(_,i)=>`5.${i+1}`),
  ...Array.from({length:5},(_,i)=>`6.${i+1}`),
  ...Array.from({length:5},(_,i)=>`7.${i+1}`),
] as readonly string[];
export type ReviewDecision = { decision:"PASS"|"N/A"; evidence:string; reviewer:string; reviewedAt:string; rationale?:string };
export type ReadinessRecord = {
 schemaVersion:1; releaseId:string; origin:string; scope:"team-pilot"|"school-use"|"public-multi-team";
 adultOwner:string; organization:string; supportEmail:string; privacyEmail:string;
 approvedAt:string; expiresAt:string; minimumAge:number; maximumAge:number; minorPermissionConfirmed:true;
 allowedAccountIds:string[]; adultAccountIds:string[]; allowedTeamIds:string[]; teamCreationAccountIds:string[];
 checklist:Record<string,ReviewDecision>;
};
export type ReadinessEnvironment = {
 MYFTC_DATA_ENABLED?:string; MYFTC_SERVICE_PAUSED?:string; MYFTC_READINESS_RECORD?:string;
};
const text=(v:unknown,max=300):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=max&&!/^(pending|todo|tbd|unknown|replace|example)/i.test(v.trim());
const email=(v:unknown):v is string=>typeof v==="string"&&v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)&&!/@(?:example\.(?:com|org|net)|invalid)$/i.test(v);
const ids=(v:unknown,max:number):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(x=>text(x,200)&&!/[\s/\\?#]/.test(x))&&new Set(v).size===v.length;
const timestamp=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v.replace(/Z$/,v.includes(".")?"Z":".000Z");
/** Validate operator-supplied evidence references. This cannot authenticate a human signature or decide legal applicability. */
export function assessReadiness(environment:ReadinessEnvironment, options:{now?:number;releaseId?:string;origin?:string}={}) {
 const now=options.now??Date.now(),releaseId=options.releaseId??release.releaseId,issues:string[]=[];
 let candidate:any;
 try{candidate=JSON.parse(environment.MYFTC_READINESS_RECORD||"null");}catch{issues.push("The readiness record is invalid JSON.");}
 let record:ReadinessRecord|null=null;
 if(!candidate||typeof candidate!=="object"||Array.isArray(candidate)){issues.push("A complete operator-managed readiness record is required.");}
 else {
  const c=candidate;let structure=true;
  const reject=(message:string)=>{structure=false;issues.push(message);};
  if(c.schemaVersion!==1)reject("The readiness record schema is unsupported.");
  if(!text(c.releaseId,100)||!/^sha256:[a-f0-9]{64}$/.test(c.releaseId))reject("A built release fingerprint is required.");
  try{const u=new URL(c.origin);if(u.protocol!=="https:"||u.origin!==c.origin||u.username||u.password)reject("The approved origin must be an HTTPS origin.");}catch{reject("The approved origin is invalid.");}
  if(!["team-pilot","school-use","public-multi-team"].includes(c.scope))reject("An approved release scope is required.");
  if(!text(c.adultOwner)||!text(c.organization)||!email(c.supportEmail)||!email(c.privacyEmail))reject("A named adult, organization and monitored real support/privacy contacts are required.");
  if(!Number.isInteger(c.minimumAge)||c.minimumAge<13||!Number.isInteger(c.maximumAge)||c.maximumAge>18||c.minimumAge>c.maximumAge||c.minorPermissionConfirmed!==true)reject("Direct student accounts must be approved ages 13–18 with the required minor permissions.");
  if(!ids(c.allowedAccountIds,500)||c.allowedAccountIds.length===0||!ids(c.adultAccountIds,100)||c.adultAccountIds.length===0||!ids(c.allowedTeamIds,20)||c.allowedTeamIds.length===0||!ids(c.teamCreationAccountIds,20))reject("Explicit account, adult and team allowlists are required.");
  else if(!c.adultAccountIds.every((id:string)=>c.allowedAccountIds.includes(id))||!c.teamCreationAccountIds.every((id:string)=>c.adultAccountIds.includes(id)))reject("Adult and team-creation access must be within the approved roster.");
  const approved=timestamp(c.approvedAt)?Date.parse(c.approvedAt):NaN,expires=timestamp(c.expiresAt)?Date.parse(c.expiresAt):NaN;
  if(!Number.isFinite(approved)||!Number.isFinite(expires)||expires<=approved||expires-approved>90*86400000)reject("Approval must have valid UTC timestamps and an expiry no later than 90 days after approval.");
  for(const id of checklistIds) {
   const row=c.checklist?.[id];
   if(!row||!["PASS","N/A"].includes(row.decision)||!text(row.evidence,2000)||!text(row.reviewer)||!timestamp(row.reviewedAt)||Date.parse(row.reviewedAt)>now||Date.parse(row.reviewedAt)>approved||row.decision==="N/A"&&!text(row.rationale,2000))reject(`Checklist row ${id} needs a reviewer, evidence and a supported decision.`);
  }
  if(structure){
   record=c as ReadinessRecord;
   if(releaseId==="unbuilt"||c.releaseId!==releaseId)issues.push("The approved fingerprint does not match this build.");
   if(approved>now||expires<=now)issues.push("The release approval is not currently valid.");
   if(options.origin&&options.origin!==c.origin)issues.push("The request origin is outside the approved deployment.");
  }
 }
 if(environment.MYFTC_DATA_ENABLED!=="true")issues.push("Real-data access has not been enabled by the operator.");
 if(environment.MYFTC_SERVICE_PAUSED==="true")issues.push("The operator has paused the service.");
 return {enabled:issues.length===0,record,issues,releaseId};
}
export function publicSupport(record:ReadinessRecord|null) {
 return record?{supportEmail:record.supportEmail,privacyEmail:record.privacyEmail}:null;
}
export function isMaintenanceRequest(request:Request) {
 const path=new URL(request.url).pathname;
 return /^\/api\/teams\/[^/]+\/privacy(?:\/(?:requests(?:\/[^/]+)?|withdraw-evidence|erase))?$/.test(path);
}
