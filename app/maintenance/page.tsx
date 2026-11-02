import { headers } from "next/headers";
import { getCurrentUser } from "../auth-identity";
import { assessReadiness, publicSupport } from "../../server/readiness";
import { getDataStores, getReadinessEnvironment } from "../../server/runtime";
import { service } from "../../server/service";
import PrivacyMaintenance from "../../src/components/PrivacyMaintenance";
import ReviewHold from "../../src/components/ReviewHold";
import type { Session } from "../../src/cloud";
import "../privacy/privacy.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy requests and cleanup | MyFTCSpace", description: "Private data requests and authorized cleanup while team work is paused.", robots: { index: false, follow: false } };

export default async function MaintenancePage() {
  const gate = assessReadiness(getReadinessEnvironment());
  const record = gate.record;
  const development = process.env.NODE_ENV !== "production";
  const requestHeaders = await headers();
  // Rights and cleanup remain available after ordinary access expires or is paused.
  if (!development && (!record || requestHeaders.get("host") !== new URL(record.origin).host)) {
    return <ReviewHold support={publicSupport(record)} />;
  }
  const user = await getCurrentUser();
  if (!user) return <main className="privacy-content"><h1>Sign in for private data help</h1><p>Existing approved team members can record privacy requests and retry authorized cleanup while normal work is paused.</p><p><a className="btn btn-primary" href="/api/auth/signin/google?callbackUrl=%2Fmaintenance">Continue with Google</a></p><p><a className="btn btn-secondary" href="/api/auth/signin/azure-ad?callbackUrl=%2Fmaintenance">Continue with Microsoft</a></p><p><a href="/privacy">Privacy and other help routes</a></p></main>;
  if (!development && !record?.allowedAccountIds.includes(user.userId)) return <ReviewHold support={publicSupport(record)} />;
  const stores = getDataStores();
  if (!stores) return <main className="privacy-content"><h1>Private data help is unavailable</h1><p>Storage could not be reached. Use the monitored adult contact on the <a href="/privacy">privacy page</a> for requests or a cleanup receipt.</p></main>;
  const response = await service(new Request((record?.origin || "http://localhost") + "/api/session"), stores.DB, stores.BUCKET, user, development ? undefined : { allowedTeamIds: record!.allowedTeamIds, adultAccountIds: record!.adultAccountIds, teamCreationAccountIds: [] });
  if (!response.ok) return <main className="privacy-content"><h1>Private data help is unavailable</h1><p>Use the adult contact on the <a href="/privacy">privacy page</a> while the team connection is checked.</p></main>;
  const session = await response.json() as Session;
  return <PrivacyMaintenance initialSession={session} />;
}
