import type {AppData,Grant,Page,Sponsor} from "./types";
const DAY=86400000;
export const localDay=(now=new Date(),zone="America/New_York")=>now.toLocaleDateString("en-CA",{timeZone:zone});
export const addDays=(day:string,days:number)=>new Date(Date.parse(day+"T12:00:00Z")+days*DAY).toISOString().slice(0,10);
export const legacyGrantDays=(grant:Grant)=>grant.reminderDays??(grant.reminder==="No reminder"?-1:grant.reminder==="Three days before internal deadline"?3:7);
export function sponsorFollowUp(s:Sponsor){
 if(["Committed","Declined","Do Not Contact"].includes(s.status))return null;
 const first=s.firstEmailSentAt?Date.parse(s.firstEmailSentAt):0,reply=s.responseReceivedAt?Date.parse(s.responseReceivedAt):0,sent=s.followUpEmailSentAt?Date.parse(s.followUpEmailSentAt):0;
 const auto=first&&reply<first&&sent<first?first+4*DAY:0;
 const manual=s.followUp&&(!sent||s.followUp>localDay(new Date(sent)))?Date.parse(s.followUp+"T12:00:00Z"):0;
 if(auto)return {date:localDay(new Date(auto)),at:auto,automatic:true};
 return manual?{date:s.followUp,at:manual,automatic:false}:null;
}
export type Reminder={id:string;title:string;detail:string;due:string;page:Page;recordId:string};
export function buildReminders(data:AppData,userId:string,manages:boolean,now=new Date()):Reminder[]{
 const today=localDay(now),items:Reminder[]=[];
 for(const task of data.tasks)if(task.status!=="Done"&&(manages||task.owner===userId)&&(task.blockedReason||task.dependencies.some(id=>data.tasks.find(t=>t.id===id)?.status!=="Done")||task.due&&task.due<=today))items.push({id:"task:"+task.id,title:task.title,detail:task.blockedReason?`Blocked: ${task.blockedReason}`:`Task due ${task.due||"—"}`,due:task.due||today,page:"tasks",recordId:task.id});
 for(const grant of data.grants){const days=legacyGrantDays(grant),due=[grant.internalDeadline,grant.deadline].filter(Boolean).sort()[0];if(days<0||!due||["Submitted","Awarded","Not Awarded","Closed"].includes(grant.status)||!manages&&grant.owner!==userId)continue;if(today>=addDays(due,-days))items.push({id:"grant:"+grant.id,title:grant.name,detail:`Grant: prepare application before ${due}${due<today?" (past due)":""}`,due,page:"grants",recordId:grant.id});}
 if(manages)for(const sponsor of data.sponsors){const follow=sponsorFollowUp(sponsor);if(follow&&(follow.automatic?now.getTime()>=follow.at:today>=follow.date))items.push({id:"sponsor:"+sponsor.id,title:sponsor.name,detail:follow.automatic?"Send a sponsorship follow-up: four days since the first email, no response recorded.":`Sponsor follow-up due ${follow.date}`,due:follow.date,page:"sponsors",recordId:sponsor.id});}
 for(const event of data.events){const days=event.awardReminderDays??7,day=localDay(now,event.awardTimezone||"America/New_York");if(event.awardName&&!event.awardSubmitted&&days>=0&&day>=addDays(event.date,-days))items.push({id:"award:"+event.id,title:event.awardName,detail:`Award submission due ${event.date}${event.time?" at "+event.time:""} ${event.awardTimezone||"America/New_York"}`,due:event.date,page:"awards",recordId:event.id});}
 for(const job of data.robotLab?.maintenance||[])if(!job.done&&job.due<=addDays(today,7))items.push({id:"maintenance:"+job.id,title:job.title,detail:`Robot maintenance due ${job.due}${job.owner?" · "+job.owner:""}`,due:job.due,page:"robotlab",recordId:job.id});
 return items.sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title));
}
