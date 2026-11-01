import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Save,
} from "lucide-react";
import { useHQ } from "../store";
import { Field, Modal } from "./ui";
import { dueLabel } from "../utils";
import "./FocusSession.css";

export interface FocusSessionProps {
  taskId: string;
  onClose: () => void;
}

function clock(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function FocusSession({ taskId, onClose }: FocusSessionProps) {
  const { data, canManage, saveRecord, notify, openRecord, storageError, myOwner, memberName, cloud } =
    useHQ();
  const task = data.tasks.find((item) => item.id === taskId);
  const canEdit = !!task && (canManage || task.owner === myOwner);
  const [minutes, setMinutes] = useState(20);
  const [remainingMs, setRemainingMs] = useState(20 * 60_000);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [completedHere, setCompletedHere] = useState(false);
  const deadline = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const next = Math.max(0, deadline.current - Date.now());
      setRemainingMs(next);
      if (next === 0) setRunning(false);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!canEdit || task?.status === "Done") setRunning(false);
  }, [canEdit, task?.status]);

  const blockers =
    task?.dependencies.filter(
      (id) => data.tasks.find((item) => item.id === id)?.status !== "Done",
    ) || [];
  const resource = task?.resourceId
    ? data.resources.find(
        (item) =>
          item.id === task.resourceId &&
          (canManage || (item.visibility !== "private" && item.approved)),
      )
    : undefined;

  function requestClose() {
    if (note.trim()) {
      setDiscardPrompt(true);
      return;
    }
    onClose();
  }

  function startTimer() {
    if (!task || !canEdit || task.status === "Done") return;
    const remaining = remainingMs > 0 ? remainingMs : minutes * 60_000;
    setRemainingMs(remaining);
    deadline.current = Date.now() + remaining;
    setRunning(true);
    if (task.status === "To do")
      saveRecord("tasks", { ...task, status: "In progress" });
  }

  function pauseTimer() {
    setRemainingMs(Math.max(0, deadline.current - Date.now()));
    setRunning(false);
  }

  function resetTimer() {
    setRunning(false);
    setRemainingMs(minutes * 60_000);
  }

  function saveNote() {
    const current = dataRef.current.tasks.find((item) => item.id === taskId);
    if (!current || !canEdit || !note.trim()) return;
    saveRecord("tasks", {
      ...current,
      comments: [
        ...current.comments,
        {
          text: note.trim(),
          author: myOwner,
          date: new Date().toISOString(),
        },
      ],
    });
    setNote("");
    setDiscardPrompt(false);
    notify("Build note added to the task conversation.");
  }

  function finishTask() {
    const current = dataRef.current.tasks.find((item) => item.id === taskId);
    if (!current || !canEdit || current.status === "Done") return;
    const pending = current.dependencies.filter(
      (id) =>
        dataRef.current.tasks.find((item) => item.id === id)?.status !== "Done",
    );
    if (pending.length || current.blockedReason) {
      notify("Complete the linked dependencies before finishing this task.");
      return;
    }
    const comments = note.trim()
      ? [
          ...current.comments,
          {
            text: note.trim(),
            author: myOwner,
            date: new Date().toISOString(),
          },
        ]
      : current.comments;
    saveRecord("tasks", { ...current, comments, status: "Done" });
    setNote("");
    setRunning(false);
    setCompletedHere(true);
    setDiscardPrompt(false);
    notify(
      note.trim() ? "Task completed and build note saved." : "Task completed.",
      () => {
        // Undo completion without erasing notes added while the receipt was open.
        const latest = dataRef.current.tasks.find((item) => item.id === taskId);
        if (latest) saveRecord("tasks", { ...latest, status: current.status });
        setCompletedHere(false);
      },
    );
  }

  return (
    <Modal title="Build session" onClose={requestClose} wide>
      {!task ? (
        <div className="focus-missing">
          <h3>Task unavailable</h3>
          <p>
            This task was removed from the workspace. Choose another assignment
            to start a session.
          </p>
          <button className="btn btn-secondary" onClick={onClose}>
            Close session
          </button>
        </div>
      ) : (
        <div className="focus-session">
          <div className="focus-session-index">
            <span>WORK ORDER / {task.area.toUpperCase()}</span>
            <span>{task.demo ? "DEMO TASK" : "TEAM TASK"}</span>
          </div>
          <header className="focus-session-heading">
            <h3>{task.title}</h3>
            <p>
              <span>
                {task.owner === myOwner ? "Assigned to you" : memberName(task.owner)}
              </span>
              <span>{dueLabel(task.due)}</span>
              <span>{task.status}</span>
            </p>
          </header>
          <section
            className="focus-finish-line"
            aria-label="Definition of done"
          >
            <span className="focus-label">FINISH LINE</span>
            <p>
              {task.done ||
                "Add a definition of done in task details before starting."}
            </p>
          </section>
          {!canEdit && (
            <p className="focus-readonly">
              This task belongs to another teammate. You can view the plan; its
              owner or a student lead can log work and change its status.
            </p>
          )}
          {completedHere && task.status === "Done" ? (
            <div className="focus-receipt" role="status">
              <CheckCircle2 size={25} />
              <div>
                <h4>Work recorded.</h4>
                <p>
                  The task is complete. Your notes remain with the assignment
                  for the next teammate.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={requestClose}>
                Close session
              </button>
            </div>
          ) : (
            <section
              className="focus-timer-section"
              aria-label="Optional focus timer"
            >
              <div className="focus-timer-top">
                <span className="focus-label">OPTIONAL FOCUS BLOCK</span>
                <label>
                  <span>Length</span>
                  <select
                    aria-label="Focus duration"
                    value={minutes}
                    disabled={running || !canEdit || task.status === "Done"}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setMinutes(value);
                      setRemainingMs(value * 60_000);
                    }}
                  >
                    <option value={10}>10 min</option>
                    <option value={20}>20 min</option>
                    <option value={45}>45 min</option>
                  </select>
                </label>
              </div>
              <div className="focus-timer-face">
                <output aria-label="Time remaining" aria-live="off" data-running={running}>
                  {clock(remainingMs)}
                </output>
                <span>
                  {running
                    ? "FOCUS BLOCK RUNNING"
                    : remainingMs === 0
                      ? "BLOCK ENDED — RECORD YOUR RESULT"
                      : "START WHEN YOU’RE READY"}
                </span>
              </div>
              <div className="focus-timer-controls">
                {running ? (
                  <button className="btn btn-secondary" onClick={pauseTimer}>
                    <Pause size={15} />
                    Pause timer
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={startTimer}
                    disabled={!canEdit || task.status === "Done"}
                  >
                    <Play size={15} />
                    {remainingMs === 0
                      ? "Start another block"
                      : remainingMs < minutes * 60_000
                        ? "Resume timer"
                        : "Start focus timer"}
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={resetTimer}
                  disabled={!canEdit}
                >
                  <RotateCcw size={14} />
                  Reset timer
                </button>
              </div>
              <p className="focus-timer-disclaimer">
                This timer runs only in this session. Ending a block never marks
                the task complete.
              </p>
            </section>
          )}
          {resource && (
            <div className="focus-reference">
              <span>LINKED REFERENCE</span>
              <button
                onClick={() => {
                  if (note.trim()) {
                    notify(
                      "Save or clear your build note before opening the reference.",
                    );
                    return;
                  }
                  openRecord("resources", resource.id);
                  onClose();
                }}
              >
                {resource.title}
                <ArrowUpRight size={15} />
              </button>
            </div>
          )}
          {task.description && (
            <details className="focus-instructions">
              <summary>Instructions & context</summary>
              <p>{task.description}</p>
            </details>
          )}
          {task.blockedReason && <p className="focus-blockers">Blocked: {task.blockedReason}</p>}
          {blockers.length > 0 && (
            <div className="focus-blockers">
              <span className="focus-label">
                WAITING ON {blockers.length}{" "}
                {blockers.length === 1 ? "TASK" : "TASKS"}
              </span>
              <ul>
                {blockers.map((id) => (
                  <li key={id}>
                    {data.tasks.find((item) => item.id === id)?.title ||
                      "A linked task that is no longer available"}
                  </li>
                ))}
              </ul>
              <p>
                Record test results now; finish the assignment after its
                dependencies are complete.
              </p>
            </div>
          )}
          <form
            className="focus-build-note"
            onSubmit={(event) => {
              event.preventDefault();
              saveNote();
            }}
          >
            <Field
              label="Build note"
              hint="What changed? What was the result? What should the next person know?"
            >
              <textarea
                rows={4}
                maxLength={4000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={!canEdit}
                placeholder="Changed… / Tested… / Next…"
              />
            </Field>
            <div className="focus-note-action">
              <span>
                {note.trim() ? "UNSAVED NOTE" : "SAVES TO TASK CONVERSATION"}
              </span>
              <button
                className="btn btn-secondary"
                type="submit"
                disabled={!canEdit || !note.trim()}
              >
                <Save size={14} />
                Save build note
              </button>
            </div>
          </form>
          {discardPrompt && (
            <div className="focus-discard" role="alert">
              <p>Your build note has not been saved.</p>
              <div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setDiscardPrompt(false)}
                >
                  Keep editing
                </button>
                <button className="btn btn-ghost" onClick={onClose}>
                  Discard note & close
                </button>
              </div>
            </div>
          )}
          <footer className="focus-session-footer">
            <span>
              {storageError
                ? "SAVE NEEDS ATTENTION — SEE WORKSPACE NOTICE"
                : cloud.shared ? `Team session · ${cloud.status}` : "Demo session · saved in this browser"}
            </span>
            <button
              className="btn btn-primary"
              onClick={finishTask}
              disabled={!canEdit || task.status === "Done"}
            >
              <Check size={15} />
              {task.status === "Done"
                ? "Task complete"
                : note.trim()
                  ? "Save note & finish task"
                  : "Finish task"}
            </button>
          </footer>
        </div>
      )}
    </Modal>
  );
}

export default FocusSession;
