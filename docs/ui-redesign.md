# Application design references

The light application interface follows these official product examples, reviewed on 2026-11-01:

- [Linear: how we redesigned the UI](https://linear.app/now/how-we-redesigned-the-linear-ui). The primary reference for the pale sidebar, compact application frame, navigation spacing, thin dividers, neutral selection states and list/detail split. Both published light and dark screenshots were inspected; this app uses the light direction.
- [Linear: My issues](https://linear.app/docs/my-issues). The reference for assigned/team work, focus ordering and grouped task lists.
- [Notion: projects](https://www.notion.com/product/projects). The published database screenshot was inspected for row density, restrained status labels, view controls and readable document hierarchy.
- [Slack: channels](https://slack.com/features/channels). The reference for the team conversation and thread organization.

MyFTCSpace retains its name, records and workflows. The design uses system typography, a light gray sidebar, white work surfaces, thin gray borders, small neutral actions and restrained violet selection details. The prior navy/orange chrome, metric-card home page, colored banners and monospace slogans have been removed.

The home page is now My work: assigned/team views, workstream filters, task rows grouped by status, a selected-task inspector, focus sessions, guarded completion and Undo. Actual events, documents, competition preparation and authored updates remain available below the list. Other screens use the same table, document and conversation language. Sign-in and the release hold are simple centered account screens; privacy is a readable document.

No external font provider, runtime asset host, data collection, dependency, integration or server permission was added. Product-reference screenshots are development references outside the application source and are not served by the app. All counts, progress and activity come from existing authorized records.

Automated checks cover the existing workflows and accessible semantics. Browser layout, color contrast at rendered sizes, zoom and assistive-technology review remain separate manual checks. Edge computer-use access was denied during the preceding design run; no rendered screenshot or manual browser certification is claimed. The exact source fingerprint must receive normal release review before accepting real team data.
