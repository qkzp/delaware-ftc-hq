import ts from "typescript";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

// Enumerate the actual typed fields instead of maintaining a second hand-copied schema.
const root=fileURLToPath(new URL("..",import.meta.url));
const source=ts.createSourceFile("types.ts",readFileSync(path.join(root,"src/types.ts"),"utf8"),ts.ScriptTarget.Latest,true);
const robotSource=ts.createSourceFile("robot-lab.ts",readFileSync(path.join(root,"src/robot-lab.ts"),"utf8"),ts.ScriptTarget.Latest,true);
const declarations=[...source.statements,...robotSource.statements];
const interfaces=new Map(declarations.filter(ts.isInterfaceDeclaration).map(n=>[n.name.text,n]));
const aliases=new Map(declarations.filter(ts.isTypeAliasDeclaration).map(n=>[n.name.text,n]));
const fields=[];
function collect(name,prefix,seen=[]){
 if(seen.includes(name))return;
 const node=interfaces.get(name);if(!node){const alias=aliases.get(name);if(alias&&ts.isTypeLiteralNode(alias.type))for(const member of alias.type.members)if(ts.isPropertySignature(member))visit(member.type,prefix+"."+member.name.getText(),[...seen,name]);return;}
 for(const clause of node.heritageClauses||[])for(const type of clause.types)collect(type.expression.getText(),prefix,[...seen,name]);
 for(const member of node.members)if(ts.isPropertySignature(member))visit(member.type,prefix+"."+member.name.getText(),[...seen,name]);
}
function visit(type,field,seen){
 fields.push({field,type:type.getText()});
 if(ts.isArrayTypeNode(type)){
  if(ts.isTypeReferenceNode(type.elementType))collect(type.elementType.typeName.getText(),field+"[]",seen);
  else if(ts.isTypeLiteralNode(type.elementType))for(const m of type.elementType.members)if(ts.isPropertySignature(m))visit(m.type,field+"[]."+m.name.getText(),seen);
 }else if(ts.isTypeReferenceNode(type))collect(type.typeName.getText(),field,seen);
 else if(ts.isTypeLiteralNode(type))for(const m of type.members)if(ts.isPropertySignature(m))visit(m.type,field+"."+m.name.getText(),seen);
}
collect("AppData","workspace");collect("Member","membership");
function category(field){
 if(field.startsWith("membership"))return "identity";
 for(const key of ["sponsors","grants","resources","evidence","events","tasks","announcements","parts","robotLab","robot"])if(field.startsWith("workspace."+key))return key;
 if(/^workspace\.(onboarding|skills)/.test(field))return "learning";
 return "team";
}
const purposes={identity:"Identify the approved account, team alias and authorized role",sponsors:"Research business sponsors and track adult-reviewed follow-up; no sending",grants:"Research sourced opportunities and track manual eligibility/application decisions",resources:"Maintain reviewed technical references and school-controlled external links",evidence:"Document approved team activities and collection/use consent references",events:"Coordinate team dates, venues and per-member RSVP; venue coordinates only",tasks:"Assign work, document dependencies, blockers and append-only build comments",announcements:"Record internal decisions and team updates",robotLab:"Maintain robot configuration profiles, numerical motor test observations/models, servo calibration, routes/obstacles and maintenance reminders",parts:"Track robot components, motor/servo specifications, RPM, purpose and business product references",robot:"Keep robot setup, safety, CAD/code links and repair instructions",learning:"Track personal training and mentor sign-offs",team:"Configure team/season, monitored adult team support/privacy contacts and internal pit preparation"};
const viewers={identity:"Authorized teammates; platform identity handled by host",sponsors:"Lead, mentor and admin; excluded from student responses",grants:"Lead, mentor and admin; students only team-visible records",resources:"Managing roles; students only approved nonprivate records",evidence:"Owner and managing roles; other students only approved nonprivate records; current attachment only",events:"Authorized team; each member receives their own RSVP",tasks:"Authorized team; server enforces assignment/comment permissions",announcements:"Authorized team",parts:"Authorized team",robotLab:"Authorized team; lead, mentor and admin edit; public copies remain tab-only",robot:"Authorized team",learning:"Account owner; mentor/admin skill review",team:"Authorized team"};
const records=fields.map(({field,type})=>({field,type,purpose:purposes[category(field)],accountableOwner:"Designated adult organization owner — not yet named",viewers:viewers[category(field)],storage:"D1 workspace/envelope and bounded revision snapshots; authorized browser-tab memory",vendors:["Vercel hosting","Enabled Google Microsoft Apple OAuth and email sign-in","Cloudflare D1"],retention:"Active records until authorized erasure; revisions 1–30 days and at most 30 snapshots, pruned on activity. Approved active/inactive schedule and maintenance owner pending.",deletion:"Admin team erasure removes current/revision records. Evidence withdrawal also purges its revisions/files. Exports, linked providers and host logs/backups need separately verified handling.",approval:"PENDING purpose/necessity, retention, vendor and viewer review"}));
const schema=ts.createSourceFile("schema.ts",readFileSync(path.join(root,"db/schema.ts"),"utf8"),ts.ScriptTarget.Latest,true);
for(const statement of schema.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
 const call=declaration.initializer;
 if(!call||!ts.isCallExpression(call)||call.expression.getText(schema)!=="sqliteTable")continue;
 const table=call.arguments[0].text,columns=call.arguments[1];
 if(!ts.isObjectLiteralExpression(columns))continue;
 for(const column of columns.properties)if(ts.isPropertyAssignment(column)){
  let init=column.initializer;
  while(ts.isCallExpression(init)&&ts.isPropertyAccessExpression(init.expression))init=init.expression.expression;
  const sqlName=ts.isCallExpression(init)&&init.arguments[0]&&ts.isStringLiteral(init.arguments[0])?init.arguments[0].text:column.name.getText(schema);
  records.push({field:`database.${table}.${sqlName}`,type:column.initializer.getText(schema),purpose:`Support ${table} authorization, persistence, requests, consent or cleanup; inspect db/schema.ts and server/privacy.ts for exact use`,accountableOwner:"Designated adult organization owner — not yet named",viewers:"Server only; role-filtered responses. Erasure job receipts restricted to initiating account.",storage:"Cloudflare D1",vendors:["Vercel hosting","Cloudflare D1"],retention:table==="revisions"?"1–30 days and at most 30; activity-triggered pruning":table==="invitations"?"48-hour expiry; used/expired invitations pruned on team activity":table==="privacy_requests"?"Open until reviewed; resolved/rejected pruned after 30 days during activity":table.includes("erasures")?"Minimal replay-prevention tombstones persist; approved retention and purge handling pending":"Until authorized team erasure; approved active/inactive retention schedule pending",deletion:table.includes("erasures")?"Operator-reviewed cleanup of minimal replay-prevention metadata; no self-service purge":"Admin team erasure; evidence withdrawal removes corresponding file metadata; database backup/log handling requires provider confirmation",approval:"PENDING organization/vendor/retention review"});
 }
}
for(const record of records){
 if(record.field.startsWith("database.auth_")){
  record.viewers="Authentication server only; never returned in team roster responses";
  record.vendors=["Vercel","Cloudflare D1","Enabled identity providers","Resend for sign-in emails"];
  record.retention=record.field.startsWith("database.auth_verification_tokens.")?"Single-use hashed tokens, 15-minute expiry, deleted on use or configured cleanup":record.field.startsWith("database.auth_email_rate.")?"Hashed recipient rate counters retained up to 24 hours plus cleanup interval":"Authentication lookup email and minimal provider links remain for account operation until authorized operator account erasure; approved retention procedure pending";
  record.deletion="Not deleted by one-team erasure because an authentication identity can serve other teams. Responsible operator must verify account-erasure authority and remove the auth lookup/links/tokens plus provider copies through the reviewed process.";
 }
 if(record.field.startsWith("database.chat_")){
  record.viewers="Group messages: current authorized team. DMs: participants in app; explicit reported copy: adult operators. Infrastructure access is not end-to-end encrypted.";
  record.retention=record.field.startsWith("database.chat_messages.")?"Adult-admin configured 1–30 days (30 default), with activity and secret-protected daily cleanup; operator must verify scheduling":"Until unblock or authorized team erasure; approved team operating schedule";
  record.deletion="Sender may permanently remove message content; adult reviewers may moderate group content. Team erasure removes messaging tables. Reports, exports and host backups follow separate handling.";
 }
}
for(const extra of [
 ["browser.display-preferences","Theme (system/light/dark), relative text scale, motion choice and preferred task/calendar/sponsor views; forward-compatible preference fields are preserved during updates","Device localStorage under stable myftcspace:preferences; in-memory fallback if blocked","Until changed or the user clears browser/site data; not sent to an app API; cache upgrades do not clear these choices",[]],
 ["browser.public-asset-cache","Public hashed JavaScript/styles, bundled fonts and favicon only; no HTML pages, sessions, API responses or team files","Same-origin service-worker Cache Storage and browser HTTP asset cache","Bounded to 100 app asset entries; old app cache versions may be pruned; unrelated caches and user preferences are preserved",[]],
 ["browser.robot-lab","Motor/servo specifications in the public tracker, numeric motor telemetry, locally fitted ARX/PID parameters, hardware dimensions, local transmission-stage ratios/wheel-speed calculations, speed targets, user-entered thermal assumptions, illustrative temperature curves and route poses","Browser tab memory; no upload to a hosted model or robot connection","Until reset/navigation/account scope change or tab close; downloaded Java/JSON/CSV stays on the user's device",[]],
 ["identity-provider.account-session","Provider-scoped Google/Microsoft/Apple or internal email account identifier and essential OAuth/session cookies; provider profile processed during sign-in but name/email/image removed from app JWT and session","Auth.js encrypted session on Vercel (configured eight-hour lifetime); configured OAuth provider or Resend email delivery; never app localStorage","Provider/host-controlled; terms, age suitability, retention, location and deletion need review",["Vercel","Google","Microsoft","Apple","Resend"]],
 ["host.logs-backups-subprocessors","Request/IP metadata, authentication logs, security logs and backups may be processed by Vercel, identity providers or Cloudflare","Provider/host systems; exact subprocessor chain and settings pending","Operator must obtain actual inventory, retention, encryption, breach and deletion commitments; unknown is a release blocker",["Vercel","Google","Microsoft","Apple","Resend","Cloudflare"]],
 ["browser.selected-team","Selected team ID preference","Browser localStorage; no team record payloads or authentication tokens","Until browser preference cleared; clear site data or sign-out preference handling"],
 ["browser.drafts","Authorized workspace and unsaved edits","Tab memory; fictional demo only may use demo storage","Until tab reset/close or account access change; authorized exports remain on chosen device"],
 ["storage.private-evidence-object","Approved PNG/JPEG/WebP/PDF/MP4 file bytes and sanitized filename/type/size","Private Cloudflare R2 reached by Vercel server functions; no public object URL","Until evidence withdrawal/team erasure; failed cleanup stays denied and is retryable. Unattached/replaced files need explicit retention policy.",["Vercel","Cloudflare R2"]],
 ["map.tiles","IP address, normal request metadata and viewed venue area after opt-in","OpenStreetMap tile service","External provider policy; no shared-workspace device geolocation; operator review pending",["OpenStreetMap"]],
 ["external.links","Destination URL and normal network metadata when visitor opens a source, CAD/code, directions or document link","Chosen external provider; referrer suppressed by app headers","Provider-controlled access/retention; school must approve provider and media sharing before use"],
 ["exports.downloads","Role-authorized workspace JSON or approved evidence exports and downloaded attachments","User-chosen device/storage; outside app deletion control","Organization must inventory copies, restrict access and confirm deletion separately"],
 ["operator.readiness-record","Adult/organization/support contact, scope/age constraints, account/team allowlists and reviewer evidence references","Private Vercel Production environment variable; only safe support contacts shown publicly","Approval expires in at most 90 days; source/vendor/data changes require review; operator retains signed materials outside public Git",["Vercel"]]
 , ["envelope.rsvps.*.accountIds[]","Per-event list of account IDs for individual RSVP","Cloudflare D1 envelope and revisions; members receive only their own RSVP","Until event/team cleanup under approved schedule; current app team erasure removes complete envelope and revisions"]
 , ["envelope.learning.*.steps[]","Per-member rookie learning completion identifiers","Cloudflare D1 envelope and revisions; owner and mentor/admin review","Until authorized team erasure; approved learning retention and access/correction procedure pending"]
 , ["envelope.learning.*.skills[]","Per-member mentor-signed skill identifiers","Cloudflare D1 envelope and revisions; owner and mentor/admin review","Until authorized team erasure; approved learning retention and access/correction procedure pending"]
])records.push({field:extra[0],type:"external/runtime",purpose:extra[1],accountableOwner:"Designated adult organization owner — not yet named",viewers:"Role/host/provider dependent; verify before enabling",storage:extra[2],vendors:extra[4]||[],retention:extra[3],deletion:extra[3],approval:"PENDING"});
const inventory={schemaVersion:1,basis:"Generated from current src/types.ts and db/schema.ts plus explicit external/runtime flows. Technical observations are not approval or a complete host attestation.",fields:records};
const output=JSON.stringify(inventory,null,2)+"\n",target=path.join(root,"docs/data-inventory.json");
if(process.argv.includes("--check")){
 if(readFileSync(target,"utf8")!==output)throw new Error("Data inventory drifted. Regenerate and review new fields before release.");
}else{mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,output);}
process.stdout.write(`${records.length} inventoried fields and runtime flows${process.argv.includes("--check")?" checked":" generated"}.\n`);
