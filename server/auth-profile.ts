import type { JWT } from "next-auth/jwt";

export function minimizeIdentityToken(token: JWT, account?: { provider: string; providerAccountId: string } | null) {
  if (account?.provider && account.providerAccountId) token.sub = `${account.provider}:${account.providerAccountId}`;
  delete token.name;
  delete token.email;
  delete token.picture;
  return token;
}

export function privateSessionUser(token: JWT) {
  return token.sub ? { id: token.sub } : undefined;
}
