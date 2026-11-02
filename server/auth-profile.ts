import type { JWT } from "next-auth/jwt";

export function minimizeIdentityToken(token: JWT, account?: { provider: string; providerAccountId: string } | null, databaseUserId?:string) {
  if(account?.provider==="email"&&!databaseUserId)throw new Error("Email identity could not be verified.");
  if (account?.provider && account.providerAccountId) token.sub = `${account.provider}:${account.provider==="email"?databaseUserId:account.providerAccountId}`;
  delete token.name;
  delete token.email;
  delete token.picture;
  return token;
}

export function privateSessionUser(token: JWT) {
  return token.sub ? { id: token.sub } : undefined;
}
