import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Command,
  Flag,
  HelpCircle,
  Home as HomeIcon,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { Page, Role, Task } from "./types";
import { HQProvider, useHQ } from "./store";
import { Avatar, Badge, EmptyState, Field, Modal } from "./components/ui";
import { dateKey } from "./utils";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Sponsors from "./pages/Sponsors";
import Grants from "./pages/Grants";
import Resources from "./pages/Resources";
import Onboarding from "./pages/Onboarding";
import Pit from "./pages/Pit";
import TeamSettings from "./pages/Settings";
const navigation: { page: Page; label: string; icon: typeof HomeIcon }[] = [
  { page: "home", label: "My home", icon: HomeIcon },
  { page: "tasks", label: "Tasks & projects", icon: CheckCheck },
  { page: "calendar", label: "Team calendar", icon: CalendarDays },
  { page: "resources", label: "Robot & resources", icon: BookOpen },
  { page: "grants", label: "Grants & opportunities", icon: Sprout },
  { page: "sponsors", label: "Sponsor outreach", icon: Users },
];
const labels: Record<Page, string> = {
  home: "Overview",
  tasks: "Tasks & projects",
  calendar: "Team calendar",
  sponsors: "Sponsor outreach",
  grants: "Grants & opportunities",
  resources: "Robot & resources",
  onboarding: "Your first five minutes",
  pit: "Competition mode",
  settings: "Team & workspace",
};
function SearchDialog({ onClose }: { onClose: () => void }) {
  const { data, setPage, openRecord, canManage } = useHQ();
  const [query, setQuery] = useState("");
  const q = query.toLowerCase().trim();
  const go = (page: Page) => {
    setPage(page);
    onClose();
  };
  const results = [
    ...data.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      detail: `Task · ${t.area} · ${t.owner}`,
      page: "tasks" as Page,
      icon: CheckCheck,
    })),
    ...data.events.map((e) => ({
      id: e.id,
      title: e.title,
      detail: `Event · ${e.date} · ${e.type}`,
      page: "calendar" as Page,
      icon: CalendarDays,
    })),
    ...data.resources
      .filter((r) => canManage || (r.visibility !== "private" && r.approved))
      .map((r) => ({
        id: r.id,
        title: r.title,
        detail: `Resource · ${r.category}`,
        page: "resources" as Page,
        icon: BookOpen,
      })),
    ...data.grants
      .filter((g) => canManage || g.visibility !== "private")
      .map((g) => ({
        id: g.id,
        title: g.name,
        detail: "Grant · " + g.status,
        page: "grants" as Page,
        icon: Sprout,
      })),
    ...(canManage
      ? data.sponsors.map((s) => ({
          id: s.id,
          title: s.name,
          detail: `Sponsor · ${s.county}`,
          page: "sponsors" as Page,
          icon: Users,
        }))
      : []),
  ]
    .filter((r) => (r.title + " " + r.detail).toLowerCase().includes(q))
    .slice(0, 8);
  return (
    <Modal title="Find your next thing" onClose={onClose}>
      <div className="search-dialog-input">
        <Search size={18} />
        <input
          aria-label="Search workspace"
          placeholder="Search tasks, events, and resources…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!q ? (
        <>
          <p className="search-label">Jump to</p>
          {[
            ...navigation,
            {
              page: "onboarding" as Page,
              label: "I’m new here",
              icon: Sparkles,
            },
            { page: "pit" as Page, label: "Competition mode", icon: Flag },
          ].map((n) => (
            <button
              className="search-result"
              key={n.page}
              onClick={() => go(n.page)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              <ChevronRight size={15} />
            </button>
          ))}
        </>
      ) : results.length ? (
        results.map((r) => (
          <button
            className="search-result"
            key={r.page + "-" + r.id}
            onClick={() => {
              openRecord(r.page, r.id);
              onClose();
            }}
          >
            <r.icon size={18} />
            <span>
              {r.title}
              <small>{r.detail}</small>
            </span>
            <ArrowRight size={15} />
          </button>
        ))
      ) : (
        <EmptyState
          title="No matches yet"
          description="Try a team member, work area, or a shorter search."
        />
      )}
      <p className="privacy-note">
        <LockKeyhole size={12} /> Results respect your role preview. Open a
        result to go straight to its details.
      </p>
    </Modal>
  );
}
function QuickTask({ onClose }: { onClose: () => void }) {
  const { data, saveRecord, canManage, notify } = useHQ();
  return (
    <Modal title="One small next step" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const task: Task = {
            id: crypto.randomUUID(),
            teamId: data.teamId,
            seasonId: data.seasonId,
            title: String(f.get("title")).trim(),
            owner: String(f.get("owner") || "Alex (you)"),
            area: String(f.get("area")),
            due: String(f.get("due")),
            priority: "Medium",
            status: "To do",
            done: String(f.get("done")).trim(),
            effort: String(f.get("effort")),
            description: "",
            dependencies: [],
            comments: [],
          };
          saveRecord("tasks", task);
          notify("Your next step is on the board.");
          onClose();
        }}
      >
        <Field label="What needs to happen?">
          <input
            name="title"
            required
            maxLength={160}
            placeholder="e.g. Run 10 intake tests"
          />
        </Field>
        <Field
          label="Done when…"
          hint="A clear finish line makes it easier to get started."
        >
          <textarea
            name="done"
            required
            rows={2}
            placeholder="e.g. Results from all 10 runs are in the build log."
          />
        </Field>
        <div className="form-grid">
          <Field label="Owner">
            <select name="owner" disabled={!canManage}>
              <option>Alex (you)</option>
              <option>Jordan</option>
              <option>Sam</option>
              <option>Riley</option>
              <option>Unassigned</option>
            </select>
          </Field>
          <Field label="Work area">
            <select name="area">
              <option>Mechanical</option>
              <option>Programming</option>
              <option>Electrical</option>
              <option>CAD</option>
              <option>Portfolio</option>
              <option>Outreach</option>
              <option>Team</option>
            </select>
          </Field>
          <Field label="Due date (optional)">
            <input name="due" type="date" />
          </Field>
          <Field label="About how long?">
            <select name="effort">
              <option>10 min</option>
              <option>20 min</option>
              <option>45 min</option>
              <option>1 meeting</option>
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            <Plus size={16} />
            Add task
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Workspace() {
  const {
    data,
    role,
    setRole,
    page,
    setPage,
    canManage,
    notice,
    clearNotice,
    storageError,
  } = useHQ();
  const [menu, setMenu] = useState(false);
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
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    document.title = `${labels[page]} · Student HQ`;
    setMenu(false);
  }, [page]);
  const navigate = (next: Page) => {
    setPage(next);
    setMenu(false);
  };
  const myCount = data.tasks.filter(
    (t) => t.owner === "Alex (you)" && t.status !== "Done",
  ).length;
  const demo =
    data.tasks.some((t) => t.demo) ||
    data.sponsors.some((s) => s.demo) ||
    data.events.some((e) => e.demo);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <button
        aria-label="Close navigation"
        className={`mobile-overlay ${menu ? "is-open" : ""}`}
        onClick={() => setMenu(false)}
        tabIndex={menu ? 0 : -1}
      />
      <aside
        className={`sidebar ${menu ? "is-open" : ""}`}
        aria-label="Workspace sidebar"
      >
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="Student HQ home"
        >
          <span className="brand-symbol">
            <Bot size={24} strokeWidth={1.65} />
          </span>
          <span className="brand-name">
            student hq<small>DELAWARE · FTC</small>
          </span>
        </button>
        <button className="team-switch" onClick={() => navigate("settings")}>
          <span className="team-switch-icon">
            <Wrench size={16} />
          </span>
          <span>
            <strong>{data.teamName}</strong>
            <small>
              {data.county} ·{" "}
              {data.teamNumber === "DEMO"
                ? "Demo team"
                : data.teamNumber
                  ? `Team ${data.teamNumber}`
                  : "Your team"}
            </small>
          </span>
          <ChevronDown size={12} />
        </button>
        <p className="nav-section-label">YOUR WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.page}
              className={`nav-link ${page === n.page ? "active" : ""}`}
              aria-current={page === n.page ? "page" : undefined}
              onClick={() => navigate(n.page)}
            >
              <n.icon />
              <span>{n.label}</span>
              {n.page === "tasks" && myCount > 0 && (
                <span className="nav-count">{myCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-lower">
          <p className="nav-section-label">TEAM TOOLKIT</p>
          <nav className="main-nav" aria-label="Team toolkit">
            <button
              className={`nav-link ${page === "pit" ? "active" : ""}`}
              aria-current={page === "pit" ? "page" : undefined}
              onClick={() => navigate("pit")}
            >
              <Flag />
              <span>Competition mode</span>
            </button>
            <button
              className={`nav-link ${page === "settings" ? "active" : ""}`}
              aria-current={page === "settings" ? "page" : undefined}
              onClick={() => navigate("settings")}
            >
              <Settings2 />
              <span>Team & settings</span>
            </button>
            <button className="nav-link" onClick={() => setHelp(true)}>
              <HelpCircle />
              <span>A little help</span>
              <ArrowRight size={12} style={{ marginLeft: "auto" }} />
            </button>
          </nav>
        </div>
        <div className="sidebar-growth">
          <div className="growth-star">
            <Sparkles size={19} />
            <span>ROOM TO GROW</span>
          </div>
          <h3>Everyone starts somewhere.</h3>
          <p>
            Your first contribution is
            <br />
            closer than you think.
          </p>
          <button onClick={() => navigate("onboarding")}>
            Start your rookie path <ArrowRight size={13} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <Avatar name="Alex Chen" />
          <div className="profile-info">
            <strong>
              Alex{" "}
              <span style={{ display: "inline", fontWeight: 400 }}>· You</span>
            </strong>
            <label>
              <span className="sr-only">Demo permission preview</span>
              <select
                aria-label="Demo permission preview"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="student">Student · demo preview</option>
                <option value="lead">Student lead · demo preview</option>
                <option value="mentor">Mentor · demo preview</option>
                <option value="admin">Admin · demo preview</option>
              </select>
            </label>
          </div>
          <button
            className="icon-btn"
            aria-label="Profile settings"
            onClick={() => navigate("settings")}
          >
            <Settings2 size={14} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu((s) => !s)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={10} />
            <span>{labels[page]}</span>
          </div>
          <button
            className="topbar-search"
            onClick={() => setSearch(true)}
            aria-label="Search workspace (Control K)"
          >
            <Search size={14} />
            <span>Find something…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <span className="team-private">
            <LockKeyhole size={12} />
            Private workspace
          </span>
          <button
            className="icon-btn notification-btn"
            aria-label="Team updates"
            onClick={() => setNotifications(true)}
          >
            <Bell size={16} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setQuickTask(true)}
          >
            <Plus size={14} />
            Add task
          </button>
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>
          <div className="demo-banner">
            <span className="demo-dot" />
            <span>
              {demo ? (
                <>
                  <strong>Demo workspace</strong> · Sample team records. Make
                  yourself at home.
                </>
              ) : (
                <>
                  <strong>Your local workspace</strong> · Records save on this
                  device.
                </>
              )}
            </span>
            <span className="saved-label">
              <CheckCircle2 size={11} />
              {storageError ? "Save needs attention" : "Device saved"}
            </span>
            <button onClick={() => navigate("settings")}>
              {data.seasonName}
              <ChevronDown size={10} />
            </button>
          </div>
          {storageError && (
            <div className="storage-error" role="alert">
              {storageError}
            </div>
          )}
          <div key={role}>
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
          {page !== "home" && (
            <footer className="page-footer">
              <button className="text-link" onClick={() => navigate("home")}>
                <HomeIcon size={13} />
                Back to my home
              </button>
              <span>
                <span className="live-dot" />
                {storageError
                  ? "Save needs attention"
                  : "Saved on this device · No team sync"}
              </span>
            </footer>
          )}
        </main>
      </div>
      {search && <SearchDialog onClose={() => setSearch(false)} />}{" "}
      {quickTask && <QuickTask onClose={() => setQuickTask(false)} />}{" "}
      {notifications && (
        <Modal title="Around the team" onClose={() => setNotifications(false)}>
          {data.announcements.length ? (
            data.announcements.map((a) => (
              <article key={a.id} className="notification-item">
                <Badge tone={a.type === "Decision" ? "purple" : "green"}>
                  {a.type}
                  {a.demo ? " · Demo" : ""}
                </Badge>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
                <small>
                  {a.author} · {a.date}
                </small>
              </article>
            ))
          ) : (
            <EmptyState
              title="All quiet for now"
              description="Team updates and decisions will appear here."
            />
          )}
        </Modal>
      )}
      {help && (
        <Modal
          title="A home base for your next step"
          onClose={() => setHelp(false)}
        >
          <div className="stack">
            <p className="muted">
              Start with your next task. When you need the plan, a file, or the
              next meeting, it’s all close by.
            </p>
            <button
              className="search-result"
              onClick={() => {
                navigate("onboarding");
                setHelp(false);
              }}
            >
              <Sparkles size={20} />
              <span>
                New here?<small>Get useful in your first five minutes.</small>
              </span>
              <ArrowRight size={16} />
            </button>
            <button
              className="search-result"
              onClick={() => {
                navigate("resources");
                setHelp(false);
              }}
            >
              <BookOpen size={20} />
              <span>
                Looking for robot instructions?
                <small>Open the robot quick reference and build library.</small>
              </span>
              <ArrowRight size={16} />
            </button>
            <button
              className="search-result"
              onClick={() => {
                navigate("settings");
                setHelp(false);
              }}
            >
              <ShieldCheck size={20} />
              <span>
                Ready for your team?
                <small>
                  Switch to the admin preview, export a backup, then start
                  fresh.
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
            <div className="settings-info">
              This MVP saves data in your browser. Role previews demonstrate the
              interface; school-approved authentication and shared team storage
              are the next integration step.
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
