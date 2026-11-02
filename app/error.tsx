"use client";
export default function ErrorScreen({reset}:{reset:()=>void}){return <main className="workspace-recovery"><h1>Let’s reopen this screen.</h1><p>Something interrupted loading. Keep any unsaved work in this tab, then try opening the screen again.</p><button className="btn btn-primary" onClick={reset}>Try again</button><p><a href="/">Return to team access</a></p></main>;}
