export default function SignIn() {
  return <div className="account-entry">
    <header className="account-entry-header"><a href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" alt="" width="38" height="38"/><strong>MyFTCSpace</strong></a></header>
    <main className="account-login" aria-labelledby="login-title">
      <img src="/favicon.svg" alt="" width="64" height="64"/>
      <h1 id="login-title">Sign in to your team.</h1>
      <p>Your tasks, robot notes, and season plans.<br/>Together in one private workspace.</p>
      <a className="btn btn-primary account-sign-in" href="/signin-with-chatgpt?return_to=%2F" target="_top">Continue with ChatGPT <span aria-hidden="true">→</span></a>
      <p className="account-login-note">Use your own ChatGPT account. After signing in, join with a team invitation or create a private team.</p>
      <div className="account-login-demo"><span>Just looking around?</span><a href="/demo">Explore the demo <span aria-hidden="true">↗</span></a></div>
    </main>
    <footer className="account-entry-footer">Team records require sign-in and team membership. Your password is handled by ChatGPT.</footer>
  </div>;
}
