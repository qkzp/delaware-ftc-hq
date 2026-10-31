# MyFTCSpae

A working season workspace built with React 19, TypeScript, Vite, and Lucide. The interface uses a top-down robot emblem, a paper-and-ink palette with restrained orange, clear team language, and a work-first layout. This project is not affiliated with FIRST and does not use another team-management product’s code or design.

## Run it

Requires a current Node.js LTS release and npm.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite. `npm run build` checks TypeScript and creates `dist/`; `npm run preview` serves that production build. `npm test` runs data-integrity and React workflow tests without a browser.

## Start with your team

1. Explore the clearly labeled Circuit Breakers demo. The role selector at the top right previews Student, Student lead, Mentor/coach, and Team admin experiences.
2. Open **Workspace settings** using the header settings button, select **Team admin**, export a backup if needed, then select **Start fresh**. This removes sample records and retains sourced learning links.
3. Add your team name, county, season label, first build meeting, and a few tasks with clear finish lines. Add your real robot CAD/code links in **Robot & resources → Robot quick reference**.
4. Let a new student open **New member checklist**, find a beginner guide, and claim a first assignment.
5. Export backups to school-approved private storage regularly. Use a separate browser profile or import a team backup to work with another team. Records carry team and season IDs; this MVP operates on one active team/season at a time.

## What works

- **The workbench:** a real-event season line; a focused next-assignment sheet; a clickable Mechanical/Programming/Electrical map that filters the work queue; actual event-kit checklist ticks; direct CAD/code/build-log links; and permission-aware follow-up handoffs. The diagram describes tracked work, not live robot telemetry.
- **Build sessions:** open a real assignment, keep its definition of done visible, run an optional 10/20/45-minute focus block, append a build note to the task, and deliberately finish it. Dependencies and ownership are enforced, completion supports undo, and unsaved notes trigger a close warning. The timer runs only while the session is open and never completes tasks automatically.

- **Student home:** next actions, task completion with undo, actual checklist-derived readiness, next team event/countdown, coming meetings, season task progress, and team announcements/decisions. Home actions and global search open the exact matching task, event, resource, sponsor, or grant record.
- **Tasks:** board/list views; search and work-area/status/owner filters; create/edit; assignees, dates, priorities, effort, dependencies, definition of done, linked resources, build notes, and comments. Dependencies block premature completion and cycles. Students can update their own tasks.
- **Calendar:** month, agenda, and season timeline; create/edit/delete; RSVP; owners, agendas, locations, notes; meeting templates; weekly meetings generated for eight occurrences; CSV/ICS import with preview, validation, and duplicate skipping; ICS export. Imports use explicit Delaware/Eastern time handling and reject unsupported timezones.
- **Sponsor outreach:** table/board, all three Delaware counties plus statewide filtering, duplicate detection, visible contacted Yes/No, follow-up due filter, private relationship records and history, requested/confirmed support, recognition restrictions, and thank-you status. Drafts require mentor/admin approval; there is no sending mechanism.
- **Grant tracker:** source and verification fields, eligibility/rookie/county/status filters, internal and official deadlines, owners, application checklists, documents, manual reminder plans, stale-source flags, and application status through Submitted/Awarded. Changing status records what the team did elsewhere; it does not submit an application.
- **Resource/build library:** search and skill/type/category filters, sourced links, team build logs, safe external URLs, text/Markdown note imports, note exports, private-first records, mentor approval for public use, and editable robot CAD/code/wiring/setup/test/repair notes. Public-use approval prepares a record for future publishing; nothing is published.
- **Rookie path:** persistent steps, a concrete starter task, encouraging skills passport, and mentor sign-offs.
- **Competition mode:** a 12-item readiness checklist, coach instructions, fast robot/match/scouting notes, recap export, and explicit local/offline status.
- **Workspace:** team details, permission previews, JSON backup/restore, explicit destructive-action confirmation, and corruption-safe recovery. Invalid saved data is preserved rather than overwritten by demo data.

## UI/UX decisions

The principles shape the flows, not just the colors:

