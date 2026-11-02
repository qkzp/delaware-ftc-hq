# MyFTCSpace

A private FTC team workspace initially intended for Delaware schools and other organizations, with coach/mentor oversight and team-lead support. The intended future scope is the United States; additional states and organizations need review before onboarding. Release version: 1.1.0. Production real-data access defaults closed until the exact release and its teams have the required recorded review.

The interface follows the compact light layouts in Linear, Notion and Slack: a quiet sidebar, grouped task rows with an inspector, document lists and conversation panes. Screens use system typography, white surfaces, thin dividers and restrained controls. See [the UI design references and notes](docs/ui-redesign.md).

## Official release review

The supplied 43-row checklist is mapped in [the release evidence packet](docs/release-evidence.md). [The generated field inventory](docs/data-inventory.json) covers the actual app/schema fields and explicit external flows. Named adult/organization ownership, monitored support/privacy contacts, school/legal/vendor decisions, consent materials and hosted/manual acceptance remain pending; this source does not claim approval or compliance certification.

Production requires the operator-managed `MYFTC_READINESS_RECORD` runtime secret, `MYFTC_DATA_ENABLED=true`, exact source fingerprint/origin, current approval and approved account/adult/team lists. `MYFTC_SERVICE_PAUSED=true` closes normal access while narrowly authorized rights/cleanup APIs remain available. The intentionally incomplete `config/readiness.example.json` is a template, never approval. See the evidence packet for setup, retention, incident/rollback, moderation and change control.

## Team use

1. On an approved release, choose a configured **Google**, **Microsoft**, **Apple**, or **email link** sign-in method. Unapproved or paused releases show the review hold. Approved signed-in users choose a team; a single existing team reopens automatically. The former `/demo` URL redirects to this entry point.
2. An approved adult creates a reviewed private team using a preapproved team slot and display alias, or an approved account joins using a one-use invitation code. Another school or team must receive its own scope review before real data is accepted.
3. An admin invites students, student leads, and mentors. Invitations expire in 48 hours. Roles are assigned by the admin and enforced by the server.
4. Add tasks, events, robot notes, parts, funding records, and evidence. Watch the sync status before closing a tab.
5. Mentors review evidence/consent and sign off rookie skills. Admins manage membership and restore saved revisions. To migrate an existing browser workspace, export its JSON backup, open the shared team, then import it in Settings after reviewing the replacement warning.

## Features

- Team hub: workstream task conversations with per-task reply drafts, a shared team brief, searchable updates/decisions, actual posted activity, next-meeting context and resource shortcuts. Drafts survive section navigation in tab memory and clear on account/team/season/role changes.
- Planning: Tasks now includes a Plan view with owner workloads and overdue/blocked/upcoming/undated work, linking to the existing safe editor and focus session. Counts describe assigned tasks, not measured individual capacity.
- Knowledge spaces: category-organized resources, owner/source search, sorting, audience/provider metadata and Needs review/Reviewed filters with a mentor review queue.
- Guided help: a Help desk for sync, invitation, evidence and access issues, an explicit read-only session check, private support summaries and coach/mentor escalation. See [the product-pattern mapping](docs/product-patterns.md) for how the requested reference products informed these workflows.
- Student workbench: personal next task, due dates, priority, explicit and dependency blockers, upcoming events, in-app reminders, task and resource shortcuts.
- Build tracking: owners, work areas, named robot subsystems, priority, status, effort, completion criteria, dependency-cycle checks, task comments, build sessions and optional focus timer.
- Schedule: upcoming agenda across months, month/season views, date/time/location/agenda/owner, registration deadlines, personal RSVPs, calendar imports/exports, and separate team-created/source-review/mentor-verified states. Imports never automatically verify an event.
- Funding: sponsor contacts, county filters, owners, relationship history, follow-ups, requested/confirmed support, recognition restrictions and mentor-approved message drafts; grants include eligibility, source, check date, deadlines, application steps, owner and manual status tracking. No sponsor outreach email or grant application is sent.
- Robot knowledge: searchable/filterable CAD, code, wiring, build logs, official resources, troubleshooting and startup notes, resource archive and a searchable parts/spares list.
- Evidence: outreach and engineering records, county, date, owner, impact, measured reach and method, award links, consent scope/reference, review receipt, private attachments, archive, and a mentor-only export of evidence approved for external use. The export is an editable Markdown evidence draft, not a validated portfolio PDF.
- Delaware: sourced New Castle, Kent, Sussex and statewide resources. Check dates and access caveats are visible. Conflicting event dates remain unverified. Grant eligibility is not assumed for a team.
- Rookie path: first three meetings, glossary, beginner links, first task, per-member progress and mentor skill sign-offs.
- Collaboration: authenticated members, server-side roles, per-member RSVPs/progress, comments, team announcements, in-app due reminders, approval and source-review receipts.
- Recovery: shared D1 records, versioned writes, automatic merging of independent edits, conflict protection, saved revisions, admin-only shared backup import with scope remapping and approval reset, and private JSON backups.
- Official setup: clean teams with empty task/event/funding/evidence records and scoped public reference links; no fictional members, robot notes, announcements, or sample tasks. The empty workbench opens the first-task form directly.
- Privacy & data help: `/privacy` describes actual access, storage, consent, retention, maps and rights routes. Settings supports private requests and coach/mentor review, disabled-by-default uploads, team pause, evidence withdrawal, team erasure and recoverable cleanup receipts.

