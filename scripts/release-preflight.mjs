import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {fingerprint} from "./release-fingerprint.mjs";
import {assessReadiness} from "../server/readiness.ts";
import {migrationRehearsal} from "./migration-rehearsal.mjs";
const groups={sessions:["NEXTAUTH_URL","NEXTAUTH_SECRET"],google:["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"],microsoft:["MICROSOFT_CLIENT_ID","MICROSOFT_CLIENT_SECRET"],apple:["APPLE_CLIENT_ID","APPLE_CLIENT_SECRET"],email:["RESEND_API_KEY","EMAIL_FROM"],database:["CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_D1_DATABASE_ID","CLOUDFLARE_D1_API_TOKEN"],privateFiles:["CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_R2_BUCKET_NAME","CLOUDFLARE_R2_ACCESS_KEY_ID","CLOUDFLARE_R2_SECRET_ACCESS_KEY"],cleanup:["CRON_SECRET"],review:["MYFTC_READINESS_RECORD"]};
export function configurationPresence(env){return Object.fromEntries(Object.entries(groups).map(([name,keys])=>[name,{configured:keys.every(key=>!!env[key]?.trim()),missing:keys.filter(key=>!env[key]?.trim())}]));}
export async function hostedChecks(origin,{fetcher=fetch,expectedRelease}={}){
 const url=new URL(origin);if(url.protocol!=="https:"||url.origin!==origin||url.username||url.password)throw new Error("Use an exact canonical HTTPS origin without a path or credentials.");
 const checks=[];let deployment=null;
 for(const pathname of ["/","/robot-lab","/signin","/privacy","/api/session","/api/deployment/status","/static-cache-sw.js","/api/maintenance/retention"]){
  try{const response=await fetcher(origin+pathname,{cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(15000)}),expected=pathname==="/api/maintenance/retention"?401:200;let ok=response.status===expected,detail="http-status";
   if(pathname==="/api/session")ok=ok&&/no-store/.test(response.headers.get("cache-control")||"");
   if(pathname==="/api/deployment/status"&&ok){const raw=await response.json();deployment={schemaVersion:raw.schemaVersion,sourceChanges:Array.isArray(raw.sourceChanges)?raw.sourceChanges.filter(name=>typeof name==="string"&&(/^(?:app|src|server|db|drizzle|worker|lib|scripts|public|docs|config|types)\/[a-zA-Z0-9_./\[\]-]+$/.test(name)||["vercel.json","package.json","package-lock.json","next.config.ts","tsconfig.json","README.md"].includes(name))):[],releaseMatches:raw.releaseId===expectedRelease,teamAccess:["paused","setup-required","review-required","enabled"].includes(raw.teamAccess)?raw.teamAccess:"unknown",configuration:{signInMethods:Array.isArray(raw.configuration?.signInMethods)?raw.configuration.signInMethods.filter(name=>["google","azure-ad","apple","email"].includes(name)):[],database:raw.configuration?.database===true,privateFiles:raw.configuration?.privateFiles===true,scheduledCleanup:raw.configuration?.scheduledCleanup===true}};ok=raw.schemaVersion===1&&deployment.releaseMatches;detail="release-and-configuration";}
   checks.push({path:pathname,ok,status:response.status,detail});
  }catch{checks.push({path:pathname,ok:false,status:null,detail:"unavailable-or-unreadable"});}
 }
 return {checks,deployment};
}
export async function readDatabaseSchema(env,expected,{fetcher=fetch}={}){
 if(!groups.database.every(key=>!!env[key]?.trim()))return {checked:false,ok:false,reason:"database-credentials-missing"};
 const endpoint=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/d1/database/${encodeURIComponent(env.CLOUDFLARE_D1_DATABASE_ID)}/query`;
 const query=async sql=>{const response=await fetcher(endpoint,{method:"POST",headers:{Authorization:`Bearer ${env.CLOUDFLARE_D1_API_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(15000)}),data=await response.json();if(!response.ok||data.success!==true||data.result?.[0]?.success===false||!Array.isArray(data.result?.[0]?.results))throw new Error("metadata unavailable");return data.result[0].results;};
 try{const rows=await query("SELECT type,name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'"),missingTables=expected.tables.map(table=>table.name).filter(name=>!rows.some(row=>row.type==="table"&&row.name===name)),missingIndexes=expected.indexes.filter(name=>!rows.some(row=>row.type==="index"&&row.name===name)),mismatches=[];
  const present=expected.tables.filter(table=>!missingTables.includes(table.name));
  for(let offset=0;offset<present.length;offset+=4){const batch=await Promise.all(present.slice(offset,offset+4).map(async table=>{const columns=await query(`PRAGMA table_info("${table.name.replaceAll('"','""')}")`),missingColumns=table.columns.filter(column=>!columns.some(actual=>actual.name===column.name)).map(column=>column.name),incompatibleColumns=table.columns.filter(column=>{const actual=columns.find(actual=>actual.name===column.name);return actual&&(String(actual.type).toUpperCase()!==column.type||!!actual.notnull!==column.notNull||Number(actual.pk)!==column.primaryKey);}).map(column=>column.name);return {table:table.name,missingColumns,incompatibleColumns};}));mismatches.push(...batch.filter(row=>row.missingColumns.length||row.incompatibleColumns.length));}
  return {checked:true,ok:!missingTables.length&&!missingIndexes.length&&!mismatches.length,missingTables,missingIndexes,columnMismatches:mismatches,reason:"schema-metadata-only; hosted workflow and provider permissions acceptance remain required"};
 }catch{return {checked:true,ok:false,reason:"provider-schema-read-failed"};}
}
export async function preflight({env=process.env,origin="https://delaware-ftc-hq.vercel.app",online=true,database=false,root=fileURLToPath(new URL("..",import.meta.url)),fetcher=fetch}={}){
 const release=JSON.parse(readFileSync(path.join(root,"server/release-manifest.json"),"utf8")),localSourceMatches=fingerprint(root)===release.releaseId,presence=configurationPresence(env),migration=migrationRehearsal(root);
 const hosted=online?await hostedChecks(origin,{fetcher,expectedRelease:release.releaseId}):null,remoteSchema=database?await readDatabaseSchema(env,migration,{fetcher}):{checked:false,ok:false,reason:"not-requested"};
 const assessment=assessReadiness(env,{origin,releaseId:release.releaseId});
 const blockers=[];if(!localSourceMatches)blockers.push("Rebuild: local source differs from the release fingerprint.");for(const name of ["sessions","database","privateFiles","cleanup","review"])if(!presence[name].configured)blockers.push(`Configure ${name}; missing: ${presence[name].missing.join(", ")}.`);
 if(!["google","microsoft","apple","email"].some(name=>presence[name].configured))blockers.push("Configure at least one sign-in provider; verify every enabled method with test accounts.");
 if(env.NEXTAUTH_URL&&env.NEXTAUTH_URL!==origin)blockers.push("NEXTAUTH_URL must match the canonical release origin.");
 for(const name of ["NEXTAUTH_SECRET","CRON_SECRET"])if(env[name]&&env[name].length<32)blockers.push(`${name} must have at least 32 characters from a secure random generator.`);
 if(presence.apple.configured){try{const payload=JSON.parse(Buffer.from(env.APPLE_CLIENT_SECRET.split(".")[1]||"","base64url").toString("utf8"));if(typeof payload.exp!=="number"||payload.exp*1000<=Date.now())throw new Error();}catch{blockers.push("APPLE_CLIENT_SECRET must be a parseable unexpired client-secret JWT; verify its signature and provider configuration separately.");}}
 if(!assessment.enabled)blockers.push("The local release record/data gate does not pass readiness validation.");
 if(!online)blockers.push("Hosted deployment checks were not run.");
 if(hosted?.checks.some(check=>!check.ok))blockers.push("Hosted smoke checks or the deployed source fingerprint need attention.");
 if(hosted?.deployment?.teamAccess!=="enabled")blockers.push("The deployed team release remains closed or unverified.");
 if(!remoteSchema.ok)blockers.push("Production database schema and migration acceptance remain unverified.");

 return {schemaVersion:1,releaseId:release.releaseId,origin,localSourceMatches,configuration:presence,migrationRehearsal:{ok:migration.ok,migrations:migration.migrations,tables:migration.tables.length,indexes:migration.indexes.length,productionModified:false},hosted,remoteSchema,technicalPreflightPassed:blockers.length===0,readiness:{enabled:assessment.enabled,issues:assessment.issues},releaseDecision:"operator-approval-required",manualAcceptance:["Verify named adult/operator authority and actual monitored contacts.","Retain signed review and hosted multi-account/provider evidence; configuration presence does not verify delivery or sign-in.","Complete real phone-keyboard, assistive-technology and installed-SDK/robot acceptance; this script cannot authenticate signatures or physical results."],blockers};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const originArg=process.argv.find(arg=>arg.startsWith("--origin=")),result=await preflight({origin:originArg?.slice(9),online:!process.argv.includes("--offline"),database:process.argv.includes("--database")});const report=JSON.stringify(result,null,2)+"\n",outputArg=process.argv.find(arg=>arg.startsWith("--output="));if(outputArg)writeFileSync(path.resolve(outputArg.slice(9)),report,"utf8");process.stdout.write(report);if(result.blockers.length)process.exitCode=1;}catch{process.stdout.write(JSON.stringify({releaseDecision:"not-verified",error:"Preflight could not complete. Check the canonical origin and local build; no credential values or provider errors are printed."})+"\n");process.exitCode=1;}
}
