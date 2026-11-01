import "./privacy.css";

export const metadata = {
  title: "Privacy & data · MyFTCSpace",
  description: "How MyFTCSpace handles account access, private team records, files, maps, and saved revisions.",
};

export default function PrivacyPage() {
  return <div className="privacy-page">
    <a className="privacy-skip-link" href="#privacy-content">Skip to privacy information</a>
    <header className="privacy-header">
      <a className="privacy-brand" href="/" aria-label="MyFTCSpace home"><img src="/favicon.svg" width="36" height="36" alt=""/><strong>MyFTCSpace</strong></a>
      <a className="privacy-workspace-link" href="/">Open workspace <span aria-hidden="true">→</span></a>
    </header>
    <main id="privacy-content" className="privacy-content">
      <div className="privacy-intro">
        <h1>Privacy & data</h1>
        <p>How your account, team records, and files work in MyFTCSpace.</p>
        <p className="privacy-updated">Product information · Updated November 1, 2026</p>
      </div>

      <nav className="privacy-contents" aria-label="On this page">
        <a href="#account-access">Account access</a><a href="#team-data">Team data</a><a href="#saving-recovery">Saving & recovery</a><a href="#maps-links">Maps & links</a><a href="#data-help">Get help</a>
      </nav>

      <section id="account-access" aria-labelledby="account-access-title">
        <h2 id="account-access-title">Sign-in and team access</h2>
        <p>ChatGPT handles sign-in and your account credentials. MyFTCSpace uses your account ID to identify you and does not collect or store your password.</p>
        <p>Private team records require sign-in and team membership. Create a private team or join with a one-use invitation from its admin. Students, student leads, mentors, and team admins have different permissions; the server checks access on each private request.</p>
        <p>A role is an access permission within the team. A trusted team admin should confirm who is allowed to serve as a mentor or manage the workspace.</p>
      </section>

      <section id="team-data" aria-labelledby="team-data-title">
        <h2 id="team-data-title">What your team stores</h2>
        <p>Your workspace can contain tasks and comments, meeting and competition details, robot notes, resources, sponsor and grant records, outreach evidence, consent references, and learning progress. These are team records with access limited by role.</p>
        <dl className="privacy-storage-list">
          <div><dt>Shared records</dt><dd>Cloudflare D1 stores team records, memberships, invitation records, and saved workspace revisions.</dd></div>
          <div><dt>Private files</dt><dd>Cloudflare R2 stores uploaded evidence files. Downloads require a current membership and permission check; the app does not create public file URLs.</dd></div>
          <div><dt>This browser</dt><dd>An open tab holds authorized records in memory and can remember your selected team ID. Shared team records are not saved as a browser-local workspace. Files you export or download remain on the device where you save them.</dd></div>
        </dl>
        <h3>Use aliases and consent references</h3>
        <p>Use a first name and last initial for student display names. The team roster does not store student email addresses or full ChatGPT profile names. Keep student contact details, home addresses, medical information, and signed consent forms in your school’s approved systems.</p>
        <p>For media, record the allowed use and a consent reference. Do not upload signed consent forms here. Mentor approval for external use allows a reviewed export; it does not publish photos, videos, or documents. Check any linked file’s sharing permissions separately.</p>
      </section>

      <section id="saving-recovery" aria-labelledby="saving-recovery-title">
        <h2 id="saving-recovery-title">Saving, backups, and deletion</h2>
        <p>Wait for the workspace to show <strong>Synced</strong> before closing the tab. If a save fails, review the connection message in Settings. While access remains valid, you can download unsaved changes before reloading saved records.</p>
        <p>Mentors and team admins can export private workspace backups. Only team admins can restore a shared backup or saved revision. Restoring replaces shared records for every teammate and preserves the previous revision for recovery.</p>
        <div className="privacy-note">
          <h3>Removing a record is not permanent erasure</h3>
          <p>Deleted or changed records can remain in earlier workspace revisions. Copies can also exist in exported backups or downloaded files. Archiving or deleting a record does not promise to erase all earlier copies.</p>
        </div>
        <h3>When account or team access changes</h3>
        <p>The server checks current membership on private requests. Open tabs also recheck identity and access periodically and when you return to them. Detected sign-out, account switching, or removed membership clears private records from the tab; role changes reload records with the current permissions.</p>
        <p>Revocation cannot instantly remove information from an offline device or erase a file someone has already downloaded. Keep exported backups and media in team-approved storage.</p>
      </section>

      <section id="maps-links" aria-labelledby="maps-links-title">
        <h2 id="maps-links-title">Maps and external links</h2>
        <p>Your location is optional. The competition map asks for browser location only when you choose <strong>Use my location</strong>. It rounds the coordinates to two decimal places, keeps them for that map visit, and does not save your position in team records. County starting points work without location permission.</p>
        <p>Opening the map loads tiles from OpenStreetMap. Its servers receive your IP address and the viewed map area as part of those requests. Directions open Google Maps. Official sources, CAD, code, and supporting-document links open their respective providers, where that service’s access permissions and data handling apply.</p>
      </section>

      <section id="data-help" className="privacy-help" aria-labelledby="data-help-title">
        <h2 id="data-help-title">Get help with your data</h2>
        <p>Contact your team admin through your existing team channel for invitations, access changes, role corrections, record corrections, consent questions, or backup recovery. If you have lost access, ask a trusted mentor or team admin to check your membership.</p>
        <p>When reporting a problem, include the screen name and error message. Keep passwords, invitation codes, and student details out of public support posts.</p>
        <a className="privacy-help-link" href="/">Return to MyFTCSpace <span aria-hidden="true">→</span></a>
      </section>
    </main>
    <footer className="privacy-footer"><span>MyFTCSpace</span><span>Private team work. Clear permissions.</span></footer>
  </div>;
}
