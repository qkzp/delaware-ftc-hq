import { getCurrentUser } from "../auth-identity";
import { isAuthConfigured } from "../../auth";
import "../../src/components/entry.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Adult release setup | MyFTCSpace", description: "Private account ID lookup for an authorized adult preparing a team release.", robots: { index: false, follow: false } };

export default async function EnrollmentPage() {
  const authConfigured = isAuthConfigured();
  const user = await getCurrentUser();
  return <div className="account-entry entry-page">
    <a className="entry-skip-link" href="#enroll-content">Skip to account setup</a>
    <header className="entry-header"><a className="entry-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" alt="" width="24" height="24"/><strong>MyFTCSpace</strong></a><a className="entry-header-link" href="/privacy">Privacy &amp; data help</a></header>
    <main className="entry-layout" id="enroll-content" aria-labelledby="enroll-title">
      <p className="entry-status">Adult release setup</p>
      <h1 id="enroll-title">Prepare an approved account.</h1>
      <p className="entry-description">This screen shows only the provider-scoped ID for the account currently signed in. It does not open team records or approve access.</p>
      {!user ? authConfigured ? <><p>Sign in with the account that the responsible adult will use to administer the reviewed release.</p><a className="btn btn-primary entry-primary-action" href="/signin?callbackUrl=%2Fenroll">Choose a sign-in method</a></> : <p role="status">Account sign-in is not configured yet. The Vercel operator must add the approved identity-provider credentials before adult account setup can continue.</p> : <>
        <p>Send this ID privately to the named adult service owner through the organization's approved channel. Do not post it publicly or include it in a student record.</p>
        <div className="entry-detail"><p><strong>Provider-scoped account ID</strong></p><code style={{display:"block",overflowWrap:"anywhere",padding:"12px",background:"#f4f4f5",borderRadius:"4px"}}>{user.userId}</code><p>This ID is needed for the signed adult roster and production allowlist. Different sign-in methods for the same person have different IDs.</p></div>
      </>}
      <a className="entry-maintenance-link" href="/">Return to the release status</a>
    </main>
    <footer className="entry-footer"><span>MyFTCSpace</span><span>Access remains closed until approved</span></footer>
  </div>;
}
