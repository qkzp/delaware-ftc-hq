import {assessReadiness,publicSupport} from "../../server/readiness";
import {getReadinessEnvironment} from "../../server/runtime";
import "./privacy.css";
export const dynamic="force-dynamic";
export const metadata={title:"Privacy and data help · MyFTCSpace",description:"Team access, student privacy, consent, data requests, files and deletion."};
export default function PrivacyPage(){
 const gate=assessReadiness(getReadinessEnvironment()),support=publicSupport(gate.record);
 return <div className="privacy-page">
  <a className="privacy-skip-link" href="#privacy-content">Skip to privacy information</a>
  <header className="privacy-header"><a className="privacy-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" width="36" height="36" alt=""/><strong>MyFTCSpace</strong></a><a className="privacy-workspace-link" href="/">Team access</a></header>
  <main id="privacy-content" className="privacy-content">
   <div className="privacy-intro"><h1>Privacy and data help</h1><p>Understand who can see team records and how to ask for help.</p><p className="privacy-updated">Product information · November 1, 2026</p></div>
   <p role="status">{gate.enabled?"Access is limited to the approved roster and release scope.":"New team access and normal team operations are paused pending release review."}</p>
   <nav className="privacy-contents" aria-label="On this page"><a href="#account-access">Access and ages</a><a href="#team-data">Team records</a><a href="#media-consent">Media and consent</a><a href="#saving-recovery">Retention and deletion</a><a href="#maps-links">Maps and vendors</a><a href="#data-help">Requests and safety concerns</a></nav>
   <section id="account-access" aria-labelledby="account-access-title">
    <h2 id="account-access-title">Access and ages</h2>
    <p>This FTC workspace is intended for teams in grades 7–12. Direct student accounts are restricted to approved users ages 13–18, with the required parent or guardian permission. Under-13 accounts, shared adult credentials and adult proxy accounts for children are not supported.</p>
    <p>Google or Microsoft handles sign-in and credentials. The app uses a provider-scoped account ID, a team alias and assigned role; it does not store your password or copy your sign-in email into the roster. Use a first name and last initial.</p>
    <p>Only an operator-approved account can enter an operator-approved team. Membership and role checks run on private requests. Adult mentor and administrator access must also be on the approved adult roster. An in-app role alone does not prove adulthood or school authorization.</p>
    <p>Production remains closed until the operator records all required reviewer decisions for this exact build, audience and vendor arrangement. These recorded decisions are not a legal certification. Material source or policy changes, approval expiry or a service pause close normal access again.</p>
   </section>
   <section id="team-data" aria-labelledby="team-data-title">
    <h2 id="team-data-title">Team records and viewers</h2>
    <p>The workspace stores team settings, assignments and comments, meetings and competitions, robot notes, resources, parts, funding research, evidence, consent references and learning progress.</p>
    <dl className="privacy-storage-list">
     <div><dt>Shared records</dt><dd>Cloudflare D1 stores memberships, hashed invitations, team records, revision history, privacy requests and cleanup work.</dd></div>
     <div><dt>Evidence files</dt><dd>Cloudflare R2 stores private evidence. Another student can download only the current attachment of approved visible evidence. Owners and managing roles have the access described in the evidence form.</dd></div>
     <div><dt>Your browser</dt><dd>Authorized records stay in an open tab's memory. The app stores only the selected team ID as a browser preference. Exported or downloaded files remain on the device or storage service you choose.</dd></div>
    </dl>
    <p>Students see team work, approved shared resources and their own or approved shared evidence. Sponsor contacts, private grants and other members' private evidence are filtered by the server. Leads manage work; mentors and admins review consent and approvals; admins manage access and privacy operations.</p>
    <p>Do not enter birth dates, addresses, personal phone numbers, student email addresses or IDs, passwords, medical information, grades or signed consent forms. Keep those in the school's approved systems. Free text and uploads can contain sensitive information, so the adult owner must review collection and moderation practices.</p>
   </section>
   <section id="media-consent" aria-labelledby="media-consent-title">
    <h2 id="media-consent-title">Consent before media</h2>
    <p>Uploads start disabled. Before uploading or linking identifiable media, record the approved consent scope and school-held reference, then obtain the required mentor or admin collection review. A student cannot create the review receipt. A receipt records a review action; it does not verify that a parent or school actually issued a release.</p>
    <p>Consent changes invalidate review. External-use approval is separate and requires the appropriate consent. Selecting external use permits a reviewed export; it does not publish media or create a public file URL. Linked providers retain their own sharing settings.</p>
    <p>Accepted files are PNG, JPEG, WebP, PDF or MP4 under 12 MiB, with signature checks and private attachment downloads. Type checks are not malware scanning. Do not upload active or untrusted files; the organization must approve a malware-handling process before enabling uploads.</p>
   </section>
   <section id="saving-recovery" aria-labelledby="saving-recovery-title">
    <h2 id="saving-recovery-title">Saving, retention and deletion</h2>
    <p>Wait for <strong>Synced</strong> before closing a tab. Independent record edits are protected from stale forms; conflicts need review. Admins can restore retained revisions, and authorized mentors/admins can export backups.</p>
    <p>Revision recovery is bounded to the configured period, up to 30 days, and at most 30 snapshots. Expiry cleanup runs during service activity; it is not a promise of removal at an exact time. The operator must schedule and verify maintenance for inactive teams. Active team records remain until an authorized deletion action; they do not have a universal automatic school-record retention period.</p>
    <p>Archiving or removing a record from a screen is not complete erasure. The permanent evidence-withdrawal operation removes the entire evidence record from current records and retained revisions and queues all its stored attachments for cleanup. Admin team erasure disables the team, removes application records and private files, and supports retry if storage cleanup fails.</p>
    <p>Deletion of application storage does not erase downloaded exports, third-party source documents, provider logs or provider backups. The responsible organization must track those copies and obtain vendor confirmation through its approved process. A minimal cleanup tombstone can remain to prevent replay; the technical inventory documents its purpose.</p>
    <p>Session changes, revoked membership and role changes clear or reload private tab records. Revocation cannot recall a file already downloaded or instantly clear an offline device.</p>
   </section>
   <section id="maps-links" aria-labelledby="maps-links-title">
    <h2 id="maps-links-title">Maps and external services</h2>
    <p>County starting points support event search without a student's device location. Device geolocation is unavailable in shared student workspaces. Map tiles load only after you choose to load them; OpenStreetMap then receives your IP address, normal network metadata and the viewed area. The event list works without tiles.</p>
    <p>Source, CAD, document and directions links open external providers. Check their permissions before sharing. Directions use a venue destination; the app does not send a student's home address.</p>
    <p>The known service flows include Vercel hosting, Google or Microsoft sign-in, Cloudflare D1/R2 storage and optional OpenStreetMap tiles. This app does not send sponsor email, collect donations, process payments, use advertising or add an analytics SDK. Host-side logs, cookies, subprocessors, storage locations, security and retention must be verified in the organization's vendor review.</p>
   </section>
   <section id="data-help" aria-labelledby="data-help-title">
    <h2 id="data-help-title">Data requests and safety concerns</h2>
    {support?<p>For support, contact <a href={`mailto:${support.supportEmail}`}>{support.supportEmail}</a>. For access, correction, export, consent withdrawal, deletion or a privacy complaint, contact <a href={`mailto:${support.privacyEmail}`}>{support.privacyEmail}</a>.</p>:<p>No approved operator contact has been configured, so this release does not open normal team access. Ask the responsible school privacy office or trusted mentor through an existing school-approved channel.</p>}
    <p>When signed in to an approved team, use <strong>Settings → Privacy and safety</strong> to submit a request or concern. If team work is paused or a deletion is still cleaning up, use <a href="/maintenance">private requests and cleanup</a>. Members see their own requests; approved coaches, mentors and admins see and review the team's requests. Team leads help with routine work and route privacy or safety matters to an adult. An adult must verify the requester, track applicable deadlines and coordinate provider/export copies. The app does not determine legal applicability or guarantee vendor completion.</p>
    <p>Keep passwords, invitation codes, student details and sensitive attachments out of reports. Give the screen and record title, the type of problem and a safe way to follow up through your school. Report urgent student-safety concerns directly to a trusted adult; this app is not an emergency service.</p>
   </section>
  </main><footer className="privacy-footer"><span>MyFTCSpace</span><a href="/third-party-notices.txt">Open source notices</a><span>Private team work with adult oversight</span></footer>
 </div>;
}
