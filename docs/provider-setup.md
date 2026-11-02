# Production provider setup

Configure these as private Vercel environment variables. Do not post secret values in GitHub, support reports or chat. A successful website deployment does not provision these provider accounts or apply database migrations.

| Service | What the operator must supply |
| --- | --- |
| App sessions | `NEXTAUTH_URL=https://delaware-ftc-hq.vercel.app` and a generated random `NEXTAUTH_SECRET` with at least 32 bytes of entropy |
| Google | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google OAuth app; registered callback `https://delaware-ftc-hq.vercel.app/api/auth/callback/google` |
| Microsoft | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and reviewed `MICROSOFT_TENANT_ID` (`common` supports configured personal and work/school account types); callback `/api/auth/callback/azure-ad` on the canonical domain |
| Apple | Apple Developer account, a Sign in with Apple Services ID (`APPLE_CLIENT_ID`), and a signed client-secret JWT (`APPLE_CLIENT_SECRET`) generated using the developer Team ID, Key ID and private key; callback `/api/auth/callback/apple` on the canonical domain. Record the client-secret expiry and rotate it before expiry. Review Apple email-relay domain requirements if using Hide My Email. |
| Email links | Resend account, a verified sending domain with required DNS records, a send-authorized `RESEND_API_KEY`, and `EMAIL_FROM` using that verified domain. Configure the sender domain without open/click tracking for authentication links. Test delivery and link scanners on the actual supported email clients. Ordinary `@icloud.com` addresses use this email-link option; Apple ID is a separate sign-in method. |
| Database | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and a restricted `CLOUDFLARE_D1_API_TOKEN` with D1 Read and Write permissions |
| Private files | `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, with bucket-scoped object Read and Write permissions. Keep the bucket private. |
| Scheduled cleanup | Random `CRON_SECRET`; Vercel calls `/api/maintenance/retention` once daily at 07:00 UTC. Check its execution history. A request with no valid secret returns 401. Activity-based cleanup remains a second path. |
| Release controls | The current approved `MYFTC_READINESS_RECORD`, `MYFTC_DATA_ENABLED` (keep false until approved), and emergency `MYFTC_SERVICE_PAUSED` |

At least one configured sign-in method and the session secret are required. Email also requires D1 and the authentication tables. The sign-in page lists only methods with the necessary configuration. Google, Microsoft, Apple and email identities are separate; identical emails do not automatically transfer team roles between methods. Email session IDs use an internal random user ID, not the email address. Team operators approve each identity on the release roster before granting access.

## Database migration

Before enabling messaging or email, the database administrator must back up the intended database and apply `drizzle/0002_messaging_and_email.sql` through the organization's approved Cloudflare D1 migration workflow. It adds chat messages, messaging settings, DM blocks, authentication lookups, hashed verification tokens and mail-rate counters. Use the exact database intended for the production environment. These migrations are not automatically applied by a Vercel build.

Confirm `0000_tidy_infant_terrible.sql` and `0001_privacy_controls.sql` were previously applied. For a new empty database, apply migrations in order. Do not rerun table-creation migrations against an existing database without checking its migration history.

## Required verification after setup

Use separate fictional test accounts to verify each enabled provider, callback, sign-out, account changes and invitation flow. Verify that an unapproved adult cannot become an operator, and that multiple approved adult operators can manage the team. Test group messages, participant-only DMs, disabled-DM behavior, blocks, explicit reports, removal, retention cleanup and team erasure against the actual D1 database. Check private R2 downloads and cleanup. Keep the real-data gate closed until the adult/school review and hosted checks are accepted.

Sources: [NextAuth email provider](https://next-auth.js.org/providers/email), [NextAuth Apple provider](https://next-auth.js.org/providers/apple), [Resend send API](https://resend.com/docs/api-reference/emails/send-email), [Cloudflare D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).

See [launch acceptance](launch-acceptance.md) for the read-only deployment preflight, migration rehearsal, hosted test sequence and physical device/robot result sheets. Teams configure their own monitored addresses in Workspace settings; the service-wide accountable operator/contact must still be supplied separately.
