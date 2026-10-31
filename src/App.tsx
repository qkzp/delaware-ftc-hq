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
} from "lucide-react";
import type { Page, Role } from "./types";
import { HQProvider, useHQ } from "./store";
import { Badge, EmptyState, Modal } from "./components/ui";
import { QuickTask, SearchDialog } from "./components/WorkspaceDialogs";
import { navigation, pageLabels } from "./navigation";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Sponsors from "./pages/Sponsors";
import Grants from "./pages/Grants";
import Resources from "./pages/Resources";
import Onboarding from "./pages/Onboarding";
import Pit from "./pages/Pit";
import TeamSettings from "./pages/Settings";

export function Workspace() {
  const {
    data,
    role,
    setRole,
    page,
    setPage,
    notice,
    clearNotice,
    storageError,
  } = useHQ();
  const [search, setSearch] = useState(false);
  const [quickTask, setQuickTask] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
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
    document.title = `${pageLabels[page]} · Student HQ`;
  }, [page]);
  const navigate = (next: Page) => setPage(next);
  const myCount = data.tasks.filter(
    (t) => t.owner === "Alex (you)" && t.status !== "Done",
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
              aria-label="Student HQ home"
            >
              <svg
                className="station-mark"
                viewBox="0 0 34 34"
                aria-hidden="true"
              >
                <path
                  d="M3 12V3h9M22 3h9v9M31 22v9h-9M12 31H3v-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 10h14v14H10zM17 6v22M6 17h22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <circle cx="24" cy="10" r="3" fill="#e7653c" />
              </svg>
              <span className="wordmark-type">
                <strong>STUDENT HQ</strong>
                <small>DE / FTC FIELD STATION</small>
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
              <span>ROLE PREVIEW</span>
              <select
                aria-label="Demo permission preview"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="student">Student</option>
                <option value="lead">Student lead</option>
                <option value="mentor">Mentor / coach</option>
                <option value="admin">Team admin</option>
              </select>
            </label>
          </div>
        </header>
        <div className="navigation-bar">
          <div className="navigation-inner">
            <nav className="workspace-tabs" aria-label="Main navigation">
              {navigation.map((n, index) => (
                <button
                  key={n.page}
                  className={`workspace-tab ${page === n.page ? "is-active" : ""}`}
                  aria-current={page === n.page ? "page" : undefined}
                  onClick={() => navigate(n.page)}
                >
                  <span className="tab-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {n.label}
                  {n.page === "tasks" && myCount > 0 && (
                    <span className="nav-count">{myCount}</span>
                  )}
                </button>
              ))}
            </nav>
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
              {hasDemo ? "DEMO DATA" : "LOCAL WORKSPACE"}
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
            {storageError ? "Save needs attention" : "Saved in this browser"}
          </span>
        </div>
        {storageError && (
          <div className="storage-error" role="alert">
            {storageError}
          </div>
        )}
        <div key={role} className="page-surface">
          {page === "home" ? (
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
            <strong>DE / FTC</strong> Field station
          </span>
          <span>Local workspace · No shared team sync</span>
          <button onClick={() => navigate("onboarding")}>
            New member checklist <ArrowRight size={13} />
          </button>
        </footer>
      </main>
      {search && <SearchDialog onClose={() => setSearch(false)} />}
      {quickTask && <QuickTask onClose={() => setQuickTask(false)} />}
      {notifications && (
        <Modal title="Team updates" onClose={() => setNotifications(false)}>
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
              Data saves in this browser. Role previews demonstrate interface
              permissions; this version has no shared accounts or team sync.
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
export default function App() {
  return (
    <HQProvider>
      <Workspace />
    </HQProvider>
  );
}
