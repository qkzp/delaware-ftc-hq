import type {NextAuthOptions} from "next-auth";
import {nativeSessionMarker,readNativeFlow,validNativeIdentity} from "./native-auth-handoff";

/** Add a flow marker only after NextAuth validates the actual OAuth callback. */
export function nativeOAuthCallbackOptions(options:NextAuthOptions,segments:string[],method:string,cookieValue:string|undefined,origin:string,secret:string):NextAuthOptions {
 if(method!=="GET"||segments.length!==2||segments[0]!=="callback"||segments[1]!=="google"||!cookieValue||cookieValue.length>5000)return options;
 let callback:URL;
 try{callback=new URL(cookieValue);}catch{try{callback=new URL(decodeURIComponent(cookieValue));}catch{return options;}}
 if(callback.origin!==origin||callback.pathname!=="/ios/auth/confirm"||callback.hash||callback.username||callback.password||
    [...callback.searchParams.keys()].some(key=>key!=="flow")||callback.searchParams.getAll("flow").length!==1)return options;
 const flow=readNativeFlow(callback.searchParams.get("flow"),secret);
 if(!flow||flow.provider!==segments[1])return options;
 const original=options.callbacks?.jwt;
 return {...options,callbacks:{...options.callbacks,async jwt(params){
  const token=original?await original(params):params.token;
  if(params.account?.type==="oauth"&&params.account.provider===flow.provider&&
     (params.trigger==="signIn"||params.trigger==="signUp")&&validNativeIdentity(token.sub,flow.provider)){
   token.nativeAuthFlow=nativeSessionMarker(flow,token.sub);
  }
  return token;
 }}};
}
