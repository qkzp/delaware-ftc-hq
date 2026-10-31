import type {
  AppData,
  Task,
  Sponsor,
  Grant,
  Resource,
  TeamEvent,
} from "./types";
import { offsetDate, dateKey } from "./utils";
export const DEFAULT_DEMO_TASK_DONE =
  "Share the result at the next build meeting and add a short note to the build log.";
export const DEFAULT_DEMO_TASK_DESCRIPTION =
  "Work with a teammate. Ask a mentor if you need help or a safety check.";
export const DEMO_TASK_CONTENT: Record<
  string,
  { done: string; description: string }
> = {
  "task-1": {
    done: "Record each intake run, note any jams, and bring the best version to build night.",
    description:
      "Ask a teammate to spot the mechanism for the first three runs. Stop if anything binds.",
  },
  "task-2": {
    done: "Attach the run log with the start position, score, and missed actions.",
    description:
      "Use the same starting path each time so the results are easy to compare.",
  },
  "task-3": {
    done: "Choose three clear build photos and add a one-sentence caption to each.",
    description:
      "Include one wide shot, one close-up of the robot, and one photo of the team at work.",
  },
  "task-4": {
    done: "Label each motor with its hub and port, then check the map against the code.",
    description:
      "Compare the printed labels with the controller configuration before powering on.",
  },
  "task-5": {
    done: "Get mentor approval and save the approved draft before contacting anyone.",
    description:
      "This is a practice outreach record. Keep the draft unsent until a mentor reviews it.",
  },
  "task-6": {
    done: "Check every drivetrain fastener and mark any that needed tightening.",
    description:
      "Turn the robot off and follow your team’s safety steps around moving parts.",
  },
  "task-7": {
    done: "Save the repository link and controller setup steps in robot resources.",
    description:
      "Ask a teammate to find the driver code and confirm the setup notes are enough to get started.",
  },
  "task-8": {
    done: "Add a photo, key measurements, test result, and next design question to the log.",
    description:
      "Keep the earlier measurements with the first prototype so changes stay traceable.",
  },
  "task-9": {
    done: "Post the agenda with an owner and time estimate for each item.",
    description:
      "Leave time for robot check-in, subsystem updates, and decisions the team needs to make.",
  },
};
export function createDemoData(): AppData {
  const base = { teamId: "demo-team", seasonId: "2026-27", demo: true };
  const task = (
    id: string,
    title: string,
    area: string,
    days: number,
    status: Task["status"],
    owner = "Alex (you)",
    priority: Task["priority"] = "Medium",
    resourceId?: string,
  ): Task => ({
    ...base,
    id,
    title,
    area,
    due: offsetDate(days),
    status,
    owner,
    priority,
    effort: "20 min",
    done: DEMO_TASK_CONTENT[id]?.done || DEFAULT_DEMO_TASK_DONE,
    description:
      DEMO_TASK_CONTENT[id]?.description || DEFAULT_DEMO_TASK_DESCRIPTION,
    dependencies: [],
    comments: [],
    resourceId,
  });
  const event = (
    id: string,
    title: string,
    days: number,
    type: TeamEvent["type"],
    time = "16:00",
  ): TeamEvent => ({
    ...base,
    id,
    title,
    date: offsetDate(days),
    time,
    endTime: "18:00",
    type,
    location: "Team workshop · sample location",
    owner: "Jordan · team lead",
    agenda:
      "Quick check-in\nWork in subsystem pairs\nRecord what changed and choose next actions",
    notes: "Sample team event. Replace with your actual schedule.",
    source: "Manually entered · demo schedule",
    lastSynced: "",
    rsvp: false,
    recurring: "None",
  });
  const sponsor = (
    id: string,
    name: string,
    county: string,
    status: Sponsor["status"],
    follow: number,
  ): Sponsor => ({
    ...base,
    id,
    name,
    county,
    website: "",
    contact: "No real contact — practice record",
    type: "Sponsor prospect",
    source: "",
    verified: "",
    owner: "Sam",
    reviewer: "Coach Morgan",
    status,
    contacted: [
      "Contacted",
      "Follow-up Due",
      "Interested",
      "Meeting Scheduled",
      "Committed",
    ].includes(status),
    followUp: offsetDate(follow),
    notes:
      "Demo outreach only. This is not a real organization or sponsorship commitment.",
    requested: "Parts or machining support",
    confirmed: "None",
    restrictions: "Confirm recognition and support terms with a mentor.",
    thanked: false,
    draft: `Hello,\n\nWe are a student robotics team in Delaware. We would love to introduce our work and learn about ways your organization supports local STEM education.\n\nCould we arrange a brief conversation?\n\nThank you,\nThe team\n\n[Draft only — mentor review required]`,
    draftStatus: "Draft",
    visibility: "private",
    history: [],
  });
  const resource = (
    id: string,
    title: string,
    category: string,
    kind: Resource["kind"],
    description: string,
    url: string,
    official = false,
  ): Resource => ({
    ...base,
    id,
    title,
    category,
    level: "Beginner",
    kind,
    description,
    url,
    official,
    content: "",
    owner: "Coach Morgan",
    reviewed: "2026-10-31",
    visibility: "team",
    approved: true,
    tags: [category.toLowerCase(), kind.toLowerCase()],
  });
  const grant = (id: string, name: string, status: Grant["status"]): Grant => ({
    ...base,
    id,
    name,
    source: "https://www.firstinspires.org/programs/team-grant-opportunities",
    checked: "2026-10-31",
    eligibility:
      "Practice workflow only. This sample is not an actual grant or eligibility determination.",
    confirmed: false,
    county: "Statewide",
    rookie: false,
    amount: "Demo workflow · no award",
    deadline: "",
    internalDeadline: offsetDate(8),
    owner: "Sam",
    status,
    requirements:
      "Confirm the official funder, eligibility, deadline, and required documents before applying.",
    documents: "",
    reminder: "7 days before internal deadline",
    visibility: "private",
    steps: [
      {
        id: "eligibility",
        title: "Check eligibility with the funder",
        done: true,
      },
      {
        id: "budget",
        title: "Prepare team budget",
        done: status === "Needs Mentor Review",
      },
      {
        id: "review",
        title: "Ask a mentor to review the application",
        done: false,
      },
    ],
  });
  return {
    schemaVersion: 1,
    teamId: base.teamId,
    seasonId: base.seasonId,
    teamName: "Circuit Breakers",
    teamNumber: "DEMO",
    county: "New Castle",
    seasonName: "2026–27 season",
    tasks: [
      task(
        "task-1",
        "Test the intake with 10 practice runs",
        "Mechanical",
        0,
        "In progress",
        "Alex (you)",
        "High",
        "log-intake",
      ),
      task(
        "task-2",
        "Add autonomous test results to the build log",
        "Programming",
        1,
        "To do",
        "Alex (you)",
        "Medium",
        "code",
      ),
      task(
        "task-3",
        "Choose three photos for the portfolio",
        "Portfolio",
        3,
        "To do",
        "Alex (you)",
        "Low",
      ),
      task(
        "task-4",
        "Label the robot’s motor ports",
        "Electrical",
        1,
        "To do",
        "Unassigned",
        "Medium",
        "wiring",
      ),
      task(
        "task-5",
        "Review the sponsor introduction draft",
        "Outreach",
        2,
        "To do",
        "Jordan",
        "High",
      ),
      task("task-6", "Check drivetrain fasteners", "Mechanical", -2, "Done"),
      task(
        "task-7",
        "Create our robot code repository",
        "Programming",
        -3,
        "Done",
        "Riley",
      ),
      task(
        "task-8",
        "Document the first intake prototype",
        "Mechanical",
        -1,
        "Done",
      ),
      task(
        "task-9",
        "Prepare the build night agenda",
        "Team",
        0,
        "Done",
        "Jordan",
      ),
    ],
    events: [
      event("event-1", "Build night: test & iterate", 0, "Build night"),
      event("event-2", "Portfolio check-in", 3, "Meeting", "16:30"),
      {
        ...event(
          "event-3",
          "Team practice scrimmage",
          14,
          "Competition",
          "09:00",
        ),
        endTime: "15:00",
        location: "Team workshop · demo event",
        agenda:
          "Practice inspection\nDriver practice\nRun autonomous tests\nCapture lessons learned",
      },
      event("event-4", "Community robot demo", 21, "Outreach", "11:00"),
    ],
    sponsors: [
      sponsor(
        "sponsor-1",
        "Example fabrication partner",
        "New Castle",
        "Follow-up Due",
        -2,
      ),
      sponsor(
        "sponsor-2",
        "Example community supporter",
        "Kent",
        "Researching",
        5,
      ),
      sponsor(
        "sponsor-3",
        "Example parts supplier",
        "Sussex",
        "Ready for Review",
        3,
      ),
    ],
    grants: [
      grant("grant-1", "Sample funding application", "In Progress"),
      grant(
        "grant-2",
        "Sample registration support request",
        "Needs Mentor Review",
      ),
      {
        ...grant("grant-directory", "FIRST team grant directory", "New"),
        demo: false,
        eligibility:
          "Official directory for FIRST programs. FTC eligibility, location restrictions, and dates vary by listing. Verify each opportunity with the funder.",
        amount: "Varies by listing",
        internalDeadline: "",
        steps: [],
        visibility: "team",
      },
    ],
    resources: [
      {
        ...resource(
          "first-start",
          "Your first steps in FTC",
          "Getting started",
          "Guide",
          "Meet the program, explore the tools, and find a place to contribute.",
          "https://ftc-docs.firstinspires.org/en/latest/",
          true,
        ),
        demo: false,
      },
      {
        ...resource(
          "cad",
          "Robot CAD & design decisions",
          "CAD",
          "CAD",
          "The current robot design, dimensions, and the choices behind them.",
          "",
        ),
        content:
          "TEAM CAD HANDOFF — DEMO\n\nAdd your team’s actual Onshape, Fusion, or other CAD project link here.\n\nDesign decision: use a modular intake so it can be removed with four fasteners.\nOwner: mechanical team\nBefore changing the assembly: check the current dimensions with the subsystem owner.\n\nNo CAD integration is connected.",
      },
      {
        ...resource(
          "code",
          "Robot code & setup guide",
          "Programming",
          "Code",
          "Official robot controller repository and a place for your team’s setup notes.",
          "https://github.com/FIRST-Tech-Challenge/FtcRobotController",
          true,
        ),
        demo: false,
        level: "Intermediate",
      },
      {
        ...resource(
          "log-intake",
          "Intake v2 · build & test notes",
          "Mechanical",
          "Build log",
          "What we changed, what we tested, and what we’ll try next.",
          "",
        ),
        content:
          "INTAKE V2 — SAMPLE BUILD LOG\n\nPurpose: bring game pieces into the robot consistently.\nChange: adjusted the roller spacing for repeatability.\nNext test: run 10 controlled intake attempts and record each result.\nDone when: results and a short clip are added to the team log.\nKnown issue: check for rubbing before each test.\nSafety: isolate power before making mechanical adjustments.",
      },
      {
        ...resource(
          "wiring",
          "Control system & wiring reference",
          "Electrical",
          "Wiring",
          "Official control system documentation, plus your team’s port map.",
          "https://ftc-docs.firstinspires.org/en/latest/",
          true,
        ),
        demo: false,
      },
      {
        ...resource(
          "local-first",
          "FIRST Delaware · local program hub",
          "Delaware",
          "Guide",
          "Find the local FTC program and verify current event information with the organizer.",
          "https://firstdelaware.org/first-tech-challenge",
        ),
        demo: false,
      },
      {
        ...resource(
          "maker",
          "University of Delaware MakerSpace",
          "Delaware",
          "Guide",
          "Explore the official makerspace page. Access, youth participation, and availability must be confirmed with UD.",
          "https://www.udel.edu/research-innovation/maker/spaces/makerspace/",
        ),
        demo: false,
      },
      {
        ...resource(
          "fundraising",
          "FIRST team management resources",
          "Fundraising",
          "Guide",
          "Official starting points for organizing a team and fundraising.",
          "https://www.firstinspires.org/resources/library/ftc/team-management-resources",
          true,
        ),
        demo: false,
      },
    ],
    announcements: [
      {
        ...base,
        id: "announcement-1",
        title: "Test it. Log it. Learn from it.",
        body: "For this build night, add one result to the engineering log before you pack up. A quick note today is a better handoff tomorrow.",
        author: "Jordan · student lead",
        date: dateKey(),
        type: "Update",
      },
      {
        ...base,
        id: "announcement-2",
        title: "Intake v2 is our next prototype",
        body: "We’ll test the wider roller spacing before making more design changes. Find the test plan in Robot & resources.",
        author: "Mechanical team",
        date: offsetDate(-1),
        type: "Decision",
      },
    ],
    onboarding: ["team"],
    pitChecklist: ["battery-tools"],
    pitNotes: [],
    skills: [],
    robot: {
      purpose:
        "A modular student-built robot. These are sample handoff notes — replace them with your team’s robot.",
      cad: "",
      code: "https://github.com/FIRST-Tech-Challenge/FtcRobotController",
      wiring: "",
      setup:
        "Check fasteners and wiring with a mentor. Keep the robot safely supported before testing. Follow official inspection requirements.",
      test: "Write a repeatable test, record results, and change one variable at a time.",
      issues: "Demo: intake roller clearance needs another measurement.",
      repairs:
        "Demo: document the fasteners and tools needed to remove the intake.",
    },
    coachInstructions:
      "Ask your coach to add your team’s event-day contact and emergency meeting instructions here. Avoid personal student contact information.",
  };
}
