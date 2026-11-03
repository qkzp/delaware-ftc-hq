import {getPlatformD1,hasPlatformD1Config} from "../../../../server/platform-storage";
import {handleRetentionRequest} from "../../../../server/retention";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){
 return handleRetentionRequest(request,process.env.CRON_SECRET||"",()=>hasPlatformD1Config()?getPlatformD1():null);
}
