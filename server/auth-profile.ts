import type { JWT } from "next-auth/jwt";
import {validNativeIdentity} from "./native-auth-handoff";

export function minimizeIdentityToken(token: JWT, account?: { provider: string; providerAccountId: string; type?:string } | null, databaseUserId?:string) {
  if(account?.provider)delete token.nativeAuthFlow;
  if(account?.provider==="email"&&!databaseUserId)throw new Error("Email identity could not be verified.");
  if(account?.provider==="native-handoff"){
    if(account.type!=="credentials"||account.providerAccountId!==databaseUserId||!validNativeIdentity(databaseUserId,"google"))throw new Error("Native identity could not be verified.");
    token.sub=databaseUserId;
    account=null;
  }
  if (account?.provider && account.providerAccountId) token.sub = `${account.provider}:${account.provider==="email"?databaseUserId:account.providerAccountId}`;
  delete token.name;
  delete token.email;
  delete token.picture;
  return token;
}

export function privateSessionUser(token: JWT) {
  return token.sub ? { id: token.sub } : undefined;
}
