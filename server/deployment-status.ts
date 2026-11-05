import release from "./release-manifest.json";
import {assessReadiness,type ReadinessEnvironment} from "./readiness";
type Environment=ReadinessEnvironment&Record<string,string|undefined>;
export function deploymentStatus(environment:Environment,origin:string){
 const has=(...keys:string[])=>keys.every(key=>!!environment[key]?.trim());
 const database=has("CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_D1_DATABASE_ID","CLOUDFLARE_D1_API_TOKEN"),privateFiles=has("CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_R2_BUCKET_NAME","CLOUDFLARE_R2_ACCESS_KEY_ID","CLOUDFLARE_R2_SECRET_ACCESS_KEY");
 const signInMethods=has("NEXTAUTH_SECRET")?[
  has("GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET")?"google":"",
  has("MICROSOFT_CLIENT_ID","MICROSOFT_CLIENT_SECRET")?"azure-ad":"",
  has("APPLE_CLIENT_ID","APPLE_CLIENT_SECRET")?"apple":"",
  database&&has("RESEND_API_KEY","EMAIL_FROM")?"email":"",
 ].filter(Boolean):[];
 const scheduledCleanup=has("CRON_SECRET"),gate=assessReadiness(environment,{origin});
 return {schemaVersion:1,releaseId:gate.releaseId,sourceChanges:release.sourceChanges,teamAccess:environment.MYFTC_SERVICE_PAUSED==="true"?"paused":!signInMethods.length||!database||!privateFiles||!scheduledCleanup?"setup-required":gate.enabled?"enabled":"review-required",configuration:{signInMethods,database,privateFiles,scheduledCleanup}};
}
