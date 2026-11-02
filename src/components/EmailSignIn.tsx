"use client";
import {useState} from "react";
import {signIn} from "next-auth/react";

export default function EmailSignIn({callbackUrl}:{callbackUrl:string}){
  const [email,setEmail]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState("");
  return <form className="stack" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError("");setStatus("");try{const result=await signIn("email",{email,callbackUrl,redirect:false});if(result?.error||!result?.ok)throw new Error("A sign-in link could not be sent. Check the address or try again later.");setStatus("If delivery is available, a sign-in link is on its way. Check your inbox and junk folder. The link expires in 15 minutes.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
    <label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@icloud.com"/>
    <button className="btn btn-primary" disabled={busy}>{busy?"Sending…":"Send sign-in link"}</button>
    <p className="muted">Use an address you control, including iCloud Mail. We send a one-time link; this app does not create an email password. Signing in does not grant team membership.</p>
    {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  </form>;
}
