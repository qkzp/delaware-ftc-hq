"use client";
import {useState} from "react";
import {signIn} from "next-auth/react";

export default function NativeOAuthStart({flow}:{flow:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);
 async function begin(){
  if(busy)return;
  setBusy(true);setError(false);
  try{
   await signIn("google",{callbackUrl:"/ios/auth/confirm?flow="+encodeURIComponent(flow)},{prompt:"select_account"});
  }catch{setBusy(false);setError(true);}
 }
 return <><button type="button" className="btn btn-primary" disabled={busy} onClick={begin}>{busy?"Connecting…":"Choose a Google account"}</button>
  {error&&<p role="alert">Could not start sign-in. Please try again.</p>}</>;
}
