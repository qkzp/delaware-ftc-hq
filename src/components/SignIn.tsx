import "./entry.css";

export default function SignIn() {
 return <div className="account-entry entry-page">
  <a className="entry-skip-link" href="#entry-content">Skip to team sign-in</a>
  <header className="entry-header"><a className="entry-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" alt="" width="24" height="24"/><strong>MyFTCSpace</strong></a><a className="entry-header-link" href="/privacy">Privacy & data help</a></header>
  <main className="entry-layout" id="entry-content" aria-labelledby="login-title">
   <h1 id="login-title">Sign in to your team.</h1>
   <p className="entry-description">Open your private workspace for tasks, robot notes, and the FTC season.</p>
   <a className="btn btn-primary entry-primary-action" href="/api/auth/signin/google">Continue with Google</a>
   <a className="btn btn-secondary entry-primary-action" href="/api/auth/signin/azure-ad">Continue with Microsoft</a>
   <p className="entry-access-note">Use your own approved Google or Microsoft account. Students must be 13–18 with the required parent or guardian permission. An approved adult sets up the team; approved members join with a private invitation.</p>
   <div className="entry-detail"><p>Team records require sign-in and team membership. Your password is handled by your sign-in provider.</p></div>
   <a className="entry-maintenance-link" href="/maintenance">Existing members: privacy requests and cleanup</a>
  </main>
  <footer className="entry-footer"><span>MyFTCSpace</span><span>Private team work with adult oversight</span></footer>
 </div>;
}
