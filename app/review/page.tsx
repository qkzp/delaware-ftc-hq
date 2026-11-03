import WorkspaceClient from "../workspace-client";

export const dynamic="force-dynamic";
export const metadata={title:"Fictional review · MyFTCSpace",robots:{index:false,follow:false}};

export default function ReviewPage(){
 return <WorkspaceClient accountMode={false} ephemeralDemo/>;
}
