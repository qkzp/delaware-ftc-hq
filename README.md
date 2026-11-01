# MyFTCSpace

A private FTC team workspace with an anonymous browser-local demo. The interface uses system typography, white and gray surfaces, and blue actions.

## Team use

1. Open Workspace settings and sign in with ChatGPT using a normal top-level sign-in link.
2. Create a private team with a display alias (first name and last initial), or join using a one-use invitation code.
3. An admin invites students, student leads, and mentors. Invitations expire in 48 hours. Roles are checked by the server; demo role switching never changes a shared membership.
4. Add tasks, events, robot notes, parts, funding records, and evidence. Watch the sync status before closing a tab.
5. Mentors review evidence/consent and sign off rookie skills. Admins manage membership and restore saved revisions. To migrate an existing browser workspace, export its JSON backup, open the shared team, then import it in Settings after reviewing the replacement warning.

## Features

- Student workbench: personal next task, due dates, priority, explicit and dependency blockers, upcoming events, in-app reminders, task and resource shortcuts.
- Build tracking: owners, work areas, named robot subsystems, priority, status, effort, completion criteria, dependency-cycle checks, task comments, build sessions and optional focus timer.
- Schedule: upcoming agenda across months, month/season views, date/time/location/agenda/owner, registration deadlines, personal RSVPs, calendar imports/exports, and separate team-created/source-review/mentor-verified states. Imports never automatically verify an event.
- Funding: sponsor contacts, county filters, owners, relationship history, follow-ups, requested/confirmed support, recognition restrictions and mentor-approved message drafts; grants include eligibility, source, check date, deadlines, application steps, owner and manual status tracking. No email or application is sent.
- Robot knowledge: searchable/filterable CAD, code, wiring, build logs, official resources, troubleshooting and startup notes, resource archive and a searchable parts/spares list.
- Evidence: outreach and engineering records, county, date, owner, impact, measured reach and method, award links, consent scope/reference, review receipt, private attachments, archive, and a mentor-only export of evidence approved for external use. The export is an editable Markdown evidence draft, not a validated portfolio PDF.
- Delaware: sourced New Castle, Kent, Sussex and statewide resources. Check dates and access caveats are visible. Conflicting event dates remain unverified. Grant eligibility is not assumed for a team.
- Rookie path: first three meetings, glossary, beginner links, first task, per-member progress and mentor skill sign-offs.
- Collaboration: authenticated members, server-side roles, per-member RSVPs/progress, comments, team announcements, in-app due reminders, approval and source-review receipts.
- Recovery: shared D1 records, versioned writes, automatic merging of independent edits, conflict protection, saved revisions, admin-only shared backup import with scope remapping and approval reset, private JSON backups and corruption-safe recovery for the separate local demo.

## Privacy model

The app URL and anonymous demo remain public. Real team data requires ChatGPT identity plus a membership check on every request. Platform-injected user IDs identify accounts; emails and full profile names are not stored in the team roster. Membership aliases are visible to teammates.

Student responses exclude sponsor contact records, private grants, private/unapproved resources and other students' private/unapproved evidence. Students may update assigned tasks, append comments, RSVP, record personal learning progress, add pit notes, prepare the pit checklist and manage their own evidence. Leads manage team work; mentors/admins approve external use and skills; only admins manage membership/invitations and restore revisions.

D1 stores team-scoped records and revision snapshots. R2 stores private evidence files. Downloads require current membership plus evidence visibility checks, are not cacheable, and are served as attachments. File uploads accept PNG/JPEG/WebP/PDF/MP4 under 12 MB with content-signature checks. Evidence starts private. External-use approval requires consent and a consent reference; edits invalidate approval. Nothing is publicly published by changing visibility. External source links retain the linked provider's permissions: use school-approved private sharing.

Use aliases rather than full student names. Keep student emails, emergency contacts, medical information and signed consent forms in the school's approved systems. Store only a consent reference and scope here. Admins can revoke members and unused invitations. Removed records remain recoverable in revision history; this release does not claim permanent erasure or a compliance certification.

Shared records are not copied into browser localStorage. Only the last selected team ID is stored as a preference. An open tab holds its authorized records in memory; unsaved changes require a successful server save and a warning protects accidental tab closure. Full offline reload and email/push reminder delivery are not implemented; the UI describes in-app reminders explicitly.

## Sources

Official and local directory entries were checked on October 31, 2026. Recheck sources before relying on dates, eligibility, access or current competition rules.

- [BIOBUZZ TU07 competition manual](https://ftc-resources.firstinspires.org/ftc/game/cm-html/BIOBUZZ%20Competition%20Manual%20-%20TU07.htm)
- [FTC outreach definitions](https://info.firstinspires.org/hubfs/web/program/ftc/outreach-terms-and-definitions.pdf)
- [FTC documentation](https://ftc-docs.firstinspires.org/en/latest/)
- [FIRST Delaware events](https://firstdelaware.org/events) ? source conflicts are explicitly marked; no directory date is seeded as a verified competition.
- [FIRST grant opportunities](https://www.firstinspires.org/programs/team-grant-opportunities)
- [UD MakerSpace](https://www.udel.edu/research-innovation/maker/spaces/makerspace/) ? youth access requires confirmation.
- [Kent County libraries](https://www.kentcountyde.gov/Residents/Library-Services)
- [Lewes library technology](https://lewes.lib.de.us/services/technology/)

## Development

Node >=22.13 (Node 26 tested), npm, Git and tar are required. Run `npm run install:ci`, `npm run dev`, `npm run check`, `npm test`, and `npm run build`. The retained Sites Vinext/Cloudflare integration owns building and dispatch authentication. Never implement the reserved sign-in/callback routes in the app.

The portable preview uses the starter's loopback-only mock sign-in. Production authentication is dispatch-owned; no mock identity is included in production. `.openai/hosting.json` retains the existing Site ID and declares D1 `DB` and R2 `BUCKET`. Drizzle schema/migrations are tracked; production publication applies migrations. Local migrations and production data are separate. See the Sites skill's migration commands when initializing a local database.

`src/screens/` contains app screens; it deliberately avoids Next's `pages/` reserved directory. `app/api/[...segments]/route.ts` obtains trusted identity and delegates to `server/service.ts`. `server/policy.ts` performs filtering, authorization, validation and conflict merging. No source tokens, auth secrets or private records belong in Git.

## Verification status

TypeScript and 52 automated checks pass. Tests exercise the actual server service with SQLite-backed D1 operations and multiple independent account identities, including membership boundaries, cross-account saves, role escalation, conflicts, comments, approvals, private files, personal progress and recovery. These are not a substitute for two real hosted ChatGPT accounts on two devices.

A browser walkthrough verified local sign-in, private team creation, shared task creation and a confirmed server revision. Desktop and 400px mobile-emulated workbench, task form, team setup and evidence form layouts were visually reviewed. Phone navigation uses a native section picker, and the primary task action remains reachable. Hosted anonymous/authenticated routing and rejection of forged identity headers were verified. Real second-account/device acceptance and assistive-technology testing must be recorded before awarding a certified 100/100 or calling this ready for team use.
