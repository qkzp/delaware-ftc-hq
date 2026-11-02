import WorkspaceClient from "./workspace-client";
import {getCurrentUser} from "./auth-identity";
import SignIn from "../src/components/SignIn";
import ReviewHold from "../src/components/ReviewHold";
import {assessReadiness,publicSupport} from "../server/readiness";
import {getReadinessEnvironment} from "../server/runtime";
export const dynamic="force-dynamic";
export default async function Page() {
 const readiness=assessReadiness(getReadinessEnvironment());
 const development=process.env.NODE_ENV!=="production";
 if(!development&&!readiness.enabled)return <ReviewHold support={publicSupport(readiness.record)}/>;
 const user=await getCurrentUser();
 if(user&&!development&&!readiness.record?.allowedAccountIds.includes(user.userId))return <ReviewHold support={publicSupport(readiness.record)}/>;
 return user?<WorkspaceClient accountMode/>:<SignIn/>;
}
