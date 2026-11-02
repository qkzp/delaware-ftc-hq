import {useViewPreference} from "../use-preferences";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  CalendarDays,
  Columns3,
  Flag,
  List,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { useHQ, useRecordDraft } from "../store";
import {
  Avatar,
  Badge,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Progress,
} from "../components/ui";
import type { Task } from "../types";
import TaskPlanning from "../components/task-planning";
import { FocusSession } from "../components/FocusSession";
import "./tasks-calendar.css";

const statuses: Task["status"][] = ["To do", "In progress", "Done"];
const areas = [
  "Mechanical",
  "Electrical",
  "CAD",
  "Programming",
  "Outreach",
  "Fundraising",
  "Portfolio",
  "Drive team",
  "Scouting",
  "Safety",
];
const demoMembers = [
  "Alex (you)",
  "Jordan",
  "Sam",
  "Riley",
  "Taylor",
  "Unassigned",
];
const day = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dueText = (date: string) =>
  !date
    ? "No due date"
    : date === day()
      ? "Today"
      : new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
const tone = (priority: Task["priority"]) =>
  priority === "High" ? "amber" : priority === "Medium" ? "blue" : "gray";

export default function TasksPage() {
  const {myOwner, memberName, cloud,
    data,
    draftScope,
    role,
    canManage,
    saveRecord,
    removeRecord,
    notify,
    focusRecord,
    openRecord,
    clearFocusRecord,
  } = useHQ();
  const members = cloud.shared ? [...cloud.shared.members.map(m => m.userId), "Unassigned"] : demoMembers;
  const [view, setView] = useViewPreference("taskView");
  const [focusTask, setFocusTask] = useState<{id:string;scope:string}|null>(null);
  const [scope, setScope] = useState("All tasks");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("All work areas");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [subsystem, setSubsystem] = useState("All subsystems");
  const [editing, setEditing, saveDraft] = useRecordDraft("tasks");
  const [comment, setComment] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canEdit = (task: Task) =>
    role !== "student" || task.owner === myOwner;
  const visibleResources = data.resources.filter(
    (r) => canManage || (r.visibility !== "private" && r.approved),
  );
  const filtered = useMemo(
    () =>
      data.tasks.filter(
        (t) =>
          (scope !== "My tasks" || t.owner === myOwner) &&
          (area === "All work areas" || t.area === area) &&
          (subsystem === "All subsystems" || t.subsystem === subsystem) &&
          (statusFilter === "All statuses" || (statusFilter === "Blocked" ? !!t.blockedReason || t.dependencies.some(id => data.tasks.find(x => x.id === id)?.status !== "Done") : t.status === statusFilter)) &&
          `${t.title} ${memberName(t.owner)} ${t.area} ${t.subsystem || ""} ${t.blockedReason || ""} ${t.description}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.tasks, scope, area, statusFilter, query, subsystem, myOwner],
  );
  const complete = data.tasks.filter((t) => t.status === "Done").length;
  const blockedBy = (task: Task) =>
    data.tasks.filter(
      (t) => task.dependencies.includes(t.id) && t.status !== "Done",
    );
  const wouldCycle = (
    candidate: Task,
    target: string,
    visited = new Set<string>(),
  ): boolean => {
    if (candidate.id === target) return true;
    if (visited.has(candidate.id)) return false;
    visited.add(candidate.id);
    return candidate.dependencies.some((id) => {
      const next = data.tasks.find((t) => t.id === id);
      return next ? wouldCycle(next, target, visited) : false;
    });
  };
  const changeStatus = (task: Task, status: Task["status"]) => {
    if (!canEdit(task)) return;
    if (status === "Done" && (blockedBy(task).length || task.blockedReason)) {
      notify("Finish this task’s dependencies before marking it done.");
      return;
    }
    if (!saveRecord("tasks", { ...task, status }, {original:task, scope:draftScope})) return;
    notify(
      status === "Done"
        ? "Task completed."
        : `Task moved to ${status.toLowerCase()}.`,
    );
  };
  const open = (task: Task) => {
    setEditing({
      ...task,
      dependencies: [...task.dependencies],
      comments: [...task.comments],
    });
    setComment("");
    setDeleting(false);
  };
  useEffect(() => {
    if (focusRecord?.page !== "tasks") return;
    const task = data.tasks.find((t) => t.id === focusRecord.id);
    if (task) open(task);
    else notify("This task is no longer in this workspace.");
    clearFocusRecord();
  }, [focusRecord, data.tasks, clearFocusRecord]);
  const create = () =>
    open({
      id: crypto.randomUUID(),
      teamId: data.teamId,
      seasonId: data.seasonId,
      demo: false,
      title: "",
      owner: myOwner,
      area: "Mechanical",
      due: day(),
      priority: "Medium",
      status: "To do",
      done: "",
      effort: "30 min",
      description: "",
      dependencies: [],
      comments: [],
    });
  const patch = (update: Partial<Task>) =>
    setEditing((t) => (t ? { ...t, ...update } : t));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !canEdit(editing)) return;
    if (editing.status === "Done" && (blockedBy(editing).length || editing.blockedReason)) {
      notify("Complete the linked dependencies first.");
      return;
    }
    const record = {
      ...editing,
      title: editing.title.trim(),
      done: editing.done.trim(),
    };
    if (!record.title || !record.done) return;
    if (!saveDraft(record)) return;
    notify(
      data.tasks.some((t) => t.id === record.id)
        ? "Task updated."
        : "Task added.",
    );
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / TASKS"
        title="Tasks"
        description="Assignments, blockers, and completed work."
        actions={
          canManage ? (
            <button className="btn btn-primary" onClick={create}>
              <Plus size={17} />
              New task
            </button>
          ) : undefined
        }
      />
      <div className="tc-task-summary">
        <div>
          <span className="tc-summary-icon">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <strong>
              {complete} of {data.tasks.length}
            </strong>
            <span>tasks complete</span>
          </div>
        </div>
        <div className="tc-summary-progress">
          <Progress
            value={data.tasks.length ? (complete / data.tasks.length) * 100 : 0}
          />
          <small>
            {data.tasks.length
              ? Math.round((complete / data.tasks.length) * 100)
              : 0}
            % of the way there
          </small>
        </div>
        <div>
          <span className="tc-summary-icon amber">
            <Clock3 size={20} />
          </span>
          <div>
            <strong>
              {
                data.tasks.filter(
                  (t) => t.status !== "Done" && t.due && t.due < day(),
                ).length
              }
            </strong>
            <span>overdue tasks</span>
          </div>
        </div>
      </div>
      <div className="tc-task-toolbar">
        <div className="filter-tabs" role="group" aria-label="Task scope">
          {["All tasks", "My tasks"].map((s) => (
            <button
              key={s}
              className={scope === s ? "active" : ""}
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
            >
              {s}
              {s === "My tasks" && (
                <span className="tc-tab-count">
                  {
                    data.tasks.filter(
                      (t) => t.owner === myOwner && t.status !== "Done",
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="tc-view-switch" role="group" aria-label="Task view">
          <button
            title="Board view"
            aria-label="Board view"
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
            className={view === "board" ? "active" : ""}
          >
            <Columns3 size={17} />
          </button>
          <button
            title="List view"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={view === "list" ? "active" : ""}
          >
            <List size={18} />
          </button>
          <button
            title="Plan view"
            aria-label="Plan view"
            aria-pressed={view === "plan"}
            onClick={() => setView("plan")}
            className={`task-plan-view-button ${view === "plan" ? "active" : ""}`}
          >
            <CalendarDays size={17} aria-hidden="true" />Plan
          </button>
        </div>
      </div>
      <div className="filters tc-task-filters">
        <label className="tc-filter-search">
          <Search size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Search tasks, people, or work…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter work area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option>All work areas</option>
          {Array.from(new Set([...areas, ...data.tasks.map((t) => t.area)]))
            .sort()
            .map((a) => (
              <option key={a}>{a}</option>
            ))}
        </select>
        <select
          aria-label="Filter task status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All statuses</option>
          <option>Blocked</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Filter robot subsystem" value={subsystem} onChange={e=>setSubsystem(e.target.value)}><option>All subsystems</option>{Array.from(new Set(data.tasks.map(t=>t.subsystem).filter(Boolean))).map(s=><option key={s}>{s}</option>)}</select>
      </div>
      {!filtered.length ? (
        <EmptyState
          title="No matching tasks"
          description="Change the filters or add a task."
          action={
            <button
              className="btn btn-secondary"
              onClick={() => {
                setQuery("");
                setArea("All work areas");
                setStatusFilter("All statuses");
                setScope("All tasks");
                setSubsystem("All subsystems");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : view === "plan" ? (
        <TaskPlanning
          key={draftScope}
          tasks={filtered}
          allTasks={data.tasks}
          members={members}
          today={day()}
          memberName={memberName}
          canWork={canEdit}
          onOpen={open}
          onFocus={(task) => {
            if (canEdit(task) && task.status !== "Done") setFocusTask({id:task.id,scope:draftScope});
          }}
        />
      ) : view === "board" ? (
        <div className="tc-board">
          {statuses.map((status) => (
            <section className="tc-board-column" key={status}>
              <div className="tc-column-heading">
                <span
                  className={`tc-status-dot ${status === "In progress" ? "progress" : status === "Done" ? "done" : ""}`}
                />
                <h2>{status}</h2>
                <span>
                  {filtered.filter((t) => t.status === status).length}
                </span>
                {canManage && (
                  <button
                    className="icon-btn"
                    aria-label={`Add ${status.toLowerCase()} task`}
                    onClick={() => {
                      create();
                      setEditing((t) => (t ? { ...t, status } : t));
                    }}
                  >
                    <Plus size={17} />
                  </button>
                )}
              </div>
              <div className="tc-column-cards">
                {filtered
                  .filter((t) => t.status === status)
                  .map((task) => (
                    <article
                      className={`tc-task-card ${task.status === "Done" ? "tc-task-done" : ""}`}
                      key={task.id}
                    >
                      <div className="tc-task-card-top">
                        <Badge
                          tone={
                            task.area === "Programming"
                              ? "purple"
                              : task.area === "Outreach"
                                ? "blue"
                                : "green"
                          }
                        >
                          {task.area}
                        </Badge>
                        {task.demo && (
                          <span className="tc-demo-mark">Demo</span>
                        )}
                      </div>
                      <button
                        className="tc-task-title"
                        onClick={() => open(task)}
                      >
                        {task.title}
                        <ArrowUpRight size={16} />
                      </button>
                      <p className="tc-task-condition">{task.done}</p>
                      {task.subsystem && <Badge>{task.subsystem}</Badge>}
                      {task.blockedReason && <p className="tc-blocked">Blocked: {task.blockedReason}</p>}
                      {blockedBy(task).length > 0 && (
                        <div className="tc-blocked">
                          Waiting on {blockedBy(task).length} linked task
                          {blockedBy(task).length > 1 ? "s" : ""}
                        </div>
                      )}
                      <div className="tc-card-badges">
                        <Badge tone={tone(task.priority)}>
                          <Flag size={11} />
                          {task.priority}
                        </Badge>
                        <span
                          className={
                            task.due &&
                            task.due < day() &&
                            task.status !== "Done"
                              ? "tc-overdue"
                              : "muted"
                          }
                        >
                          <Clock3 size={12} />
                          {dueText(task.due)}
                        </span>
                      </div>
                      <div className="tc-task-card-footer">
                        <div className="inline">
                          <Avatar name={memberName(task.owner)} small />
                          <span>{memberName(task.owner)}</span>
                        </div>
                        {task.comments.length > 0 && (
                          <span className="inline muted">
                            <MessageSquare size={13} />
                            {task.comments.length}
                          </span>
                        )}
                        <select
                          aria-label={`Status for ${task.title}`}
                          disabled={!canEdit(task)}
                          value={task.status}
                          onChange={(e) =>
                            changeStatus(task, e.target.value as Task["status"])
                          }
                        >
                          {statuses.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </article>
                  ))}
                {!filtered.some((t) => t.status === status) && (
                  <div className="tc-column-empty">
                    {status === "Done"
                      ? "No completed tasks."
                      : "No tasks in this status."}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card tc-task-list">
          {filtered.map((task) => (
            <div className="task-row" key={task.id}>
              <button
                className={`tc-check ${task.status === "Done" ? "checked" : ""}`}
                aria-label={`${task.status === "Done" ? "Reopen" : "Complete"} ${task.title}`}
                disabled={!canEdit(task)}
                onClick={() =>
                  changeStatus(task, task.status === "Done" ? "To do" : "Done")
                }
              >
                {task.status === "Done" ? (
                  <Check size={16} />
                ) : (
                  <Circle size={18} />
                )}
              </button>
              <button className="tc-task-list-title" onClick={() => open(task)}>
                <strong>{task.title}</strong>
                <span>
                  {task.area} · {task.effort} · {memberName(task.owner)}
                </span>
              </button>
              <Badge tone={tone(task.priority)}>{task.priority}</Badge>
              <span
                className={`tc-list-date ${task.due && task.due < day() && task.status !== "Done" ? "tc-overdue" : ""}`}
              >
                {dueText(task.due)}
              </span>
              <select
                aria-label={`Status for ${task.title}`}
                value={task.status}
                disabled={!canEdit(task)}
                onChange={(e) =>
                  changeStatus(task, e.target.value as Task["status"])
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      <p className="tc-page-footnote">
        Team workspace ·{" "}
        {role === "student"
          ? "You can update your own tasks. Ask a student lead to reassign work."
          : "Every task includes an owner and a definition of done."}
      </p>
      {focusTask?.scope === draftScope && <FocusSession key={`${draftScope}:${focusTask.id}`} taskId={focusTask.id} onClose={()=>setFocusTask(null)}/>}
      {editing && (
        <Modal
          title={
            data.tasks.some((t) => t.id === editing.id)
              ? "Task details"
              : "New task"
          }
          onClose={() => setEditing(null)}
          wide
        >
          <form onSubmit={save} className="stack">
            <Field label="Task name">
              <input
                required
                maxLength={160}
                value={editing.title}
                disabled={!canEdit(editing)}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="For example, test the intake with five samples"
              />
            </Field>
            <div className="form-grid">
              <Field label="Owner">
                <select
                  disabled={!canManage}
                  value={editing.owner}
                  onChange={(e) => patch({ owner: e.target.value })}
                >
                  {Array.from(
                    new Set([...members, ...data.tasks.map((t) => t.owner)]),
                  ).map((m) => (
                    <option key={m} value={m}>{memberName(m)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Work area">
                <select
                  disabled={!canEdit(editing)}
                  value={editing.area}
                  onChange={(e) => patch({ area: e.target.value })}
                >
                  {Array.from(
                    new Set([...areas, ...data.tasks.map((t) => t.area)]),
                  ).map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={editing.due}
                  disabled={!canEdit(editing)}
                  onChange={(e) => patch({ due: e.target.value })}
                />
              </Field>
              <Field label="Estimated effort">
                <input
                  value={editing.effort}
                  disabled={!canEdit(editing)}
                  onChange={(e) => patch({ effort: e.target.value })}
                  placeholder="30 min"
                />
              </Field>
              <Field label="Priority">
                <select
                  value={editing.priority}
                  disabled={!canEdit(editing)}
                  onChange={(e) =>
                    patch({ priority: e.target.value as Task["priority"] })
                  }
                >
                  {["Low", "Medium", "High"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={editing.status}
                  disabled={!canEdit(editing)}
                  onChange={(e) =>
                    patch({ status: e.target.value as Task["status"] })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="What does done look like?"
              hint="Be specific so a new teammate can succeed without guessing."
            >
              <textarea
                required
                rows={2}
                value={editing.done}
                disabled={!canEdit(editing)}
                onChange={(e) => patch({ done: e.target.value })}
                placeholder="Five tests recorded in the build log, with a photo and next steps."
              />
            </Field>
            <Field label="Instructions and build notes">
              <textarea
                rows={3}
                value={editing.description}
                disabled={!canEdit(editing)}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Add the context, test results, or decision behind this work."
              />
            </Field>
            <div className="form-grid"><Field label="Robot subsystem" hint="For example: drivetrain, intake, lift, or autonomous localization."><input value={editing.subsystem || ""} disabled={!canEdit(editing)} onChange={e=>patch({subsystem:e.target.value})}/></Field><Field label="Blocker" hint="Explain what is needed before work can continue. Clear this when resolved."><input value={editing.blockedReason || ""} disabled={!canEdit(editing)} onChange={e=>patch({blockedReason:e.target.value})}/></Field></div>
            <Field label="Linked learning or build resource">
              <select
                disabled={!canEdit(editing)}
                value={editing.resourceId || ""}
                onChange={(e) =>
                  patch({ resourceId: e.target.value || undefined })
                }
              >
                <option value="">No linked resource</option>
                {data.resources
                  .filter(
                    (r) =>
                      canManage || (r.visibility !== "private" && r.approved),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
            </Field>
            {editing.resourceId &&
              visibleResources.some((r) => r.id === editing.resourceId) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditing(null);
                    if (editing.resourceId)
                      openRecord("resources", editing.resourceId);
                  }}
                >
                  Open linked resource
                  <ArrowUpRight size={15} />
                </button>
              )}
            <details className="tc-dependencies">
              <summary>
                Dependencies · {editing.dependencies.length} linked
              </summary>
              <p className="muted">
                These tasks need to be done before this one can be completed.
              </p>
              {data.tasks
                .filter((t) => t.id !== editing.id)
                .map((t) => (
                  <label className="tc-dependency" key={t.id}>
                    <input
                      type="checkbox"
                      disabled={!canEdit(editing) || wouldCycle(t, editing.id)}
                      checked={editing.dependencies.includes(t.id)}
                      onChange={(e) =>
                        patch({
                          dependencies: e.target.checked
                            ? [...editing.dependencies, t.id]
                            : editing.dependencies.filter((id) => id !== t.id),
                        })
                      }
                    />
                    {t.title}
                    {t.status === "Done" && <Check size={14} />}
                  </label>
                ))}
            </details>
            {editing.demo && (
              <Badge tone="amber">Demo task · sample team work</Badge>
            )}
            <div className="form-actions">
              {canManage && data.tasks.some((t) => t.id === editing.id) && (
                <button
                  type="button"
                  className="btn btn-ghost tc-delete"
                  onClick={() => {
                    if (!deleting) {
                      setDeleting(true);
                      return;
                    }
                    removeRecord("tasks", editing.id);
                    setEditing(null);
                  }}
                >
                  {deleting ? "Confirm delete" : "Delete task"}
                </button>
              )}
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(null)}
              >
                {canEdit(editing) ? "Cancel" : "Close"}
              </button>
              {canEdit(editing) && (
                <button className="btn btn-primary" type="submit">
                  Save task
                  <Check size={16} />
                </button>
              )}
            </div>
          </form>
          {data.tasks.some((t) => t.id === editing.id) && (
            <section className="tc-comment-section">
              <h3>Team conversation</h3>
              {editing.comments.length ? (
                editing.comments.map((c, i) => (
                  <div className="tc-comment" key={`${c.date}-${i}`}>
                    <Avatar name={memberName(c.author)} small />
                    <div>
                      <strong>{memberName(c.author)}</strong>
                      <small>
                        {new Date(c.date).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </small>
                      <p>{c.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Share a result, ask for help, or leave the next person a
                  useful note.
                </p>
              )}
              <form
                className="tc-comment-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  const current =
                    data.tasks.find((t) => t.id === editing.id);
                  if (!current) { notify("This task was removed. Your comment was kept."); return; }
                  const updated = {
                    ...current,
                    comments: [
                      ...current.comments,
                      {
                        author: myOwner,
                        text: comment.trim(),
                        date: new Date().toISOString(),
                      },
                    ],
                  };
                  if (!current || !saveRecord("tasks", updated, {original:current,scope:draftScope})) return;
                  setEditing({ ...editing, comments: updated.comments });
                  setComment("");
                  notify("Comment added.");
                }}
              >
                <input
                  aria-label="Add a team comment"
                  placeholder="Leave a helpful note…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                />
                <button
                  className="btn btn-secondary"
                  type="submit"
                  disabled={!comment.trim()}
                >
                  Add note
                </button>
              </form>
            </section>
          )}
        </Modal>
      )}
    </>
  );
}
