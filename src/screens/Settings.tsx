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
import TeamAccess from "../components/TeamAccess";
import { api } from "../cloud";
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
    cloud,
  } = useHQ();
  const [confirm, setConfirm] = useState<"reset" | "fresh" | null>(null);
  const [restore, setRestore] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / SETTINGS"
        title="Workspace settings"
        description="Team access, roles, details, and recoverable records."
      />
      <TeamAccess />
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
              {cloud.shared ? "Changes sync across team members. Shared revision history provides recovery, and a mentor can export a private backup." : "Demo changes save in this browser. Sign in above for shared team records."}
            </p>
            {storageError && !cloud.shared && (
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
                  {cloud.shared ? "Replaces shared records for every teammate and saves the previous version to revision history. Export a current backup first." : "Replaces this browser’s workspace. Export your current data first."}
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
                    if (file.size > 2_000_000) {
                      notify("Choose a backup smaller than 2 MB. Media files are stored separately.");
                      return;
                    }
                    setRestore(await file.text());
                  }
                  e.target.value = "";
                }}
              />
            </div>
            {!cloud.shared && <div className="settings-action">
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
            </div>}
            {!cloud.shared && <div className="settings-action">
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
            </div>}
          </section>
        </div>
        <aside className="stack">
          <section className="card settings-section">
            <div className="section-title">
              <ShieldCheck size={21} />
              <h2>{cloud.shared ? "Team permissions" : "Role preview"}</h2>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {cloud.shared ? "Your admin assigns roles. Only mentors and admins can approve external use and skill sign-offs." : "Preview how the interface changes for each team role."}
            </p>
            {cloud.shared ? <p className="assigned-role">Your assigned role: {role === "admin" ? "Team admin" : role === "mentor" ? "Mentor / coach" : role === "lead" ? "Student lead" : "Student"}</p> : <Field label="Demo permission preview">
              <select
                disabled={!!cloud.shared}
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
            </Field>}
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
              <strong>{cloud.shared ? "Private records. Clear permissions." : "A separate demo workspace."}</strong>
            </p>
            <p>
              {cloud.shared ? "Membership and role checks run on every server operation. Student names are display aliases; do not store student email addresses or signed consent forms here." : "Role switching is a demo. Sign in above for a private team with server-enforced membership."}
            </p>
            <p>
              {cloud.shared ? "Private media requires an authorized team request. Review consent before approving any external-use evidence." : "Use sample or non-sensitive records in the demo."}
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
            {cloud.shared ? "This replaces the shared records for every teammate and preserves the previous revision for recovery. Owners are matched to current members; unmatched tasks become unassigned. Imported approvals and event verification must be reviewed again. Private files from another team must be uploaded again." : "This restores the selected backup and replaces records in this browser. Export your current workspace first if you need to keep it."}
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
              onClick={async () => {
                if(cloud.shared){try{const result=await api(`/api/teams/${cloud.shared.id}/import`,'POST',{baseVersion:cloud.shared.version,data:JSON.parse(restore)});await cloud.reload();setRestore(null);notify(result.missingFiles.length?`Backup restored. Re-upload attachments for: ${result.missingFiles.join(', ')}`:'Shared backup restored. Imported approvals need review.');}catch(error){notify((error as Error).message);}return;}
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
