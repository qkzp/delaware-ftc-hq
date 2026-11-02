import { ArrowRight, CalendarDays, ClipboardList, FolderOpen, Wrench } from "lucide-react";
import "./welcome.css";

type Support = { supportEmail: string; privacyEmail: string };

export default function PublicWelcome({ accessReady, support }: { accessReady: boolean; support?: Support | null }) {
  return <div className="public-welcome">
    <a className="welcome-skip" href="#welcome-main">Skip to main content</a>
    <header className="welcome-header">
      <a className="welcome-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" width="30" height="30" alt=""/><span>MyFTCSpace</span></a>
      <nav aria-label="Welcome navigation"><a href="#workspace-features">The workspace</a><a href="/privacy">Privacy &amp; data</a><a className="welcome-member-link" href="/maintenance">Member help <ArrowRight size={15} aria-hidden="true"/></a></nav>
    </header>
    <main id="welcome-main">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-intro">
          <p className="welcome-eyebrow">A workspace for Delaware FTC teams</p>
          <h1 id="welcome-title">Your team.<br/>One place to build.</h1>
          <p className="welcome-lede">Bring the season together. Plan the work, keep robot knowledge close, and turn team activities into a record you can use.</p>
          <a className="welcome-explore" href="#workspace-features">Explore the workspace <ArrowRight size={17} aria-hidden="true"/></a>
          <a className="welcome-explore" style={{marginLeft:24}} href="/robot-lab">Open Robot Lab <ArrowRight size={17} aria-hidden="true"/></a>
          <div className="welcome-principles"><span>Private team spaces</span><span>Coach and mentor oversight</span></div>
        </div>
        <div className="welcome-account" aria-labelledby="welcome-account-title">
          <div className="welcome-account-heading"><img src="/favicon.svg" width="36" height="36" alt=""/><span>MYFTCSpace / Team access</span></div>
          <h2 id="welcome-account-title">{accessReady ? "Sign in to your team." : "Start with your team."}</h2>
          <p>{accessReady ? "Use the sign-in method approved for your team." : "A coach or mentor sets up your team's private workspace and approves member access."}</p>
          {accessReady ? <div className="welcome-actions"><a className="welcome-button welcome-button-dark" href="/signin">Choose a sign-in method <ArrowRight size={16} aria-hidden="true"/></a><p>Google, Microsoft, Apple or an email link, as enabled by your organization.</p></div> : <>
            <div className="welcome-access-status"><span aria-hidden="true"/>Team access is being configured</div>
            <p className="welcome-status-note">The workspace will open after the responsible organization completes setup and the required review.</p>
            <a className="welcome-button welcome-button-dark" href="/enroll">Coach or mentor setup <ArrowRight size={16} aria-hidden="true"/></a>
          </>}
          <a className="welcome-account-help" href="/maintenance">Existing member? Get access or data help</a>
          <div className="welcome-account-note">Students use their own approved accounts. Student access is limited to ages 13–18 with the required permission; adult coaches and mentors use their own accounts.</div>
        </div>
      </section>
      <section className="welcome-features" id="workspace-features" aria-labelledby="welcome-features-title">
        <div className="welcome-section-heading"><p className="welcome-eyebrow">From the first meeting to competition day</p><h2 id="welcome-features-title">Keep the whole season connected.</h2></div>
        <div className="welcome-feature-grid">
          <article><ClipboardList size={24} strokeWidth={1.6} aria-hidden="true"/><h3>Know what comes next</h3><p>Assign tasks, track dependencies, and keep build conversations with the work.</p></article>
          <article><Wrench size={24} strokeWidth={1.6} aria-hidden="true"/><h3>Keep robot knowledge</h3><p>Organize parts, startup notes, CAD and code links, and troubleshooting references.</p></article>
          <article><CalendarDays size={24} strokeWidth={1.6} aria-hidden="true"/><h3>Plan the season</h3><p>Bring meetings and competitions into one team schedule with source and review details.</p></article>
          <article><FolderOpen size={24} strokeWidth={1.6} aria-hidden="true"/><h3>Document the work</h3><p>Collect activity evidence and consent references, with coach and mentor review controls.</p></article>
        </div>
      </section>
      <section className="welcome-oversight" aria-labelledby="welcome-oversight-title"><div><p className="welcome-eyebrow">Built around the team</p><h2 id="welcome-oversight-title">Clear roles. Shared work.</h2></div><p>Students contribute to their team. Team leads coordinate the work. Coaches and mentors oversee access, evidence, and privacy or safety concerns. Team records are available only to authorized members.</p></section>
    </main>
    <footer className="welcome-footer"><div><a className="welcome-brand" href="/"><img src="/favicon.svg" width="24" height="24" alt=""/><span>MyFTCSpace</span></a><p>Independent software for FTC teams. No FIRST or school endorsement is claimed.</p></div><nav aria-label="Site information"><a href="/privacy">Privacy &amp; data help</a><a href="/third-party-notices.txt">Open source notices</a>{support&&<a href={`mailto:${support.supportEmail}`}>Contact support</a>}</nav></footer>
  </div>;
}
