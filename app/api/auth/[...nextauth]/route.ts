import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "../../../../auth";
import { authOptionsForRoute } from "../../../../server/auth-route-options";
import { nativeOAuthCallbackOptions } from "../../../../server/native-auth-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const { nextauth } = await context.params;
  let options = authOptionsForRoute(authOptions, nextauth);
  try {
    const origin = new URL(process.env.NEXTAUTH_URL || "").origin;
    const cookieName = origin.startsWith("https://") ? "__Secure-next-auth.callback-url" : "next-auth.callback-url";
    options = nativeOAuthCallbackOptions(options, nextauth, request.method, request.cookies.get(cookieName)?.value, origin, process.env.NEXTAUTH_SECRET || "");
  } catch {
    // An invalid canonical origin leaves normal NextAuth behavior unchanged.
  }
  return NextAuth(request, context, options);
}
export { handler as GET, handler as POST };
