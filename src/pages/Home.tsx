import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Flag,
  Lightbulb,
  MapPin,
  Megaphone,
  Plus,
  Rocket,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { useHQ } from "../store";
import {
  Avatar,
  Badge,
  EmptyState,
  Field,
  Modal,
  Progress,
} from "../components/ui";
import RobotIllustration from "../components/RobotIllustration";
import { PIT_ITEM_IDS } from "./Pit";
import { dateKey, daysUntil, dueLabel, formatDate } from "../utils";
export default function Home() {
  const {
    data,
    setPage,
    openRecord,
    saveRecord,
    canManage,
    notify,
    storageError,
  } = useHQ();
  const [taskFilter, setTaskFilter] = useState("My tasks");
  const [announcement, setAnnouncement] = useState(false);
  const openTasks = data.tasks.filter((t) => t.status !== "Done");
  const myTasks = openTasks.filter((t) => t.owner === "Alex (you)");
  const tasks = (taskFilter === "My tasks" ? myTasks : openTasks).slice(0, 4);
  const upcoming = [...data.events]
    .filter((e) => e.date >= dateKey())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const competition = upcoming.find((e) => e.type === "Competition");
  const next = competition || upcoming[0];
  const visibleGrants = data.grants.filter(
    (g) => canManage || g.visibility !== "private",
  );
  const completed = data.tasks.filter((t) => t.status === "Done").length;
  const robotTasks = data.tasks.filter((t) =>
    ["Mechanical", "Electrical", "Programming", "CAD"].includes(t.area),
  );
  const robotDone = robotTasks.filter((t) => t.status === "Done").length;
  const readyItems = PIT_ITEM_IDS.filter((id) =>
    data.pitChecklist.includes(id),
  ).length;
  const overdue = data.sponsors.filter(
    (s) =>
      s.followUp &&
      s.followUp < dateKey() &&
      !["Declined", "Do Not Contact", "Committed"].includes(s.status),
  );
  const toggleTask = (id: string) => {
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return;
    if (!canManage && task.owner !== "Alex (you)") {
      notify("You can complete tasks assigned to you.");
      return;
    }
    if (
      task.dependencies.some(
        (dep) => data.tasks.find((t) => t.id === dep)?.status !== "Done",
      )
    ) {
      notify("Finish the linked dependencies first.");
      return;
    }
    saveRecord("tasks", { ...task, status: "Done" });
    notify("Nice work. One step closer!", () => saveRecord("tasks", task));
  };
  return (
    <>
      <div className="home-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, YOUR NEXT CHAPTER</div>
          <h1>
            Good to see you, Alex <span className="greeting-spark">✳</span>
          </h1>
          <p className="page-description">
            A little progress today. A stronger team tomorrow.
          </p>
        </div>
        <div className="today-label">
          <CalendarDays size={16} />
          {formatDate(dateKey(), {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>
      <div className="home-top-grid">
        <section className="welcome-card">
          <div className="welcome-copy">
            <div className="welcome-label">
              <span />
              LET’S MAKE IT HAPPEN
            </div>
            <h2>
              Small steps.
              <br />
              Big things ahead.
            </h2>
            <p>
              You don’t need to know everything.
              <br />
              Just know your next move.
            </p>
            <div className="welcome-actions">
              <button
                className="btn btn-primary"
                onClick={() =>
                  document
                    .getElementById("next-steps")
                    ?.scrollIntoView({
                      behavior: matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? "instant"
                        : "smooth",
                      block: "center",
                    })
                }
              >
                Find my next step <ArrowRight size={16} />
              </button>
              <button
                className="welcome-rookie"
                onClick={() => setPage("onboarding")}
              >
                <Sparkles size={15} /> I’m new here
              </button>
            </div>
          </div>
          <RobotIllustration />
          <div className="hero-caption">
            <span className="live-dot" /> MADE FOR BUILDING. BETTER TOGETHER.
          </div>
        </section>
        <section className="next-event-card">
          <div className="card-topline">
            <span className="eyebrow">NEXT UP FOR THE TEAM</span>
            <Flag size={17} />
          </div>
          {next ? (
            <>
              <div className="event-countdown">
                <strong>{Math.max(0, daysUntil(next.date))}</strong>
                <div>
                  <span>days to go</span>
                  <Badge tone="green">
                    {next.demo ? "Demo event" : next.type}
                  </Badge>
                </div>
                <div className="event-orbit">
                  <Target size={43} strokeWidth={1.15} />
                </div>
              </div>
              <h3>{next.title}</h3>
              <div className="event-detail">
                <CalendarDays size={14} />
                {formatDate(next.date, {
                  month: "long",
                  day: "numeric",
                })} · {next.time}
              </div>
              <div className="event-detail">
                <MapPin size={14} />
                {next.location}
              </div>
              <div className="event-ready">
                <div>
                  <span>Let’s get competition-ready</span>
                  <strong>
                    {Math.round(
                      Math.min(100, (readyItems / PIT_ITEM_IDS.length) * 100),
                    )}
                    %
                  </strong>
                </div>
                <Progress
                  value={Math.min(
                    100,
                    (readyItems / PIT_ITEM_IDS.length) * 100,
                  )}
                />
              </div>
              <button className="event-cta" onClick={() => setPage("pit")}>
                Open competition checklist <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <EmptyState
              title="Your next event starts here"
              description="Add a build night or a competition to start planning."
              action={
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage("calendar")}
                >
                  Open team calendar
                </button>
              }
            />
          )}
        </section>
      </div>
      <div className="home-main-grid">
        <section className="card next-steps-card" id="next-steps">
          <div className="card-header">
            <div className="section-title">
              <span className="section-icon">
                <CheckCheck size={18} />
              </span>
              <h2>My next steps</h2>
              <span className="count-badge">{myTasks.length}</span>
            </div>
            <button className="text-link" onClick={() => setPage("tasks")}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="next-step-tabs" role="group" aria-label="Task view">
            {["My tasks", "Team tasks"].map((t) => (
              <button
                key={t}
                className={taskFilter === t ? "active" : ""}
                onClick={() => setTaskFilter(t)}
              >
                {t}
              </button>
            ))}
            <span className="task-summary">
              <span className="live-dot" />
              {completed} done this season
            </span>
          </div>
          <div className="home-task-list">
            {tasks.length ? (
              tasks.map((t) => (
                <div className="home-task" key={t.id}>
                  <button
                    className="task-check"
                    onClick={() => toggleTask(t.id)}
                    aria-label={`Complete ${t.title}`}
                  >
                    <Check size={13} />
                  </button>
                  <div className="home-task-copy">
                    <button onClick={() => openRecord("tasks", t.id)}>
                      {t.title}
                    </button>
                    <div>
                      <span
                        className={`area-dot area-${t.area.toLowerCase()}`}
                      />
                      {t.area}
                      <span className="meta-divider">·</span>
                      {t.effort}
                      <span className="meta-divider">·</span>
                      {t.owner === "Alex (you)" ? "You" : t.owner}
                    </div>
                  </div>
                  <div className="home-task-end">
                    <Badge
                      tone={
                        t.priority === "High"
                          ? "amber"
                          : t.status === "In progress"
                            ? "green"
                            : "gray"
                      }
                    >
                      {t.priority === "High" ? "High priority" : t.status}
                    </Badge>
                    <span className={t.due <= dateKey() ? "due-today" : ""}>
                      <Clock3 size={12} />
                      {dueLabel(t.due)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="You’re all caught up"
                description="Choose a team task or explore a new skill."
                action={
                  <button
                    className="btn btn-secondary"
                    onClick={() => setPage("onboarding")}
                  >
                    Find a first task
                  </button>
                }
              />
            )}
          </div>
          <button className="task-board-link" onClick={() => setPage("tasks")}>
            <Plus size={15} /> Pick up a task <ChevronRight size={15} />
          </button>
        </section>
        <section className="card week-card">
          <div className="card-header">
            <div className="section-title">
              <CalendarDays size={18} />
              <h2>Coming up</h2>
            </div>
            <button
              className="icon-btn"
              aria-label="Open team calendar"
              onClick={() => setPage("calendar")}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="upcoming-events">
            {upcoming.slice(0, 3).map((e, i) => (
              <button
                className="upcoming-event"
                key={e.id}
                onClick={() => openRecord("calendar", e.id)}
              >
                <div
                  className={`event-date ${i === 0 ? "event-date-first" : ""}`}
                >
                  <span>{formatDate(e.date, { month: "short" })}</span>
                  <strong>{new Date(e.date + "T12:00:00").getDate()}</strong>
                </div>
                <div>
                  <strong>{e.title}</strong>
                  <span>
                    {e.time} – {e.endTime}
                  </span>
                  <small>{e.demo ? "Demo schedule" : e.type}</small>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <button
            className="calendar-footer"
            onClick={() => setPage("calendar")}
          >
            See the team calendar <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="home-bottom-grid">
        <section className="card season-card">
          <div className="card-header">
            <div className="section-title">
              <Rocket size={18} />
              <h2>The season, moving forward</h2>
            </div>
            <Badge tone="gray">Team snapshot</Badge>
          </div>
          <div className="milestone-grid">
            <button onClick={() => openRecord("resources", "robot-reference")}>
              <span className="milestone-icon">
                <Wrench size={18} />
              </span>
              <div>
                <span>Robot milestones</span>
                <strong>
                  {robotDone}
                  <small> / {robotTasks.length} tasks</small>
                </strong>
                <Progress
                  value={
                    robotTasks.length
                      ? (robotDone / robotTasks.length) * 100
                      : 0
                  }
                />
                <small>Build. Test. Improve.</small>
              </div>
            </button>
            <button onClick={() => setPage("tasks")}>
              <span className="milestone-icon purple-icon">
                <FileText size={18} />
              </span>
              <div>
                <span>Portfolio progress</span>
                <strong>
                  {
                    data.tasks.filter(
                      (t) => t.area === "Portfolio" && t.status === "Done",
                    ).length
                  }
                  <small>
                    {" "}
                    / {
                      data.tasks.filter((t) => t.area === "Portfolio").length
                    }{" "}
                    tasks
                  </small>
                </strong>
                <Progress
                  value={
                    data.tasks.filter((t) => t.area === "Portfolio").length
                      ? (data.tasks.filter(
                          (t) => t.area === "Portfolio" && t.status === "Done",
                        ).length /
                          data.tasks.filter((t) => t.area === "Portfolio")
                            .length) *
                        100
                      : 0
                  }
                />
                <small>Tell the story as you go.</small>
              </div>
            </button>
            <button onClick={() => setPage("grants")}>
              <span className="milestone-icon orange-icon">
                <Flag size={18} />
              </span>
              <div>
                <span>Funding applications</span>
                <strong>
                  {
                    visibleGrants.filter(
                      (g) => g.status === "Submitted" || g.status === "Awarded",
                    ).length
                  }
                  <small>
                    {" "}
                    / {
                      visibleGrants.filter((g) => g.status !== "New").length
                    }{" "}
                    submitted
                  </small>
                </strong>
                <Progress
                  value={
                    visibleGrants.filter((g) => g.status !== "New").length
                      ? (visibleGrants.filter(
                          (g) =>
                            g.status === "Submitted" || g.status === "Awarded",
                        ).length /
                          visibleGrants.filter((g) => g.status !== "New")
                            .length) *
                        100
                      : 0
                  }
                />
                <small>
                  {canManage && overdue.length
                    ? `${overdue.length} sponsor follow-up${overdue.length > 1 ? "s" : ""} need attention`
                    : "A little follow-through goes far."}
                </small>
              </div>
            </button>
          </div>
        </section>
        <section className="rookie-card">
          <div className="rookie-icon">
            <Lightbulb size={23} />
          </div>
          <div>
            <span className="eyebrow">NEW TO THE CREW?</span>
            <h3>You belong here.</h3>
            <p>
              Find your people, learn one thing,
              <br />
              and make your first contribution.
            </p>
            <button className="text-link" onClick={() => setPage("onboarding")}>
              Take your first five minutes <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
      <section className="card updates-card">
        <div className="card-header">
          <div className="section-title">
            <Megaphone size={18} />
            <h2>Around the team</h2>
          </div>
          {canManage && (
            <button className="text-link" onClick={() => setAnnouncement(true)}>
              <Plus size={14} />
              Post an update
            </button>
          )}
        </div>
        <div className="updates-grid">
          {data.announcements.slice(0, 2).map((a) => (
            <article className="team-update" key={a.id}>
              <Avatar name={a.author} small />
              <div>
                <div className="update-meta">
                  {a.author}
                  <span>· {dueLabel(a.date)}</span>
                  <Badge tone={a.type === "Decision" ? "purple" : "gray"}>
                    {a.type}
                  </Badge>
                  {a.demo && <span className="demo-mini">Demo</span>}
                </div>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
              </div>
            </article>
          ))}
        </div>
        {!data.announcements.length && (
          <EmptyState
            title="Keep the whole team in the loop"
            description="Student leads and mentors can share decisions and useful updates here."
          />
        )}
      </section>
      <footer className="page-footer">
        <span>
          <span className="tiny-mark">✳</span> Built by small steps. Powered by
          your team.
        </span>
        <span>
          <span className="live-dot" />{" "}
          {storageError ? "Save needs attention" : "Saved on this device"}
        </span>
      </footer>
      {announcement && (
        <Modal
          title="Post a team update"
          onClose={() => setAnnouncement(false)}
        >
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveRecord("announcements", {
                id: crypto.randomUUID(),
                teamId: data.teamId,
                seasonId: data.seasonId,
                title: String(f.get("title")).trim(),
                body: String(f.get("body")).trim(),
                author: "Alex · student lead",
                date: dateKey(),
                type: f.get("type") as "Update" | "Decision",
              });
              setAnnouncement(false);
              notify("Update shared with your team.");
            }}
          >
            <Field label="Title">
              <input name="title" required maxLength={120} />
            </Field>
            <Field label="What should the team know?">
              <textarea name="body" required rows={4} />
            </Field>
            <Field label="Update type">
              <select name="type">
                <option>Update</option>
                <option>Decision</option>
              </select>
            </Field>
            <p className="privacy-note">Team only · No external publishing</p>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setAnnouncement(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary">Post update</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
