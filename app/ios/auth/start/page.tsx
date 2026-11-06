import {headers} from "next/headers";
import {configuredAuthMethods} from "../../../../auth";
import {hasPlatformD1Config} from "../../../../server/platform-storage";
import {createNativeFlow} from "../../../../server/native-auth-handoff";
import {matchesNativeOrigin,nativeCanonicalOrigin} from "../../../../server/native-auth-origin";
import NativeOAuthStart from "../../../../src/components/NativeOAuthStart";
import "../../../../src/components/entry.css";

export const dynamic="force-dynamic";
export const metadata={title:"Sign in to MyFTCSpace on iPhone",robots:{index:false,follow:false}};
type Search=Record<string,string|string[]|undefined>;
export default async function NativeStart({searchParams}:{searchParams:Promise<Search>}){
 const params=await searchParams,requestHeaders=await headers(),origin=nativeCanonicalOrigin(process.env.NEXTAUTH_URL);
 const keys=Object.keys(params).sort().join(",");
 const values=[params.provider,params.state,params.challenge,params.snapshot,params.callbackUrl];
 const ready=origin&&matchesNativeOrigin(requestHeaders,origin)&&keys==="callbackUrl,challenge,provider,snapshot,state"&&
  values.every(value=>typeof value==="string")&&configuredAuthMethods().includes("google")&&hasPlatformD1Config();
 const flow=ready?createNativeFlow({provider:params.provider as string,state:params.state as string,challenge:params.challenge as string,snapshot:params.snapshot as string,callbackUrl:params.callbackUrl as string},process.env.NEXTAUTH_SECRET||""):null;
 return <main className="account-entry entry-page"><div className="entry-layout">
  <h1>Sign in to MyFTCSpace on iPhone.</h1>
  {flow?<><p>Choose the Google account you want to use in the app. Continue only if you started this sign-in from your iPhone.</p><NativeOAuthStart flow={flow}/></>:
   <p role="alert">This sign-in request is unavailable or expired. Return to the iPhone app and try again.</p>}
 </div></main>;
}
