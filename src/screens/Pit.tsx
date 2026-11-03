import { useEffect, useState } from "react";
import {
  ArrowRight,
  BatteryCharging,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  MapPin,
  Plus,
  Radio,
  ShieldCheck,
  StickyNote,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import { useHQ } from "../store";
import {
  Badge,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Progress,
} from "../components/ui";
import "./Library.css";

const groups = [
  {
    title: "Robot & inspection",
    Icon: Wrench,
    items: [
      {
        id: "robot-hardware",
        title: "Check fasteners, guards, and moving parts",
      },
      {
        id: "robot-code",
        title: "Confirm the correct robot configuration and code",
      },
      { id: "robot-auto", title: "Run and record one autonomous test" },
      {
        id: "robot-inspection",
        title: "Review the current official inspection checklist",
      },
    ],
  },
  {
    title: "Batteries & essentials",
    Icon: BatteryCharging,
    items: [
      { id: "battery-charged", title: "Charge and label match batteries" },
      {
        id: "battery-safe",
        title: "Inspect batteries, cables, and connectors",
      },
      {
        id: "battery-chargers",
        title: "Pack chargers, controllers, and spare cables",
      },
      {
        id: "battery-tools",
        title: "Pack tools, spares, safety glasses, and team materials",
      },
    ],
  },
  {
    title: "Pit & team",
    Icon: ClipboardCheck,
    items: [
      {
        id: "pit-assignments",
        title: "Confirm drive, pit, and scouting assignments",
      },
      {
        id: "pit-schedule",
        title: "Read the event schedule and team meeting point",
      },
      {
        id: "pit-coach",
        title: "Review the coach’s contact and emergency instructions",
      },
      { id: "pit-recap", title: "Capture the day’s lessons before packing up" },
    ],
  },
];
const allItems = groups.flatMap((g) => g.items);
export const PIT_ITEM_IDS = allItems.map((item) => item.id);
function eventDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}
export default function PitPage() {
  const { data, setData, setPage, openRecord, notify, canReview, cloud, draftScope, saveWorkspace } = useHQ();
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("Robot issue");
  const [match, setMatch] = useState("");
  const [editCoach, setEditCoach] = useState(false);
  const [instructions, setInstructions] = useState(data.coachInstructions);
  const [instructionOrigin,setInstructionOrigin] = useState({original:data.coachInstructions,scope:draftScope});
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const completed = allItems.filter((i) =>
    data.pitChecklist.includes(i.id),
  ).length;
  const today = new Date().toLocaleDateString("en-CA");
  const competition = data.events
    .filter((e) => e.type === "Competition" && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  function toggle(id: string) {
    setData((s) => ({
      ...s,
      pitChecklist: s.pitChecklist.includes(id)
        ? s.pitChecklist.filter((x) => x !== id)
        : [...s.pitChecklist, id],
    }));
    setOnline(navigator.onLine);
  }
  function addNote() {
    if (!note.trim()) return;
    setData((s) => ({
      ...s,
      pitNotes: [
        {
          id: crypto.randomUUID(),
          text: `${noteType}${match.trim() ? ` · Match ${match.trim()}` : ""}: ${note.trim()}`,
          date: new Date().toISOString(),
        },
        ...s.pitNotes,
      ],
    }));
    setNote("");
    setMatch("");
    notify(cloud.shared ? "Pit note added to the shared workspace." : "Pit note saved on this device.");
  }
  function exportRecap() {
    const text = `${data.teamName} · Competition recap\n\nChecklist: ${completed}/${allItems.length}\n${allItems.map((i) => `${data.pitChecklist.includes(i.id) ? "[x]" : "[ ]"} ${i.title}`).join("\n")}\n\nNOTES\n${data.pitNotes.map((n) => `${new Date(n.date).toLocaleString()}\n${n.text}`).join("\n\n")}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "team-competition-recap.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    notify("Competition recap exported.");
  }
  return (
    <>
      <PageHeader
        eyebrow="EVENT / CHECKLIST"
        title="Competition checklist"
        description="Robot readiness, equipment, assignments, and event notes."
        actions={
          <button className="btn btn-secondary" onClick={exportRecap}>
            <Download size={16} /> Export recap
          </button>
        }
      />
      <div className="pit-save-status" role="status">
        {online ? <Wifi size={15} /> : <WifiOff size={15} />}
        <span>
          {cloud.shared ? `Shared checklist and notes · ${cloud.status}. ` : "Demo checklist and notes save on this device. "}
          {!online && "Offline: keep this tab open. Shared changes wait for a successful retry."}
        </span>
        <Badge tone="green">Team only</Badge>
      </div>
      {competition ? (
        <section className="pit-event">
          <div className="pit-event-icon">
            <Radio size={26} />
          </div>
          <div>
            <div className="inline">
              <span className="eyebrow">NEXT COMPETITION</span>
              {competition.demo && <Badge tone="amber">Demo event</Badge>}
            </div>
            <h2>{competition.title}</h2>
            <div className="pit-event-meta">
              <span>
                <CalendarDays size={15} />
                {eventDate(competition.date)}
                {competition.time ? ` · ${competition.time}` : ""}
              </span>
              <span>
                <MapPin size={15} />
                {competition.location ||
                  "Location to be confirmed by the event owner"}
              </span>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setPage("calendar")}
          >
            Event details <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <div className="card">
          <EmptyState
            title="No upcoming competition"
            description="Ask a student lead to add the event and team assignments. You can prepare the checklist now."
            action={
              <button
                className="btn btn-secondary"
                onClick={() => setPage("calendar")}
              >
                Open team calendar <ArrowRight size={16} />
              </button>
            }
          />
        </div>
      )}
      <div className="pit-layout">
        <section className="card pit-checklist">
          <div className="card-header">
            <div>
              <h2>Readiness checklist</h2>
              <p className="muted">Complete before leaving for the event.</p>
            </div>
            <Badge tone={completed === allItems.length ? "green" : "gray"}>
              {completed} / {allItems.length} ready
            </Badge>
          </div>
          <Progress value={(completed / allItems.length) * 100} />
          {groups.map(({ title, Icon, items }) => (
            <div className="pit-check-group" key={title}>
              <h3>
                <Icon size={18} />
                {title}
              </h3>
              {items.map((item) => (
                <label
                  className={`pit-check-item ${data.pitChecklist.includes(item.id) ? "is-checked" : ""}`}
                  key={item.id}
                >
                  <input
                    type="checkbox"
                    checked={data.pitChecklist.includes(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span>{item.title}</span>
                  {data.pitChecklist.includes(item.id) && (
                    <CheckCircle2 size={17} />
                  )}
                </label>
              ))}
            </div>
          ))}
          <p className="pit-disclaimer">
            This is your team’s preparation list. Use the current official FIRST
            inspection and game documents for requirements.
          </p>
        </section>
        <aside className="stack">
          <section className="card pit-quick-note">
            <div className="inline">
              <span className="resource-icon">
                <StickyNote size={21} />
              </span>
              <h2>Record an observation</h2>
            </div>
            <p className="muted">
              Log a robot issue, match result, or scouting note.
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                addNote();
              }}
            >
              <div className="form-grid">
                <Field label="Note type">
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                  >
                    <option>Robot issue</option>
                    <option>Match observation</option>
                    <option>Scouting</option>
                    <option>End-of-day lesson</option>
                  </select>
                </Field>
                <Field label="Match (optional)">
                  <input
                    maxLength={20}
                    value={match}
                    onChange={(e) => setMatch(e.target.value)}
                    placeholder="e.g. Q12"
                  />
                </Field>
              </div>
              <Field label="What happened?">
                <textarea
                  required
                  rows={4}
                  value={note}
                  maxLength={3000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What you noticed, what changed, and what we should try next."
                />
              </Field>
              <button type="submit" className="btn btn-primary">
                <Plus size={16} /> Save team note
              </button>
            </form>
          </section>
          <section className="card pit-coach">
            <ShieldCheck size={23} />
            <h3>Coach’s instructions</h3>
            <div className="resource-content">
              {data.coachInstructions ||
                "Ask your coach to set the team meeting point, emergency contact procedure, and supervision instructions. Do not post personal phone numbers here."}
            </div>
            {canReview && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setInstructions(data.coachInstructions);
                setInstructionOrigin({original:data.coachInstructions,scope:draftScope});
                  setEditCoach(true);
                }}
              >
                Edit team instructions <ArrowRight size={14} />
              </button>
            )}
          </section>
          <button
            className="btn btn-secondary"
            onClick={() => openRecord("resources", "robot-reference")}
          >
            <Wrench size={16} /> Open robot quick reference{" "}
            <ArrowRight size={15} />
          </button>
        </aside>
      </div>
      <section className="card pit-notes">
        <div className="card-header">
          <div>
            <h2>Team notes & observations</h2>
            <p className="muted">
              Notes follow your workspace's storage. Export a recap to share it with the team.
            </p>
          </div>
          <Badge>{data.pitNotes.length} notes</Badge>
        </div>
        {data.pitNotes.length ? (
          data.pitNotes.map((n) => (
            <article className="pit-note" key={n.id}>
              <span className="pit-note-dot" />
              <div>
                <p>{n.text}</p>
                <time dateTime={n.date}>
                  {new Date(n.date).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </article>
          ))
        ) : (
          <div className="pit-no-notes">
            <StickyNote size={25} />
            <p>No observations recorded.</p>
          </div>
        )}
      </section>
      {editCoach && (
        <Modal
          title="Coach’s team instructions"
          onClose={() => setEditCoach(false)}
        >
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saveWorkspace({coachInstructions:instructions.trim()}, {coachInstructions:instructionOrigin.original}, instructionOrigin.scope)) return;
              setEditCoach(false);
              notify("Coach instructions saved.");
            }}
          >
            <Field
              label="Meeting point and emergency procedure"
              hint="Use team-managed contact channels. Avoid student phone numbers, home addresses, or personal contact details."
            >
              <textarea
                rows={8}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="If you need help, find the supervising coach at the team pit…"
              />
            </Field>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setEditCoach(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                Save instructions
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
