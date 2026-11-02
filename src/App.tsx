import TeamReminders from "./components/TeamReminders";
import { useEffect, useState } from "react";
import {ArrowRight,CheckCircle2,X} from "lucide-react";
import type { Page } from "./types";
import { HQProvider, useHQ } from "./store";
import { Badge, EmptyState, Modal } from "./components/ui";
import { QuickTask, SearchDialog } from "./components/WorkspaceDialogs";
import { navigation, pageLabels } from "./navigation";
import Home from "./screens/Home";
import TeamHub from "./screens/TeamHub";
import Tasks from "./screens/Tasks";
import Calendar from "./screens/Calendar";
import Awards from "./screens/Awards";
import RobotLab from "./screens/RobotLab";
import Sponsors from "./screens/Sponsors";
import Grants from "./screens/Grants";
import Resources from "./screens/Resources";
import Onboarding from "./screens/Onboarding";
import Pit from "./screens/Pit";
import TeamSettings from "./screens/Settings";
import EvidencePage from "./screens/Evidence";
import Opportunities from "./screens/Opportunities";
import TeamAccess from "./components/TeamAccess";
import SignIn from "./components/SignIn";
import WorkspaceChrome from "./components/WorkspaceChrome";

export function Workspace() {
  const {myOwner, memberName, cloud,
    data,
    role,
    page,
    setPage,
    notice,
    clearNotice,
    notify,
    storageError,
    canManage,
  } = useHQ();
  const [search, setSearch] = useState(false);
  const [quickTask, setQuickTask] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [account, setAccount] = useState(false);
  const [hubVisited,setHubVisited]=useState(page==="team");
  const [labVisited,setLabVisited]=useState(page==="robotlab");
  useEffect(()=>{if(page==="team")setHubVisited(true);},[page]);
  useEffect(()=>{if(page==="robotlab")setLabVisited(true);},[page]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    document.title = `${pageLabels[page]} · MyFTCSpace`;
  }, [page]);
  const navigate = (next: Page) => setPage(next);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <WorkspaceChrome onSearch={()=>setSearch(true)} onCreate={()=>setQuickTask(true)} onAccount={()=>setAccount(true)} onUpdates={()=>setNotifications(true)} onHelp={()=>setHelp(true)}/>
      <main className="main-content" id="main-content" tabIndex={-1}>
        {storageError && (
          <div className="storage-error" role="alert">
            {storageError}
          </div>
        )}
        <div key={role} className="page-surface">
          <div className="team-hub-surface" hidden={page!=="team"}>{(hubVisited||page==="team")&&<TeamHub/>}</div>
          <div hidden={page!=="robotlab"}>{(labVisited||page==="robotlab")&&<RobotLab/>}</div>
          {page === "team" || page === "robotlab" ? null : page === "awards" ? <Awards/> : page === "evidence" ? <EvidencePage /> : page === "opportunities" ? <Opportunities /> : page === "home" ? (
            <Home />
          ) : page === "tasks" ? (
            <Tasks />
          ) : page === "calendar" ? (
            <Calendar />
          ) : page === "sponsors" ? (
            <Sponsors />
          ) : page === "grants" ? (
            <Grants />
          ) : page === "resources" ? (
            <Resources />
          ) : page === "onboarding" ? (
            <Onboarding />
          ) : page === "pit" ? (
            <Pit />
          ) : (
            <TeamSettings />
          )}
        </div>
        <footer className="workspace-footer">
          <span className="storage-status"><span className={`storage-dot ${storageError ? "has-error" : ""}`}/>{cloud.shared ? cloud.status : storageError ? "Save needs attention" : "Saved in this browser"}</span>
          <span>{cloud.shared ? "Private team workspace" : "Fictional demo records"}</span>
          <a className="workspace-privacy-link" href="/privacy">Privacy & data help</a>
          <button onClick={() => navigate("onboarding")}>
            New member checklist <ArrowRight size={13} />
          </button>
        </footer>
      </main>
      {search && <SearchDialog onClose={() => setSearch(false)} />}
      {quickTask && <QuickTask onClose={() => setQuickTask(false)} />}
      {account && <Modal title="Your account" onClose={()=>setAccount(false)}>
        <div className="stack">
          {cloud.session.user ? <><h3>{cloud.shared ? memberName(myOwner) === "You" ? cloud.shared.members.find(m=>m.userId===myOwner)?.name || "Signed in" : memberName(myOwner) : "Signed in with your approved account"}</h3><p>{cloud.shared ? `${data.teamName} · ${role === 'admin' ? 'Team admin' : role === 'mentor' ? 'Mentor / coach' : role === 'lead' ? 'Student lead' : 'Student'}` : "Choose or create a private team to save shared records."}</p><button className="btn btn-secondary" onClick={()=>{navigate('settings');setAccount(false);}}>Team access & settings</button><a className="btn btn-primary" href="#sign-out" onClick={async e=>{e.preventDefault();if(cloud.hasUnsaved()){notify("Wait for your changes to save, or download them in Settings before signing out.");return;}const {signOut}=await import("next-auth/react");await signOut({callbackUrl:"/"});}}>Sign out</a></> : <><p>You’re exploring the demo. Sign in to create or join a private team.</p><a className="btn btn-primary" href="/signin">Choose a sign-in method</a></>}
          <p className="privacy-note">Private records are limited to your team. Account passwords are handled by your sign-in provider.</p>
        </div>
      </Modal>}
      {notifications && (
        <Modal title="Team updates" onClose={() => setNotifications(false)}>
          <TeamReminders onClose={()=>setNotifications(false)}/>
          {data.announcements.length ? (
            data.announcements.map((a) => (
              <article key={a.id} className="notification-item">
                <div className="inline">
                  <Badge>{a.type}</Badge>
                  {a.demo && <span className="muted">Demo record</span>}
                  <time>{a.date}</time>
                </div>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
                <small>{memberName(a.author)}</small>
              </article>
            ))
          ) : (
            <EmptyState
              title="No updates"
              description="Team announcements and decisions appear here."
            />
          )}
        </Modal>
      )}
      {help && (
        <Modal title="Workspace guide" onClose={() => setHelp(false)}>
          <div className="stack">
            <p className="muted">
              Use the tabs to find team work, meeting plans, robot
              documentation, and funding records. Search opens the matching
              record directly.
            </p>
            {[
              {
                page: "team" as Page,
                title: "Team hub and guided help",
                detail: "Task conversations, a shared brief and a Help desk for workspace issues.",
              },
              {
                page: "onboarding" as Page,
                title: "New member checklist",
                detail: "Find a beginner resource and claim your first task.",
              },
              {
                page: "resources" as Page,
                title: "Robot documentation",
                detail: "CAD, code, build logs, setup, and repair notes.",
              },
              {
                page: "settings" as Page,
                title: "Team setup and backups",
                detail:
                  "Edit team details, export a backup, or start a fresh workspace.",
              },
            ].map((link) => (
              <button
                key={link.page}
                className="search-result"
                onClick={() => {
                  navigate(link.page);
                  setHelp(false);
                }}
              >
                <span>
                  {link.title}
                  <small>{link.detail}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            <div className="settings-info">
              {cloud.shared ? "Team records save to your private shared workspace. Your role is enforced by the server. Use Settings for invitations, backups, and member access." : "The demo saves in this browser. Open Settings and sign in with an approved account to create or join a private shared team."}
            </div>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCircle2 size={17} />
          <span>{notice.message}</span>
          {notice.action && (
            <button
              onClick={() => {
                notice.action?.();
                clearNotice();
              }}
            >
              {notice.actionLabel}
            </button>
          )}
          <button aria-label="Dismiss notification" onClick={clearNotice}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
export function AccountWorkspace() {
  const {cloud,notice,clearNotice}=useHQ();
  if(!cloud.ready)return <div className="account-entry"><main className="account-login" role="status" aria-busy="true"><img src="/favicon.svg" alt="" width="48" height="48"/><h1>Checking your account.</h1><p>Opening your private team workspace…</p></main></div>;
  if(!cloud.session.user)return <>{cloud.error&&<div className="account-connection-message" role="alert">{cloud.error} <button className="text-link" onClick={()=>void cloud.refreshSession().catch(()=>{})}>Retry connection</button></div>}<SignIn/></>;
  if(!cloud.shared)return <div className="account-entry">
    <header className="account-entry-header"><a href="/"><img src="/favicon.svg" alt="" width="38" height="38"/><strong>MyFTCSpace</strong></a><a href="#sign-out" onClick={async e=>{e.preventDefault();const {signOut}=await import("next-auth/react");await signOut({callbackUrl:"/"});}}>Sign out</a></header>
    <main className="account-team-setup"><h1>{cloud.session.teams.length ? "Choose your team." : "Set up your team."}</h1><p>Choose an existing workspace, join with an invitation, or start a private team.</p><TeamAccess/>{notice&&<p className="account-connection-message" role="alert">{notice.message} <button className="text-link" onClick={clearNotice}>Dismiss</button></p>}</main>
    <footer className="account-entry-footer">Private team records · Memberships and permissions are checked on the server.<br/><a href="/privacy">Privacy & data help</a></footer>
  </div>;
  return <Workspace/>;
}
export default function App({accountMode=false,demoMode=false}:{accountMode?:boolean;demoMode?:boolean}) {
  return (
    <HQProvider accountMode={accountMode} demoMode={demoMode}>
      {accountMode ? <AccountWorkspace/> : <Workspace />}
    </HQProvider>
  );
}
