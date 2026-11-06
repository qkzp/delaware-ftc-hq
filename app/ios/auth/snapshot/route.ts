import type {NextRequest} from "next/server";
import {getToken} from "next-auth/jwt";
import {createNativeSnapshot,nativeSessionIdentity} from "../../../../server/native-auth-handoff";
import {matchesNativeOrigin,nativeCanonicalOrigin} from "../../../../server/native-auth-origin";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const secret=process.env.NEXTAUTH_SECRET||"",origin=nativeCanonicalOrigin(process.env.NEXTAUTH_URL);
 const headers={"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
 const fetchSite=request.headers.get("sec-fetch-site");
 if(!origin||new URL(request.url).origin!==origin||!matchesNativeOrigin(request.headers,origin)||request.headers.has("authorization")||(fetchSite&&fetchSite!=="same-origin"))
  return Response.json({error:"Unavailable"},{status:403,headers});
 const token=await getToken({req:request,secret,secureCookie:true});
 const snapshot=createNativeSnapshot(nativeSessionIdentity(token?.sub),secret);
 return snapshot?Response.json({snapshot},{headers}):Response.json({error:"Unavailable"},{status:503,headers});
}
