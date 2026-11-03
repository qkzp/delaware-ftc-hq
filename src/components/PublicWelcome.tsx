import DisplayPreferences from "./DisplayPreferences";
import {ArrowDownRight,ArrowRight,ArrowUpRight} from "lucide-react";
import {BIOBUZZ_ART,BIOBUZZ_SOURCE} from "../field-layouts";
import "./public-new.css";

type Support={supportEmail:string;privacyEmail:string};

export default function PublicWelcome({accessReady,support}:{accessReady:boolean;support?:Support|null}){
 return <div className="public-welcome field-welcome">
  <a className="sheet-skip" href="#welcome-main">Skip to main content</a>
  <header className="sheet-header">
   <a className="sheet-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" width="30" height="30" alt=""/><span>MYFTC<span>SPACE</span></span></a>
   <nav aria-label="Welcome navigation"><a href="#workspace-features">The workspace</a><a href="/robot-lab">Robot Lab</a><a href="/privacy">Privacy</a><a href="/maintenance">Member help <ArrowUpRight size={14} aria-hidden="true"/></a></nav>
   <span className="sheet-header-note">A WORKSPACE FOR FTC TEAMS</span>
  </header>
  <div className="sheet-status"><span className="sheet-status-index">NOTICE / 01</span><span>{accessReady?"Use your own approved account to join your team.":"Team access is being configured. Robot Lab is available now."}</span><a href={accessReady?"/signin":"/enroll"}>{accessReady?"Sign in":"Coach or mentor setup"} <ArrowRight size={15} aria-hidden="true"/></a></div>
  <main id="welcome-main">
   <section className="sheet-hero" aria-labelledby="welcome-title">
    <div className="sheet-hero-copy"><div className="sheet-eyebrow"><span>FIELD NOTES / 01</span><span>MYFTCSPACE</span></div><h1 id="welcome-title">THE WORK<br/>BEHIND<br/>THE ROBOT<span className="sheet-period">.</span></h1><p>Plans change. Parts break. Good notes help. Keep your team, its work and its robot knowledge in one place.</p><div className="sheet-actions"><a className="sheet-action sheet-action-primary" href="/signin">Sign in to your team <ArrowRight size={18} aria-hidden="true"/></a><a className="sheet-action sheet-action-demo" href="/review">Try the demo <ArrowUpRight size={15} aria-hidden="true"/></a><a className="sheet-action sheet-action-link" href="/robot-lab">Open Robot Lab <ArrowUpRight size={18} aria-hidden="true"/></a></div><div className="sheet-hero-foot"><span>FOR STUDENTS, MENTORS &amp; COACHES</span><span>SCROLL TO EXPLORE <ArrowDownRight size={13} aria-hidden="true"/></span></div></div>
    <figure className="sheet-field"><div className="sheet-figure-header"><span>FIELD REFERENCE / 2026&ndash;27</span><span>01 / 01</span></div><img src={BIOBUZZ_ART} alt="Top-down illustration of the 2026-27 BIOBUZZ field, showing the central HIVE and red and blue sides."/><figcaption><span>01 <strong>BIOBUZZ</strong><br/>ILLUSTRATED FIELD VIEW</span><a href={BIOBUZZ_SOURCE} target="_blank" rel="noreferrer">Artwork by Team Juice 16236 <ArrowUpRight size={13} aria-hidden="true"/></a></figcaption></figure>
   </section>
   <section className="sheet-index" id="workspace-features" aria-labelledby="workspace-features-title"><header className="sheet-section-heading"><div><p className="sheet-kicker">THE WORKSPACE / INDEX</p><h2 id="workspace-features-title">A place for the parts<br/>that make a team.</h2></div><p>From the next meeting to the next match, find the information the work needs.</p></header><div className="sheet-index-head" aria-hidden="true"><span>NO.</span><span>AREA</span><span>WHAT IT DOES</span><span>OPEN</span></div>
    <div className="sheet-index-row"><span className="sheet-row-number">01</span><h3>THE WORK</h3><p>Assign tasks, follow the schedule, and keep team conversations together.</p><a href="#team-access" aria-label="Learn about team workspace access">Team workspace <ArrowUpRight size={16} aria-hidden="true"/></a></div>
    <div className="sheet-index-row"><span className="sheet-row-number">02</span><h3>THE ROBOT</h3><p>Keep hardware details close. Calculate wheel speed, explore PID and plan a route.</p><a href="/robot-lab">Try Robot Lab <ArrowUpRight size={16} aria-hidden="true"/></a></div>
    <div className="sheet-index-row"><span className="sheet-row-number">03</span><h3>THE SEASON</h3><p>Track awards and grant deadlines, prepare for competition, and follow up with sponsors.</p><a href="#team-access" aria-label="Learn about team access for season planning">Team access <ArrowUpRight size={16} aria-hidden="true"/></a></div>
   </section>
   <section className="sheet-access" id="team-access" aria-labelledby="welcome-account-title"><div><p className="sheet-kicker">TEAM ACCESS / HOW IT WORKS</p><h2 id="welcome-account-title">{accessReady?"Sign in to your team.":"START WITH YOUR TEAM."}</h2><p>A coach or mentor sets up your team workspace and oversees access. Students and team leads can contribute using their own approved accounts.</p></div><div className="sheet-access-detail"><div className="sheet-access-state"><span aria-hidden="true"/>{accessReady?"YOUR TEAM / YOUR ACCOUNT":"TEAM ACCESS / SETUP IN PROGRESS"}</div><p>{accessReady?"Use the sign-in method approved for your team.":"Access opens after the responsible organization completes setup and the required review."}</p>{accessReady?<a className="sheet-action sheet-action-primary" href="/signin">Choose a sign-in method <ArrowRight size={17} aria-hidden="true"/></a>:<a className="sheet-action sheet-action-primary" href="/enroll">Coach or mentor setup <ArrowRight size={17} aria-hidden="true"/></a>}<a className="sheet-access-help" href="/maintenance">Existing member? Access &amp; data help <ArrowUpRight size={14} aria-hidden="true"/></a><p className="sheet-small">Student access is limited to ages 13&ndash;18 with required permission. Adults use their own accounts. Team records are available only to authorized members.</p></div></section>
   <details className="sheet-display"><summary>Display settings</summary><DisplayPreferences/></details>
  </main>
  <footer className="sheet-footer"><div><strong>MYFTCSPACE</strong><p>Independent software for FTC teams. No FIRST or school endorsement is claimed.</p></div><nav aria-label="Site information"><a href="/privacy">Privacy &amp; data help</a><a href="/third-party-notices.txt">Open source notices</a>{support&&<a href={`mailto:${support.supportEmail}`}>Contact support</a>}</nav><span className="sheet-footer-mark">BUILD. RECORD. REPEAT.</span></footer>
 </div>;
}
