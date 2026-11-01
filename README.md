# MyFTCSpace

A signed-in FTC team workspace for real team records. The interface uses system typography, white and gray surfaces, and blue actions. Release version: 1.0.0.

## Team use

1. Open the site and choose **Continue with ChatGPT**. The server renders the login screen for anonymous visitors. Signed-in users choose a team; a single existing team reopens automatically. The former `/demo` URL redirects to this official entry point.
2. Create a private team with a display alias (first name and last initial), or join using a one-use invitation code.
3. An admin invites students, student leads, and mentors. Invitations expire in 48 hours. Roles are assigned by the admin and enforced by the server.
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
- Recovery: shared D1 records, versioned writes, automatic merging of independent edits, conflict protection, saved revisions, admin-only shared backup import with scope remapping and approval reset, and private JSON backups.
- Official setup: clean teams with empty task/event/funding/evidence records and scoped public reference links; no fictional members, robot notes, announcements, or sample tasks. The empty workbench opens the first-task form directly.
- Privacy & data help: a public `/privacy` page describes actual access, storage, revision retention, map requests, and team-admin assistance.

## Privacy model

The login and privacy-information pages are public. Team data requires ChatGPT identity plus a membership check on every request. Platform-injected user IDs identify accounts; emails and full profile names are not stored in the team roster. Membership aliases are visible to teammates.

Student responses exclude sponsor contact records, private grants, private/unapproved resources and other students' private/unapproved evidence. Students may update assigned tasks, append comments, RSVP, record personal learning progress, add pit notes, prepare the pit checklist and manage their own evidence. Leads manage team work; mentors/admins approve external use and skills; only admins manage membership/invitations and restore revisions.

D1 stores team-scoped records and revision snapshots. R2 stores private evidence files. Downloads require current membership plus evidence visibility checks, are not cacheable, and are served as attachments. File uploads accept PNG/JPEG/WebP/PDF/MP4 under 12 MB with content-signature checks. Evidence starts private. External-use approval requires consent and a consent reference; edits invalidate approval. Nothing is publicly published by changing visibility. External source links retain the linked provider's permissions: use school-approved private sharing.

Use aliases rather than full student names. Keep student emails, emergency contacts, medical information and signed consent forms in the school's approved systems. Store only a consent reference and scope here. Admins can revoke members and unused invitations. Removed records remain recoverable in revision history; this release does not claim permanent erasure or a compliance certification.

Shared records are not copied into browser localStorage. Only the last selected team ID is stored as a preference. An open tab holds its authorized records in memory; unsaved changes require a successful server save and a warning protects accidental tab closure. Full offline reload and email/push reminder delivery are not implemented; the UI describes in-app reminders explicitly.

The signed-in root checks identity on the server before loading the workspace client. A client access gate waits for the session and membership check before showing private screens. The former `/demo` route permanently redirects to `/`; production pages never open a sample workspace. Sign-in/out use the platform-owned top-level routes; the app does not collect or store passwords. The Account menu exposes sign-out and team settings. Sign-out links block navigation while changes remain unsaved.

Active teams recheck identity and membership every five seconds and when the tab is focused, restored, or becomes visible. Sign-out, account switching, and revoked membership clear private records from the tab and return to login/team selection; role changes reload server-filtered records even if a draft is pending. Each save rechecks identity and includes the preparing account ID; the server rejects a mismatched account. Server authorization remains authoritative on every API operation. These checks do not claim instantaneous removal from an offline device.

Delayed reads and saves carry an access-generation check so older responses cannot restore records after account, membership, role, or team changes. Reload and save operations are serialized; newly edited drafts are preserved rather than silently discarded by an older reload.

JSON requests are limited while streaming to 2,000,000 UTF-8 bytes; uploads to 12 MiB, including requests without Content-Length. Skill sign-offs, shared restores, and backup imports recheck the actor's exact membership role in the atomic revision/data write. A permission change during an in-flight operation prevents the commit.

