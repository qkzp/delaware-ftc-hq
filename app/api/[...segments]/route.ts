import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { service } from "../../../server/service";
export const dynamic = "force-dynamic";
async function handle(request: Request) { if(!env.DB || !env.BUCKET) return Response.json({error:"Team storage is unavailable. Try again shortly."},{status:503,headers:{"Cache-Control":"no-store"}}); return service(request,env.DB,env.BUCKET,await getChatGPTUser()); }
export {handle as GET,handle as POST,handle as PUT,handle as DELETE};