- Team messages: group chat and optional participant-only DMs, per-user blocking, explicit safety reports, multiple reviewed adult operators, and 1?30-day retention. DMs default off.
- Awards: shared, sourced deadlines with time zones, submission state, mentor review and configurable advance reminders; students and adults see the same dates.
- Reminders: configurable grant lead times, four-day unanswered first-email sponsorship follow-ups, recurring robot maintenance and calendar snapshot export. No sponsor outreach is sent and no inbox is read.
- Robot engineering: saved robot/season profiles, per-motor CSV/manual test history, device-linked measured PID models, positional/continuous servo calibration and mechanism presets, side-by-side drivetrain comparisons, draggable/keyboard waypoints and conservative obstacle screening. Public tools stay in tab memory; approved team profiles/tests save to D1.
- Robot Lab: shared motor/servo tracking (model, purpose, ports, RPM, encoder/gearing and servo type/speed/torque), tracker-based drivetrain estimates, a multi-stage wheel RPM/speed calculator for gears, chains/sprockets and belts/pulleys, public local CSV motor-model training, simulated PID search, route preview and disabled Java scaffold export at `/robot-lab`. Real telemetry and hardware validation are required.

See [provider setup](docs/provider-setup.md) for Apple/email credentials, database migration and scheduled cleanup requirements.

## Privacy model

The review hold, approved login and privacy-information pages contain no team records. Team data requires the release/roster checks, an approved provider-scoped identity and current membership/role checks. Provider-scoped account IDs identify accounts; sign-in emails and full profile names are not copied into team membership rows. Membership aliases are visible to teammates.

Student responses exclude sponsor contact records, private grants, private/unapproved resources and other students' private/unapproved evidence. Students may update assigned tasks, append comments, RSVP, record personal learning progress, add pit notes, prepare the pit checklist and manage their own evidence. Leads manage team work; mentors/admins approve external use and skills; only admins manage membership/invitations and restore revisions.

D1 stores team-scoped records and bounded revisions. R2 stores private evidence files. Students can download only the current attached file of approved visible evidence; owner/managing-role draft/history access remains private. Downloads are noncacheable attachments. Uploads default disabled and accept PNG/JPEG/WebP/PDF/MP4 up to 12 MiB with signature checks after saved collection consent and a server-issued mentor/admin review. Content checks do not scan malware. External-use approval is separate; relevant edits invalidate review. Nothing is published by changing visibility. External links retain their provider's permissions.

Use aliases rather than full student names. Keep student emails, emergency contacts, medical information and signed releases in school-approved systems; store only safe consent references and scope. Routine record removal remains recoverable within bounded revisions. Explicit permanent evidence withdrawal scrubs current/revision evidence and associated stored files; admin team erasure removes application records and files. Failed cleanup remains inaccessible and retryable. Provider logs/backups, exports and linked copies require separate verified handling. Minimal cleanup tombstones prevent resurrection and need an approved retention decision.

