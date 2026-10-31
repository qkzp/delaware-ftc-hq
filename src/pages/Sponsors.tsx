import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  Copy,
  Flag,
  LayoutGrid,
  List,
  LockKeyhole,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useHQ } from "../store";
import {
  PageHeader,
  Modal,
  Badge,
  EmptyState,
  Field,
  Avatar,
} from "../components/ui";
import type { Sponsor } from "../types";
import "./funding.css";

const statuses: Sponsor["status"][] = [
  "Researching",
  "Ready for Review",
  "Contacted",
  "Follow-up Due",
  "Interested",
  "Meeting Scheduled",
  "Committed",
  "Declined",
  "Do Not Contact",
];
const counties = ["Statewide", "New Castle", "Kent", "Sussex"];
const today = () => new Date().toLocaleDateString("en-CA");
const dateLabel = (date: string) => {
  const parsed = new Date(`${date}T12:00:00`);
  return date && Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Not set";
};
const safeURL = (value: string) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const normalizedDomain = (value: string) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const overdue = (s: Sponsor) =>
  !!s.followUp &&
  s.followUp <= today() &&
  !["Committed", "Declined", "Do Not Contact"].includes(s.status);
const tone = (s: Sponsor["status"]) =>
  s === "Committed"
    ? "green"
    : s === "Follow-up Due"
      ? "amber"
      : s === "Do Not Contact" || s === "Declined"
        ? "gray"
        : s === "Interested" || s === "Meeting Scheduled"
          ? "purple"
          : "blue";

