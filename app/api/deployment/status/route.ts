import {deploymentStatus} from "../../../../server/deployment-status";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){return Response.json(deploymentStatus(process.env,new URL(request.url).origin),{headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});}
