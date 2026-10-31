import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useHQ } from "../store";
import { Field, Modal } from "../components/ui";
import { PIT_ITEM_IDS } from "./Pit";
import { dateKey, daysUntil, dueLabel, formatDate } from "../utils";
import "./Home.css";

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
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [announcement, setAnnouncement] = useState(false);
  const today = dateKey();
  const openTasks = data.tasks.filter((task) => task.status !== "Done");
  const myTasks = openTasks.filter((task) => task.owner === "Alex (you)");
  const scopedTasks = scope === "mine" ? myTasks : openTasks;
  const tasks = [...scopedTasks]
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
    .slice(0, 6);
  const upcoming = [...data.events]
    .filter((event) => event.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const nextSession = upcoming[0];
  const competition = upcoming.find((event) => event.type === "Competition");
  const laterEvents = upcoming
    .filter(
      (event) => event.id !== nextSession?.id && event.id !== competition?.id,
    )
    .slice(0, 3);
  const visibleGrants = data.grants.filter(
    (grant) => canManage || grant.visibility !== "private",
  );
  const activeGrants = visibleGrants.filter(
    (grant) => !["New", "Closed", "Not Awarded"].includes(grant.status),
  );
  const submittedGrants = activeGrants.filter((grant) =>
    ["Submitted", "Awarded"].includes(grant.status),
  ).length;
  const completed = data.tasks.filter((task) => task.status === "Done").length;
  const robotTasks = data.tasks.filter((task) =>
    ["Mechanical", "Electrical", "Programming", "CAD"].includes(task.area),
  );
  const robotDone = robotTasks.filter((task) => task.status === "Done").length;
  const readyItems = PIT_ITEM_IDS.filter((id) =>
    data.pitChecklist.includes(id),
  ).length;
  const overdueSponsors = canManage
    ? data.sponsors.filter(
        (sponsor) =>
          sponsor.followUp &&
          sponsor.followUp <= today &&
          !["Declined", "Do Not Contact", "Committed"].includes(sponsor.status),
      )
    : [];
  const visibleResources = data.resources.filter(
    (resource) =>
      canManage || (resource.visibility !== "private" && resource.approved),
  );
  const buildLog = visibleResources.find(
    (resource) => resource.kind === "Build log",
  );
  const quickLinks = [
    {
      label: "Robot reference",
      action: () => openRecord("resources", "robot-reference"),
    },
    {
      label: "Build log",
      action: () =>
        buildLog ? openRecord("resources", buildLog.id) : setPage("resources"),
    },
    { label: "Season schedule", action: () => setPage("calendar") },
  ];
  const preparationGroups = [
    { label: "Robot & inspection", prefix: "robot-" },
    { label: "Batteries & essentials", prefix: "battery-" },
    { label: "Pit & assignments", prefix: "pit-" },
  ];

  function completeTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    if (!canManage && task.owner !== "Alex (you)") {
      notify("You can update tasks assigned to you.");
      return;
    }
    if (
      task.dependencies.some(
        (id) => data.tasks.find((item) => item.id === id)?.status !== "Done",
      )
    ) {
      notify("Complete the linked dependencies before finishing this task.");
      return;
    }
    saveRecord("tasks", { ...task, status: "Done" });
    notify("Task completed.", () => saveRecord("tasks", task));
  }

  return (
    <div className="overview">
      <header className="overview-heading">
        <div>
          <div className="overview-label">TEAM OVERVIEW</div>
          <h1>{data.teamName}</h1>
          <p>
            {data.county === "Statewide" ? "Delaware" : `${data.county} County`}{" "}
            <span>/</span> {data.seasonName}
            {data.teamNumber && data.teamNumber !== "DEMO"
              ? ` / Team ${data.teamNumber}`
              : ""}
          </p>
        </div>
        <div className="overview-date">
          <span>{formatDate(today, { weekday: "long" })}</span>
          <strong>
            {formatDate(today, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </strong>
        </div>
      </header>

      <section className="overview-session" aria-label="Next team event">
        <div className="overview-session-label">NEXT EVENT</div>
        {nextSession ? (
          <>
            <span className="overview-session-date">
              {dueLabel(nextSession.date)}
              {nextSession.time ? ` / ${nextSession.time}` : ""}
            </span>
            <button
              className="overview-session-title"
              onClick={() => openRecord("calendar", nextSession.id)}
            >
              {nextSession.title}
            </button>
            {nextSession.demo && <span className="overview-demo">DEMO</span>}
            <button
              className="overview-inline-link"
              onClick={() => openRecord("calendar", nextSession.id)}
            >
              Agenda <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="overview-session-empty">
              No upcoming meeting or event.
            </span>
            <button
              className="overview-inline-link"
              onClick={() => setPage("calendar")}
            >
              Set up the schedule <ArrowRight size={14} />
            </button>
          </>
        )}
      </section>

      <div className="overview-columns">
        <div className="overview-main">
          <section
            className="overview-work"
            aria-labelledby="overview-work-title"
          >
            <div className="overview-section-heading">
              <div>
                <h2 id="overview-work-title">Open work</h2>
                <span className="overview-section-count">
                  {scopedTasks.length}
                </span>
              </div>
              <button
                className="overview-inline-link"
                onClick={() => setPage("tasks")}
              >
                Task board <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="overview-work-toolbar">
              <div
                className="overview-scope"
                role="group"
                aria-label="Task view"
              >
                <button
                  aria-pressed={scope === "mine"}
                  className={scope === "mine" ? "is-active" : ""}
                  onClick={() => setScope("mine")}
                >
                  Assigned to me <span>{myTasks.length}</span>
                </button>
                <button
                  aria-pressed={scope === "team"}
                  className={scope === "team" ? "is-active" : ""}
                  onClick={() => setScope("team")}
                >
                  All team work <span>{openTasks.length}</span>
                </button>
              </div>
            </div>
            {tasks.length ? (
              <div
                className="overview-work-table"
                role="table"
                aria-label="Open tasks"
              >
                <div className="overview-work-head" role="row">
                  <span role="columnheader" className="overview-check-column">
                    <span className="sr-only">Complete</span>
                  </span>
                  <span role="columnheader">TASK</span>
                  <span role="columnheader">STATUS</span>
                  <span role="columnheader">OWNER</span>
                  <span role="columnheader">DUE</span>
                </div>
                {tasks.map((task) => (
                  <div className="overview-work-row" key={task.id} role="row">
                    <div role="cell" className="overview-check-column">
                      <button
                        className="overview-check"
                        disabled={!canManage && task.owner !== "Alex (you)"}
                        aria-label={`Complete ${task.title}`}
                        onClick={() => completeTask(task.id)}
                      >
                        <span>
                          <Check size={12} />
                        </span>
                      </button>
                    </div>
                    <div className="overview-work-name" role="cell">
                      <button onClick={() => openRecord("tasks", task.id)}>
                        {task.title}
                      </button>
                      <p>
                        {task.area}
                        <span> / </span>
                        {task.effort}
                        {task.priority === "High" && (
                          <>
                            <span> / </span>
                            <b>High priority</b>
                          </>
                        )}
                        {task.demo && (
                          <>
                            <span> / </span>
                            <span className="overview-row-demo">Demo</span>
                          </>
                        )}
                      </p>
                      <span className="overview-done-condition">
                        {task.done}
                      </span>
                    </div>
                    <div className="overview-work-status" role="cell">
                      <span
                        className={
                          task.status === "In progress"
                            ? "overview-status-dot is-started"
                            : "overview-status-dot"
                        }
                      />
                      {task.status}
                    </div>
                    <div className="overview-work-owner" role="cell">
                      {task.owner === "Alex (you)" ? "You" : task.owner}
                    </div>
                    <div
                      className={`overview-work-due ${task.due && task.due <= today ? "is-due" : ""}`}
                      role="cell"
                    >
                      {dueLabel(task.due)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overview-empty">
                <h3>
                  {scope === "mine"
                    ? "No open assignments"
                    : "No open team tasks"}
                </h3>
                <p>
                  {scope === "mine"
                    ? "Choose an existing team task or use onboarding to create your first assignment."
                    : "Add a task with an owner, a due date, and a clear finish line."}
                </p>
                <button
                  className="overview-inline-link"
                  onClick={() =>
                    setPage(scope === "mine" ? "onboarding" : "tasks")
                  }
                >
                  {scope === "mine"
                    ? "Find a first assignment"
                    : "Open task board"}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            {scopedTasks.length > tasks.length && (
              <button
                className="overview-table-more"
                onClick={() => setPage("tasks")}
              >
                View {scopedTasks.length - tasks.length} more open tasks{" "}
                <ArrowRight size={14} />
              </button>
            )}
          </section>

          <section
            className="overview-season"
            aria-labelledby="overview-season-title"
          >
            <div className="overview-section-heading">
              <div>
                <h2 id="overview-season-title">Season status</h2>
              </div>
              <span className="overview-small-label">{data.seasonName}</span>
            </div>
            <div className="overview-metrics">
              <button onClick={() => setPage("tasks")}>
                <span>TEAM TASKS</span>
                <strong>
                  {completed}
                  <small> / {data.tasks.length}</small>
                </strong>
                <div
                  className="overview-meter"
                  aria-label={`${completed} of ${data.tasks.length} team tasks complete`}
                >
                  <i
                    style={{
                      width: `${data.tasks.length ? (completed / data.tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>completed</small>
              </button>
              <button
                onClick={() => openRecord("resources", "robot-reference")}
              >
                <span>ROBOT WORK</span>
                <strong>
                  {robotDone}
                  <small> / {robotTasks.length}</small>
                </strong>
                <div
                  className="overview-meter"
                  aria-label={`${robotDone} of ${robotTasks.length} robot tasks complete`}
                >
                  <i
                    style={{
                      width: `${robotTasks.length ? (robotDone / robotTasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>build tasks complete</small>
              </button>
              <button onClick={() => setPage("grants")}>
                <span>APPLICATIONS</span>
                <strong>
                  {submittedGrants}
                  <small> / {activeGrants.length}</small>
                </strong>
                <div
                  className="overview-meter"
                  aria-label={`${submittedGrants} of ${activeGrants.length} tracked applications submitted`}
                >
                  <i
                    style={{
                      width: `${activeGrants.length ? (submittedGrants / activeGrants.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>recorded as submitted</small>
              </button>
            </div>
          </section>

          <section
            className="overview-team-log"
            aria-labelledby="overview-log-title"
          >
            <div className="overview-section-heading">
              <div>
                <h2 id="overview-log-title">Team log</h2>
                <span className="overview-section-count">
                  {data.announcements.length}
                </span>
              </div>
              {canManage && (
                <button
                  className="overview-inline-link"
                  onClick={() => setAnnouncement(true)}
                >
                  <Plus size={14} />
                  Post update
                </button>
              )}
            </div>
            {data.announcements.length ? (
              data.announcements.slice(0, 3).map((update) => (
                <article className="overview-log-entry" key={update.id}>
                  <div className="overview-log-date">
                    <time dateTime={update.date}>
                      {formatDate(update.date)}
                    </time>
                    <span>{update.type}</span>
                  </div>
                  <div className="overview-log-body">
                    <h3>{update.title}</h3>
                    <p>{update.body}</p>
                    <div>
                      {update.author}
                      {update.demo && (
                        <span className="overview-demo">DEMO</span>
                      )}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="overview-empty">
                <p>
                  No team updates yet. Decisions and meeting notes will appear
                  here.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="overview-rail" aria-label="Events and team reference">
          <section className="overview-competition">
            <div className="overview-rail-title">NEXT COMPETITION</div>
            {competition ? (
              <>
                <div className="overview-competition-date">
                  <strong>
                    {new Date(competition.date + "T12:00:00").getDate()}
                  </strong>
                  <div>
                    <span>
                      {formatDate(competition.date, { month: "long" })}
                    </span>
                    <small>
                      {Math.max(0, daysUntil(competition.date))} DAYS AWAY
                    </small>
                  </div>
                  {competition.demo && (
                    <span className="overview-demo">DEMO</span>
                  )}
                </div>
                <button
                  className="overview-competition-name"
                  onClick={() => openRecord("calendar", competition.id)}
                >
                  {competition.title}
                  <ArrowUpRight size={15} />
                </button>
                <p>{competition.location}</p>
                <span className="overview-event-time">
                  {competition.time || "Time to be confirmed"}
                  {competition.endTime ? ` – ${competition.endTime}` : ""}
                </span>
              </>
            ) : (
              <div className="overview-no-competition">
                <p>No competition scheduled.</p>
                <button
                  className="overview-inline-link"
                  onClick={() => setPage("calendar")}
                >
                  Add event details <ArrowRight size={14} />
                </button>
              </div>
            )}
            <div className="overview-preparation">
              <div className="overview-preparation-heading">
                <h3>Event preparation</h3>
                <span>
                  {readyItems}/{PIT_ITEM_IDS.length}
                </span>
              </div>
              <div
                className="overview-meter"
                aria-label={`${readyItems} of ${PIT_ITEM_IDS.length} preparation items complete`}
              >
                <i
                  style={{
                    width: `${(readyItems / PIT_ITEM_IDS.length) * 100}%`,
                  }}
                />
              </div>
              {preparationGroups.map((group) => {
                const ids = PIT_ITEM_IDS.filter((id) =>
                  id.startsWith(group.prefix),
                );
                return (
                  <button
                    key={group.prefix}
                    className="overview-prep-row"
                    onClick={() => setPage("pit")}
                  >
                    <span>{group.label}</span>
                    <span>
                      {
                        ids.filter((id) => data.pitChecklist.includes(id))
                          .length
                      }
                      /{ids.length}
                      <ChevronRight size={13} />
                    </span>
                  </button>
                );
              })}
              <button
                className="overview-rail-action"
                onClick={() => setPage("pit")}
              >
                Open event checklist <ArrowRight size={14} />
              </button>
            </div>
          </section>

          {laterEvents.length > 0 && (
            <section className="overview-schedule">
              <div className="overview-rail-title">ON THE SCHEDULE</div>
              {laterEvents.map((event) => (
                <button
                  className="overview-schedule-row"
                  key={event.id}
                  onClick={() => openRecord("calendar", event.id)}
                >
                  <span className="overview-schedule-date">
                    {formatDate(event.date)}
                  </span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {event.time}
                      {event.demo ? " / Demo" : ` / ${event.type}`}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </section>
          )}

          {overdueSponsors.length > 0 && (
            <section className="overview-follow-ups">
              <div className="overview-rail-title">FOLLOW-UP REQUIRED</div>
              <button
                onClick={() => openRecord("sponsors", overdueSponsors[0].id)}
              >
                <strong>{overdueSponsors.length}</strong>
                <span>
                  Sponsor follow-up{overdueSponsors.length > 1 ? "s" : ""} due
                </span>
                <ArrowUpRight size={15} />
              </button>
              <p>Outreach records are restricted to leads and mentors.</p>
            </section>
          )}

          <section className="overview-reference">
            <div className="overview-rail-title">TEAM REFERENCE</div>
            {quickLinks.map((link) => (
              <button key={link.label} onClick={link.action}>
                {link.label}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </section>
          <section className="overview-onboarding">
            <span>NEW TO FTC?</span>
            <h3>Start with one assignment.</h3>
            <p>Meet the team, find a guide, and pick up your first task.</p>
            <button
              className="overview-inline-link"
              onClick={() => setPage("onboarding")}
            >
              Open onboarding <ArrowRight size={14} />
            </button>
          </section>
        </aside>
      </div>

      <footer className="overview-footer">
        <span>DELAWARE FTC / STUDENT HQ</span>
        <span>
          {storageError
            ? "SAVE REQUIRES ATTENTION"
            : "SAVED ON THIS DEVICE / NO TEAM SYNC"}
        </span>
      </footer>

      {announcement && (
        <Modal
          title="Post a team update"
          onClose={() => setAnnouncement(false)}
        >
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const title = String(form.get("title") || "").trim();
              const body = String(form.get("body") || "").trim();
              if (!title || !body) {
                notify("Add a title and update before posting.");
                return;
              }
              saveRecord("announcements", {
                id: crypto.randomUUID(),
                teamId: data.teamId,
                seasonId: data.seasonId,
                title,
                body,
                author: "Alex · student lead",
                date: today,
                type: form.get("type") as "Update" | "Decision",
              });
              setAnnouncement(false);
              notify("Team update posted.");
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
    </div>
  );
}
