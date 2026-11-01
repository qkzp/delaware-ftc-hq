"use client";
import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
class WorkspaceBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<Recovery />:this.props.children;}
}
function Recovery(){return <main className="workspace-recovery"><h1>Let’s reopen your workspace.</h1><p>The screen could not finish loading. Your last successful server save remains available.</p><button className="btn btn-primary" onClick={()=>window.location.reload()}>Reload saved workspace</button></main>;}
function Opening(){return <div className="workspace-opening" aria-busy="true"><header><span className="opening-emblem" aria-hidden="true">M</span><strong>MyFTCSpace</strong></header><main><p role="status">Opening your workspace…</p><h1>Your space to build.</h1><div className="opening-sheets" aria-hidden="true"><div><strong>Your next task</strong><i/><i/><i/></div><div><strong>Your team</strong><span className="opening-ring"/></div></div></main></div>;}
export default function WorkspaceClient() {
 const [App, setApp] = useState<ComponentType | null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(() => { import("../src/App").then(m => setApp(() => m.default)).catch(()=>setFailed(true)); }, []);
 return failed?<Recovery />:App?<WorkspaceBoundary><App /></WorkspaceBoundary>:<Opening />;
}
