# Vercel deployment

MyFTCSpace now uses the Next.js runtime expected by Vercel. Vercel hosts the app and its Node.js server functions. Configured Google, Microsoft and Apple providers or email links provide sign-in. The existing Cloudflare D1 database and private R2 bucket remain the data stores and are called from server code only. This avoids an unreviewed database migration, but adds Vercel, enabled identity providers and transactional email and Cloudflare API access to the actual provider review.

## Vercel project settings

- Connect the Git repository rooted at the folder containing `package.json` and set the Vercel root directory to `./`. If you put this project inside a larger monorepo, set the root directory to its `delaware-ftc-hq` subfolder instead.
- Framework: Next.js. Build command: `npm run build`. Install command: `npm ci`. Leave the output directory at the Next.js default.
- Use the current supported Node.js runtime for the Vercel project. Do not deploy a static export; API routes, authentication and private server-rendered pages need server functions.
- Keep Preview environment variables separate from Production. Previews must not receive production storage credentials or `MYFTC_DATA_ENABLED=true`.

## Required private environment variables

Set these in the Vercel project's encrypted environment settings. Do not commit actual values, expose them with `NEXT_PUBLIC_`, or paste them in deployment logs.

| Variable | Source / purpose |
| --- | --- |
| `NEXTAUTH_URL` | Exact canonical HTTPS production origin, e.g. `https://space.example.org` |
| `NEXTAUTH_SECRET` | A fresh random secret used to protect signed/encrypted auth sessions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth application credentials |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft Entra application credentials |
| `MICROSOFT_TENANT_ID` | `common` permits supported personal and work/school Microsoft accounts; narrow this only after organization review |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account owning the existing D1 database and R2 bucket |
| `CLOUDFLARE_D1_DATABASE_ID` | Existing D1 database identifier |
| `CLOUDFLARE_D1_API_TOKEN` | Cloudflare API token scoped to the required D1 Read and D1 Write permissions |
| `CLOUDFLARE_R2_BUCKET_NAME` | Existing private R2 bucket name |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 S3 credentials scoped to this bucket with object read/write access |
| `MYFTC_DATA_ENABLED` | Leave unset or `false` until the exact production release is approved |
| `MYFTC_SERVICE_PAUSED` | Emergency operator control; use `true` to pause normal service |
| `MYFTC_READINESS_RECORD` | Private JSON record after all human approvals and hosted checks are complete |

Google OAuth redirect URI: `https://<production-host>/api/auth/callback/google`. Microsoft redirect URI: `https://<production-host>/api/auth/callback/azure-ad`. Register the final HTTPS domain with both identity providers. The app uses the provider-scoped identity (`google:<subject>` or `azure-ad:<subject>`) as its account identifier; email and full name are not stored in team membership rows.

## Additional providers and messaging migration

Follow [provider setup](provider-setup.md) for Apple Developer credentials, Resend verified-domain authentication mail, the private `CRON_SECRET`, and exact callback URLs. Apply `drizzle/0002_messaging_and_email.sql` only after checking and backing up the intended D1 database. Vercel does not apply these migrations automatically. Verify the daily retention cron in the deployed project.

## Safe activation sequence

1. Create the Vercel project and configure OAuth and storage variables with production data still disabled.
2. Deploy a Preview and verify Google/Microsoft sign-in, the review hold, `/privacy`, server API responses and security headers using synthetic accounts/data.
3. Sign in with the designated adult account and use `/enroll` to obtain its provider-scoped account ID for the private reviewer allowlist. Collect student IDs only through the organization's approved process; `/enroll` shows only each signed-in user their own ID. Confirm D1 migrations on the intended database and confirm R2 is private. Test team isolation, file authorization/deletion, exports, account changes and rollback using separate synthetic users and devices.
4. Confirm whether existing Site account IDs and memberships need migration. Site identity IDs are not the same as Google/Microsoft provider IDs; existing users will not automatically map to the new identities. For an unused database, treat launch as a fresh account roster. For a used database, plan and rehearse a reviewed membership/data migration before exposing it.
5. Complete the 43-row organization review for Vercel, Google, Microsoft, Cloudflare, actual contracts, intended jurisdictions, users, retention, accessibility and operations. Keep signed evidence outside Git.
6. Deploy the approved source to Production. Record its exact commit, Vercel deployment URL, build fingerprint, database migration and access settings. Add the current provider-scoped account IDs, adult IDs and team IDs to the signed readiness record, set the exact HTTPS origin and expiry, and store the record as a private Vercel environment variable.
7. Run the hosted acceptance checklist for that exact deployment. Enable `MYFTC_DATA_ENABLED=true` only after the owner has accepted the evidence, then redeploy so the new Vercel environment is active. Recheck the live hold/data gate and keep the pause procedure staffed.

The app does not self-certify legal compliance. The Vercel build can be ready before the adult owner, school/legal review, provider contracts, real contact rota, accessibility acceptance and hosted operational evidence are ready. Until those decisions are complete, Vercel deployments must remain closed to real student data.

## Implementation notes

- `server/platform-storage.ts` translates the app's prepared D1 operations to Cloudflare's D1 HTTP query API and uses the R2 S3-compatible API for private files. It is deliberately server-only. Network requests add latency compared with an in-Worker binding; verify hosted performance and operational limits before launch.
- D1 batch behavior is used for multi-statement access and erasure operations. Verify each transaction-like workflow against the live D1 database with synthetic rows before enabling real data.
- Google/Microsoft identities are new IDs compared with the former Sites-provided ChatGPT identities. Prior readiness signatures, fingerprints, account allowlists and team approvals do not transfer to this source or identity system.
- `npm run build` refreshes `server/release-manifest.json`; `npm run release:check` verifies that the source has not changed since the fingerprint was generated.
