import "./entry.css";

export default function ReviewHold({support}:{support?:{supportEmail:string;privacyEmail:string}|null}) {
 return <div className="account-entry entry-page entry-review-page">
  <a className="entry-skip-link" href="#review-content">Skip to release information</a>
  <header className="entry-header"><a className="entry-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" alt="" width="24" height="24"/><strong>MyFTCSpace</strong></a><a className="entry-header-link" href="/privacy">Privacy & data help</a></header>
  <main className="entry-layout" id="review-content" aria-labelledby="review-title">
   <p className="entry-status">Release review</p>
   <h1 id="review-title">Team access is paused.</h1>
   <p className="entry-description">This release is awaiting its adult and school review. The team workspace, records and uploads remain unavailable.</p>
   <a className="btn btn-primary entry-primary-action" href="/privacy">Privacy and data help</a>
   <a className="entry-maintenance-link" href="/enroll">Adult release setup: view your sign-in ID</a>
   <a className="entry-maintenance-link" href="/maintenance">Existing members: privacy requests and cleanup</a>
   {support&&<div className="entry-contact"><p>For help, contact <a href={`mailto:${support.supportEmail}`}>{support.supportEmail}</a>.</p><p>For existing records or an urgent concern, contact <a href={`mailto:${support.privacyEmail}`}>{support.privacyEmail}</a>.</p></div>}
   <div className="entry-detail"><h2>Student access</h2><p>MyFTCSpace supports FTC teams in grades 7–12. Direct student access is limited to approved users ages 13–18, with the required parent or guardian permission. Under-13 accounts and shared adult accounts are not supported.</p><p>No FIRST or school endorsement is claimed. This review screen does not approve the service for student data.</p></div>
  </main>
  <footer className="entry-footer"><span>MyFTCSpace</span><span>Private team work with adult oversight</span></footer>
 </div>;
}
