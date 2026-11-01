export type Role = "student" | "lead" | "mentor" | "admin";
export type Page =
  | "home"
  | "tasks"
  | "calendar"
  | "sponsors"
  | "grants"
  | "resources"
  | "onboarding"
  | "evidence"
  | "opportunities"
  | "pit"
  | "settings";
export type Member = { userId: string; name: string; role: Role };
export type Visibility = "team" | "private" | "public";
export interface Base {
  id: string;
  teamId: string;
  seasonId: string;
  demo?: boolean;
}
export interface Task extends Base {
  subsystem?: string;
  blockedReason?: string;
  title: string;
  owner: string;
  area: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  status: "To do" | "In progress" | "Done";
  done: string;
  effort: string;
  description: string;
  dependencies: string[];
  resourceId?: string;
  comments: { text: string; date: string; author: string }[];
}
export interface TeamEvent extends Base {
  verification?: "team-created" | "needs-review" | "verified";
  verifiedAt?: string;
  verifiedBy?: string;
  deadline?: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  type: "Build night" | "Competition" | "Outreach" | "Deadline" | "Meeting";
  location: string;
  owner: string;
  agenda: string;
  notes: string;
  source: string;
  lastSynced: string;
  rsvp: boolean;
  recurring: "None" | "Weekly";
}
export interface Sponsor extends Base {
  name: string;
  county: string;
  website: string;
  contact: string;
  type: string;
  source: string;
  verified: string;
  owner: string;
  reviewer: string;
  status:
    | "Researching"
    | "Ready for Review"
    | "Contacted"
    | "Follow-up Due"
    | "Interested"
    | "Meeting Scheduled"
    | "Committed"
    | "Declined"
    | "Do Not Contact";
  contacted: boolean;
  followUp: string;
  notes: string;
  requested: string;
  confirmed: string;
  restrictions: string;
  thanked: boolean;
  draft: string;
  draftStatus: "Draft" | "Needs review" | "Approved";
  visibility: Visibility;
  stale?: boolean;
  history: { date: string; text: string }[];
}
export interface Grant extends Base {
  name: string;
  source: string;
  checked: string;
  eligibility: string;
  confirmed: boolean;
  county: string;
  rookie: boolean;
  amount: string;
  deadline: string;
  internalDeadline: string;
  owner: string;
  status:
    | "New"
    | "Checking Eligibility"
    | "Eligible"
    | "In Progress"
    | "Needs Mentor Review"
    | "Submitted"
    | "Awarded"
    | "Not Awarded"
    | "Closed";
  requirements: string;
  documents: string;
  reminder: string;
  steps: { id: string; title: string; done: boolean }[];
  visibility: Visibility;
  stale?: boolean;
}
export interface Resource extends Base {
  archived?: boolean;
  title: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  kind:
    "Guide" | "CAD" | "Code" | "Build log" | "Wiring" | "Photo" | "Document";
  description: string;
  url: string;
  content: string;
  owner: string;
  reviewed: string;
  official: boolean;
  visibility: Visibility;
  approved: boolean;
  tags: string[];
  stale?: boolean;
}
export interface Announcement extends Base {
  title: string;
  body: string;
  author: string;
  date: string;
  type: "Decision" | "Update";
}
export interface AppData {
  evidence?: Evidence[];
  parts?: Part[];
  schemaVersion: 1;
  teamId: string;
  seasonId: string;
  teamName: string;
  teamNumber: string;
  county: string;
  seasonName: string;
  tasks: Task[];
  events: TeamEvent[];
  sponsors: Sponsor[];
  grants: Grant[];
  resources: Resource[];
  announcements: Announcement[];
  onboarding: string[];
  pitChecklist: string[];
  pitNotes: { id: string; text: string; date: string }[];
  skills: string[];
  robot: {
    purpose: string;
    cad: string;
    code: string;
    wiring: string;
    setup: string;
    test: string;
    issues: string;
    repairs: string;
  };
  coachInstructions: string;
}
export type Collection =
  "tasks" | "events" | "sponsors" | "grants" | "resources" | "announcements" | "evidence";
export type RecordFor<K extends Collection> = NonNullable<AppData[K]>[number];

export interface Evidence extends Base {
  title: string;
  date: string;
  county: string;
  owner: string;
  kind: "Outreach" | "Engineering" | "Team development";
  activity: string;
  impact: string;
  reach: number;
  measurement: string;
  awards: string[];
  mediaUrl: string;
  fileId: string;
  consent: "Not recorded" | "Team use only" | "External use permitted";
  consentNote: string;
  visibility: Visibility;
  approved: boolean;
  reviewedBy: string;
  reviewedAt: string;
  archived: boolean;
}
export interface Part { id: string; name: string; subsystem: string; quantity: number; location: string; source: string; notes: string; }