Shared records are not copied into browser localStorage. The selected team ID and non-sensitive display/view preferences are stored separately from records. Theme, relative text size, motion and task/calendar/sponsor views persist across updates; account changes still clear the selected team. Public static assets are cached, while the service worker excludes HTML pages, sessions, APIs and private files. An open tab holds its authorized records in memory; unsaved changes require a successful server save and a warning protects accidental tab closure. Full offline reload and email/push reminder delivery are not implemented; the UI describes in-app reminders explicitly.

The signed-in root checks identity on the server before loading the workspace client. A client access gate waits for the session and membership check before showing private screens. The former `/demo` route permanently redirects to `/`; production pages never open a sample workspace. Sign-in/out use the platform-owned top-level routes; the app does not collect or store passwords. The Account menu exposes sign-out and team settings. Sign-out links block navigation while changes remain unsaved.

Active teams recheck identity and membership every five seconds and when the tab is focused, restored, or becomes visible. Sign-out, account switching, and revoked membership clear private records from the tab and return to login/team selection; role changes reload server-filtered records even if a draft is pending. Each save rechecks identity and includes the preparing account ID; the server rejects a mismatched account. Server authorization remains authoritative on every API operation. These checks do not claim instantaneous removal from an offline device.

Delayed reads and saves carry an access-generation check so older responses cannot restore records after account, membership, role, or team changes. Reload and save operations are serialized; newly edited drafts are preserved rather than silently discarded by an older reload.

JSON requests are limited while streaming to 2,000,000 UTF-8 bytes; uploads to 12 MiB, including requests without Content-Length. Skill sign-offs, shared restores, and backup imports recheck the actor's exact membership role in the atomic revision/data write. A permission change during an in-flight operation prevents the commit.

## Competition map

Schedule → Map uses locally bundled Leaflet 1.9.4 with attributed OpenStreetMap tiles. Six curated Delaware and southeastern Pennsylvania scrimmages/qualifiers were checked against their individual organizer pages on November 1, 2026. Venue coordinates come from organizer-linked venue maps or the PA organizer's public `data-venue` records. This is regional coverage, not a live nationwide event feed. Past events are hidden; checks older than 30 days are marked for review. Registration deadlines use the organizer's stated cutoff and do not imply space remains available.

Students use county starting points, filter by radius/text/source, select numbered pins or equivalent list buttons, inspect sources/dates and open venue directions. Device geolocation is disabled in shared student workspaces and by production browser policy. Tiles start off; an opt-in explains that OpenStreetMap receives the viewed venue area and normal network metadata. The complete event list works without tiles. No address is sent to a geocoder.

Leads can review an organizer listing before adding it to the team schedule. Imported listings need mentor verification. Existing real team competitions appear when both venue coordinates are valid; unmapped competitions remain accessible in a separate list. Coordinates are validated during import/save on client and server, and venue changes invalidate prior verification. Demo events never become real map pins. Team event coordinates stay within the existing private workspace permissions.

## Sources

Official and local directory entries were checked on October 31, 2026. Recheck sources before relying on dates, eligibility, access or current competition rules.

