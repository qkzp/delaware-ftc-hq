import {downloadFile} from "../utils";
import {reminderCalendar} from "../reminder-calendar";
import {useEffect,useState} from "react";
import {ArrowRight} from "lucide-react";
import {useHQ} from "../store";
import {buildReminders} from "../reminders";
export function useReminderTime(){const [now,setNow]=useState(()=>new Date());useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);return now;}
export default function TeamReminders({onClose}:{onClose:()=>void}){
 const {data,myOwner,canManage,openRecord}=useHQ(),now=useReminderTime(),items=buildReminders(data,myOwner,canManage,now);
 return <><button className="btn btn-secondary" onClick={()=>downloadFile("team-reminders.ics",reminderCalendar(data,myOwner,canManage,now),"text/calendar")}>Export upcoming reminders to calendar</button><p className="muted">Import this snapshot into your calendar for alerts outside the app. Calendar alert support varies; update or remove old imports when dates, responses or completion status change. Award entries are date-only; verify their stated time zone and cutoff.</p><h3>Needs attention ({items.length})</h3>{items.map(item=><button className="search-result" key={item.id} onClick={()=>{openRecord(item.page,item.recordId);onClose();}}><span>{item.title}<small>{item.detail}</small></span><ArrowRight size={16}/></button>)}{!items.length&&<p>No reminders need attention right now.</p>}<p className="privacy-note">Reminders update while you use the app. Grant and award lead times are configurable; maintenance appears seven days ahead. Sponsorship follow-ups appear 96 hours after you record the first email as sent, until you record a response or follow-up. There is no inbox monitoring, background push or automatic outreach email.</p></>;
}
