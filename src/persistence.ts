import type { AppData } from "./types";

export const STORAGE_KEY = "delaware-ftc-hq:v1";
export const RECOVERY_KEY = `${STORAGE_KEY}:recovery`;
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const strings = (o: ObjectValue, keys: string[]) =>
  keys.every((k) => typeof o[k] === "string");
const booleans = (o: ObjectValue, keys: string[]) =>
  keys.every((k) => typeof o[k] === "boolean");
const stringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((i) => typeof i === "string");
const optionalBoolean = (v: unknown) =>
  v === undefined || typeof v === "boolean";
const oneOf = (v: unknown, options: string[]) =>
  typeof v === "string" && options.includes(v);
const visibility = (v: unknown) => oneOf(v, ["private", "team", "public"]);
const day = (v: unknown, optional = true) => {
  if (typeof v !== "string") return false;
  if (!v) return optional;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(`${v}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v
  );
};
const timestamp = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}(?:T.+)?$/.test(v) &&
  Number.isFinite(new Date(v).getTime());
const link = (v: unknown) => {
  if (typeof v !== "string") return false;
  if (!v) return true;
  try {
    return ["https:", "http:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};
const uniqueIds = (values: unknown[]) =>
  values.every(
    (v) => object(v) && typeof v.id === "string" && v.id.length > 0,
  ) && new Set(values.map((v) => (v as ObjectValue).id)).size === values.length;

/** Validate the entire record shape before any page receives restored data. */
export function validateData(value: unknown): value is AppData {
  if (!object(value)) return false;
  const v = value;
  if (v.evidence !== undefined && (!Array.isArray(v.evidence) || !uniqueIds(v.evidence) || !v.evidence.every((e) => object(e) && strings(e, ["id", "teamId", "seasonId", "title", "date", "county", "owner", "activity", "impact", "measurement", "mediaUrl", "fileId", "consentNote", "reviewedBy", "reviewedAt"]) && e.teamId === v.teamId && e.seasonId === v.seasonId && day(e.date, false) && day(e.reviewedAt) && oneOf(e.kind, ["Outreach", "Engineering", "Team development"]) && oneOf(e.consent, ["Not recorded", "Team use only", "External use permitted"]) && visibility(e.visibility) && booleans(e, ["approved", "archived"]) && stringList(e.awards) && link(e.mediaUrl) && Number.isInteger(e.reach) && (e.reach as number) >= 0))) return false;
  if (v.parts !== undefined && (!Array.isArray(v.parts) || !uniqueIds(v.parts) || !v.parts.every((p) => object(p) && strings(p, ["id", "name", "subsystem", "location", "source", "notes"]) && link(p.source) && Number.isInteger(p.quantity) && (p.quantity as number) >= 0))) return false;
  if (
    v.schemaVersion !== 1 ||
    !strings(v, [
      "teamId",
      "seasonId",
      "teamName",
      "teamNumber",
      "county",
      "seasonName",
      "coachInstructions",
    ]) ||
    !v.teamId ||
    !v.seasonId
  )
    return false;
  const collections = [
    "tasks",
    "events",
    "sponsors",
    "grants",
    "resources",
    "announcements",
  ] as const;
  for (const key of collections) {
    const records = v[key];
    if (!Array.isArray(records) || !uniqueIds(records)) return false;
    if (
      !records.every(
        (r) =>
          object(r) &&
          r.teamId === v.teamId &&
          r.seasonId === v.seasonId &&
          optionalBoolean(r.demo),
      )
    )
      return false;
  }
  if (!["onboarding", "pitChecklist", "skills"].every((k) => stringList(v[k])))
    return false;
  const tasks = v.tasks as ObjectValue[];
  if (
    !tasks.every(
      (t) =>
        strings(t, [
          "title",
          "owner",
          "area",
          "due",
          "done",
          "effort",
          "description",
        ]) &&
        day(t.due) &&
        oneOf(t.priority, ["High", "Medium", "Low"]) &&
        oneOf(t.status, ["To do", "In progress", "Done"]) &&
        stringList(t.dependencies) &&
        (t.resourceId === undefined || typeof t.resourceId === "string") &&
        Array.isArray(t.comments) &&
        t.comments.every(
          (c) =>
            object(c) &&
            strings(c, ["text", "date", "author"]) &&
            timestamp(c.date),
        ),
    )
  )
    return false;
  const events = v.events as ObjectValue[];
  if (!(v.tasks as ObjectValue[]).every(t => (t.subsystem === undefined || typeof t.subsystem === "string") && (t.blockedReason === undefined || typeof t.blockedReason === "string"))) return false;
  if (!events.every(e => (e.verification === undefined || oneOf(e.verification, ["team-created", "needs-review", "verified"])) && (e.verifiedAt === undefined || day(e.verifiedAt)) && (e.verifiedBy === undefined || typeof e.verifiedBy === "string") && (e.deadline === undefined || day(e.deadline)))) return false;
  if (
    !events.every(
      (e) =>
        strings(e, [
          "title",
          "date",
          "time",
          "endTime",
          "location",
          "owner",
          "agenda",
          "notes",
          "source",
          "lastSynced",
        ]) &&
        day(e.date, false) &&
        day(e.lastSynced) &&
        [e.time, e.endTime].every(
          (t) => t === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(t as string),
        ) &&
        oneOf(e.type, [
          "Build night",
          "Competition",
          "Outreach",
          "Deadline",
          "Meeting",
        ]) &&
        oneOf(e.recurring, ["None", "Weekly"]) &&
        typeof e.rsvp === "boolean",
    )
  )
    return false;
  const resources = v.resources as ObjectValue[];
  if (
    !resources.every(
      (r) =>
        strings(r, [
          "title",
          "category",
          "description",
          "url",
          "content",
          "owner",
          "reviewed",
        ]) &&
        day(r.reviewed) &&
        link(r.url) &&
        oneOf(r.level, ["Beginner", "Intermediate", "Advanced"]) &&
        oneOf(r.kind, [
          "Guide",
          "CAD",
          "Code",
          "Build log",
          "Wiring",
          "Photo",
          "Document",
        ]) &&
        visibility(r.visibility) &&
        booleans(r, ["official", "approved"]) &&
        stringList(r.tags) &&
        optionalBoolean(r.stale),
    )
  )
    return false;
  const sponsors = v.sponsors as ObjectValue[];
  if (
    !sponsors.every(
      (s) =>
        strings(s, [
          "name",
          "county",
          "website",
          "contact",
          "type",
          "source",
          "verified",
          "owner",
          "reviewer",
          "followUp",
          "notes",
          "requested",
          "confirmed",
          "restrictions",
          "draft",
        ]) &&
        link(s.website) &&
        link(s.source) &&
        day(s.verified) &&
        day(s.followUp) &&
        visibility(s.visibility) &&
        booleans(s, ["contacted", "thanked"]) &&
        oneOf(s.status, [
          "Researching",
          "Ready for Review",
          "Contacted",
          "Follow-up Due",
          "Interested",
          "Meeting Scheduled",
          "Committed",
          "Declined",
          "Do Not Contact",
        ]) &&
        oneOf(s.draftStatus, ["Draft", "Needs review", "Approved"]) &&
        optionalBoolean(s.stale) &&
        Array.isArray(s.history) &&
        s.history.every(
          (h) =>
            object(h) && strings(h, ["date", "text"]) && day(h.date, false),
        ),
    )
  )
    return false;
  const grants = v.grants as ObjectValue[];
  if (
    !grants.every(
      (g) =>
        strings(g, [
          "name",
          "source",
          "checked",
          "eligibility",
          "county",
          "amount",
          "deadline",
          "internalDeadline",
          "owner",
          "requirements",
          "documents",
          "reminder",
        ]) &&
        link(g.source) &&
        link(g.documents) &&
        day(g.checked) &&
        day(g.deadline) &&
        day(g.internalDeadline) &&
        visibility(g.visibility) &&
        booleans(g, ["confirmed", "rookie"]) &&
        oneOf(g.status, [
          "New",
          "Checking Eligibility",
          "Eligible",
          "In Progress",
          "Needs Mentor Review",
          "Submitted",
          "Awarded",
          "Not Awarded",
          "Closed",
        ]) &&
        optionalBoolean(g.stale) &&
        Array.isArray(g.steps) &&
        uniqueIds(g.steps) &&
        g.steps.every(
          (s) =>
            object(s) &&
            typeof s.title === "string" &&
            typeof s.done === "boolean",
        ),
    )
  )
    return false;
  if (
    !(v.announcements as ObjectValue[]).every(
      (a) =>
        strings(a, ["title", "body", "author", "date"]) &&
        day(a.date, false) &&
        oneOf(a.type, ["Decision", "Update"]),
    )
  )
    return false;
  if (
    !Array.isArray(v.pitNotes) ||
    !uniqueIds(v.pitNotes) ||
    !v.pitNotes.every(
      (n) => object(n) && strings(n, ["text", "date"]) && timestamp(n.date),
    )
  )
    return false;
  return (
    object(v.robot) &&
    strings(v.robot, [
      "purpose",
      "cad",
      "code",
      "wiring",
      "setup",
      "test",
      "issues",
      "repairs",
    ]) &&
    link(v.robot.cad) &&
    link(v.robot.code) &&
    link(v.robot.wiring)
  );
}

export class RecoveryRequiredError extends Error {
  constructor() {
    super(
      "The saved workspace could not be read. Its original data is preserved. Download it or explicitly restore a valid backup before replacing it.",
    );
    this.name = "RecoveryRequiredError";
  }
}
function parseSaved(raw: string): AppData {
  const parsed: unknown = JSON.parse(raw);
  if (!validateData(parsed))
    throw new Error("Saved data format is not supported.");
  return parsed;
}
export const localRepository = {
  readRaw(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
  read(): AppData | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : parseSaved(raw);
  },
  write(data: AppData) {
    if (!validateData(data))
      throw new Error("Changes are not a valid MyFTCSpace workspace.");
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous !== null) {
      try {
        parseSaved(previous);
      } catch {
        throw new RecoveryRequiredError();
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  /** Explicit recovery only: retain the original bytes before replacing a bad snapshot. */
  recover(data: AppData) {
    if (!validateData(data))
      throw new Error("Choose a valid MyFTCSpace backup.");
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous !== null) {
      let invalid = false;
      try {
        parseSaved(previous);
      } catch {
        invalid = true;
      }
      if (invalid) localStorage.setItem(RECOVERY_KEY, previous);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
