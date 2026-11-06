import type {CredentialsConfig} from "next-auth/providers/credentials";
import {getToken} from "next-auth/jwt";
import type {NextRequest} from "next/server";
import {nativeSessionIdentity,redeemNativeTicket} from "./native-auth-handoff";

async function currentIdentity(headers:Record<string,string>|undefined,secret:string):Promise<string|null>{
 if(headers?.authorization)throw new Error("Unsupported authorization header");
 const cookieHeader=headers?.cookie||"";
 if(typeof cookieHeader!=="string"||cookieHeader.length>16384)throw new Error("Invalid cookies");
 const cookies:Record<string,string>={};
 for(const part of cookieHeader.split(";")){
  const index=part.indexOf("=");if(index<0)continue;
  const name=part.slice(0,index).trim();
  if(!/^__Secure-next-auth\.session-token(?:\.\d+)?$/.test(name))continue;
  if(Object.hasOwn(cookies,name))throw new Error("Duplicate session cookie");
  cookies[name]=decodeURIComponent(part.slice(index+1).trim());
 }
 const token=await getToken({req:{cookies,headers:new Headers()} as unknown as NextRequest,secret,secureCookie:true});
 return nativeSessionIdentity(token?.sub);
}
export function nativeHandoffProvider(storage:()=>D1Database,secret:string):CredentialsConfig<{ticket:{};verifier:{};snapshot:{}}>{
 return {
  id:"native-handoff",type:"credentials",name:"iPhone handoff",credentials:{ticket:{},verifier:{},snapshot:{}},
  async authorize(credentials,request){
   try{
    const identity=await currentIdentity(request.headers as Record<string,string>|undefined,secret);
    const id=await redeemNativeTicket(storage(),credentials?.ticket,credentials?.verifier,credentials?.snapshot,identity,secret);
    return id?{id}:null;
   }catch{return null;}
  },
 };
}