- [BIOBUZZ TU07 competition manual](https://ftc-resources.firstinspires.org/ftc/game/cm-html/BIOBUZZ%20Competition%20Manual%20-%20TU07.htm)
- [FTC outreach definitions](https://info.firstinspires.org/hubfs/web/program/ftc/outreach-terms-and-definitions.pdf)
- [FTC documentation](https://ftc-docs.firstinspires.org/en/latest/)
- [FIRST Delaware events](https://firstdelaware.org/events) — calendar records are never automatically mentor-verified. The map's reviewed subset links individual current BIOBUZZ event pages.
- [Pennsylvania FTC events](https://www.ftcpenn.org/ftc-events) — individual organizer pages provide the map's PA event dates, venues, and registration cutoffs.
- [FIRST grant opportunities](https://www.firstinspires.org/programs/team-grant-opportunities)
- [UD MakerSpace](https://www.udel.edu/research-innovation/maker/spaces/makerspace/) ? youth access requires confirmation.
- [Kent County libraries](https://www.kentcountyde.gov/Residents/Library-Services)
- [Lewes library technology](https://lewes.lib.de.us/services/technology/)

## Development

Node >=22.13, npm and Git are required. Run `npm ci`, `npm run dev`, `npm run check`, and `npm run build`. This release targets Vercel with the Next.js runtime and Auth.js Google/Microsoft/Apple or email-link sign-in. Configure the callbacks, Vercel environment variables, Cloudflare D1 API and private R2 S3 credentials as described in [the Vercel deployment guide](docs/vercel-deployment.md).

Production sign-in supports Google, Microsoft and Apple OAuth and email links, backed by encrypted Auth.js sessions. No mock identity is included in production. Vercel hosts the app; Cloudflare D1 and private R2 continue to hold shared data. The Vercel Functions connect to them using server-only credentials. Drizzle schema/migrations are tracked; confirm migrations against the target D1 database before release.

`src/screens/` contains app screens; it deliberately avoids Next's `pages/` reserved directory. `app/api/[...segments]/route.ts` obtains trusted identity and delegates to `server/service.ts`. `server/policy.ts` performs filtering, authorization, validation and conflict merging. No source tokens, auth secrets or private records belong in Git.

## Verification status

On November 2, 2026, all 214 automated tests passed; TypeScript, the Next.js production build, release fingerprint, 399-field inventory, and `npm audit` also passed (zero known dependency vulnerabilities). A local production-mode HTTP smoke check confirmed the public welcome page, privacy page, enrollment setup message, maintenance entry, session gate, and security headers. Isolated Chromium simulations also passed rendered contrast/semantics, mobile/tablet/desktop reflow, 200%/400% reflow equivalents and keyboard checks with fictional records. Light/dark themes, 200% text, minimum touch targets, duplicate actions, preference reloads, first-use screens, technical-error redaction and simulated keyboard viewports are also covered. An actual screen-reader review, physical phone keyboards, real devices and hosted provider flows remain outstanding.

The GitHub remote is `https://github.com/qkzp/delaware-ftc-hq.git` and its listed website is `https://delaware-ftc-hq.vercel.app`. The GitHub Vercel status reported success for the existing main commit on November 2, 2026. This workspace has no local Vercel project link or OAuth/Cloudflare credentials; provider configuration and real data flows are not verified by that deployment status. Hosted two-account/device acceptance, phone/tablet/desktop, zoom/contrast and screen-reader review, vendor deletion/backup attestations and signed approvals remain outstanding. The release fingerprint is generated in `server/release-manifest.json` by `npm run build`.

## Release operations

`npm run db:rehearse` applies the tracked migrations only to a fresh in-memory SQLite database. `npm run release:preflight` reports local configuration presence, release fingerprints and public hosted checks without printing secrets; `--database` adds read-only D1 schema metadata checks when credentials are available. It never applies production migrations or approves a release. See [launch acceptance](docs/launch-acceptance.md). `/api/deployment/status` exposes configuration/gate flags, the source fingerprint and changed build-source paths.

Each team can set monitored support/privacy addresses in Workspace settings. Adult mentor/admin permissions protect updates; current members can read those contacts through authorized privacy maintenance even while ordinary access is paused. Platform identity and public monitored contacts remain a separate required operator responsibility.

## Product UI refresh

The landing page and shared application surfaces now use an original Apple-inspired product style: centered typography, an original robot/route illustration, neutral light/dark surfaces and a blue accent. The workspace has an anchored product header, grouped navigation and real task/event/preparation summaries. The same design covers Robot Lab, conversations, planning, funding, settings and account entry. References: [Apple](https://www.apple.com/), [Notion](https://www.notion.com/product), [Linear](https://linear.app/). Existing role boundaries, display preferences and release gates remain in effect.

Wheel speed includes an editable speed-target warning and an optional illustrative 100% load thermal model with two-setup comparison, threshold-crossing markers, accessible chart values and JSON export. Default temperatures and thermal parameters are examples, not motor-specific ratings or a verified cutoff. See [thermal model](docs/thermal-model.md).
