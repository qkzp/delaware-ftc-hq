import { useRef, useState } from "react";
import {
  ArrowRight,
  Database,
  Download,
  FileUp,
  FolderLock,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useHQ } from "../store";
import { Badge, Field, Modal, PageHeader } from "../components/ui";
import { localRepository } from "../persistence";
import { downloadFile } from "../utils";
export default function Settings() {
  const {
    data,
    setData,
    role,
    setRole,
    canManage,
    canReview,
    notify,
    exportData,
    importData,
    resetDemo,
    startFresh,
    storageError,
  } = useHQ();
  const [confirm, setConfirm] = useState<"reset" | "fresh" | null>(null);
  const [restore, setRestore] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / SETTINGS"
        title="Workspace settings"
        description="Team details, role previews, and data management."
      />
      <div className="settings-layout">
        <div className="stack">
          <section className="card settings-section">
            <div className="section-title">
              <Users size={21} />
              <h2>Your team</h2>
              <Badge>Team only</Badge>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Set the active team, county, and season label.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canManage) return;
                const f = new FormData(e.currentTarget);
                setData((d) => ({
                  ...d,
                  teamName: String(f.get("teamName")).trim(),
                  teamNumber: String(f.get("teamNumber")).trim(),
                  county: String(f.get("county")),
                  seasonName: String(f.get("seasonName")).trim(),
                }));
                notify("Team details saved.");
              }}
              key={data.teamId + data.teamName}
            >
              <Field label="Team name">
                <input
                  name="teamName"
                  required
                  maxLength={80}
                  defaultValue={data.teamName}
                  disabled={!canManage}
                />
              </Field>
              <div className="form-grid">
                <Field label="FTC team number (optional)">
                  <input
                    name="teamNumber"
                    maxLength={10}
                    defaultValue={data.teamNumber}
                    disabled={!canManage}
                  />
                </Field>
                <Field label="County">
                  <select
                    name="county"
                    defaultValue={data.county}
                    disabled={!canManage}
                  >
                    <option>New Castle</option>
                    <option>Kent</option>
                    <option>Sussex</option>
                    <option>Statewide</option>
                  </select>
                </Field>
              </div>
              <Field label="Season label">
                <input
                  name="seasonName"
                  required
                  maxLength={60}
                  defaultValue={data.seasonName}
                  disabled={!canManage}
                />
              </Field>
              {canManage && (
                <button className="btn btn-primary">Save team details</button>
              )}
            </form>
          </section>
          <section className="card settings-section">
            <div className="section-title">
              <Database size={21} />
              <h2>Data & backups</h2>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Changes save in this browser. Export a backup to move your
              workspace or preserve a season.
            </p>
            {storageError && (
              <div className="settings-info">
                <p>
                  <strong>Your previous saved snapshot is preserved.</strong>
                </p>
                <p>
                  Download it before replacing the workspace. The file may need
                  repair and can contain private team records.
                </p>
                <button
                  className="btn btn-secondary"
                  disabled={role !== "admin"}
                  onClick={() => {
                    try {
                      const raw = localRepository.readRaw();
                      if (raw !== null)
                        downloadFile("myftcspace-recovery.json", raw);
                      else notify("There is no saved snapshot to download.");
                    } catch {
                      notify("Browser storage is unavailable.");
                    }
                  }}
                >
                  <Download size={15} />
                  Download original snapshot
                </button>
              </div>
            )}
            <div className="settings-action">
              <div>
                <strong>Export a team backup</strong>
                <p>
                  Tasks, events, robot notes, and private funding records in one
                  JSON file.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={exportData}
                disabled={!canReview}
              >
                <Download size={15} />
                Export backup
              </button>
            </div>
            <div className="settings-action">
              <div>
                <strong>Restore a team backup</strong>
                <p>
                  Replaces this browser’s workspace. Export your current data
                  first.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                disabled={role !== "admin"}
                onClick={() => input.current?.click()}
              >
                <FileUp size={15} />
                Import backup
              </button>
              <input
                hidden
                type="file"
                accept=".json,application/json"
                ref={input}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5_000_000) {
                      notify("Choose a backup smaller than 5 MB.");
                      return;
                    }
                    setRestore(await file.text());
                  }
                  e.target.value = "";
                }}
              />
            </div>
            <div className="settings-action">
              <div>
                <strong>Start with your own team</strong>
                <p>
                  Clears sample records and keeps the official learning links.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                disabled={role !== "admin"}
                onClick={() => setConfirm("fresh")}
              >
                <RefreshCcw size={15} />
                Start fresh
              </button>
            </div>
            <div className="settings-action">
              <div>
                <strong>Explore the demo again</strong>
                <p>Restores all sample records and clears local changes.</p>
              </div>
              <button
                className="btn btn-ghost"
                disabled={role !== "admin"}
                onClick={() => setConfirm("reset")}
              >
                <RefreshCcw size={14} />
                Reset demo
              </button>
            </div>
          </section>
        </div>
        <aside className="stack">
          <section className="card settings-section">
            <div className="section-title">
              <ShieldCheck size={21} />
              <h2>Role preview</h2>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Preview how the interface changes for each team role.
            </p>
            <Field label="Demo permission preview">
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as typeof role);
                  notify("Role preview changed.");
                }}
              >
                <option value="student">Student</option>
                <option value="lead">Student lead</option>
                <option value="mentor">Mentor / coach</option>
                <option value="admin">Team admin</option>
              </select>
            </Field>
            <div className="privacy-grid">
              <div>
                <strong>Student</strong>Own tasks, calendar RSVPs, approved
                learning resources, and competition checklists.
              </div>
              <div>
                <strong>Student lead</strong>Team planning, resources, and
                private sponsor and grant workflows.
              </div>
              <div>
                <strong>Mentor / coach</strong>Communication review, public-use
                approval, skill sign-offs, and private exports.
              </div>
              <div>
                <strong>Team admin</strong>Mentor controls, workspace setup, and
                backup restoration.
              </div>
            </div>
          </section>
          <section className="settings-info">
            <FolderLock size={22} />
            <p>
              <strong>A local workspace with honest boundaries.</strong>
            </p>
            <p>
              Role switching previews permissions; it is not authentication.
              Data stays in this browser and is not shared with teammates.
            </p>
            <p>
              Use sample or non-sensitive records here. A shared team deployment
              needs school-approved sign-in and a backend that enforces team and
              role access.
            </p>
            <p>
              Drafts stay drafts. No emails, grant submissions, or public
              publishing happen from this app.
            </p>
          </section>
        </aside>
      </div>
      {confirm && (
        <Modal
          title={
            confirm === "fresh"
              ? "Start your team’s workspace?"
              : "Restore the sample workspace?"
          }
          onClose={() => setConfirm(null)}
        >
          <p className="muted">
            This replaces all records on this device. Export a private backup if
            you want to keep your work.
          </p>
          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setConfirm(null)}
            >
              Keep my workspace
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (confirm === "fresh") startFresh();
                else resetDemo();
                setConfirm(null);
              }}
            >
              {confirm === "fresh" ? "Start fresh" : "Restore demo"}
            </button>
          </div>
        </Modal>
      )}
      {restore && (
        <Modal
          title="Replace your current workspace?"
          onClose={() => setRestore(null)}
        >
          <p className="muted">
            This restores the selected backup and replaces the records currently
            saved in this browser. Export your current workspace first if you
            need to keep it.
          </p>
          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setRestore(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (importData(restore)) setRestore(null);
              }}
            >
              Restore backup
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
