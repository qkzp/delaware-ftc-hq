import {useHQ} from "../store";
import {awardGuides,awardManualUrl,awardTaskId} from "../award-criteria";
import type {Task} from "../types";
import "./award-tracker.css";

/** Award progress uses normal team tasks, so it follows the same sync and permissions. */
export default function AwardTracker(){
 const {data,canManage,myOwner,memberName,saveRecord}=useHQ();
 function update(awardId:string,awardName:string,criterionId:string,text:string,status:Task["status"]){
  const id=awardTaskId(awardId,criterionId),prior=data.tasks.find(task=>task.id===id);
  const task:Task=prior?{...prior,status}:{id,teamId:data.teamId,seasonId:data.seasonId,title:`${awardName} award: ${text}`,owner:myOwner,area:"Awards",due:"",priority:"Medium",status,done:"",effort:"",description:"",dependencies:[],comments:[]};
  saveRecord("tasks",task);
 }
 return <section className="award-tracker" aria-labelledby="award-tracker-title">
  <header><div><p className="award-tracker-kicker">2026–27 / BIOBUZZ</p><h2 id="award-tracker-title">Award tracker</h2><p>Explore the criteria and track your team's preparation. Progress is saved as team tasks.</p></div><a href={awardManualUrl} target="_blank" rel="noreferrer">Read FIRST's awards section ↗</a></header>
  <p className="award-tracker-note">Planning summaries based on FIRST's Section 6, TU06 (October 22, 2026). Rules can change; check the current manual and your event. Judges decide awards, and not every event offers every award.</p>
  <div className="award-tracker-list">{awardGuides.map(award=>{
   const required=award.criteria.filter(c=>c.kind==="Required");
   const complete=required.filter(c=>data.tasks.find(task=>task.id===awardTaskId(award.id,c.id))?.status==="Done").length;
   return <details className="award-tracker-award" key={award.id}>
    <summary><span><strong>{award.name} Award</strong><small>{complete} of {required.length} required items marked done</small></span><span className="award-tracker-arrow" aria-hidden="true">＋</span></summary>
    <div className="award-tracker-criteria">{award.criteria.map(criterion=>{
     const task=data.tasks.find(item=>item.id===awardTaskId(award.id,criterion.id));
     const editable=canManage||!task||task.owner===myOwner;
     const label=`${award.name}: ${criterion.text}`;
     return <div className="award-tracker-row" key={criterion.id}>
      <div><span className="award-tracker-kind">{criterion.kind}</span><p>{criterion.text}</p>{task&&!editable&&<small>Assigned to {memberName(task.owner)}. Ask the owner or a team lead to update it.</small>}</div>
      <label><span className="award-tracker-visually-hidden">Progress for {label}</span><select value={task?.status||"To do"} disabled={!editable} onChange={event=>update(award.id,award.name,criterion.id,criterion.text,event.target.value as Task["status"])}><option>To do</option><option>In progress</option><option>Done</option></select></label>
     </div>;
    })}</div>
   </details>;
  })}</div>
 </section>;
}
