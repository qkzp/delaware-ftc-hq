import WorkspaceClient from "./workspace-client";
import { getChatGPTUser } from "./chatgpt-auth";
import SignIn from "../src/components/SignIn";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getChatGPTUser();
  return user ? <WorkspaceClient accountMode /> : <SignIn />;
}
