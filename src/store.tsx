import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppData, Collection, Page, RecordFor, Role } from "./types";
import {
  createDemoData,
  DEFAULT_DEMO_TASK_DESCRIPTION,
  DEFAULT_DEMO_TASK_DONE,
  DEMO_TASK_CONTENT,
} from "./seed";
import {
  localRepository,
  validateData,
  RecoveryRequiredError,
} from "./persistence";
import { downloadFile, dateKey } from "./utils";
import { useCloud, type Cloud } from "./cloud";
type Notice = {
  message: string;
  action?: () => void;
  actionLabel?: string;
  id: number;
};
interface HQContext {
  cloud: Cloud;
  myOwner: string;
  memberName: (owner: string) => string;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  role: Role;
  setRole: (role: Role) => void;
  page: Page;
  setPage: (page: Page) => void;
  focusRecord: { page: Page; id: string } | null;
  openRecord: (page: Page, id: string) => void;
  clearFocusRecord: () => void;
  canManage: boolean;
  canReview: boolean;
  saveRecord: <K extends Collection>(
    collection: K,
    record: RecordFor<K>,
  ) => void;
  removeRecord: (collection: Collection, id: string) => void;
  notify: (message: string, action?: () => void, actionLabel?: string) => void;
  notice: Notice | null;
  clearNotice: () => void;
  storageError: string;
  exportData: () => void;
  importData: (text: string) => boolean;
  resetDemo: () => void;
  startFresh: () => void;
}
const Context = createContext<HQContext | null>(null);
const validPages: Page[] = [
  "home",
  "tasks",
  "calendar",
  "sponsors",
  "grants",
  "resources",
  "onboarding",
  "pit",
  "settings",
  "evidence",
  "opportunities",
];
export function HQProvider({ children, accountMode=false, demoMode=false }: { children: ReactNode; accountMode?:boolean; demoMode?:boolean }) {
  const [storageError, setStorageError] = useState("");
  const [data, updateData] = useState<AppData>(() => {
    if (accountMode) return createDemoData();
    try {
      const saved = localRepository.read();
      if (!saved) return createDemoData();
      let migrated = false;
      const tasks = saved.tasks.map((task) => {
        const sample = task.demo ? DEMO_TASK_CONTENT[task.id] : undefined;
        if (!sample) return task;
        const done =
          task.done === DEFAULT_DEMO_TASK_DONE ? sample.done : task.done;
        const description =
          task.description === DEFAULT_DEMO_TASK_DESCRIPTION
            ? sample.description
            : task.description;
        if (done === task.done && description === task.description) return task;
        migrated = true;
        return { ...task, done, description };
      });
      return migrated ? { ...saved, tasks } : saved;
    } catch {
      return createDemoData();
    }
  });
  const cloud = useCloud(data, updateData, {enabled:!demoMode, autoOpen:accountMode});
  const myOwner = cloud.session.user && cloud.shared ? cloud.session.user.userId : "Alex (you)";
  const memberName = (owner: string) => owner === myOwner ? "You" : cloud.shared?.members.find(m => m.userId === owner)?.name || owner;
  const setData: React.Dispatch<React.SetStateAction<AppData>> = (action) => { cloud.markDirty(); updateData(action); };
  const [previewRole, setPreviewRole] = useState<Role>("lead");
  const role = cloud.shared?.role || previewRole;
  const setRole = (next: Role) => { if (!cloud.shared) setPreviewRole(next); };
  const [page, updatePage] = useState<Page>(() => {
    const p = location.hash.slice(1) as Page;
    return validPages.includes(p) ? p : "home";
  });
  const [focusRecord, setFocusRecord] = useState<{
    page: Page;
    id: string;
  } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const counter = useRef(0);
  const canManage = role !== "student";
  const canReview = role === "mentor" || role === "admin";
  const notify = (message: string, action?: () => void, actionLabel = "Undo") =>
    setNotice({ message, action, actionLabel, id: ++counter.current });
  useEffect(() => {
    if (cloud.shared) { setStorageError(cloud.error); return; }
    if (accountMode) { setStorageError(cloud.error); return; }
    try {
      localRepository.write(data);
      setStorageError("");
    } catch (error) {
      setStorageError(
        error instanceof RecoveryRequiredError
          ? "The saved workspace is damaged and has been preserved. Changes currently stay in memory. In Team & settings, use the admin preview to download the original and restore a valid backup or explicitly start fresh."
          : "Your browser could not save these changes. Export a backup before closing this tab.",
      );
    }
  }, [data, cloud.shared, cloud.error, accountMode]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const handler = () => {
      const p = location.hash.slice(1) as Page;
      if (validPages.includes(p)) updatePage(p);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const setPage = (next: Page) => {
    location.hash = next;
    updatePage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openRecord = (next: Page, id: string) => {
    setFocusRecord({ page: next, id });
    setPage(next);
  };
  function saveRecord<K extends Collection>(
    collection: K,
    record: RecordFor<K>,
  ) {
    if (collection === "tasks") {
      const incoming = record as RecordFor<"tasks">;
      const current = data.tasks.find(t=>t.id===incoming.id);
      if(current) record = {...incoming, comments:[...current.comments,...incoming.comments.filter(c=>!current.comments.some(x=>x.text===c.text&&x.date===c.date&&x.author===c.author))]} as RecordFor<K>;
    }
    if (record.teamId !== data.teamId || record.seasonId !== data.seasonId) {
      notify("This record belongs to another team or season.");
      return;
    }
    if (!canManage) {
      const existingEvent =
        collection === "events"
          ? data.events.find((e) => e.id === record.id)
          : undefined;
      const isRsvp =
        existingEvent &&
        JSON.stringify({ ...record, rsvp: existingEvent.rsvp }) ===
          JSON.stringify(existingEvent);
      const priorTask = collection === "tasks" ? data.tasks.find(t=>t.id===record.id) : undefined;
      const isComment = priorTask && JSON.stringify({...record,comments:priorTask.comments}) === JSON.stringify(priorTask) && (record as RecordFor<"tasks">).comments.length > priorTask.comments.length;
      if (!isRsvp && !isComment) {
        if (
          !["tasks", "evidence"].includes(collection) ||
          (record as RecordFor<"tasks">).owner !== myOwner
        ) {
          notify("A student lead or mentor can make this change.");
          return;
        }
        const previous = data.tasks.find((t) => t.id === record.id);
        if (previous && previous.owner !== myOwner) {
          notify("You can update tasks assigned to you.");
          return;
        }
      }
    }
    if (
      collection === "resources" &&
      (record as RecordFor<"resources">).visibility === "public" &&
      (record as RecordFor<"resources">).approved &&
      !canReview
    ) {
      notify("A mentor or team admin must approve public content.");
      return;
    }
    if (collection === "sponsors" && !canReview) {
      const incoming = record as RecordFor<"sponsors">;
      const previous = data.sponsors.find((s) => s.id === incoming.id);
      if (
        incoming.draftStatus === "Approved" &&
        (previous?.draftStatus !== "Approved" ||
          previous.draft !== incoming.draft)
      ) {
        notify("A mentor or team admin must approve this communication draft.");
        return;
      }
    }
    setData((previous) => ({
      ...previous,
      [collection]: ((previous[collection] || []) as RecordFor<K>[]).some(
        (r) => r.id === record.id,
      )
        ? ((previous[collection] || []) as RecordFor<K>[]).map((r) =>
            r.id === record.id ? record : r,
          )
        : [record, ...(previous[collection] || [])],
    }));
  }
  function removeRecord(collection: Collection, id: string) {
    if (collection === "tasks" && data.tasks.some(t=>t.dependencies.includes(id))) { notify("Unlink this task from its dependent tasks before removing it."); return; }
    if (!canManage) {
      notify("A student lead or mentor can remove records.");
      return;
    }
    const removed = ((data[collection] || []) as { id: string }[]).find(
      (r) => r.id === id,
    );
    if (!removed) return;
    setData((prev) => ({
      ...prev,
      [collection]: ((prev[collection] || []) as { id: string }[]).filter(
        (r) => r.id !== id,
      ),
    }));
    notify("Record removed.", () =>
      setData((prev) => ({
        ...prev,
        [collection]: [...(prev[collection] || []), removed],
      })),
    );
  }
  const exportData = () => {
    if (!canReview) {
      notify(
        "Switch to a mentor or admin preview to export private team records.",
      );
      return;
    }
    downloadFile(`myftcspace-${dateKey()}.json`, JSON.stringify(data, null, 2));
    notify("Backup exported. Keep it in your team’s approved private storage.");
  };
  const importData = (text: string) => {
    if (cloud.shared) { notify("Use shared revision history to restore a team workspace. Browser imports are demo-only."); return false; }
    if (role !== "admin") {
      notify("Only the team admin preview can restore a backup.");
      return false;
    }
    try {
      if (text.length > 5_000_000) throw Error();
      const parsed: unknown = JSON.parse(text);
      if (!validateData(parsed)) throw Error();
      localRepository.recover(parsed);
      setData(parsed);
      notify("Team backup restored.");
      return true;
    } catch {
      notify(
        "The backup could not be restored. Check its format and available browser storage. Your current saved data is unchanged.",
      );
      return false;
    }
  };
  const replaceWorkspace = (fresh: AppData, message: string) => {
    try {
      localRepository.recover(fresh);
      setData(fresh);
      notify(message);
    } catch {
      notify(
        "The workspace could not be replaced. Download a backup and check available browser storage.",
      );
    }
  };
  const resetDemo = () => {
    if (cloud.shared) return;
    if (role !== "admin") return;
    replaceWorkspace(createDemoData(), "Sample workspace restored.");
  };
  const startFresh = () => {
    if (cloud.shared) return;
    if (role !== "admin") return;
    const fresh = createDemoData();
    const teamId = crypto.randomUUID();
    replaceWorkspace(
      {
        ...fresh,
        teamId,
        teamName: "My FTC team",
        teamNumber: "",
        tasks: [],
        events: [],
        sponsors: [],
        grants: [],
        resources: fresh.resources
          .filter((r) => !r.demo)
          .map((r) => ({ ...r, teamId })),
        announcements: [],
        onboarding: [],
        pitChecklist: [],
        pitNotes: [],
        skills: [],
        robot: {
          purpose: "",
          cad: "",
          code: "",
          wiring: "",
          setup: "",
          test: "",
          issues: "",
          repairs: "",
        },
        coachInstructions: "",
      },
      "Your fresh workspace is ready. Add your team name and first meeting.",
    );
  };
  return (
    <Context.Provider
      value={{
        cloud,
        myOwner,
        memberName,
        data,
        setData,
        role,
        setRole,
        page,
        setPage,
        focusRecord,
        openRecord,
        clearFocusRecord: () => setFocusRecord(null),
        canManage,
        canReview,
        saveRecord,
        removeRecord,
        notify,
        notice,
        clearNotice: () => setNotice(null),
        storageError,
        exportData,
        importData,
        resetDemo,
        startFresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useHQ() {
  const value = useContext(Context);
  if (!value) throw Error("HQProvider is required");
  return value;
}