export default function SponsorsPage() {
  const {
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
  const [view, setView] = useState<"list" | "board">("list");
  const [followOnly, setFollowOnly] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (focusRecord?.page !== "sponsors") return;
    const record = canManage
      ? data.sponsors.find((s) => s.id === focusRecord.id)
      : undefined;
    if (record) {
      setError("");
      setEditing(record);
    }
    clearFocusRecord();
  }, [focusRecord, canManage, data.sponsors, clearFocusRecord]);
  const records = data.sponsors.filter(
    (s) =>
      (s.name + " " + s.type + " " + s.owner)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (county === "All counties" || s.county === county) &&
      (status === "All statuses" || s.status === status) &&
      (!followOnly || overdue(s)),
  );
  function openNew() {
    setError("");
    setEditing({
      id: crypto.randomUUID(),
      teamId: data.teamId,
      seasonId: data.seasonId,
      demo: false,
      name: "",
      county: data.county || "Statewide",
      website: "",
      contact: "",
      type: "Sponsor prospect",
      source: "",
      verified: "",
      owner: "Alex (you)",
      reviewer: "Coach Morgan",
      status: "Researching",
      contacted: false,
      followUp: "",
      notes: "",
      requested: "",
      confirmed: "",
      restrictions: "",
      thanked: false,
      draft: "",
      draftStatus: "Draft",
      visibility: "private",
      history: [],
    });
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (
      (editing.website && !safeURL(editing.website)) ||
      (editing.source && !safeURL(editing.source))
    ) {
      setError(
        "Website and source links must use a complete http:// or https:// URL.",
      );
      return;
    }
    const duplicate = data.sponsors.find(
      (s) =>
        s.id !== editing.id &&
        (s.name.trim().toLowerCase() === editing.name.trim().toLowerCase() ||
          (!!normalizedDomain(editing.website) &&
            normalizedDomain(s.website) === normalizedDomain(editing.website))),
    );
    if (duplicate) {
      setError(
        `“${duplicate.name}” is already in your pipeline. Open the existing record to keep your contact history together.`,
      );
      return;
    }
    const previous = data.sponsors.find((s) => s.id === editing.id);
    const history = [...editing.history];
    if (!previous)
      history.push({
        date: today(),
        text: "Prospect added to the team pipeline.",
      });
    else if (previous.status !== editing.status)
      history.push({
        date: today(),
        text: `Status changed from ${previous.status} to ${editing.status}.`,
      });
    saveRecord("sponsors", { ...editing, name: editing.name.trim(), history });
    setEditing(null);
    notify(previous ? "Sponsor record updated." : "Sponsor prospect added.");
  }
  function patch<K extends keyof Sponsor>(key: K, value: Sponsor[K]) {
    setEditing((s) => (s ? { ...s, [key]: value } : s));
  }
  function toggleContact(s: Sponsor) {
    if (s.status === "Do Not Contact") {
      notify(
        "This organization is marked Do Not Contact. Ask your mentor before making any changes.",
      );
      return;
    }
    const contacted = !s.contacted;
    saveRecord("sponsors", {
      ...s,
      contacted,
      status: contacted ? "Contacted" : "Researching",
      history: [
        ...s.history,
        {
          date: today(),
          text: contacted
            ? "Marked contacted by the team."
            : "Contacted flag cleared.",
        },
      ],
    });
    notify(
      contacted
        ? "Marked contacted. Set a follow-up to keep the conversation moving."
        : "Contacted flag cleared.",
    );
  }
  async function copyDraft() {
    if (!editing) return;
    try {
      await navigator.clipboard.writeText(editing.draft);
      notify("Draft copied. Mentor review is required before external use.");
    } catch {
      notify("Select the draft text to copy it manually.");
    }
  }
  const draftTemplate = `Hello [organization team],\n\nWe are ${data.teamName}, a student robotics team in Delaware. We are learning engineering, programming, and teamwork through FIRST Tech Challenge.\n\nWe would love to explore support for [specific project or need]. Could we arrange a brief conversation through our coach?\n\nThank you for considering our team.\n[Team name · coach-approved team contact]`;

  if (!canManage)
    return (
      <>
        <PageHeader
          eyebrow="FUNDING / SPONSORS"
          title="Sponsor outreach"
          description="Organization records, contact history, and follow-up dates."
        />
        <div className="card funding-access">
          <LockKeyhole size={32} />
          <h2>Restricted records</h2>
          <p>
            Contact details, outreach notes, and message drafts are private to
            student leads and mentors. Ask your team lead for a fundraising
            task, or explore the approved resource library.
          </p>
          <Badge tone="green">Private by default</Badge>
        </div>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="FUNDING / SPONSORS"
        title="Sponsor outreach"
        description="Organization records, contact history, and follow-up dates."
        actions={
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={17} />
            Add sponsor
          </button>
        }
      />
      <div className="funding-summary">
        <div className="card">
          <span className="funding-stat-icon">
            <Building2 size={19} />
          </span>
          <div>
            <strong>{data.sponsors.length}</strong>
            <span>Organization records</span>
          </div>
        </div>
        <button
          className={`card funding-stat-button ${followOnly ? "is-selected" : ""}`}
          onClick={() => setFollowOnly((v) => !v)}
          aria-pressed={followOnly}
        >
          <span className="funding-stat-icon amber">
            <Mail size={19} />
          </span>
          <div>
            <strong>{data.sponsors.filter(overdue).length}</strong>
            <span>Follow-ups due</span>
          </div>
          <ArrowUpRight size={16} />
        </button>
        <div className="card">
          <span className="funding-stat-icon">
            <Users size={19} />
          </span>
          <div>
            <strong>
              {data.sponsors.filter((s) => s.status === "Committed").length}
            </strong>
            <span>Confirmed supporters</span>
          </div>
        </div>
      </div>
      <div className="funding-private-note">
        <LockKeyhole size={14} />
        <span>
          Private team pipeline. Prospects are not confirmed sponsors. Messages
          stay drafts until a mentor reviews them.
        </span>
      </div>
      <section className="card funding-records">
        <div className="funding-toolbar">
          <label className="funding-search">
            <Search size={17} />
            <input
              aria-label="Search sponsors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations or owners…"
            />
          </label>
          <div className="funding-toolbar-actions">
            <select
              aria-label="Filter sponsor county"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            >
              <option>All counties</option>
              {counties.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Filter sponsor status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>All statuses</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="funding-view-toggle">
              <button
                aria-label="Table view"
                aria-pressed={view === "list"}
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
              >
                <List size={17} />
              </button>
              <button
                aria-label="Board view"
                aria-pressed={view === "board"}
                className={view === "board" ? "active" : ""}
                onClick={() => setView("board")}
              >
                <LayoutGrid size={17} />
              </button>
            </div>
          </div>
        </div>
        {followOnly && (
          <div className="funding-filter-notice">
            Showing follow-ups due today or earlier{" "}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFollowOnly(false)}
            >
              Clear filter
            </button>
          </div>
        )}
        {!records.length ? (
          <EmptyState
            title="No matching organizations"
            description={
              data.sponsors.length
                ? "Try another search or clear your filters."
                : "Add an organization, record its public source, and decide who will make the first introduction."
            }
            action={
              <button className="btn btn-secondary" onClick={openNew}>
                Add a prospect
              </button>
            }
          />
        ) : view === "list" ? (
          <div className="funding-table-wrap">
            <table className="funding-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Contacted</th>
                  <th>Next follow-up</th>
                  <th>Owner</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <button
                        className="funding-record-name"
                        onClick={() => {
                          setError("");
                          setEditing(s);
                        }}
                      >
                        {s.name}
                      </button>
                      <div className="funding-record-sub">
                        {s.county} · {s.type}
                        {s.demo && <span className="funding-demo">Demo</span>}
                      </div>
                    </td>
                    <td>
                      <Badge tone={tone(s.status)}>{s.status}</Badge>
                    </td>
                    <td>
                      <button
                        className={`contact-pill ${s.contacted ? "contacted" : ""}`}
                        aria-label={`Mark ${s.name} ${s.contacted ? "not contacted" : "contacted"}`}
                        onClick={() => toggleContact(s)}
                        disabled={s.status === "Do Not Contact"}
                      >
                        {s.contacted ? (
                          <Check size={13} />
                        ) : (
                          <span className="contact-dot" />
                        )}
                        {s.contacted ? "Yes" : "No"}
                      </button>
                    </td>
                    <td>
                      <span className={overdue(s) ? "funding-due" : ""}>
                        {dateLabel(s.followUp)}
                        {overdue(s) && " · Due"}
                      </span>
                    </td>
                    <td>
                      <span className="funding-owner">
                        <Avatar name={s.owner} small />
                        <span>{s.owner.replace(" (you)", "")}</span>
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={`Open ${s.name}`}
                        onClick={() => {
                          setError("");
                          setEditing(s);
                        }}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="funding-board">
            {[
              ["Research", "Researching", "Ready for Review"],
              [
                "In conversation",
                "Contacted",
                "Follow-up Due",
                "Interested",
                "Meeting Scheduled",
              ],
              ["Outcomes", "Committed", "Declined", "Do Not Contact"],
            ].map(([name, ...states]) => (
              <div className="funding-board-column" key={name}>
                <div className="funding-column-title">
                  {name}
                  <span>
                    {records.filter((s) => states.includes(s.status)).length}
                  </span>
                </div>
                {records
                  .filter((s) => states.includes(s.status))
                  .map((s) => (
                    <button
                      className="funding-board-card"
                      onClick={() => {
                        setError("");
                        setEditing(s);
                      }}
                      key={s.id}
                    >
                      <div className="inline">
                        <Badge tone={tone(s.status)}>{s.status}</Badge>
                        {s.demo && <span className="funding-demo">Demo</span>}
                      </div>
                      <h3>{s.name}</h3>
                      <p>
                        {s.county} · {s.type}
                      </p>
                      <div className="funding-card-bottom">
                        <span>
                          Contacted:{" "}
                          <strong>{s.contacted ? "Yes" : "No"}</strong>
                        </span>
                        <span className={overdue(s) ? "funding-due" : ""}>
                          {dateLabel(s.followUp)}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
        <div className="funding-table-foot">
          <span>
            {records.length} organization{records.length !== 1 ? "s" : ""}
          </span>
          <span>
            <ShieldCheck size={13} /> Visible to team leads & mentors
          </span>
        </div>
      </section>
      {editing && (
        <Modal
          title={
            data.sponsors.some((s) => s.id === editing.id)
              ? "Sponsor relationship"
              : "Add a sponsor prospect"
          }
          onClose={() => setEditing(null)}
          wide
        >
          <form onSubmit={save} className="stack funding-form">
            {editing.demo && (
              <div className="funding-notice">
                Demo organization — a fictional example, not a real business or
                sponsor commitment.
              </div>
            )}
            {error && (
              <div className="funding-error" role="alert">
                {error}
              </div>
            )}
            <div className="form-grid">
              <Field label="Organization name">
                <input
                  required
                  maxLength={120}
                  value={editing.name}
                  onChange={(e) => patch("name", e.target.value)}
                />
              </Field>
              <Field label="County / region">
                <select
                  value={editing.county}
                  onChange={(e) => patch("county", e.target.value)}
                >
                  {counties.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Website">
                <input
                  type="url"
                  placeholder="https://…"
                  value={editing.website}
                  onChange={(e) => patch("website", e.target.value)}
                />
              </Field>
              <Field label="Opportunity type">
                <select
                  value={editing.type}
                  onChange={(e) => patch("type", e.target.value)}
                >
                  {[
                    "Sponsor prospect",
                    "College / university",
                    "Community organization",
                    "Makerspace",
                    "Supplier",
                    "Mentor",
                    "In-kind support",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Public contact channel"
                hint="Use an organization’s public contact page or team email, never a student’s personal information."
              >
                <input
                  value={editing.contact}
                  placeholder="Public contact URL or organization email"
                  onChange={(e) => patch("contact", e.target.value)}
                />
              </Field>
              <Field label="Source URL">
                <input
                  type="url"
                  placeholder="https://…"
                  value={editing.source}
                  onChange={(e) => patch("source", e.target.value)}
                />
              </Field>
              <Field label="Last verified">
                <input
                  type="date"
                  value={editing.verified}
                  max={today()}
                  onChange={(e) => patch("verified", e.target.value)}
                />
              </Field>
              <Field label="Visibility">
                <select
                  value={editing.visibility}
                  onChange={(e) =>
                    patch("visibility", e.target.value as Sponsor["visibility"])
                  }
                >
                  <option value="private">Private · leads & mentors</option>
                  <option value="team">
                    Team · still restricted to leads & mentors
                  </option>
                </select>
              </Field>
              <Field label="Student owner">
                <input
                  required
                  value={editing.owner}
                  onChange={(e) => patch("owner", e.target.value)}
                />
              </Field>
              <Field label="Mentor reviewer">
                <input
                  required
                  value={editing.reviewer}
                  onChange={(e) => patch("reviewer", e.target.value)}
                />
              </Field>
              <Field label="Relationship status">
                <select
                  value={editing.status}
                  onChange={(e) => {
                    const status = e.target.value as Sponsor["status"];
                    setEditing((s) =>
                      s
                        ? {
                            ...s,
                            status,
                            contacted: [
                              "Contacted",
                              "Follow-up Due",
                              "Interested",
                              "Meeting Scheduled",
                              "Committed",
                            ].includes(status)
                              ? true
                              : s.contacted,
                          }
                        : s,
                    );
                  }}
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Next follow-up">
                <input
                  type="date"
                  value={editing.followUp}
                  onChange={(e) => patch("followUp", e.target.value)}
                />
              </Field>
            </div>
            <div className="inline funding-checks">
              <label>
                <input
                  type="checkbox"
                  checked={editing.contacted}
                  onChange={(e) => patch("contacted", e.target.checked)}
                />{" "}
                Contacted: {editing.contacted ? "Yes" : "No"}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={editing.thanked}
                  onChange={(e) => patch("thanked", e.target.checked)}
                />{" "}
                Thank-you sent by team
              </label>
            </div>
            <div className="form-grid">
              <Field label="Requested support">
                <input
                  value={editing.requested}
                  placeholder="Parts, workshop space, mentoring…"
                  onChange={(e) => patch("requested", e.target.value)}
                />
              </Field>
              <Field label="Confirmed support">
                <input
                  value={editing.confirmed}
                  placeholder="Only record agreed support"
                  onChange={(e) => patch("confirmed", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Restrictions / recognition promises">
              <input
                value={editing.restrictions}
                onChange={(e) => patch("restrictions", e.target.value)}
              />
            </Field>
            <Field label="Private team notes">
              <textarea
                rows={3}
                value={editing.notes}
                onChange={(e) => patch("notes", e.target.value)}
              />
            </Field>
            <section className="funding-draft">
              <div className="funding-section-header">
                <h3>
                  <Mail size={17} />
                  Message draft
                </h3>
                <Badge
                  tone={editing.draftStatus === "Approved" ? "green" : "amber"}
                >
                  {editing.draftStatus}
                </Badge>
              </div>
              <p>Prepare your message here. Nothing is sent from MyFTCSpace.</p>
              <Field label="Draft message">
                <textarea
                  rows={7}
                  value={editing.draft}
                  onChange={(e) => {
                    patch("draft", e.target.value);
                    patch("draftStatus", "Draft");
                  }}
                  placeholder="Start with the template, then make it personal to this organization."
                />
              </Field>
              <div className="funding-draft-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    patch("draft", draftTemplate);
                    patch("draftStatus", "Draft");
                  }}
                >
                  Use team template
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!editing.draft.trim()}
                  onClick={() => patch("draftStatus", "Needs review")}
                >
                  Request mentor review
                </button>
                {canReview && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={editing.draftStatus !== "Needs review"}
                    onClick={() => patch("draftStatus", "Approved")}
                  >
                    <ShieldCheck size={15} />
                    Approve draft
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!editing.draft.trim()}
                  onClick={copyDraft}
                >
                  <Copy size={14} />
                  Copy draft
                </button>
              </div>
            </section>
            <div className="funding-verification">
              <span>
                {safeURL(editing.source) ? (
                  <a
                    href={safeURL(editing.source)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source <ArrowUpRight size={12} />
                  </a>
                ) : (
                  "No source recorded"
                )}{" "}
                ·{" "}
                {editing.verified
                  ? `Last verified ${dateLabel(editing.verified)}`
                  : "Not yet verified"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  patch("stale", true);
                  notify("Marked for re-verification. Save to keep this flag.");
                }}
              >
                <Flag size={13} />
                {editing.stale
                  ? "Flagged for review"
                  : "Flag stale information"}
              </button>
            </div>
            {editing.history.length > 0 && (
              <details className="funding-history">
                <summary>
                  Relationship history ({editing.history.length})
                </summary>
                {editing.history
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <p key={i}>
                      <time>{dateLabel(h.date)}</time>
                      {h.text}
                    </p>
                  ))}
              </details>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                Save relationship
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
