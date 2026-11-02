import type {Resource} from "../types";
import "./ResourceSpaces.css";

export type ReviewFilter="all"|"needs-review"|"reviewed";
export const RESOURCE_REVIEW_DAYS=90;
function day(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
 const parsed=Date.parse(value+"T00:00:00Z");
 return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===value?parsed:NaN;
}
export function resourceReview(resource:Resource,now=Date.now()){
 if(!resource.approved)return {needed:true,label:"Awaiting approval",reason:"A mentor or admin must approve the selected audience."};
 if(resource.stale)return {needed:true,label:"Flagged for review",reason:"The owner or a teammate flagged this resource as outdated."};
 const reviewed=day(resource.reviewed),today=day(new Date(now).toLocaleDateString("en-CA"));
 if(!Number.isFinite(reviewed)||reviewed>today)return {needed:true,label:"Review date needed",reason:"Record a valid review date after checking the source and notes."};
 if(today-reviewed>RESOURCE_REVIEW_DAYS*86400000)return {needed:true,label:"Review due",reason:`The last review is more than ${RESOURCE_REVIEW_DAYS} days old. Check current instructions before relying on it.`};
 return {needed:false,label:"Reviewed",reason:`Approved, unflagged and reviewed within the last ${RESOURCE_REVIEW_DAYS} days.`};
}
export function resourceAudience(resource:Resource){
 if(resource.visibility==="private")return "Leads, mentors & admins";
 if(!resource.approved)return "Leads, mentors & admins until approval";
 return resource.visibility==="public"?"Team members · external use approved":"Team members";
}
export function resourceLocation(resource:Resource){
 try{const url=new URL(resource.url);if(["https:","http:"].includes(url.protocol))return url.hostname;}catch{/* A note may have no linked source. */}
 return "Team note";
}
export default function ResourceSpaces({resources,category,onCategory,review,onReview}:{resources:Resource[];category:string;onCategory:(value:string)=>void;review:ReviewFilter;onReview:(value:ReviewFilter)=>void}){
 const spaces=Array.from(new Set(resources.map(resource=>resource.category))).sort((a,b)=>a.localeCompare(b));
 const inSpace=resources.filter(resource=>category==="All areas"||resource.category===category);
 const needsReview=inSpace.filter(resource=>resourceReview(resource).needed).length;
 return <aside className="knowledge-spaces" aria-labelledby="knowledge-spaces-title">
  <div className="knowledge-spaces-intro"><h2 id="knowledge-spaces-title">Knowledge spaces</h2><p>Guides, files and handoff notes organized by work area.</p></div>
  <nav className="knowledge-space-list" aria-label="Knowledge spaces">
   <button type="button" aria-pressed={category==="All areas"} onClick={()=>onCategory("All areas")}><span>All spaces</span><strong>{resources.length}</strong></button>
   {spaces.map(space=><button type="button" key={space} aria-pressed={category===space} onClick={()=>onCategory(space)}><span>{space}</span><strong>{resources.filter(resource=>resource.category===space).length}</strong></button>)}
  </nav>
  <fieldset className="knowledge-review-views"><legend>Review view</legend>{([["all","All resources",inSpace.length],["needs-review","Needs review",needsReview],["reviewed","Reviewed",inSpace.length-needsReview]] as const).map(([value,label,count])=><button key={value} type="button" aria-pressed={review===value} onClick={()=>onReview(value)}><span>{label}</span><strong>{count}</strong></button>)}</fieldset>
  <p className="knowledge-review-explanation">Reviewed means approved, unflagged and checked within {RESOURCE_REVIEW_DAYS} days. Counts include only resources your role can access.</p>
 </aside>;
}
