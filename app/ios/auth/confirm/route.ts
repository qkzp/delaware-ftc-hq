import type {NextRequest} from "next/server";
import {getToken} from "next-auth/jwt";
import {configuredAuthMethods} from "../../../../auth";
import {hasPlatformD1Config,getPlatformD1} from "../../../../server/platform-storage";
import {nativeCanonicalOrigin} from "../../../../server/native-auth-origin";
import {handleNativeConfirmation} from "../../../../server/native-auth-confirm";

export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handler(request:NextRequest){
 const secret=process.env.NEXTAUTH_SECRET||"",origin=nativeCanonicalOrigin(process.env.NEXTAUTH_URL);
 if(!origin||!configuredAuthMethods().includes("google")||!hasPlatformD1Config()||request.headers.has("authorization"))
  return new Response("Sign-in is unavailable. Return to the iPhone app and try again.",{status:503,headers:{"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"}});
 const token=await getToken({req:request,secret,secureCookie:true});
 return handleNativeConfirmation(request,{secret,origin,db:getPlatformD1(),token});
}
export {handler as GET,handler as POST};
