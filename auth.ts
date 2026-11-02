import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { minimizeIdentityToken, privateSessionUser } from "./server/auth-profile";

const configured = (name: string) => process.env[name]?.trim() || "";

export function isAuthConfigured() {
  return !!configured("NEXTAUTH_SECRET") &&
    !!configured("GOOGLE_CLIENT_ID") && !!configured("GOOGLE_CLIENT_SECRET") &&
    !!configured("MICROSOFT_CLIENT_ID") && !!configured("MICROSOFT_CLIENT_SECRET");
}

export const authOptions: NextAuthOptions = {
  secret: configured("NEXTAUTH_SECRET"),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    GoogleProvider({
      clientId: configured("GOOGLE_CLIENT_ID"),
      clientSecret: configured("GOOGLE_CLIENT_SECRET"),
    }),
    AzureADProvider({
      clientId: configured("MICROSOFT_CLIENT_ID"),
      clientSecret: configured("MICROSOFT_CLIENT_SECRET"),
      tenantId: configured("MICROSOFT_TENANT_ID") || "common",
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      return minimizeIdentityToken(token, account);
    },
    async session({ session, token }) {
      session.user = privateSessionUser(token);
      return session;
    },
  },
  pages: { signIn: "/" },
};

export default NextAuth(authOptions);
