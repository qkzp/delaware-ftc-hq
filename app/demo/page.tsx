import WorkspaceClient from "../workspace-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Demo · MyFTCSpace" };
export default function DemoPage() { return <WorkspaceClient demoMode />; }