## Competition map

Schedule → Map uses locally bundled Leaflet 1.9.4 with attributed OpenStreetMap tiles. Six curated Delaware and southeastern Pennsylvania scrimmages/qualifiers were checked against their individual organizer pages on November 1, 2026. Venue coordinates come from organizer-linked venue maps or the PA organizer's public `data-venue` records. This is regional coverage, not a live nationwide event feed. Past events are hidden; checks older than 30 days are marked for review. Registration deadlines use the organizer's stated cutoff and do not imply space remains available.

Students can use county starting points or explicitly request browser geolocation, filter by radius/text/source, select numbered pins or equivalent list buttons, inspect source/date/registration information, and open directions. Geolocation is rounded to two decimals and retained only in component memory. OpenStreetMap receives the viewed tile area and normal network metadata; the interface discloses this. No address is automatically sent to a geocoder. Tile failures retain the complete results list.

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

Node >=22.13 (Node 26 tested), npm, Git and tar are required. Run `npm run install:ci`, `npm run dev`, `npm run check`, `npm test`, and `npm run build`. The retained Sites Vinext/Cloudflare integration owns building and dispatch authentication. Never implement the reserved sign-in/callback routes in the app.

The portable preview uses the starter's loopback-only mock sign-in. Production authentication is dispatch-owned; no mock identity is included in production. `.openai/hosting.json` retains the existing Site ID and declares D1 `DB` and R2 `BUCKET`. Drizzle schema/migrations are tracked; production publication applies migrations. Local migrations and production data are separate. See the Sites skill's migration commands when initializing a local database.

`src/screens/` contains app screens; it deliberately avoids Next's `pages/` reserved directory. `app/api/[...segments]/route.ts` obtains trusted identity and delegates to `server/service.ts`. `server/policy.ts` performs filtering, authorization, validation and conflict merging. No source tokens, auth secrets or private records belong in Git.

## Verification status

Automated checks exercise the actual server service with SQLite-backed D1 operations and multiple independent account identities, including membership boundaries, cross-account saves, role escalation, conflicts, comments, approvals, private files, personal progress and recovery. Map checks cover coordinate validation/round trips, distance and date/text/radius filtering, stale source checks, opening actual team records, opt-in location with denied-permission fallback, and event form persistence. Login checks cover anonymous/team-setup gates, private storage boundaries, cross-tab sign-out, revocation, account changes, role reduction, expired-session saves, stale response races, and rejection of a save prepared by another account. Official team creation is checked for clean records and real author attribution. These are not a substitute for two real hosted ChatGPT accounts on two devices.

A browser walkthrough verified local sign-in, private team creation, shared task creation and a confirmed server revision. Desktop and 400px mobile-emulated workbench, task form, team setup and evidence form layouts were visually reviewed. Phone navigation uses a native section picker, and the primary task action remains reachable. Hosted anonymous/authenticated routing and rejection of forged identity headers were verified. Real second-account/device acceptance and assistive-technology testing must be recorded before awarding a certified 100/100 or calling this ready for team use.

This release received a desktop browser review of the signed-in workbench, upcoming schedule, rendered map tiles/pins, and selection of sourced event details. The schedule and map controls were reviewed at a 400px phone width. A fresh browser load showed no console errors. Real-device geolocation permission behavior, a full assistive-technology pass, and the user's two-account acceptance result remain unverified.

Next, Sharp, React/RSC, the retained Vinext runtime, Vite, and the runtime archive decoder were updated to supported patched versions. The stable Vinext release preserves the Sites worker's fetch-handler interface. `npm audit --omit=dev` reports no known production dependency vulnerabilities at the release check; runtime framework dependencies declared under devDependencies were also reviewed and patched. Remaining findings in local build/test tooling are not covered by that production-only result. This is a dependency check, not a claim that all application security risks have been eliminated.
