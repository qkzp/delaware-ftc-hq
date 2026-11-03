import { getCurrentUser } from "../auth-identity";
import { isAuthConfigured } from "../../auth";
import { assessReadiness } from "../../server/readiness";
import { getReadinessEnvironment } from "../../server/runtime";
import "../../src/components/entry.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a team | MyFTCSpace", description: "Get started with a private team workspace.", robots: { index: false, follow: false } };

export default async function EnrollmentPage() {
  const authConfigured = isAuthConfigured();
  const readiness = assessReadiness(getReadinessEnvironment());
  const user = await getCurrentUser();
  const available = authConfigured && readiness.enabled && readiness.record?.accessModel === "self-service";
  return <div className="account-entry entry-page">
    <a className="entry-skip-link" href="#enroll-content">Skip to team setup</a>
    <header className="entry-header"><a className="entry-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" alt="" width="24" height="24"/><strong>MyFTCSpace</strong></a><a className="entry-header-link" href="/privacy">Privacy &amp; data help</a></header>
    <main className="entry-layout" id="enroll-content" aria-labelledby="enroll-title">
      <p className="entry-status">Team setup</p>
      <h1 id="enroll-title">Create a team workspace.</h1>
      <p className="entry-description">Students and adults can start a private workspace and invite their teammates, coaches and mentors. Students need the required parent or guardian permission.</p>
      {available ? <>
        <p>Sign in with your own account, then choose <strong>Create a team</strong> in team settings. Student founders can invite teammates and a responsible adult coach or mentor. Adult-only controls remain with adult operators.</p>
        <a className="btn btn-primary entry-primary-action" href={user ? "/#settings" : "/signin?callbackUrl=%2F%23settings"}>{user ? "Continue to team settings" : "Sign in to get started"}</a>
      </> : <p role="status">Self-service team creation is not open yet. The service is still being prepared for team access.</p>}
      {!available && authConfigured && !user && <p><a href="/signin?callbackUrl=%2Fenroll">Sign in for roster-based release setup</a></p>}
      {user && !available && <details className="entry-detail"><summary>Account ID for a roster-based release</summary><p>For an approved roster-based release, send this ID privately to the responsible service owner through the organization’s approved channel. Do not post it publicly or include it in a student record.</p><p><strong>Provider-scoped account ID</strong></p><code style={{display:"block",overflowWrap:"anywhere",padding:"12px"}}>{user.userId}</code><p>Different sign-in methods for the same person have different IDs.</p></details>}
      <div className="entry-demo"><span>Want to see the workspace?</span><a href="/review">Try the demo</a><small>Fictional data only. Changes reset when you reload.</small></div>
      <a className="entry-maintenance-link" href="/">Return to MyFTCSpace</a>
    </main>
    <footer className="entry-footer"><span>MyFTCSpace</span><span>Private team workspaces</span></footer>
  </div>;
}
