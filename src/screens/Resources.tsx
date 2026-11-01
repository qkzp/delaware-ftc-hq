import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  Code2,
  ExternalLink,
  Flag,
  FolderOpen,
  Link,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import type { Resource } from "../types";
import { useHQ } from "../store";
import { PageHeader, Modal, Badge, EmptyState, Field } from "../components/ui";
import "./Library.css";
import PartsList from "../components/PartsList";

const categories = [
  "Robot design",
  "Programming",
  "CAD",
  "Manufacturing",
  "Wiring",
  "Autonomous",
  "Testing",
  "Scouting",
  "Outreach",
  "Fundraising",
  "Judging",
  "Portfolio",
  "Safety",
  "Competition prep",
];
const levels: Resource["level"][] = ["Beginner", "Intermediate", "Advanced"];
const kinds: Resource["kind"][] = [
  "Guide",
  "CAD",
  "Code",
  "Build log",
  "Wiring",
  "Photo",
  "Document",
];
const today = () => new Date().toLocaleDateString("en-CA");
function safeUrl(url: string) {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
function displayDate(value: string) {
  return value
    ? new Date(value + "T12:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not reviewed yet";
}
export default function ResourcesPage() {
  const {myOwner, memberName, cloud,
    data,
    canManage,
    canReview,
    saveRecord,
    notify,
    focusRecord,
    clearFocusRecord,
  } = useHQ();
  const [tab, setTab] = useState<"library" | "robot">("library");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [category, setCategory] = useState("All areas");
  const [level, setLevel] = useState("All levels");
  const [kind, setKind] = useState("All types");
  const [selected, setSelected] = useState<Resource | null>(null);
  const [editing, setEditing] = useState<Resource | "new" | null>(null);
  useEffect(() => {
    if (focusRecord?.page !== "resources") return;
    setEditing(null);
    if (focusRecord.id === "robot-reference") {
      setTab("robot");
      setSelected(null);
    } else {
      const resource = data.resources.find(
        (r) =>
          r.id === focusRecord.id &&
          (canManage || (r.visibility !== "private" && r.approved)),
      );
      if (resource) {
        setTab("library");
        setSelected(resource);
      } else notify("This resource is not available in your current role.");
    }
    clearFocusRecord();
  }, [focusRecord, data.resources, canManage]);
  const visible = data.resources.filter(
    (r) => (canManage || (r.visibility !== "private" && r.approved)) && !!r.archived === showArchived,
  );
  const filtered = visible.filter(
    (r) =>
      (category === "All areas" || r.category === category) &&
      (level === "All levels" || r.level === level) &&
      (kind === "All types" || r.kind === kind) &&
      `${r.title} ${r.description} ${r.category} ${r.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const current = selected
    ? data.resources.find((r) => r.id === selected.id) || selected
    : null;
  function save(resource: Resource) {
    saveRecord("resources", resource);
    setEditing(null);
    notify(cloud.shared ? "Resource updated. Check the sync status before closing." : "Resource saved to this device.");
  }
  function exportNote(resource: Resource) {
    const text = `${resource.title}\n\n${resource.description}\n\n${resource.content}\n\nSource: ${resource.url || "Team record"}\nOwner: ${resource.owner}\nReviewed: ${resource.reviewed || "Not reviewed"}\nVisibility: ${resource.visibility}\n`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    link.download = `${resource.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify("Resource note exported.");
  }
  return (
    <>
      <PageHeader
        eyebrow="ROBOT / LIBRARY"
        title="Robot & resources"
        description="Build records, technical files, and reference material."
        actions={
          canManage && (
            <button
              className="btn btn-primary"
              onClick={() => setEditing("new")}
            >
              <Plus size={17} /> Add resource
            </button>
          )
        }
      />
      <div className="filter-tabs library-tabs" aria-label="Resource views">
        <button
          className={tab === "library" ? "active" : ""}
          onClick={() => setTab("library")}
        >
          <FolderOpen size={17} /> Team library
        </button>
        <button
          className={tab === "robot" ? "active" : ""}
          onClick={() => setTab("robot")}
        >
          <Wrench size={17} /> Robot quick reference
        </button>
      </div>
      {tab === "robot" ? (
        <RobotReference />
      ) : (
        <>
          <div className="filters library-filters">
            <label className="search-input">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guides, files, or a subsystem…"
                aria-label="Search resources"
              />
              {query && (
                <button
                  className="icon-btn"
                  onClick={() => setQuery("")}
                  aria-label="Clear resource search"
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <label className="inline"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Archived resources</label>
            <select
              aria-label="Filter work area"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>All areas</option>
              {Array.from(
                new Set([...categories, ...visible.map((r) => r.category)]),
              ).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Filter skill level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option>All levels</option>
              {levels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <select
              aria-label="Filter resource type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option>All types</option>
              {kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="library-results">
            <span>
              {filtered.length} resource{filtered.length !== 1 ? "s" : ""}
            </span>
            <span>
              <LockKeyhole size={13} /> Team library · approval required for
              public use
            </span>
          </div>
          {filtered.length ? (
            <div className="resource-grid">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  className="card resource-card"
                  onClick={() => setSelected(r)}
                >
                  <div className="resource-card-top">
                    <Badge
                      tone={
                        r.level === "Beginner"
                          ? "green"
                          : r.level === "Intermediate"
                            ? "blue"
                            : "purple"
                      }
                    >
                      {r.level}
                    </Badge>
                  </div>
                  <div className="resource-category">
                    {r.category} <span>·</span> {r.kind}
                  </div>
                  <h2>{r.title}</h2>
                  <p>{r.description}</p>
                  <div className="resource-tags">
                    {Array.from(new Set(r.tags))
                      .slice(0, 3)
                      .map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                  </div>
                  <div className="resource-footer">
                    <span>
                      {r.official ? (
                        <>
                          <ShieldCheck size={13} /> Official source
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={13} />{" "}
                          {r.visibility === "private"
                            ? "Private"
                            : "Team resource"}
                        </>
                      )}
                      {r.demo && <span className="resource-demo">Demo</span>}
                    </span>
                    <ArrowRight size={17} />
                  </div>
                  {!r.approved && (
                    <div className="resource-pending">
                      <span>Awaiting mentor approval</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No matching resources"
              description="Try another search or clear the filters to see the team library."
              action={
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("All areas");
                    setLevel("All levels");
                    setKind("All types");
                  }}
                >
                  Clear filters
                </button>
              }
            />
          )}
        </>
      )}
      {current && !editing && (
        <Modal title={current.title} onClose={() => setSelected(null)} wide>
          <div className="stack resource-detail">
            <div className="inline">
              <Badge tone="green">{current.level}</Badge>
              <Badge>{current.kind}</Badge>
              <Badge>
                {current.visibility === "private"
                  ? "Private · leads & mentors"
                  : current.visibility === "public"
                    ? current.approved
                      ? "Approved for public use"
                      : "Public · awaiting approval"
                    : "Team only"}
              </Badge>
              {current.demo && <Badge tone="amber">Demo team record</Badge>}
            </div>
            <p className="resource-description">{current.description}</p>
            <div className="resource-detail-meta">
              <span>
                <strong>Owner</strong>
                {memberName(current.owner)}
              </span>
              <span>
                <strong>Last reviewed</strong>
                {displayDate(current.reviewed)}
              </span>
              <span>
                <strong>Source</strong>
                {current.official
                  ? "Official organization resource"
                  : "Team-created / unofficial guidance"}
              </span>
            </div>
            {current.content && (
              <div className="resource-content">{current.content}</div>
            )}
            {current.stale && (
              <div className="library-note">
                <Flag size={16} /> Flagged for review. Check with the owner
                before relying on this information.
              </div>
            )}
            {safeUrl(current.url) && (
              <a
                className="btn btn-primary"
                href={safeUrl(current.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open{" "}
                {current.kind === "CAD"
                  ? "CAD file"
                  : current.kind === "Code"
                    ? "code repository"
                    : "source"}{" "}
                <ExternalLink size={16} />
              </a>
            )}
            {!current.url && !current.content && (
              <p className="library-note">
                This resource needs a link or team notes. Ask the owner to add
                them.
              </p>
            )}
            <div className="form-actions">
              {current.content && (
                <button
                  className="btn btn-secondary"
                  onClick={() => exportNote(current)}
                >
                  <ArrowDownToLine size={16} /> Export note
                </button>
              )}
              {canManage && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditing(current)}
                >
                  <Pencil size={16} /> Edit resource
                </button>
              )}
              {canManage && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    saveRecord("resources", {
                      ...current,
                      stale: !current.stale,
                    });
                    notify(
                      current.stale
                        ? "Review flag cleared."
                        : "Resource flagged for review.",
                    );
                  }}
                >
                  <Flag size={16} />
                  {current.stale ? "Clear review flag" : "Flag as outdated"}
                </button>
              )}
              {canReview && !current.approved && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    saveRecord("resources", {
                      ...current,
                      approved: true,
                      reviewed: today(),
                    });
                    notify(
                      current.visibility === "public"
                        ? "Approved for public use. Nothing has been published externally."
                        : "Approved for the team.",
                    );
                  }}
                >
                  <CheckCircle2 size={16} /> Approve{" "}
                  {current.visibility === "public" ? "public use" : "for team"}
                </button>
              )}
            </div>
            <p className="muted library-fineprint">
              Public approval prepares this resource for a future team page.
              This app does not publish files or student photos externally.
            </p>
          </div>
        </Modal>
      )}
      {editing && (
        <ResourceEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}

function ResourceEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Resource | null;
  onClose: () => void;
  onSave: (resource: Resource) => void;
}) {
  const {myOwner, memberName, cloud, data, canReview, notify } = useHQ();
  const [value, setValue] = useState<Resource>(
    initial || {
      id: crypto.randomUUID(),
      teamId: data.teamId,
      seasonId: data.seasonId,
      demo: false,
      title: "",
      category: "Robot design",
      level: "Beginner",
      kind: "Guide",
      description: "",
      url: "",
      content: "",
      owner: myOwner,
      reviewed: "",
      official: false,
      visibility: "private",
      approved: false,
      tags: [],
    },
  );
  const [tags, setTags] = useState(value.tags.join(", "));
  function set<K extends keyof Resource>(key: K, v: Resource[K]) {
    setValue((s) => ({
      ...s,
      [key]: v,
      ...(["title", "description", "url", "content", "visibility"].includes(key)
        ? { approved: false }
        : {}),
    }));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.url && !safeUrl(value.url)) {
      notify("Use a complete https:// or http:// link.");
      return;
    }
    if (!value.url && !value.content.trim()) {
      notify("Add a source link or useful team notes before saving.");
      return;
    }
    onSave({
      ...value,
      title: value.title.trim(),
      description: value.description.trim(),
      tags: Array.from(
        new Set(
          tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ),
      approved: canReview ? value.approved : false,
      demo: false,
    });
  }
  return (
    <Modal
      title={initial ? "Edit resource" : "Add resource"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="stack">
        <div className="library-note">
          <LockKeyhole size={17} /> Start private. A mentor approves resources
          before wider sharing.
        </div>
        <Field label="Resource title">
          <input
            required
            maxLength={120}
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Intake assembly and repair notes"
          />
        </Field>
        <Field label="What will this help someone do?">
          <textarea
            required
            rows={2}
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="A short, useful description."
          />
        </Field>
        <div className="form-grid">
          <Field label="Work area">
            <select
              value={value.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {Array.from(new Set([...categories, value.category])).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Skill level">
            <select
              value={value.level}
              onChange={(e) =>
                set("level", e.target.value as Resource["level"])
              }
            >
              {levels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Resource type">
            <select
              value={value.kind}
              onChange={(e) => set("kind", e.target.value as Resource["kind"])}
            >
              {kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Owner">
            {cloud.shared ? <select value={value.owner} onChange={e=>set("owner",e.target.value)}>{cloud.shared.members.map(m=><option key={m.userId} value={m.userId}>{m.name}</option>)}</select> : <input required value={value.owner} onChange={e=>set("owner",e.target.value)}/>} 
          </Field>
        </div>
        <Field
          label="Source or file link"
          hint="Use a team-approved file share, CAD workspace, repository, or official resource."
        >
          <input
            type="url"
            value={value.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Team notes or build log">
          <textarea
            rows={7}
            value={value.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Purpose, what changed, what you tested, and what the next person should know."
          />
        </Field>
        <Field
          label="Import a text or Markdown note"
          hint="Text becomes part of the resource record. Use a private source link for large CAD files, or upload photos and videos through Evidence."
        >
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 512000) {
                notify("Choose a text note smaller than 500 KB.");
                return;
              }
              set("content", await file.text());
              notify("Text note added. Save the resource to keep it.");
            }}
          />
        </Field>
        <div className="form-grid">
          <Field label="Tags, separated by commas">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="intake, maintenance, handoff"
            />
          </Field>
          <Field label="Last reviewed">
            <input
              type="date"
              max={today()}
              value={value.reviewed}
              onChange={(e) => set("reviewed", e.target.value)}
            />
          </Field>
          <Field label="Visibility">
            <select
              value={value.visibility}
              onChange={(e) => {
                set("visibility", e.target.value as Resource["visibility"]);
                set("approved", false);
              }}
            >
              <option value="private">Private · leads & mentors</option>
              <option value="team">Team · request mentor approval</option>
              <option value="public">
                Public use · request mentor approval
              </option>
            </select>
          </Field>
        </div>
        <label className="library-check">
          <input
            type="checkbox"
            checked={value.official}
            onChange={(e) => set("official", e.target.checked)}
          />{" "}
          This link is an official source (FIRST, funder, or manufacturer).
        </label>
        <label className="library-check"><input type="checkbox" checked={!!value.archived} onChange={e=>set("archived",e.target.checked)}/>Archive this resource</label>
        {canReview && (
          <label className="library-check">
            <input
              type="checkbox"
              checked={value.approved}
              onChange={(e) => set("approved", e.target.checked)}
            />{" "}
            I have reviewed this resource and approve its selected visibility.
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Save resource <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RobotReference() {
  const {myOwner, memberName, cloud, data, canManage, setData, notify } = useHQ();
  const [edit, setEdit] = useState(false);
  const [robot, setRobot] = useState(data.robot);
  const sections: {
    key: keyof typeof data.robot;
    title: string;
    hint: string;
  }[] = [
    {
      key: "purpose",
      title: "What our robot does",
      hint: "Subsystem purpose and design decisions.",
    },
    {
      key: "setup",
      title: "Set up & start",
      hint: "The steps to get from powered off to ready.",
    },
    {
      key: "test",
      title: "Test procedure",
      hint: "How we know it works, and what to record.",
    },
    {
      key: "issues",
      title: "Known issues",
      hint: "Symptoms, workarounds, and things to check.",
    },
    {
      key: "repairs",
      title: "Repair & handoff notes",
      hint: "What the next person needs to know.",
    },
  ];
  const links: {
    key: "cad" | "code" | "wiring";
    label: string;
    Icon: typeof Wrench;
  }[] = [
    { key: "cad", label: "Robot CAD", Icon: Wrench },
    { key: "code", label: "Robot code", Icon: Code2 },
    { key: "wiring", label: "Wiring & ports", Icon: Link },
  ];
  return (
    <div className="stack">
      <div className="card robot-reference-head">
        <span className="robot-reference-icon">
          <Wrench size={30} />
        </span>
        <div>
          <div className="eyebrow">THE TEAM’S SHARED MEMORY</div>
          <h2>Robot quick reference</h2>
          <p className="muted">
            Setup, files, tests, and the lessons we don’t want to learn twice.
          </p>
        </div>
        {canManage && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setRobot(data.robot);
              setEdit(true);
            }}
          >
            <Pencil size={16} /> Edit reference
          </button>
        )}
      </div>
      <div className="robot-links">
        {links.map(({ key, label, Icon }) =>
          safeUrl(data.robot[key]) ? (
            <a
              key={key}
              className="card robot-link"
              href={safeUrl(data.robot[key])}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon size={22} />
              <span>
                {label}
                <small>Open team file</small>
              </span>
              <ExternalLink size={16} />
            </a>
          ) : (
            <div key={key} className="card robot-link">
              <Icon size={22} />
              <span>
                {label}
                <small>Add a link in Edit reference</small>
              </span>
            </div>
          ),
        )}
      </div>
      <div className="robot-reference-grid">
        {sections.map((s) => (
          <section className="card robot-reference-section" key={s.key}>
            <h3>{s.title}</h3>
            <p className="muted">{s.hint}</p>
            <div className="resource-content">
              {data.robot[s.key] ||
                "No team notes yet. Add what you know so the next student can get started."}
            </div>
          </section>
        ))}
      </div>
      <PartsList />
      {edit && (
        <Modal
          title="Edit robot quick reference"
          onClose={() => setEdit(false)}
          wide
        >
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              for (const { key } of links) {
                if (robot[key] && !safeUrl(robot[key])) {
                  notify(
                    "Use complete https:// or http:// links for robot files.",
                  );
                  return;
                }
              }
              setData((s) => ({ ...s, robot }));
              setEdit(false);
              notify(cloud.shared ? "Robot reference updated in the shared workspace." : "Robot reference saved on this device.");
            }}
          >
            {links.map((l) => (
              <Field key={l.key} label={`${l.label} link`}>
                <input
                  type="url"
                  value={robot[l.key]}
                  onChange={(e) =>
                    setRobot((r) => ({ ...r, [l.key]: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </Field>
            ))}
            {sections.map((s) => (
              <Field key={s.key} label={s.title} hint={s.hint}>
                <textarea
                  rows={4}
                  value={robot[s.key]}
                  onChange={(e) =>
                    setRobot((r) => ({ ...r, [s.key]: e.target.value }))
                  }
                />
              </Field>
            ))}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEdit(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save reference
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
