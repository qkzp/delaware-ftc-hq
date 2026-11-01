import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Plus,
  Search,
  Settings2,
  X,
  UserRound,
} from "lucide-react";
import type { Page, Role } from "./types";
import { HQProvider, useHQ } from "./store";
import { Badge, EmptyState, Modal } from "./components/ui";
import { QuickTask, SearchDialog } from "./components/WorkspaceDialogs";
import { navigation, pageLabels } from "./navigation";
import Home from "./screens/Home";
import Tasks from "./screens/Tasks";
import Calendar from "./screens/Calendar";
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

export function Workspace() {
  const {myOwner, memberName, cloud,
    data,
    role,
    setRole,
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
  const myCount = data.tasks.filter(
    (t) => t.owner === myOwner && t.status !== "Done",
  ).length;
  const hasDemo =
    data.tasks.some((t) => t.demo) ||
    data.events.some((e) => e.demo) ||
    data.sponsors.some((s) => s.demo);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-chrome">
        <header className="masthead">
          <div className="masthead-inner">
            <button
              className="wordmark"
              onClick={() => navigate("home")}
              aria-label="MyFTCSpace home"
            >
              <svg
                className="station-mark"
                viewBox="0 0 40 40"
                aria-hidden="true"
              >
                <path
                  d="M11 4h18l7 7v18l-7 7H11l-7-7V11z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M14 12h12l3 4v11H11V16z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M8 16h3m18 0h3M8 23h3m18 0h3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.4"
                />
                <path
                  d="M16 15.5h8"
                  fill="none"
                  stroke="#e7653c"
                  strokeLinecap="round"
                  strokeWidth="2.4"
                />
              </svg>
              <span className="wordmark-type">
                <strong>MyFTCSpace</strong>
              </span>
            </button>
            <span className="masthead-divider" />
            <button
              className="workspace-name"
              onClick={() => navigate("settings")}
            >
              <span>{data.teamName}</span>
              <ChevronDown size={13} />
            </button>
            <button
              className="workspace-search"
              aria-label="Search workspace (Control K)"
              onClick={() => setSearch(true)}
            >
              <Search size={15} />
              <span>Search workspace</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="masthead-actions">
              <button className="chrome-icon" aria-label="Your account" onClick={()=>setAccount(true)}><UserRound size={18}/></button>
              <button
                className="chrome-icon"
                aria-label="Team updates"
                onClick={() => setNotifications(true)}
              >
                <Bell size={17} />
              </button>
              <button
                className="chrome-icon"
                aria-label="Help"
                onClick={() => setHelp(true)}
              >
                <HelpCircle size={17} />
              </button>
              <button
                className="chrome-icon"
                aria-label="Workspace settings"
                onClick={() => navigate("settings")}
              >
                <Settings2 size={17} />
              </button>
            </div>
            <label className="role-switch">
              <span>{cloud.shared ? "Team role" : "Demo role"}</span>
              <select
                disabled={!!cloud.shared}
                aria-label={cloud.shared ? "Assigned team role" : "Demo permission preview"}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="student">Student</option>
                <option value="lead">Student lead</option>
                <option value="mentor">Mentor / coach</option>
                <option value="admin">Team admin</option>
              </select>
            </label>
            <button className="mobile-team-settings chrome-icon" aria-label="Team access and settings" onClick={()=>setAccount(true)}><UserRound size={19}/></button>
          </div>
        </header>
        <div className="navigation-bar">
          <div className="navigation-inner">
            <nav className="workspace-tabs" aria-label="Main navigation">
              {navigation.map((n) => (
                <button
                  key={n.page}
                  className={`workspace-tab ${page === n.page ? "is-active" : ""}`}
                  aria-current={page === n.page ? "page" : undefined}
                  onClick={() => navigate(n.page)}
                >
                  {n.label}
                  {n.page === "tasks" && myCount > 0 && (
                    <span className="nav-count">{myCount}</span>
                  )}
                </button>
              ))}
            </nav>
            <select className="mobile-navigation" aria-label="Workspace section" value={page} onChange={e=>navigate(e.target.value as Page)}>{navigation.map(n=><option key={n.page} value={n.page}>{n.label}</option>)}<option value="onboarding">New member checklist</option><option value="settings">Team access & settings</option></select>
            <button
              className="btn btn-primary chrome-create"
              onClick={() => setQuickTask(true)}
            >
              <Plus size={15} />
              New task
            </button>
          </div>
        </div>
      </div>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <div className="workspace-context">
          <div className="workspace-context-left">
            <span className={`workspace-indicator ${hasDemo ? "is-demo" : ""}`}>
              {cloud.shared ? "Private team" : "Demo workspace"}
            </span>
            <span className="context-team-name">{data.teamName}</span>
            <span className="context-county">{data.county}, Delaware</span>
            <span className="context-separator">/</span>
            <button onClick={() => navigate("settings")}>
              {data.seasonName}
            </button>
          </div>
          <span className="storage-status">
            <span
              className={`storage-dot ${storageError ? "has-error" : ""}`}
            />
            {cloud.shared ? cloud.status : storageError ? "Save needs attention" : "Saved in this browser"}
          </span>
        </div>
        {storageError && (
          <div className="storage-error" role="alert">
            {storageError}
          </div>
        )}
        <div key={role} className="page-surface">
          {page === "evidence" ? <EvidencePage /> : page === "opportunities" ? <Opportunities /> : page === "home" ? (
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
          <span>
            <strong>MyFTCSpace</strong> FTC team workspace
          </span>
          <span>{cloud.shared ? "Private team · Shared records" : "Demo · Records stay in this browser"}</span>
          <button onClick={() => navigate("onboarding")}>
            New member checklist <ArrowRight size={13} />
          </button>
        </footer>
      </main>
      {search && <SearchDialog onClose={() => setSearch(false)} />}
      {quickTask && <QuickTask onClose={() => setQuickTask(false)} />}
      {account && <Modal title="Your account" onClose={()=>setAccount(false)}>
        <div className="stack">
          {cloud.session.user ? <><h3>{cloud.shared ? memberName(myOwner) === "You" ? cloud.shared.members.find(m=>m.userId===myOwner)?.name || "Signed in" : memberName(myOwner) : "Signed in with ChatGPT"}</h3><p>{cloud.shared ? `${data.teamName} · ${role === 'admin' ? 'Team admin' : role === 'mentor' ? 'Mentor / coach' : role === 'lead' ? 'Student lead' : 'Student'}` : "Choose or create a private team to save shared records."}</p><button className="btn btn-secondary" onClick={()=>{navigate('settings');setAccount(false);}}>Team access & settings</button><a className="btn btn-primary" href="/signout-with-chatgpt?return_to=%2F" target="_top" onClick={e=>{if(cloud.hasUnsaved()){e.preventDefault();notify("Wait for your changes to save, or download them in Settings before signing out.");}}}>Sign out</a></> : <><p>You’re exploring the demo. Sign in to create or join a private team.</p><a className="btn btn-primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">Continue with ChatGPT</a></>}
          <p className="privacy-note">Private records are limited to your team. Account passwords are handled by ChatGPT.</p>
        </div>
      </Modal>}
      {notifications && (
        <Modal title="Team updates" onClose={() => setNotifications(false)}>
          <h3>Needs attention</h3>
          {data.tasks.filter(t=>t.status!=='Done'&&(t.owner===myOwner||canManage)&&(!!t.blockedReason||t.dependencies.some(id=>data.tasks.find(d=>d.id===id)?.status!=='Done')||(t.due&&t.due<=new Date().toLocaleDateString('en-CA')))).slice(0,6).map(t=><button className="search-result" key={t.id} onClick={()=>{navigate('tasks');setNotifications(false);}}><span>{t.title}<small>{t.blockedReason?`Blocked: ${t.blockedReason}`:t.due?`Due ${t.due}`:'Linked dependency needs attention'}</small></span><ArrowRight size={16}/></button>)}
          {canManage&&data.sponsors.filter(s=>s.followUp&&s.followUp<=new Date().toLocaleDateString('en-CA')&&!['Committed','Declined','Do Not Contact'].includes(s.status)).map(s=><button className="search-result" key={s.id} onClick={()=>{navigate('sponsors');setNotifications(false);}}><span>{s.name}<small>Sponsor follow-up due {s.followUp}</small></span><ArrowRight size={16}/></button>)}
          {data.grants.filter(g=>g.status!=='Closed'&&g.deadline&&g.deadline<=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA')).map(g=><button className="search-result" key={g.id} onClick={()=>{navigate('grants');setNotifications(false);}}><span>{g.name}<small>Grant deadline {g.deadline} · {g.status}</small></span><ArrowRight size={16}/></button>)}
          <p className="privacy-note">In-app reminders use your team’s records. Check this list when you open the app; no email is sent.</p>
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
                <small>{a.author}</small>
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
              {cloud.shared ? "Team records save to your private shared workspace. Your role is enforced by the server. Use Settings for invitations, backups, and member access." : "The demo saves in this browser. Open Settings and sign in with ChatGPT to create or join a private shared team."}
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
    <header className="account-entry-header"><a href="/"><img src="/favicon.svg" alt="" width="38" height="38"/><strong>MyFTCSpace</strong></a><a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></header>
    <main className="account-team-setup"><h1>{cloud.session.teams.length ? "Choose your team." : "Set up your team."}</h1><p>Choose an existing workspace, join with an invitation, or start a private team.</p><TeamAccess/>{notice&&<p className="account-connection-message" role="alert">{notice.message} <button className="text-link" onClick={clearNotice}>Dismiss</button></p>}</main>
    <footer className="account-entry-footer"><a href="/demo">Explore the demo</a> · Team memberships and permissions are checked on the server.</footer>
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
