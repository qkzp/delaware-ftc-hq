"use client";

import {useEffect,useState} from "react";
import {signIn} from "next-auth/react";

type OAuthProvider = "google" | "azure-ad" | "apple";

export default function OAuthSignIn({provider,label,callbackUrl}:{provider:OAuthProvider;label:string;callbackUrl:string}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    const resetOnRestore=(event:PageTransitionEvent)=>{if(event.persisted)setBusy(false);};
    const resetNative=()=>setBusy(false);
    window.addEventListener("pageshow",resetOnRestore);
    window.addEventListener("myftc:native-auth-finished",resetNative);
    return ()=>{window.removeEventListener("pageshow",resetOnRestore);window.removeEventListener("myftc:native-auth-finished",resetNative);};
  },[]);
  async function startSignIn(){
    if(busy)return;
    setBusy(true);
    setError(false);
    try{
      const bridge=(window as typeof window & {webkit?:{messageHandlers?:{myftcNativeAuth?:{postMessage:(value:{provider:OAuthProvider;callbackUrl:string})=>void}}}}).webkit?.messageHandlers?.myftcNativeAuth;
      if(bridge){bridge.postMessage({provider,callbackUrl});return;}
      // NextAuth obtains the CSRF token and POSTs to the provider endpoint.
      await signIn(provider,{callbackUrl});
    }catch{
      setError(true);
      setBusy(false);
    }
  }
  return <div>
    <button type="button" className="btn btn-primary entry-primary-action" disabled={busy} onClick={startSignIn}>{busy?"Connecting…":`Continue with ${label}`}</button>
    <span role="status" className="sr-only">{busy?`Connecting to ${label}…`:""}</span>
    {error&&<p role="alert">Could not start sign-in. Check your connection and try again.</p>}
  </div>;
}
