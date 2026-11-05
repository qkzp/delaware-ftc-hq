import {configuredAuthMethods} from "../../auth";
import EmailSignIn from "../../src/components/EmailSignIn";
import OAuthSignIn from "../../src/components/OAuthSignIn";
import "../../src/components/entry.css";
export const dynamic="force-dynamic";
export const metadata={title:"Sign in | MyFTCSpace",robots:{index:false,follow:false}};
export default async function LoginPage({searchParams}:{searchParams:Promise<{callbackUrl?:string;error?:string}>}){
  const params=await searchParams,methods=configuredAuthMethods();
  const candidate=params.callbackUrl||"/",callbackUrl=candidate.startsWith("/")&&!candidate.startsWith("//")&&!candidate.includes("\\")&&!candidate.startsWith("/api/")?candidate:"/";
  const labels:Record<string,string>={google:"Google","azure-ad":"Microsoft",apple:"Apple"};
  return <div className="account-entry entry-page"><header className="entry-header"><a className="entry-brand" href="/"><img src="/favicon.svg" width="24" height="24" alt=""/><strong>MyFTCSpace</strong></a><a href="/privacy">Privacy &amp; data help</a></header><main className="entry-layout"><h1>Sign in to your team.</h1><p className="entry-description">Use your own account. Your coach or mentor approves team access separately.</p>{params.error&&<p role="alert">Sign-in could not be completed. Try an enabled method again or contact your coach. Accounts using different sign-in methods are not automatically merged.</p>}{methods.filter((method):method is "google"|"azure-ad"|"apple"=>method==="google"||method==="azure-ad"||method==="apple").map(method=><div className="entry-oauth-method" key={method}><OAuthSignIn provider={method} label={labels[method]} callbackUrl={callbackUrl}/></div>)}{methods.includes("email")&&<div className="entry-detail"><h2>Sign in with email</h2><EmailSignIn callbackUrl={callbackUrl}/></div>}{!methods.length&&<p role="status">Google, Microsoft, Apple and email sign-in are supported. The service operator must configure at least one method before sign-in opens.</p>}<p className="entry-access-note">Student accounts are limited to approved ages 13–18 with the required permission. Adult operators use their own accounts.</p><div className="entry-demo"><span>Want a look around first?</span><a href="/review">Try the demo</a><small>Fictional data only. Changes reset when you reload.</small></div><a href="/">Return to MyFTCSpace</a></main></div>;
}