| Principle                                                          | Implementation                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Hick’s Law](https://lawsofux.com/hicks-law/)                      | The home screen emphasizes the next task and event. Main workspace navigation is separated from toolkit actions. Detailed editing, dependencies, and source fields appear when needed.                                    |
| [Fitts’s Law](https://lawsofux.com/fittss-law/)                    | Main actions are near the work they affect. Mobile controls use 44px targets, with larger checkbox hit areas and spacing.                                                                                                 |
| [Law of Proximity](https://lawsofux.com/law-of-proximity/)         | Owner, finish line, due date, and status travel together. Source/verification information stays next to the corresponding opportunity.                                                                                    |
| Jakob’s Law / consistency                                          | Persistent horizontal navigation, board/list views, predictable search/filter controls, shared forms, and consistent primary/secondary actions reduce relearning.                                                         |
| [Goal-gradient effect](https://lawsofux.com/goal-gradient-effect/) | Rookie steps, actual task totals, application checklists, and pit readiness show real progress. No competitive student rankings.                                                                                          |
| Recognition over recall                                            | Plain-language labels, visible definition-of-done text, resource links, persistent next actions, and a searchable workspace reduce memory demands.                                                                        |
| Immediate feedback and recovery                                    | Local state changes immediately, status toasts confirm actions, deletions support undo, duplicate records are blocked, and import preview prevents accidental bad data.                                                   |
| Accessible interaction                                             | Visible focus, skip link, semantic labels, live status messages, focus-trapped Escape-dismissable dialogs, reduced-motion support, stronger AA-oriented secondary-text palettes, and responsive agenda/checklist layouts. |

The production build and automated tests pass. Browser-control infrastructure could not reliably identify the browser URL, so final visual, keyboard, screen-reader, and device testing remains unverified. CSS contrast and target sizes were reviewed in source; this is not a claim of independently certified WCAG conformance.

## Demo records and trustworthy sources

All sample tasks, schedules, outreach organizations, team announcements, CAD handoff notes, and funding application workflows carry demo markers. Example partners are deliberately generic; they are not real sponsors or commitments. Sample application dates are internal practice targets, not verified grant deadlines. Demo event dates are generated relative to first launch and are not official competitions.

The real entries are links to official information, checked October 31, 2026:

- [FIRST Tech Challenge documentation](https://ftc-docs.firstinspires.org/en/latest/)
- [Official robot controller repository](https://github.com/FIRST-Tech-Challenge/FtcRobotController)
- [FIRST team management resources](https://www.firstinspires.org/resources/library/ftc/team-management-resources)
- [FIRST team grant directory](https://www.firstinspires.org/programs/team-grant-opportunities) — eligibility and deadlines must be checked for each listing.
- [FIRST Delaware’s FTC page](https://firstdelaware.org/first-tech-challenge) — verify event information with the organizer.
- [University of Delaware MakerSpace](https://www.udel.edu/research-innovation/maker/spaces/makerspace/) — access and youth participation require confirmation with UD; no partnership is implied.

There is no live FIRST integration, grant feed, automatic reminder service, email service, or cloud drive connection. Dates, sources, verification labels, and manually entered records are editable. Uploading in this MVP means importing text/Markdown notes or a calendar/backup; binary media storage and CAD hosting are deferred.

## Persistence, privacy, and a shared backend

`src/types.ts` defines the team/season-scoped model. `src/persistence.ts` is the storage boundary: `read`, `write`, validation, and explicit recovery. Data uses browser `localStorage` under `delaware-ftc-hq:v1`. Invalid original snapshots are protected and explicit recovery preserves their bytes under `delaware-ftc-hq:v1:recovery`.

**Role previews are interface demonstrations, not authentication or server authorization.** This local MVP is useful for non-sensitive planning on one device. Data is neither encrypted nor synced between teammates; someone with access to the browser profile or developer tools can inspect it. Do not store real student personal information or confidential financial/contact records until the shared backend is connected. The hosted app is public to anyone with its URL, while each visitor's records stay in their browser. The app itself never publishes team records or sends record data to an API. Barlow Condensed, IBM Plex Sans, and IBM Plex Mono are hosted with the app; their SIL Open Font licenses are in `public/fonts/`. There is no external font request at runtime. `node scripts/fetch-fonts.mjs` refreshes the official font assets if needed.

For shared school/team use, replace the local repository with an authenticated API while retaining the page model:

1. Add school-approved sign-in, server-verified memberships, and roles. Remove client-selectable demo roles outside demonstration mode.
2. Enforce team ID, season ID, record visibility, ownership, and mentor approvals on every API operation. A browser-side role check is not a security boundary.
3. Store records in a database with membership/row access policies; keep files in private object storage using short-lived authorized URLs. Audit external-use approval and skill sign-off actors/timestamps.
4. Add concurrency control, schema migrations, durable backups, and per-user identity instead of the demo’s `Alex (you)`.
5. Add permitted data integrations only after verifying their source, permission, and sync metadata. Keep sending, applications, and public publishing behind separate deliberate approved actions.

Offline behavior is limited to an already loaded tab: checklist and notes remain editable and save locally. A service worker and full offline reload support are not implemented.

## Next release

Authenticated multi-user/team sync, binary media and portfolio exports/public previews, vetted cross-team opportunity sharing, official event integrations, richer meeting/handoff archives, scheduled reminders, and season rollover are future work. The current season timeline and exports provide a practical manual handoff.
