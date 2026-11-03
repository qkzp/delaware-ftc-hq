import {getCurrentUser} from "../../auth-identity";
import {service} from "../../../server/service";
import {accountInRelease,assessReadiness,isMaintenanceRequest} from "../../../server/readiness";
import {getDataStores,getReadinessEnvironment} from "../../../server/runtime";
export const dynamic="force-dynamic";
const unavailable=()=>Response.json({error:"Team access is paused pending the required release review."},{status:503,headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
async function handle(request:Request) {
 const gate=assessReadiness(getReadinessEnvironment(),{origin:new URL(request.url).origin});
 const localSynthetic=process.env.NODE_ENV!=="production";
 const maintenance=isMaintenanceRequest(request)&&gate.record?.origin===new URL(request.url).origin;
 if(!localSynthetic&&!gate.enabled&&!maintenance){
  if(new URL(request.url).pathname==="/api/session")return Response.json({user:null,teams:[],reviewClosed:true},{headers:{"Cache-Control":"no-store, private"}});
  return unavailable();
 }
 const user=await getCurrentUser();
 const preparedAccount=request.headers.get("X-MyFTC-Account");
 if(preparedAccount&&preparedAccount!==user?.userId)return Response.json({error:"Your account changed. Reload private data help before continuing."},{status:401,headers:{"Cache-Control":"no-store, private"}});
 if(!localSynthetic&&(!user||!accountInRelease(gate.record,user.userId)))return Response.json({error:"This account is outside the approved team roster."},{status:403,headers:{"Cache-Control":"no-store, private"}});
 const stores=getDataStores();
 if(!stores)return Response.json({error:"Team storage is unavailable. Try again shortly."},{status:503,headers:{"Cache-Control":"no-store, private"}});
 return service(request,stores.DB,stores.BUCKET,user,localSynthetic?undefined:{allowedTeamIds:gate.record!.allowedTeamIds,teamCreationAccountIds:gate.record!.teamCreationAccountIds,adultAccountIds:gate.record!.adultAccountIds,accessModel:gate.record!.accessModel});
}
export {handle as GET,handle as POST,handle as PUT,handle as DELETE};
