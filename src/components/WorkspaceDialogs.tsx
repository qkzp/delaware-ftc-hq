import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  CheckCheck,
  CalendarDays,
  BookOpen,
  Sprout,
  Users,
  ChevronRight,
  LockKeyhole,
  Plus,
} from "lucide-react";
import type { Page, Task } from "../types";
import { useHQ } from "../store";
import { EmptyState, Field, Modal } from "./ui";
import { navigation } from "../navigation";
export function SearchDialog({ onClose }: { onClose: () => void }) {
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
    <Modal title="Search workspace" onClose={onClose}>
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
              label: "New member checklist",
              icon: CheckCheck,
            },
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
export function QuickTask({ onClose }: { onClose: () => void }) {
  const { data, saveRecord, canManage, notify } = useHQ();
  return (
    <Modal title="New task" onClose={onClose}>
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
          notify("Task added.");
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
          hint="Describe the result needed to complete this task."
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
