import {timingSafeEqual} from "node:crypto";
import {getPlatformD1,hasPlatformD1Config} from "../../../../server/platform-storage";
import {runScheduledRetention} from "../../../../server/retention";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET||"",provided=request.headers.get("authorization")||"",expected=`Bearer ${secret}`;
 if(!secret||provided.length!==expected.length||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return Response.json({error:"Unauthorized"},{status:401});
 if(!hasPlatformD1Config())return Response.json({error:"Storage unavailable"},{status:503});
 await runScheduledRetention(getPlatformD1());
 return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
