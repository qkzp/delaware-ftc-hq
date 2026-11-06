import type { NextAuthOptions } from "next-auth";

/**
 * The email adapter stores email-link identities, while OAuth identities are
 * deliberately keyed by provider and subject. NextAuth otherwise uses the
 * adapter for OAuth callbacks too and rejects a second provider when the same
 * email is already present. Keep OAuth callbacks independent of that adapter.
 */
export function authOptionsForRoute(options: NextAuthOptions, segments: string[]): NextAuthOptions {
  const [action, providerId] = segments;
  const oauthCallback = action === "callback" && options.providers.some(
    (provider) => provider.id === providerId && provider.type === "oauth",
  );
  if (!oauthCallback || !options.adapter) return options;

  // NextAuth requires an adapter whenever its email provider is present.
  // A callback needs only the OAuth providers; all other endpoints keep the
  // original provider list and the email adapter.
  return { ...options, adapter: undefined, providers: options.providers.filter((provider) => provider.type !== "email") };
}
