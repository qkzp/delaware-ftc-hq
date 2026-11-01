"use client";
import { useEffect, useState, type ComponentType } from "react";
export default function WorkspaceClient() {
 const [App, setApp] = useState<ComponentType | null>(null);
 useEffect(() => { import("../src/App").then(m => setApp(() => m.default)); }, []);
 return App ? <App /> : <main style={{padding: 40, fontFamily: "system-ui"}} role="status">Opening MyFTCSpace…</main>;
}
