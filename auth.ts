import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import AppleProvider from "next-auth/providers/apple";
import type { EmailConfig } from "next-auth/providers/email";
import { minimizeIdentityToken, privateSessionUser } from "./server/auth-profile";
import {d1AuthAdapter,normalizeLoginEmail} from "./server/auth-adapter";
import {sendLoginEmail} from "./server/email-delivery";
import {getPlatformD1,hasPlatformD1Config} from "./server/platform-storage";
import {nativeHandoffProvider} from "./server/native-auth-provider";

const configured = (name: string) => process.env[name]?.trim() || "";

const emailEnabled=()=>!!configured("RESEND_API_KEY")&&!!configured("EMAIL_FROM")&&hasPlatformD1Config();
export function configuredAuthMethods(){
  if(!configured("NEXTAUTH_SECRET"))return [];
  return [configured("GOOGLE_CLIENT_ID")&&configured("GOOGLE_CLIENT_SECRET")?"google":"",configured("MICROSOFT_CLIENT_ID")&&configured("MICROSOFT_CLIENT_SECRET")?"azure-ad":"",configured("APPLE_CLIENT_ID")&&configured("APPLE_CLIENT_SECRET")?"apple":"",emailEnabled()?"email":""].filter(Boolean);
}
export function isAuthConfigured(){return configuredAuthMethods().length>0;}
const providers:NextAuthOptions["providers"]=[];
if(configured("GOOGLE_CLIENT_ID")&&configured("GOOGLE_CLIENT_SECRET"))providers.push(GoogleProvider({clientId:configured("GOOGLE_CLIENT_ID"),clientSecret:configured("GOOGLE_CLIENT_SECRET")}));
if(configured("MICROSOFT_CLIENT_ID")&&configured("MICROSOFT_CLIENT_SECRET"))providers.push(AzureADProvider({clientId:configured("MICROSOFT_CLIENT_ID"),clientSecret:configured("MICROSOFT_CLIENT_SECRET"),tenantId:configured("MICROSOFT_TENANT_ID")||"common"}));
if(configured("APPLE_CLIENT_ID")&&configured("APPLE_CLIENT_SECRET"))providers.push(AppleProvider({clientId:configured("APPLE_CLIENT_ID"),clientSecret:configured("APPLE_CLIENT_SECRET")}));
if(emailEnabled())providers.push({id:"email",type:"email",name:"Email",server:{},from:configured("EMAIL_FROM"),maxAge:15*60,options:{},normalizeIdentifier:normalizeLoginEmail,sendVerificationRequest:async({identifier,url})=>sendLoginEmail(getPlatformD1(),{identifier,url},{apiKey:configured("RESEND_API_KEY"),from:configured("EMAIL_FROM")})} as EmailConfig);
if(configured("NEXTAUTH_SECRET")&&configured("GOOGLE_CLIENT_ID")&&configured("GOOGLE_CLIENT_SECRET")&&hasPlatformD1Config())providers.push(nativeHandoffProvider(getPlatformD1,configured("NEXTAUTH_SECRET")));

export const authOptions: NextAuthOptions = {
  secret: configured("NEXTAUTH_SECRET"),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers,
  ...(emailEnabled()?{adapter:d1AuthAdapter(getPlatformD1())}:{}),
  callbacks: {
    async jwt({ token, account, user }) {
      return minimizeIdentityToken(token, account, user?.id);
    },
    async session({ session, token }) {
      session.user = privateSessionUser(token);
      return session;
    },
  },
  pages: { signIn: "/signin" },
};
