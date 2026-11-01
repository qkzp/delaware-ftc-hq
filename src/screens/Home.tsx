import { useState, type CSSProperties } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Crosshair,
  FileText,
  Play,
  Plus,
  Wrench,
} from "lucide-react";
import { useHQ } from "../store";
import { Field, Modal } from "../components/ui";
import { FocusSession } from "../components/FocusSession";
import { QuickTask } from "../components/WorkspaceDialogs";
import { PIT_ITEM_IDS } from "./Pit";
import { dateKey, daysUntil, dueLabel, formatDate } from "../utils";
import type { Task } from "../types";
import "./Home.css";

const workstreams = [
  { area: "Mechanical", label: "Mechanisms" },
  { area: "Programming", label: "Control & code" },
  { area: "Electrical", label: "Power & wiring" },
];
const priorityOrder = { High: 0, Medium: 1, Low: 2 };

export default function Home() {
  const {myOwner, memberName, cloud,
    data,
    setPage,
    openRecord,
    saveRecord,
    canManage,
    notify,
  } = useHQ();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [area, setArea] = useState("All work");
  const [pinnedTaskId, setPinnedTaskId] = useState<string | null>(null);
  const [sessionTaskId, setSessionTaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const today = dateKey();
  const openTasks = data.tasks.filter((task) => task.status !== "Done");
  const myTasks = openTasks.filter((task) => task.owner === myOwner);
  const blockedTasks = (task: Task) =>
    [...task.dependencies.filter(
      (id) => data.tasks.find((item) => item.id === id)?.status !== "Done",
    ), ...(task.blockedReason ? ["manual-blocker"] : [])];
  const canWork = (task: Task) => canManage || task.owner === myOwner;
  const orderedTasks = (scope === "mine" ? myTasks : openTasks)
    .filter((task) => area === "All work" || task.area === area)
    .sort(
      (a, b) =>
        Number(blockedTasks(a).length > 0) -
          Number(blockedTasks(b).length > 0) ||
        (a.due || "9999").localeCompare(b.due || "9999") ||
        priorityOrder[a.priority] - priorityOrder[b.priority],
    );
  const nextTask =
    orderedTasks.find((task) => task.id === pinnedTaskId) ||
    orderedTasks.find(canWork) ||
    orderedTasks[0];
  const queue = orderedTasks.slice(0, 5);
  const upcoming = [...data.events]
    .filter((event) => event.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const competition = upcoming.find((event) => event.type === "Competition");
  const readyItems = PIT_ITEM_IDS.filter((id) =>
    data.pitChecklist.includes(id),
  ).length;
  const completed = data.tasks.filter((task) => task.status === "Done").length;
  const visibleResources = data.resources.filter(
    (resource) =>
      canManage || (resource.visibility !== "private" && resource.approved),
  );
  const buildLog = visibleResources.find(
    (resource) => resource.kind === "Build log",
  );
  const cad = visibleResources.find((resource) => resource.kind === "CAD");
  const code = visibleResources.find((resource) => resource.kind === "Code");
  const visibleGrants = data.grants.filter(
    (grant) => canManage || grant.visibility !== "private",
  );
  const reviewGrants = visibleGrants.filter(
    (grant) => grant.status === "Needs Mentor Review",
  );
  const overdueSponsors = canManage
    ? data.sponsors.filter(
        (sponsor) =>
          sponsor.followUp &&
          sponsor.followUp <= today &&
          !["Committed", "Declined", "Do Not Contact"].includes(sponsor.status),
      )
    : [];
  const taskAreas = Array.from(
    new Set(openTasks.map((task) => task.area)),
  ).sort();

  function completeTask(task: Task) {
    if (!canWork(task)) {
      notify("You can update tasks assigned to you.");
      return;
    }
    if (blockedTasks(task).length) {
      notify("Complete this task’s linked dependencies first.");
      return;
    }
    saveRecord("tasks", { ...task, status: "Done" });
    notify("Task completed. Your work is recorded.", () =>
      saveRecord("tasks", task),
    );
  }
  function selectWorkstream(workArea: string) {
    setArea((current) => (current === workArea ? "All work" : workArea));
    setScope("team");
    setPinnedTaskId(null);
  }
  function bringToBench(task: Task) {
    setPinnedTaskId(task.id);
    document.getElementById("field-next-task")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
  }

  return (
    <div className="field-workbench">
      <header className="field-heading">
        <div>
          <div className="field-kicker">{formatDate(today, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1>Your space to build.</h1>
          <p>
            {data.teamName} <span>·</span> {data.seasonName}
            {data.teamNumber && data.teamNumber !== "DEMO"
              ? ` / Team ${data.teamNumber}`
              : ""}
          </p>
        </div>
      </header>
      <div className="attention-strip" aria-label="Needs attention">
       {myTasks.some(t=>t.due&&t.due<=today)&&<button onClick={()=>setPage('tasks')}><strong>{myTasks.filter(t=>t.due&&t.due<=today).length}</strong> of your tasks due</button>}
       {openTasks.some(t=>blockedTasks(t).length>0)&&<button onClick={()=>setPage('tasks')}><strong>{openTasks.filter(t=>blockedTasks(t).length>0).length}</strong> blocked tasks</button>}
       {canManage&&(data.evidence||[]).some(e=>!e.approved&&!e.archived)&&<button onClick={()=>setPage('evidence')}><strong>{(data.evidence||[]).filter(e=>!e.approved&&!e.archived).length}</strong> evidence reviews</button>}
      </div>

      <div className="field-stage">
        <section
          className="field-assignment"
          id="field-next-task"
          aria-labelledby="field-assignment-title"
        >
          <div className="field-sheet-top">
            <span>
              <i />
                Your next task
            </span>
          </div>
          {nextTask ? (
            <>
              <div className="field-assignment-tags">
                <span>{nextTask.area}</span>
                {nextTask.demo && (
                  <span className="field-demo">Demo task</span>
                )}
                <span className="field-priority">
                  {nextTask.priority} priority
                </span>
              </div>
              <h2 id="field-assignment-title">{nextTask.title}</h2>
              <div className="field-assignment-actions">
                <button
                  className="field-start-button"
                  disabled={
                    !canWork(nextTask) || blockedTasks(nextTask).length > 0
                  }
                  onClick={() => setSessionTaskId(nextTask.id)}
                >
                  <Play size={14} fill="currentColor" />
                  Start work session <ArrowUpRight size={17} />
                </button>
                <button
                  className="field-text-button"
                  onClick={() => openRecord("tasks", nextTask.id)}
                >
                  Task details <ArrowRight size={14} />
                </button>
              </div>
              <div className="field-assignment-spec">
                <span>
                  <small>Assigned to</small>
                  <strong>
                    {nextTask.owner === myOwner
                      ? "You"
                      : memberName(nextTask.owner)}
                  </strong>
                </span>
                <span>
                  <small>Due</small>
                  <strong
                    className={
                      nextTask.due && nextTask.due <= today ? "field-due" : ""
                    }
                  >
                    {dueLabel(nextTask.due)}
                  </strong>
                </span>
                <span>
                  <small>Estimate</small>
                  <strong>{nextTask.effort || "Not estimated"}</strong>
                </span>
                <span>
                  <small>Status</small>
                  <strong>{nextTask.status}</strong>
                </span>
              </div>
              <div className="field-finish-line">
                <span className="field-check-outline" aria-hidden="true">
                  <Check size={13} />
                </span>
                <div>
                  <h3>What success looks like</h3>
                  <p>
                    {nextTask.done ||
                      "Ask the task owner to define the result before you start."}
                  </p>
                </div>
              </div>
              {blockedTasks(nextTask).length > 0 && (
                <div className="field-blocker">
                  {nextTask.blockedReason || `Waiting on ${blockedTasks(nextTask).length} linked task(s). Open task details to see the dependencies.`}
                </div>
              )}
              {!canWork(nextTask) && (
                <p className="field-assignment-permission">
                  Ask a student lead to assign this work to you before starting
                  a session.
                </p>
              )}
            </>
          ) : (
            <div className="field-assignment-empty">
              <Crosshair size={28} />
              <h2 id="field-assignment-title">Clear bench.</h2>
              <p>
                {area !== "All work"
                  ? `No open ${area.toLowerCase()} tasks in this view.`
                  : data.tasks.length === 0 ? canManage ? "Add your first task with an owner and a clear result. Your team’s work will appear here." : "Your team has no assignments yet. Ask a student lead for your first task, or open the new member checklist." : "No open assignments in this view. Pick up a team task or start the new member checklist."}
              </p>
              <div>
                <button
                  className="field-start-button"
                  onClick={() => {
                    if(canManage && data.tasks.length === 0){setCreatingTask(true);return;}
                    setScope("team");
                    setArea("All work");
                  }}
                >
                  {canManage && data.tasks.length === 0 ? "Add first task" : "View team work"} <ArrowRight size={15} />
                </button>
                <button
                  className="field-text-button"
                  onClick={() => setPage("onboarding")}
                >
                  First assignment <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="field-system-map" aria-labelledby="field-map-title">
          <div className="field-map-head">
            <div>
              <h2 id="field-map-title">The bigger picture.</h2>
            </div>
            <span className="field-map-cross" aria-hidden="true">
              +
            </span>
          </div>
          <div className="field-progress" role="progressbar" aria-label="Team tasks completed" aria-valuemin={0} aria-valuemax={Math.max(1, data.tasks.length)} aria-valuenow={completed} aria-valuetext={`${completed} of ${data.tasks.length} team tasks completed`}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="51" className="field-progress-track" />
              <circle cx="60" cy="60" r="51" className="field-progress-value" pathLength="100" strokeDasharray={`${data.tasks.length ? completed / data.tasks.length * 100 : 0} 100`} />
            </svg>
            <span><strong>{completed}<small>/{data.tasks.length}</small></strong><span>tasks complete</span></span>
          </div>
          <div className="field-circuit">
            {workstreams.map((stream) => {
              const tasks = data.tasks.filter(
                (task) => task.area === stream.area,
              );
              const done = tasks.filter(
                (task) => task.status === "Done",
              ).length;
              const open = tasks.length - done;
              return (
                <button
                  key={stream.area}
                  className={`field-stream ${area === stream.area ? "is-selected" : ""}`}
                  onClick={() => selectWorkstream(stream.area)}
                  aria-pressed={area === stream.area}
                  aria-label={`Filter ${stream.area} workstream`}
                >
                  <span className="field-stream-terminal" aria-hidden="true" />
                  <span className="field-stream-name">
                    <strong>{stream.label}</strong>
                    <small>
                      {tasks.length
                        ? `${done}/${tasks.length} tasks complete`
                        : "No tasks tracked yet"}
                    </small>
                  </span>
                  <span className="field-stream-open">
                    {open}
                    <small>open</small>
                  </span>
                  <ArrowDownRight size={17} />
                </button>
              );
            })}
          </div>
          <div className="field-map-output">
            <span className="field-terminal-out" aria-hidden="true" />
            <div>
              <span>Competition checklist</span>
              <strong>
                {readyItems}
                <small> / {PIT_ITEM_IDS.length} checked</small>
              </strong>
            </div>
            <button
              onClick={() => setPage("pit")}
              aria-label="Open competition preparation checklist"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div
            className="field-pit-ticks"
            aria-label={`${readyItems} of ${PIT_ITEM_IDS.length} competition preparation items checked`}
          >
            {PIT_ITEM_IDS.map((id) => (
              <span
                key={id}
                className={data.pitChecklist.includes(id) ? "is-packed" : ""}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="field-season" aria-labelledby="field-season-title">
        <div className="field-season-heading">
          <h2 id="field-season-title">Coming up.</h2>
          <span>Next {Math.min(upcoming.length, 4)} team events</span>
          <button
            onClick={() => setPage("calendar")}
            aria-label="Open full season schedule"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
        {upcoming.length ? (
          <div
            className="field-season-track"
            style={
              { "--field-event-count": Math.min(upcoming.length, 4) } as CSSProperties
            }
          >
            <div className="field-now">
              <strong>Today</strong>
              <i aria-hidden="true" />
            </div>
            {upcoming.slice(0, 4).map((event) => (
              <button
                key={event.id}
                className={`field-season-event ${event.type === "Competition" ? "is-competition" : ""}`}
                onClick={() => openRecord("calendar", event.id)}
              >
                <div>
                  <time dateTime={event.date}>
                    {formatDate(event.date, { month: "short", day: "numeric" })}
                  </time>
                  {event.demo && <span className="field-demo">DEMO</span>}
                </div>
                <span className="field-track-node" aria-hidden="true" />
                <strong>{event.title}</strong>
                <small>
                  {event.time || "Time not set"} <span> / </span> {event.type}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <div className="field-season-empty">
            <p>No events on the season line yet.</p>
            <button
              className="field-text-button"
              onClick={() => setPage("calendar")}
            >
              Add the next team meeting <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>

      <div className="field-lower-layout">
        <section className="field-queue" aria-labelledby="field-queue-title">
          <div className="field-section-head">
            <div>
              <h2 id="field-queue-title">
                Your task list.<span>{orderedTasks.length}</span>
              </h2>
            </div>
            <button
              className="field-text-button"
              onClick={() => setPage("tasks")}
            >
              Full task board <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="field-queue-toolbar">
            <div className="field-scope" role="group" aria-label="Task view">
              <button
                className={scope === "mine" ? "is-active" : ""}
                aria-pressed={scope === "mine"}
                onClick={() => {
                  setScope("mine");
                  setPinnedTaskId(null);
                }}
              >
                For me <span>{myTasks.length}</span>
              </button>
              <button
                className={scope === "team" ? "is-active" : ""}
                aria-pressed={scope === "team"}
                onClick={() => {
                  setScope("team");
                  setPinnedTaskId(null);
                }}
              >
                Team <span>{openTasks.length}</span>
              </button>
            </div>
            <label>
              <span className="sr-only">Filter workstream</span>
              <select
                value={area}
                onChange={(event) => {
                  setArea(event.target.value);
                  setPinnedTaskId(null);
                }}
                aria-label="Filter workstream"
              >
                <option>All work</option>
                {taskAreas.map((workArea) => (
                  <option key={workArea}>{workArea}</option>
                ))}
              </select>
            </label>
          </div>
          {queue.length ? (
            <div
              className="field-queue-table"
              role="table"
              aria-label="Open tasks"
            >
              <div className="field-queue-heading" role="row">
                <span role="columnheader">DONE</span>
                <span role="columnheader">ASSIGNMENT</span>
                <span role="columnheader">STATUS</span>
                <span role="columnheader">DUE</span>
                <span role="columnheader" className="sr-only">
                  Select
                </span>
              </div>
              {queue.map((task) => (
                <div
                  className={`field-queue-row ${nextTask?.id === task.id ? "is-on-bench" : ""}`}
                  role="row"
                  key={task.id}
                >
                  <div role="cell">
                    <button
                      className="field-complete-button"
                      disabled={!canWork(task)}
                      aria-label={`Complete ${task.title}`}
                      onClick={() => completeTask(task)}
                    >
                      <span>
                        <Check size={12} />
                      </span>
                    </button>
                  </div>
                  <div className="field-queue-task" role="cell">
                    <button onClick={() => openRecord("tasks", task.id)}>
                      {task.title}
                    </button>
                    <p>
                      {task.area} <span>/</span> {task.effort || "No estimate"}{" "}
                      <span>/</span>{" "}
                      {task.owner === myOwner ? "You" : memberName(task.owner)}
                      {task.demo && (
                        <span className="field-row-demo">Demo</span>
                      )}
                    </p>
                  </div>
                  <div role="cell" className="field-queue-status">
                    <i
                      className={
                        task.status === "In progress" ? "is-started" : ""
                      }
                    />
                    {blockedTasks(task).length ? "Blocked" : task.status}
                  </div>
                  <div
                    role="cell"
                    className={`field-queue-due ${task.due && task.due <= today ? "field-due" : ""}`}
                  >
                    {dueLabel(task.due)}
                  </div>
                  <div role="cell">
                    <button
                      className="field-pin-button"
                      aria-label={`Bring ${task.title} to the workbench`}
                      onClick={() => bringToBench(task)}
                      title="Bring to workbench"
                    >
                      <Crosshair size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="field-queue-empty">
              <h3>No work in this view.</h3>
              <p>Choose another workstream or check all team assignments.</p>
              <button
                className="field-text-button"
                onClick={() => {
                  setArea("All work");
                  setScope("team");
                }}
              >
                Clear filters <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="field-queue-foot">
            <span>
              {completed} of {data.tasks.length} team tasks complete
            </span>
            <button onClick={() => setPage("tasks")}>
              View all{" "}
              {orderedTasks.length > queue.length
                ? `${orderedTasks.length} assignments`
                : "tasks"}
              <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <aside
          className="field-event-notes"
          aria-label="Competition and follow-ups"
        >
          <div className="field-section-head">
            <div>
              <span className="field-section-index">Next competition</span>
              <h2>
                {competition
                  ? `${Math.max(0, daysUntil(competition.date))} days out`
                  : "Set the next date"}
              </h2>
            </div>
            <span className="field-note-marker" aria-hidden="true">
              ↗
            </span>
          </div>
          {competition ? (
            <>
              <button
                className="field-event-title"
                onClick={() => openRecord("calendar", competition.id)}
              >
                {competition.title}
                <ArrowUpRight size={15} />
              </button>
              <p>
                {formatDate(competition.date, {
                  month: "long",
                  day: "numeric",
                })}{" "}
                / {competition.time || "Time pending"}
              </p>
              <p className="field-event-location">
                {competition.location || "Location to be confirmed"}
              </p>
              {competition.demo && (
                <span className="field-demo">Demo event</span>
              )}
              <button
                className="field-event-action"
                onClick={() => setPage("pit")}
              >
                Prepare the pit checklist <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <p>
                Add a competition or practice event to connect the team’s work
                to a date.
              </p>
              <button
                className="field-text-button"
                onClick={() => setPage("calendar")}
              >
                Open team schedule <ArrowRight size={14} />
              </button>
            </>
          )}
          {(overdueSponsors.length > 0 || reviewGrants.length > 0) && (
            <div className="field-follow-ups">
              <span className="field-section-index">Follow-ups</span>
              {overdueSponsors.length > 0 && (
                <button
                  onClick={() => openRecord("sponsors", overdueSponsors[0].id)}
                >
                  <span>{overdueSponsors.length}</span>
                  Sponsor follow-up{overdueSponsors.length > 1 ? "s" : ""} due
                  <ArrowUpRight size={14} />
                </button>
              )}
              {reviewGrants.length > 0 && (
                <button
                  onClick={() => openRecord("grants", reviewGrants[0].id)}
                >
                  <span>{reviewGrants.length}</span>
                  Application{reviewGrants.length > 1 ? "s" : ""} to review
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      <section
        className="field-bench-access"
        aria-label="Robot documentation shortcuts"
      >
        <div>
          <Wrench size={19} />
          <span>Made for your robot.</span>
        </div>
        {[
          {
            label: "Robot reference",
            detail: "Setup / wiring / repair",
            action: () => openRecord("resources", "robot-reference"),
          },
          {
            label: "CAD & design",
            detail: cad?.title || "Add your design files",
            action: () =>
              cad ? openRecord("resources", cad.id) : setPage("resources"),
          },
          {
            label: "Source & build log",
            detail: buildLog?.title || code?.title || "Document the work",
            action: () =>
              buildLog
                ? openRecord("resources", buildLog.id)
                : code
                  ? openRecord("resources", code.id)
                  : setPage("resources"),
          },
        ].map((link) => (
          <button key={link.label} onClick={link.action}>
            <strong>{link.label}</strong>
            <span>{link.detail}</span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </section>

      <section className="field-team-log" aria-labelledby="field-log-title">
        <div className="field-section-head">
          <div>
            <h2 id="field-log-title">Keep everyone in the loop.</h2>
          </div>
          {canManage && (
            <button
              className="field-text-button"
              onClick={() => setAnnouncement(true)}
            >
              <Plus size={14} />
              Post update
            </button>
          )}
        </div>
        <div className="field-log-entries">
          {data.announcements.length ? (
            data.announcements.slice(0, 2).map((update) => (
              <article className="field-log-entry" key={update.id}>
                <div className="field-log-meta">
                  <span>{update.type}</span>
                  <time dateTime={update.date}>{formatDate(update.date)}</time>
                  {update.demo && <span className="field-demo">DEMO</span>}
                </div>
                <h3>{update.title}</h3>
                <p>{update.body}</p>
                <footer>
                  <FileText size={13} />
                  {memberName(update.author)}
                </footer>
              </article>
            ))
          ) : (
            <p className="field-log-empty">
              No team notes yet. Record a decision, test result, or the context
              behind a change.
            </p>
          )}
        </div>
      </section>

      <div className="field-new-member">
        <span className="field-registration" aria-hidden="true">
          +
        </span>
        <div>
          <strong>First time in the workshop?</strong>
          <span>A beginner guide, a teammate, and one real assignment.</span>
        </div>
        <button onClick={() => setPage("onboarding")}>
          New member checklist <ArrowRight size={16} />
        </button>
      </div>

      {sessionTaskId && (
        <FocusSession
          taskId={sessionTaskId}
          onClose={() => setSessionTaskId(null)}
        />
      )}
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
                author: myOwner,
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
      {creatingTask && <QuickTask onClose={()=>setCreatingTask(false)}/>}
    </div>
  );
}
