# Release activation and acceptance

The GitHub/Vercel publication is running. Real-team activation still requires actual provider accounts, an accountable adult/organization, monitored contacts and accepted evidence for the exact source. No software check authenticates signatures or physical results. Keep `MYFTC_DATA_ENABLED=false` until those requirements are satisfied.

## Run the available checks

```powershell
npm run db:rehearse
npm run check
npm test
npm run test:accessibility:simulation
npm run build
npm run release:check
npm run release:preflight -- --output=../outputs/release-preflight.json
```

The preflight returns exit code 1 when technical prerequisites are missing. The report contains credential names/presence, schema metadata and status flags; it does not print credential values or raw provider errors. A closed release is an expected blocker until operator approval/configuration is completed. `--offline` skips hosted checks; `--origin=https://your-canonical-domain` chooses a different reviewed origin. `--database` performs read-only production schema checks when Cloudflare credentials are available in the process environment.

The source fingerprint normalizes line endings and Vercel configuration JSON formatting; configuration values and other source changes remain covered. Per-file hashes identify build-source differences.

The public `/api/deployment/status` endpoint returns the source fingerprint, changed build-source paths and coarse configuration/gate flags. It does not expose account IDs, team IDs, contacts, credentials, review evidence or database contents. A configured flag proves presence only, not successful sign-in, email delivery, provider permissions or legal acceptance.

## Configure and verify providers

Use [provider setup](provider-setup.md) for the exact private Vercel variable names and callback URLs. The accountable adult must create or control the provider applications and verified sending domain. Configure Vercel Production separately from Preview; previews must not receive the real-data enabled flag or production team records.

1. Supply the actual platform operator/organization and monitored public support/privacy addresses. Each team separately records its own monitored addresses in Workspace settings; only adult mentor/admin operators can change them. Team addresses are visible to current members and do not replace the platform contact. Assign a primary coach/mentor, backup adult operator and coverage for requests/incidents.
2. Configure the session secret, Google/Microsoft/Apple applications and Resend email sender as appropriate. Test every method that appears on `/signin`, including supported iCloud email delivery and Apple relay behavior. Record Apple client-secret expiration and rotation responsibility.
3. Use adult-controlled fictional test accounts. Obtain each provider-scoped identity from `/enroll`. Different methods are separate identities; matching email addresses do not transfer roles.
4. Confirm invite joining, multiple adult operators, revoked membership, sign-out and account switching. Verify that a student or unapproved adult cannot appoint an operator.

## Production database migration

The local rehearsal applies all tracked migrations to a fresh in-memory SQLite database, checks integrity and reports hashes plus expected schema. It never contacts production. This is not evidence that the live D1 database has been migrated.

The database administrator must identify the correct Production database, verify its migration history and make a recoverable backup before applying missing migrations. For an existing database, never blindly rerun the migration scripts. Apply only unapplied files in order through the approved Cloudflare workflow, including `0002_messaging_and_email.sql` for auth/chat, `0003_student_founder.sql` for student founders, and `0004_native_auth_handoff.sql` for iPhone sign-in. Record the database identifier privately, migration hashes, time, operator, backup reference and recovery procedure.

The optional preflight database check reads `sqlite_master` and `PRAGMA table_info`, comparing expected tables/index names, column types, nullability and primary-key metadata. It does not read team rows or apply migrations. Schema introspection is supported by [Cloudflare's D1 SQL documentation](https://developers.cloudflare.com/d1/sql-api/sql-statements/), using the [D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/). Index presence is not a full verification of index definitions, provider behavior or transactional workflows; retain live acceptance evidence.

After migration, use two separate fictional teams/accounts to verify:

- Team boundaries, student/lead/mentor/admin permissions and in-flight revocation.
- Group chat, participant-only DMs, disabled-DM behavior, blocking, explicit reports, removal and retention.
- Robot profiles/tests, servo presets, reminders, uploads, protected downloads, exports, evidence withdrawal and complete team erasure.
- D1 updates/conflicts/recovery and private R2 permissions. Verify that inaccessible/deleted files cannot be fetched through old URLs.
- The authenticated daily retention job actually runs in Vercel; unauthenticated requests must return 401. Verify cleanup outcomes with synthetic rows instead of relying only on a successful job status.

## Physical phone and assistive-technology acceptance

Record tester, device/browser/OS versions, build/deployment, date, result and any issue for each scenario. Browser simulations already cover themes, text scaling, touch targets and a resized visual viewport; they do not open a physical phone keyboard or run a real screen reader.

| Scenario | Required observation | Actual result / reviewer |
| --- | --- | --- |
| iPhone Safari: task form, chat composer, numeric calculator and long modal | Open the real keyboard; focused input/caret and action remain reachable; portrait/landscape, safe area and dismiss/reopen work | PENDING |
| Android Chrome: same forms | Keyboard resize/scroll preserves input and draft; native number/date/email inputs work | PENDING |
| Light, dark and device theme | Change theme repeatedly, navigate and reload; controls, text, graphs and focus remain readable | PENDING |
| System text size and browser zoom | Check 100%, 200% and 400% zoom/reflow as applicable; complete actual forms without losing content/actions | PENDING |
| VoiceOver / TalkBack / desktop screen reader | Navigate headings, labels, errors, dialog focus/close/return, reminders, editable routes and equivalent numeric inputs | PENDING |
| Rapid taps and slow/interrupted connection | Repeated taps do not duplicate an action; legitimate different actions work; drafts survive failures and errors remain actionable | PENDING |
| Cache update / stored preferences | New deployment loads current pages; appearance/view settings persist; no private page/API/file is retained by the app service worker | PENDING |
| First team / empty tools | Each route/tab offers a heading, explanation and appropriate next step; no blank page | PENDING |

## Installed SDK and robot acceptance

The responsible coach must record the real robot, dimensions, drivetrain, wheel/encoder conversions, transmission stages, motor configuration/directions, battery/load conditions and installed FTC SDK version. Generated code is a disabled scaffold and must be compiled against that team's installed SDK before any supervised test. Keep hardware disconnected while reviewing code; use the team's established controlled test procedure for actual motion.

| Check | Evidence required | Actual result / reviewer |
| --- | --- | --- |
| Java build | Compiled OpMode with the actual SDK and configuration; compiler output and reviewer | PENDING |
| Motor telemetry | Actual measured CSV with units, sampling, device attribution, voltage/load and model validation; synthetic/manual data is not measured PID calibration | PENDING |
| Motor direction / stop / timeout | Low-risk supervised checks of each motor, stop request, timeout and zero-power behavior | PENDING |
| Straight / turn / strafe / route | Measured target vs actual movement; correct gearing/wheel conversion; floor traction and localization limits documented | PENDING |
| Servo calibration | Real limits/neutral/direction/presets checked without binding; positional vs continuous behavior verified | PENDING |
| Obstacles and field | Actual swept clearance and game elements inspected; conservative screen checks do not certify physical clearance | PENDING |

## Final operator decision

Complete the original 43-row checklist and private readiness record using actual evidence. Record the exact commit, build fingerprint, canonical origin, reviewed teams/adult accounts, approval/expiry and rollback owner. Validate with `npm run readiness:check -- <private-record.json>`. Keep signatures, releases, provider contracts and sensitive evidence outside public Git.

Once the responsible reviewers have accepted all required evidence, set the current private readiness record and enabled flag in Vercel Production, redeploy, then repeat the hosted acceptance checks. Retain a tested pause/rollback procedure. Neither a successful deployment nor a passing technical preflight is a legal or physical-safety certification.
