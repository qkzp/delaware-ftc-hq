import {buildReminders} from "../reminders";
import {useReminderTime} from "./TeamReminders";
import {Bell,ChevronDown,HelpCircle,Plus,Search,Settings2,ShieldCheck,UserRound,UserRoundPlus} from "lucide-react";
import {useHQ} from "../store";
import {navigation,pageLabels} from "../navigation";
import type {Page,Role} from "../types";
import "./workspace-chrome.css";

type Props={onSearch:()=>void;onCreate:()=>void;onAccount:()=>void;onUpdates:()=>void;onHelp:()=>void};

export default function WorkspaceChrome({onSearch,onCreate,onAccount,onUpdates,onHelp}:Props){
 const {data,cloud,page,setPage,role,setRole,myOwner}=useHQ();
 const reminderCount=buildReminders(data,myOwner,role!=="student",useReminderTime()).length;
 const mine=data.tasks.filter(task=>task.owner===myOwner&&task.status!=="Done").length;
 const roleName=role==="admin"?"Team admin":role==="mentor"?"Mentor / coach":role==="lead"?"Student lead":"Student";
 const groups=[
  {label:"Every day",pages:["home","team","tasks","calendar"]},
  {label:"Build & compete",pages:["robotlab","resources","awards","pit","evidence"]},
  {label:"Beyond the robot",pages:["grants","sponsors","opportunities"]},
 ];
 const accountName=cloud.shared?(cloud.shared.members.find(member=>member.userId===myOwner)?.name||"Team member"):"Demo workspace";
 const initials=accountName.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase();
 const current=navigation.find(item=>item.page===page);
 const PageIcon=current?.icon||Settings2;
 return <>
  <div className="product-globalbar"><button onClick={()=>setPage("home")} className="product-wordmark" aria-label="MyFTCSpace home"><img src="/favicon.svg" width="23" height="23" alt=""/>MyFTCSpace</button><span className="globalbar-context">{cloud.shared?"Team workspace":"Demo workspace / Fictional records"}</span><button className="globalbar-help" onClick={onHelp}>Workspace guide <HelpCircle size={15} aria-hidden="true"/></button></div>
  <aside className="workspace-sidebar" aria-label="Workspace sidebar">
   <button className="workspace-name" onClick={()=>setPage("settings")}>
    <span className="team-symbol" aria-hidden="true">M</span>
    <span><strong>{data.teamName||"Your team"}</strong><small>{data.teamNumber&&data.teamNumber!=="DEMO"?`FTC ${data.teamNumber}`:"MyFTCSpace"}</small></span>
    <ChevronDown size={14} aria-hidden="true"/>
   </button>
   <div className="sidebar-quick-actions">
    <button className="workspace-search" aria-label="Search Ctrl K — search workspace" onClick={onSearch}><Search size={16} aria-hidden="true"/><span>Search</span> <kbd>Ctrl K</kbd></button>
    <button className="sidebar-utility sidebar-inbox" onClick={onUpdates}><Bell size={16} aria-hidden="true"/>Team updates {reminderCount>0&&<span className="nav-count">{reminderCount}</span>}</button>
   </div>
   <div className="sidebar-navigation-scroll">
    <nav className="workspace-tabs" aria-label="Main navigation">
     {groups.map(group=><div className="sidebar-nav-group" key={group.label}>
      <p className="sidebar-section-label">{group.label}</p>
      {group.pages.map(key=>navigation.find(item=>item.page===key)!).filter(Boolean).map(item=><button key={item.page} className={`workspace-tab ${page===item.page?"is-active":""}`} aria-current={page===item.page?"page":undefined} onClick={()=>setPage(item.page)}>
       <item.icon size={16} aria-hidden="true"/>{item.label}{item.page==="tasks"&&mine>0&&<span className="nav-count">{mine}</span>}
      </button>)}
     </div>)}
    </nav>
   </div>
   <div className="sidebar-bottom">
    <button className={`sidebar-utility ${page==="onboarding"?"is-active":""}`} onClick={()=>setPage("onboarding")}><UserRoundPlus size={16} aria-hidden="true"/>New member checklist</button>
    <button className={`sidebar-utility ${page==="settings"?"is-active":""}`} aria-label="Workspace settings" onClick={()=>setPage("settings")}><Settings2 size={16} aria-hidden="true"/>Settings</button>
    <button className="sidebar-account" onClick={onAccount}><span className="account-avatar" aria-hidden="true">{initials}</span><span><strong>{accountName}</strong><small>{roleName}</small></span><ChevronDown size={13} aria-hidden="true"/></button>
    <label className="role-switch"><span>{cloud.shared?"Your role":"Preview as"}</span>{cloud.shared?<strong className="assigned-role">{roleName}</strong>:<select aria-label="Demo permission preview" value={role} onChange={event=>setRole(event.target.value as Role)}><option value="student">Student</option><option value="lead">Student lead</option><option value="mentor">Mentor / coach</option><option value="admin">Team admin</option></select>}</label>
    <div className="sidebar-privacy"><ShieldCheck size={12} aria-hidden="true"/>{cloud.shared?"Private team workspace":"Fictional data · Demo mode"}</div>
   </div>
  </aside>
  <header className="workspace-topbar">
   <div className="workspace-breadcrumb"><PageIcon size={16} aria-hidden="true"/><strong>{pageLabels[page]}</strong><span className="chrome-breadcrumb-divider" aria-hidden="true">/</span><span>{data.seasonName||"Team workspace"}</span></div>
   <div className="masthead-actions">
    <button className="chrome-icon chrome-mobile-search" aria-label="Search" onClick={onSearch}><Search size={17}/></button>
    <button className="chrome-icon" aria-label="Help" onClick={onHelp}><HelpCircle size={17}/></button>
    <button className="chrome-icon topbar-account" aria-label="Your account" onClick={onAccount}><UserRound size={17}/></button>
   </div>
   <button className="btn btn-primary chrome-create" onClick={onCreate}><Plus size={14} aria-hidden="true"/>New task</button>
  </header>
  <div className="mobile-section-bar">
   <label><span className="sr-only">Workspace section</span><select className="mobile-navigation" aria-label="Workspace section" value={page} onChange={event=>setPage(event.target.value as Page)}>{navigation.map(item=><option key={item.page} value={item.page}>{item.label}</option>)}<option value="onboarding">New member checklist</option><option value="settings">Team access & settings</option></select></label>
   {cloud.shared?<span><ShieldCheck size={13} aria-hidden="true"/>{roleName}</span>:<select className="mobile-role-select" aria-label="Preview role on mobile" value={role} onChange={event=>setRole(event.target.value as Role)}><option value="student">Student demo</option><option value="lead">Lead demo</option><option value="mentor">Mentor demo</option><option value="admin">Admin demo</option></select>}
   <button className="chrome-icon" onClick={onUpdates}><Bell size={17} aria-hidden="true"/><span className="sr-only">Open team updates</span> {reminderCount>0&&<span className="reminder-count">{reminderCount}</span>}</button>
  </div>
 </>;
}
