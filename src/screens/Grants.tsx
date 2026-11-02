import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Flag,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useHQ, useRecordDraft } from "../store";
import {
  PageHeader,
  Modal,
  Badge,
  EmptyState,
  Field,
  Progress,
  Avatar,
} from "../components/ui";
import type { Grant } from "../types";
import "./funding.css";

const statuses: Grant["status"][] = [
  "New",
  "Checking Eligibility",
  "Eligible",
  "In Progress",
  "Needs Mentor Review",
  "Submitted",
  "Awarded",
  "Not Awarded",
  "Closed",
];
const today = () => new Date().toLocaleDateString("en-CA");
const dateLabel = (date: string) => {
  const parsed = new Date(`${date}T12:00:00`);
  return date && Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not confirmed";
};
const safeURL = (value: string) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const progress = (g: Grant) =>
  g.steps.length
    ? Math.round((g.steps.filter((s) => s.done).length / g.steps.length) * 100)
    : 0;
const statusTone = (s: Grant["status"]) =>
  s === "Awarded"
    ? "green"
    : s === "Submitted"
      ? "blue"
      : s === "Needs Mentor Review"
        ? "amber"
        : s === "Closed" || s === "Not Awarded"
          ? "gray"
          : "purple";

export default function GrantsPage() {
  const {myOwner, memberName, cloud,
    data,
    canManage,
    canReview,
    saveRecord,
    notify,
    focusRecord,
    clearFocusRecord,
  } = useHQ();
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("All counties");
  const [status, setStatus] = useState("All statuses");
  const [rookie, setRookie] = useState(false);
  const [editing, setEditing, saveDraft] = useRecordDraft("grants");
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (focusRecord?.page !== "grants") return;
    const record = data.grants.find(
      (g) => g.id === focusRecord.id && (canManage || g.visibility === "team"),
    );
    if (record) {
      setError("");
      setStep("");
      setEditing(record);
    }
    clearFocusRecord();
  }, [focusRecord, canManage, data.grants, clearFocusRecord]);
  const visible = data.grants.filter(
    (g) => canManage || g.visibility === "team",
  );
  const records = visible.filter(
    (g) =>
      (g.name + " " + g.eligibility + " " + g.amount)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (county === "All counties" ||
        g.county === county ||
        g.county === "Statewide") &&
      (status === "All statuses" || g.status === status) &&
      (!rookie || g.rookie),
  );
  function openNew() {
    setStep("");
    setError("");
    setEditing({
      id: crypto.randomUUID(),
      teamId: data.teamId,
      seasonId: data.seasonId,
      demo: false,
      name: "",
      source: "",
      checked: "",
      eligibility: "",
      confirmed: false,
      county: "Statewide",
      rookie: false,
      amount: "",
      deadline: "",
      internalDeadline: "",
      owner: myOwner,
      status: "New",
      requirements: "",
      documents: "",
      reminder: "One week before internal deadline",
      steps: [
        {
          id: crypto.randomUUID(),
          title: "Check eligibility with the official funder",
          done: false,
        },
        {
          id: crypto.randomUUID(),
          title: "Prepare application materials",
          done: false,
        },
        { id: crypto.randomUUID(), title: "Get mentor approval", done: false },
      ],
      visibility: "team",
    });
  }
  function patch<K extends keyof Grant>(key: K, value: Grant[K]) {
    setEditing((g) => (g ? { ...g, [key]: value } : g));
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (
      !safeURL(editing.source) ||
      (editing.documents && !safeURL(editing.documents))
    ) {
      setError(
        "Source and document links must use a complete http:// or https:// URL.",
      );
      return;
    }
    if (editing.confirmed && (!editing.source || !editing.checked)) {
      setError(
        "Add the official source and last-checked date before marking eligibility verified.",
      );
      return;
    }
    if (
      editing.internalDeadline &&
      editing.deadline &&
      editing.internalDeadline > editing.deadline
    ) {
      setError(
        "Your internal deadline should be on or before the application deadline.",
      );
      return;
    }
    if (
      data.grants.some(
        (g) =>
          g.id !== editing.id &&
          g.name.trim().toLowerCase() === editing.name.trim().toLowerCase(),
      )
    ) {
      setError(
        "This opportunity is already in your tracker. Open that record to keep the application together.",
      );
      return;
    }
    if (!saveDraft({ ...editing, name: editing.name.trim() })) return;
    setEditing(null);
    notify("Grant application saved.");
  }
  function addStep() {
    if (!editing || !step.trim()) return;
    patch("steps", [
      ...editing.steps,
      { id: crypto.randomUUID(), title: step.trim(), done: false },
    ]);
    setStep("");
  }
  return (
    <>
      <PageHeader
        eyebrow="FUNDING / GRANTS"
        title="Grant register"
        description="Eligibility checks, application steps, and submission records."
        actions={
          canManage ? (
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={17} />
              Add opportunity
            </button>
          ) : undefined
        }
      />
      <div className="funding-summary">
        <div className="card">
          <span className="funding-stat-icon">
            <CircleDollarSign size={19} />
          </span>
          <div>
            <strong>
              {
                visible.filter(
                  (g) =>
                    !["Closed", "Not Awarded", "Awarded"].includes(g.status),
                ).length
              }
            </strong>
            <span>Open opportunities</span>
          </div>
        </div>
        <div className="card">
          <span className="funding-stat-icon amber">
            <Clock3 size={19} />
          </span>
          <div>
            <strong>
              {
                visible.filter((g) =>
                  ["In Progress", "Needs Mentor Review"].includes(g.status),
                ).length
              }
            </strong>
            <span>Applications in progress</span>
          </div>
        </div>
        <div className="card">
          <span className="funding-stat-icon">
            <FileCheck2 size={19} />
          </span>
          <div>
            <strong>
              {
                visible.filter((g) =>
                  ["Submitted", "Awarded"].includes(g.status),
                ).length
              }
            </strong>
            <span>Applications submitted</span>
          </div>
        </div>
      </div>
      <div className="funding-source-note">
        <ShieldCheck size={19} />
        <div>
          <strong>Source verification</strong>
          <p>
            This is a team-managed directory, not a live grant feed. Check
            eligibility and deadlines directly with the funder before applying.
          </p>
        </div>
      </div>
      <div className="funding-toolbar funding-grant-toolbar">
        <label className="funding-search">
          <Search size={17} />
          <input
            aria-label="Search grants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search grants, eligibility, or support…"
          />
        </label>
        <div className="funding-toolbar-actions">
          <select
            aria-label="Filter grant county"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
          >
            <option>All counties</option>
            {["Statewide", "New Castle", "Kent", "Sussex"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Filter grant status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="funding-rookie-filter">
            <input
              type="checkbox"
              checked={rookie}
              onChange={(e) => setRookie(e.target.checked)}
            />
            Rookie-friendly
          </label>
        </div>
      </div>
      {!records.length ? (
        <div className="card">
          <EmptyState
            title="No matching opportunities"
            description="Try a wider filter, or add an opportunity from an official funder website."
            action={
              canManage ? (
                <button className="btn btn-secondary" onClick={openNew}>
                  Add an opportunity
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grant-grid">
          {records.map((g) => (
            <article className="card grant-card" key={g.id}>
              <div className="grant-topline">
                <div className="inline">
                  {g.demo && <Badge tone="gray">Demo workflow</Badge>}
                  <Badge tone={statusTone(g.status)}>{g.status}</Badge>
                </div>
              </div>
              <h2>
                <button
                  onClick={() => {
                    setError("");
                    setStep("");
                    setEditing(g);
                  }}
                >
                  {g.name}
                </button>
              </h2>
              <p className="grant-eligibility">
                {g.eligibility ||
                  "Eligibility has not been recorded. Check with the funder."}
              </p>
              <div className="grant-tags">
                <Badge tone="gray">{g.county}</Badge>
                {g.rookie && (
                  <Badge tone="green">Rookie-friendly · verify</Badge>
                )}
                <Badge tone={g.confirmed && !g.stale ? "green" : "amber"}>
                  {g.confirmed && !g.stale
                    ? "Source checked"
                    : "Verify with funder"}
                </Badge>
              </div>
              <div className="grant-facts">
                <div>
                  <span>SUPPORT</span>
                  <strong>{g.amount || "Confirm with funder"}</strong>
                </div>
                <div>
                  <span>APPLICATION DEADLINE</span>
                  <strong>{dateLabel(g.deadline)}</strong>
                </div>
              </div>
              <div className="grant-progress-label">
                <span>Application checklist</span>
                <span>
                  {g.steps.filter((s) => s.done).length}/{g.steps.length} steps
                </span>
              </div>
              <Progress value={progress(g)} />
              <div className="grant-footer">
                <span className="funding-owner">
                  <Avatar name={memberName(g.owner)} small />
                  {memberName(g.owner)}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setError("");
                    setStep("");
                    setEditing(g);
                  }}
                >
                  {canManage ? "Open application" : "View details"}
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="grant-source">
                {safeURL(g.source) ? (
                  <a href={safeURL(g.source)} target="_blank" rel="noreferrer">
                    Official source <ArrowUpRight size={11} />
                  </a>
                ) : (
                  <span>Source needed</span>
                )}
                <span>
                  Checked:{" "}
                  {g.checked ? dateLabel(g.checked) : "Not yet checked"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (canManage || editing.visibility === "team") && (
        <Modal
          title={
            data.grants.some((g) => g.id === editing.id)
              ? "Opportunity & application"
              : "Add an opportunity"
          }
          onClose={() => setEditing(null)}
          wide
        >
          <form className="stack funding-form" onSubmit={save}>
            {editing.demo && (
              <div className="funding-notice">
                Demo application workflow. This example does not assert that
                funding is available or that your team is eligible.
              </div>
            )}
            {!editing.confirmed && (
              <div className="funding-notice">
                <ShieldCheck size={17} />
                Verify eligibility, support, and all dates directly with the
                funder.
              </div>
            )}
            {error && (
              <div className="funding-error" role="alert">
                {error}
              </div>
            )}
            <fieldset className="funding-fieldset" disabled={!canManage}>
              <div className="form-grid">
                <Field label="Opportunity / funder name">
                  <input
                    required
                    maxLength={150}
                    value={editing.name}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
                <Field label="Official funder / source URL">
                  <input
                    required
                    type="url"
                    placeholder="https://official-funder…"
                    value={editing.source}
                    onChange={(e) => patch("source", e.target.value)}
                  />
                </Field>
                <Field label="Last checked">
                  <input
                    type="date"
                    max={today()}
                    value={editing.checked}
                    onChange={(e) => patch("checked", e.target.value)}
                  />
                </Field>
                <Field label="County / region">
                  <select
                    value={editing.county}
                    onChange={(e) => patch("county", e.target.value)}
                  >
                    {["Statewide", "New Castle", "Kent", "Sussex"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                label="Eligibility summary"
                hint="Include FTC / FIRST eligibility, team age, Delaware requirements, and any restrictions. Leave uncertain details explicitly unconfirmed."
              >
                <textarea
                  required
                  rows={3}
                  value={editing.eligibility}
                  onChange={(e) => patch("eligibility", e.target.value)}
                />
              </Field>
              <div className="inline funding-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={editing.confirmed}
                    onChange={(e) => patch("confirmed", e.target.checked)}
                  />
                  Eligibility verified with official source
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editing.rookie}
                    onChange={(e) => patch("rookie", e.target.checked)}
                  />
                  May support rookie teams
                </label>
              </div>
              <div className="form-grid">
                <Field
                  label="Award type / support"
                  hint="Record only the amount or in-kind support stated by the funder."
                >
                  <input
                    value={editing.amount}
                    placeholder="Unconfirmed · check with funder"
                    onChange={(e) => patch("amount", e.target.value)}
                  />
                </Field>
                <Field label="Application status">
                  <select
                    value={editing.status}
                    onChange={(e) =>
                      patch("status", e.target.value as Grant["status"])
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Official application deadline"
                  hint="Leave blank if not confirmed."
                >
                  <input
                    type="date"
                    value={editing.deadline}
                    onChange={(e) => patch("deadline", e.target.value)}
                  />
                </Field>
                <Field label="Team’s internal deadline">
                  <input
                    type="date"
                    value={editing.internalDeadline}
                    onChange={(e) => patch("internalDeadline", e.target.value)}
                  />
                </Field>
                <Field label="Assigned owner">
                  {cloud.shared ? <select required value={editing.owner} onChange={e=>patch("owner",e.target.value)}>{cloud.shared.members.map(m=><option value={m.userId} key={m.userId}>{m.name}</option>)}</select> : <input required value={editing.owner} onChange={e=>patch("owner",e.target.value)}/>}
                </Field>
                <Field label="Remind before grant deadline" hint="Appears in Team updates before the earlier internal or external deadline, until submitted or closed. No email is sent.">
                  <select value={editing.reminderDays??(editing.reminder==="No reminder"?-1:editing.reminder==="Three days before internal deadline"?3:7)} onChange={event=>setEditing({...editing,reminderDays:Number(event.target.value),reminder:Number(event.target.value)<0?"No reminder":`${event.target.value} days before earliest deadline`})}>
                    {[-1,1,3,7,14,30,60].map(days=><option key={days} value={days}>{days<0?"Off":`${days} days before`}</option>)}
                  </select>
                </Field>
                <Field label="Linked documents">
                  <input
                    type="url"
                    placeholder="https://team-approved-drive…"
                    value={editing.documents}
                    onChange={(e) => patch("documents", e.target.value)}
                  />
                </Field>
                <Field label="Visibility">
                  <select
                    value={editing.visibility}
                    onChange={(e) =>
                      patch("visibility", e.target.value as Grant["visibility"])
                    }
                  >
                    <option value="team">Team members</option>
                    <option value="private">Private · leads & mentors</option>
                  </select>
                </Field>
              </div>
              <Field label="Requirements / application notes">
                <textarea
                  rows={3}
                  value={editing.requirements}
                  onChange={(e) => patch("requirements", e.target.value)}
                />
              </Field>
            </fieldset>
            <section className="funding-application-steps">
              <div className="funding-section-header">
                <h3>Application checklist</h3>
                <span className="muted">{progress(editing)}% complete</span>
              </div>
              <Progress value={progress(editing)} />
              {editing.steps.map((s) => (
                <label className="grant-step" key={s.id}>
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={s.done}
                    onChange={(e) =>
                      patch(
                        "steps",
                        editing.steps.map((item) =>
                          item.id === s.id
                            ? { ...item, done: e.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                  <span className={s.done ? "completed" : ""}>{s.title}</span>
                  {s.done && <Check size={15} />}
                </label>
              ))}
              {canManage && (
                <div className="funding-add-step">
                  <input
                    aria-label="New application step"
                    value={step}
                    onChange={(e) => setStep(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addStep();
                      }
                    }}
                    placeholder="Add an application step…"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addStep}
                    disabled={!step.trim()}
                  >
                    <Plus size={15} />
                    Add step
                  </button>
                </div>
              )}
            </section>
            {canManage && (
              <div className="funding-draft-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => patch("status", "Needs Mentor Review")}
                >
                  <ShieldCheck size={15} />
                  Request mentor review
                </button>
                {canReview && editing.status === "Needs Mentor Review" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => patch("status", "In Progress")}
                  >
                    Review complete · ready to apply
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={editing.status === "Submitted"}
                  onClick={() => patch("status", "Submitted")}
                >
                  <FileCheck2 size={15} />
                  Mark submitted
                </button>
              </div>
            )}
            <p className="funding-disclosure">
              <LockKeyhole size={13} />
              MyFTCSpace never submits an application. “Submitted” records an
              action your team completed with the funder.
            </p>
            <div className="funding-verification">
              <span>
                {safeURL(editing.source) && (
                  <a
                    href={safeURL(editing.source)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official source <ArrowUpRight size={12} />
                  </a>
                )}
              </span>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => patch("stale", true)}
                >
                  <Flag size={13} />
                  {editing.stale
                    ? "Flagged for verification"
                    : "Flag stale information"}
                </button>
              )}
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(null)}
              >
                {canManage ? "Cancel" : "Close"}
              </button>
              {canManage && (
                <button className="btn btn-primary" type="submit">
                  Save application
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
