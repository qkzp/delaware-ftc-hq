import type { AppData, Role, Evidence } from "../src/types";
import { validateData } from "../src/persistence";
import { collectionAuthorized, consentContext } from "./privacy";
export type Envelope = { workspace: AppData; rsvps: Record<string, string[]>; learning: Record<string, {steps: string[]; skills: string[]}> };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Rebase independent edits; reject only a field changed differently by two writers. */
export function rebaseWorkspace(base: AppData, incoming: AppData, current: AppData): AppData {
 const result:any=structuredClone(current), collections=new Set(['tasks','events','resources','sponsors','grants','announcements','evidence','parts']);
 const mergeFields=(before:any, sent:any, latest:any)=>{
  const out={...latest};for(const key of new Set([...Object.keys(before||{}),...Object.keys(sent||{})])){
   if(same(before?.[key],sent?.[key]))continue;
   if(key==='comments'&&Array.isArray(before[key])&&Array.isArray(sent[key])&&Array.isArray(latest[key])&&before[key].every((c:unknown,i:number)=>same(c,sent[key][i]))&&before[key].every((c:unknown,i:number)=>same(c,latest[key][i]))){out[key]=[...latest[key],...sent[key].slice(before[key].length).filter((c:unknown)=>!latest[key].some((x:unknown)=>same(c,x)))];continue;}
   if(!same(before?.[key],latest?.[key])&&!same(sent?.[key],latest?.[key]))throw new ApiError(409,`A teammate changed ${key}. Download your unsaved changes and reload to review the conflict.`);
   if(sent?.[key]===undefined)delete out[key];else out[key]=structuredClone(sent[key]);
  }return out;
 };
 for(const key of Object.keys(incoming) as (keyof AppData)[]){
  if(collections.has(key)){
   const before=(base[key]||[]) as any[],sent=(incoming[key]||[]) as any[],latest=(current[key]||[]) as any[],out=structuredClone(latest);
   for(const item of sent){const old=before.find(x=>x.id===item.id),now=latest.find(x=>x.id===item.id);if(same(old,item))continue;if(!old&&now&&!same(item,now))throw new ApiError(409,'A record with this ID already exists.');if(old&&!now)throw new ApiError(409,'A teammate removed a record you edited.');const merged=old&&now?mergeFields(old,item,now):item;const index=out.findIndex(x=>x.id===item.id);index<0?out.push(merged):out.splice(index,1,merged);}
   for(const old of before)if(!sent.some(x=>x.id===old.id)){const now=latest.find(x=>x.id===old.id);if(now&&!same(now,old))throw new ApiError(409,'A teammate edited a record you removed.');const index=out.findIndex(x=>x.id===old.id);if(index>=0)out.splice(index,1);}
   result[key]=out;
  }else if(!same(base[key],incoming[key])){if(!same(base[key],current[key])&&!same(incoming[key],current[key]))throw new ApiError(409,`A teammate changed ${key}. Review the saved revision first.`);result[key]=structuredClone(incoming[key]);}
 }
 return result;
}
export const manages = (role: Role) => role !== "student";
export const reviews = (role: Role) => role === "mentor" || role === "admin";
export function assertTaskGraph(tasks:AppData['tasks']) {
 const taskMap = new Map(tasks.map(t => [t.id,t]));
 function visit(id: string, active = new Set<string>(), done = new Set<string>()) { if (active.has(id)) throw new ApiError(400,"Task dependencies contain a cycle."); if(done.has(id)) return; active.add(id); for(const dep of taskMap.get(id)?.dependencies || []) { if(!taskMap.has(dep)) throw new ApiError(400,"A linked task is missing."); visit(dep,active,done); } active.delete(id); done.add(id); }
 const visited = new Set<string>(); for(const id of taskMap.keys()) visit(id,new Set(),visited);
}
export function visibleEvidence(e: Evidence, role: Role, userId: string) { return manages(role) || e.owner === userId || (e.visibility !== "private" && e.approved); }
export function view(envelope: Envelope, role: Role, userId: string): AppData {
 const d = structuredClone(envelope.workspace);
 if (!manages(role)) {
  d.sponsors = [];
  d.grants = d.grants.filter(g => g.visibility === "team");
  d.resources = d.resources.filter(r => r.visibility !== "private" && r.approved);
 }
 d.evidence = (d.evidence || []).filter(e => visibleEvidence(e, role, userId));
 d.events = d.events.map(e => ({...e, rsvp: (envelope.rsvps[e.id] || []).includes(userId)}));
 d.onboarding = envelope.learning[userId]?.steps || [];
 d.skills = envelope.learning[userId]?.skills || [];
 return d;
}
export function mergeWorkspace(envelope: Envelope, incoming: AppData, role: Role, userId: string, now = new Date().toISOString()): Envelope {
 if (!validateData(incoming)) throw new ApiError(400, "The workspace contains invalid records.");
 const before = view(envelope, role, userId), next = structuredClone(envelope);
 const old = envelope.workspace;
 if (incoming.teamId !== old.teamId || incoming.seasonId !== old.seasonId) throw new ApiError(403, "Team and season boundaries cannot be changed.");
 const allowed = new Set(Object.keys(before));
 for (const k of Object.keys(incoming)) if (!allowed.has(k) && !["evidence", "parts"].includes(k)) throw new ApiError(400, "Unsupported workspace field.");
 const collections = ["tasks", "events", "resources", "sponsors", "grants", "announcements", "evidence"] as const;
 const basics = ["teamName", "teamNumber", "county", "seasonName", "robot", "coachInstructions", "pitChecklist", "pitNotes", "parts"] as const;
 for (const key of basics) if (!same(incoming[key] ?? (key === "parts" ? [] : undefined), before[key] ?? (key === "parts" ? [] : undefined))) {
  if (!manages(role)) {
   if (key !== "pitNotes" && key !== "pitChecklist") throw new ApiError(403, "A student lead or mentor must change team settings.");
   if (key === "pitChecklist") { if(!incoming.pitChecklist.every(id=>['robot-hardware','robot-code','robot-auto','robot-inspection','battery-charged','battery-safe','battery-chargers','battery-tools','pit-assignments','pit-schedule','pit-coach','pit-recap'].includes(id))) throw new ApiError(400,"Invalid pit checklist item."); (next.workspace as any)[key]=structuredClone(incoming[key]); continue; }
   const prior = old.pitNotes;
   if (incoming.pitNotes.length < prior.length || !prior.every(p => incoming.pitNotes.some(n => same(n,p)))) throw new ApiError(403, "Students may add pit notes but cannot alter someone else's note.");
  }
  (next.workspace as any)[key] = structuredClone(incoming[key]);
 }
 for (const key of collections) {
  const visibleOld = (before[key] || []) as any[], received = (incoming[key] || []) as any[];
  const all = (next.workspace[key] || []) as any[];
  for (const record of received) {
   const previous = visibleOld.find(r => r.id === record.id);
   const hidden = all.find(r => r.id === record.id);
   if (hidden && !previous) throw new ApiError(403, "This record is unavailable to your role.");
   if (same(record, previous)) continue;
   const updated = structuredClone(record);
   if (!manages(role)) {
    if (key === "tasks") {
     const ownTask = record.owner === userId && (!previous || previous.owner === userId);
     const onlyComments = previous && same({...record, comments: previous.comments}, previous) && record.comments.length > previous.comments.length && previous.comments.every((c: unknown, i: number) => same(c,record.comments[i]));
     if (!ownTask && !onlyComments) throw new ApiError(403, "Students may edit their assigned tasks or add a comment.");
    } else if (key === "events") {
     if (!previous || !same({...record, rsvp: previous.rsvp}, previous)) throw new ApiError(403, "Students may RSVP to events.");
    } else if (key === "evidence") {
     if (record.owner !== userId || (previous && previous.owner !== userId)) throw new ApiError(403, "Students may edit their own evidence.");
    } else throw new ApiError(403, "A student lead or mentor must make this change.");
   }
   if (key === "tasks") {
    if(previous && !previous.comments.every((c:unknown,i:number)=>same(c,updated.comments[i]))) throw new ApiError(400,"Keep existing comments unchanged; add a new comment for corrections.");
    if (updated.status === "Done" && updated.blockedReason?.trim()) throw new ApiError(400, "Resolve the recorded blocker before completing this task.");
    const previousComments = previous?.comments || [];
    updated.comments = updated.comments.map((c: any, i: number) => same(c, previousComments[i]) ? c : {...c, author: userId, date: now});
    if (updated.status === "Done" && updated.dependencies.some((id: string) => received.find(t => t.id === id)?.status !== "Done")) throw new ApiError(400, "Finish linked dependencies before completing this task.");
    if (updated.dependencies.includes(updated.id)) throw new ApiError(400, "A task cannot depend on itself.");
   }
   if (key === "events") {
    updated.verifiedAt = previous?.verifiedAt || ""; updated.verifiedBy = previous?.verifiedBy || "";
    const ids = new Set(next.rsvps[record.id] || []);
    record.rsvp ? ids.add(userId) : ids.delete(userId);
    next.rsvps[record.id] = [...ids]; updated.rsvp = false;
    const contentChanged = !previous || !same({...record,rsvp: previous.rsvp,verification:previous.verification,verifiedAt:previous.verifiedAt,verifiedBy:previous.verifiedBy},previous);
    if (record.verification === "verified" && (contentChanged || previous?.verification !== "verified")) {
     if (!reviews(role) || record.demo || !/^https:\/\//.test(record.source)) throw new ApiError(403, "A mentor must check an official HTTPS source to verify a real event.");
     updated.verifiedAt = now.slice(0,10); updated.verifiedBy = userId;
    } else if (contentChanged && previous?.verification === "verified") { updated.verification = "needs-review"; updated.verifiedAt = ""; updated.verifiedBy = ""; }
   }
   if (key === "announcements") updated.author = previous?.author || userId;
   if (key === "resources") {
    const changed = !previous || !same({...record,approved: previous.approved},previous);
    if (record.approved && (changed || !previous?.approved) && !reviews(role)) updated.approved = false;
   }
   if (key === "sponsors" && record.draftStatus === "Approved" && (!previous || record.draft !== previous.draft || previous.draftStatus !== "Approved") && !reviews(role)) throw new ApiError(403, "A mentor must approve outreach drafts.");
   if (key === "grants" && record.confirmed && (!record.source || !record.checked)) throw new ApiError(400, "Eligibility confirmation requires its official source and check date.");
   if (key === "evidence") {
    // Collection authorization is server-issued and tied to the reviewed record.
    const consentChanged = !previous || consentContext(record) !== consentContext(previous);
    updated.consentReviewedBy = consentChanged ? "" : previous.consentReviewedBy || "";
    updated.consentReviewedAt = consentChanged ? "" : previous.consentReviewedAt || "";
    updated.reviewedBy = previous?.reviewedBy || ""; updated.reviewedAt = previous?.reviewedAt || "";
    if ((updated.fileId && updated.fileId !== previous?.fileId || updated.mediaUrl && updated.mediaUrl !== previous?.mediaUrl) && !collectionAuthorized(updated)) throw new ApiError(400, "A mentor must review collection consent before attaching media. Save the record and request consent review first.");
    if (record.reach > 0 && !record.measurement.trim()) throw new ApiError(400, "Explain how outreach reach was measured.");
    const changed = !previous || !same({...record,approved:previous.approved,reviewedAt:previous.reviewedAt,reviewedBy:previous.reviewedBy},previous);
    if (changed || !previous?.approved) {
     updated.approved = !!record.approved && reviews(role);
     if (updated.approved && !collectionAuthorized(updated)) throw new ApiError(400, "A mentor must review collection consent and its reference before approval.");
     if (updated.approved && record.visibility === "public" && record.consent !== "External use permitted") throw new ApiError(400, "External-use approval requires external-use consent.");
     updated.reviewedAt = updated.approved ? now.slice(0,10) : "";
     updated.reviewedBy = updated.approved ? userId : "";
    }
   }
   const index = all.findIndex(r => r.id === updated.id);
   index < 0 ? all.push(updated) : all.splice(index, 1, updated);
  }
  for (const previous of visibleOld) if (!received.some(r => r.id === previous.id)) {
   if (!manages(role)) throw new ApiError(403, "A student lead or mentor must remove records.");
   all.splice(all.findIndex(r => r.id === previous.id),1);
  }
  (next.workspace as any)[key] = all;
 }
 const learning = next.learning[userId] || {steps: [], skills: []};
 if (!same(before.skills, incoming.skills) && !reviews(role)) throw new ApiError(403, "A mentor must sign off workshop skills.");
 next.learning[userId] = { steps: incoming.onboarding, skills: reviews(role) ? incoming.skills : learning.skills };
 assertTaskGraph(next.workspace.tasks);
 if (!validateData(next.workspace)) throw new ApiError(400, "The changes would create an invalid workspace.");
 return next;
}
