import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createServer as createHttpServer } from "node:http";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "vite-legacy";
import { database } from "./sql-fixture.mjs";

const require = createRequire(import.meta.url);
const nextAuthRoot = dirname(require.resolve("next-auth"));
const callbackHandler = require(join(nextAuthRoot, "core/lib/callback-handler.js")).default;
const { assertConfig } = require(join(nextAuthRoot, "core/lib/assert.js"));
const { AuthHandler } = require(join(nextAuthRoot, "core/index.js"));
const { decode, encode } = require("next-auth/jwt");
const vite = await createServer({ configFile: false, cacheDir: ".sites-runtime/provider-isolation-" + process.pid, server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom", logLevel: "silent" });
after(() => vite.close());
const { authOptionsForRoute } = await vite.ssrLoadModule("/server/auth-route-options.ts");
const { d1AuthAdapter } = await vite.ssrLoadModule("/server/auth-adapter.ts");
const { minimizeIdentityToken } = await vite.ssrLoadModule("/server/auth-profile.ts");

test("OAuth callbacks keep provider identities separate from an email account", async () => {
  const db = database();
  try {
    const adapter = d1AuthAdapter(db);
    const emailUser = await adapter.createUser({ email: "member@team.test", emailVerified: new Date(), name: null, image: null });
    const providers = [
      { id: "google", type: "oauth", checks: ["pkce", "state"] },
      { id: "azure-ad", type: "oauth", checks: ["pkce", "state"] },
      { id: "email", type: "email" },
    ];
    const options = { secret: "test-secret", providers, adapter, session: { strategy: "jwt" }, jwt: {}, events: {} };
    const account = { type: "oauth", provider: "google", providerAccountId: "google-subject" };
    const profile = { id: "google-subject", email: "member@team.test", name: "Member" };

    await assert.rejects(callbackHandler({ sessionToken: null, profile, account, options }), { name: "AccountNotLinkedError" });
    const callbackOptions = authOptionsForRoute(options, ["callback", "google"]);
    assert.equal(callbackOptions.adapter, undefined);
    assert.deepEqual(callbackOptions.providers, providers.slice(0, 2));
    assert.deepEqual(callbackOptions.providers[0].checks, ["pkce", "state"]);
    assert.equal(options.adapter, adapter);
    assert.equal(options.providers.length, 3);
    assert.ok(Array.isArray(assertConfig({ options: callbackOptions, req: { action: "callback", origin: "https://team.test", query: {}, cookies: {} } })));

    const oauth = await callbackHandler({ sessionToken: "existing-session", profile, account, options: callbackOptions });
    assert.equal(oauth.user.id, "google-subject");
    assert.equal(minimizeIdentityToken({ email: profile.email }, account).sub, "google:google-subject");
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM auth_accounts").get().n, 0);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM auth_users").get().n, 1);

    const emailOptions = authOptionsForRoute(options, ["callback", "email"]);
    assert.equal(emailOptions, options);
    const emailAccount = { type: "email", provider: "email", providerAccountId: profile.email };
    const email = await callbackHandler({ sessionToken: null, profile: { email: profile.email }, account: emailAccount, options: emailOptions });
    assert.equal(email.user.id, emailUser.id);
    assert.equal(minimizeIdentityToken({}, emailAccount, email.user.id).sub, `email:${emailUser.id}`);
  } finally {
    db.close();
  }
});

test("email, session, unknown providers, and non-callback routes retain their normal options", () => {
  const options = { adapter: {}, session: { strategy: "jwt" }, providers: [{ id: "google", type: "oauth" }, { id: "email", type: "email" }] };
  for (const segments of [["signin", "google"], ["session"], ["callback", "email"], ["callback", "unknown"], ["providers"]]) {
    assert.equal(authOptionsForRoute(options, segments), options);
  }
  const googleOnly = { session: { strategy: "jwt" }, providers: [{ id: "google", type: "oauth" }] };
  assert.equal(authOptionsForRoute(googleOnly, ["callback", "google"]), googleOnly);
});

test("NextAuth OAuth round trip preserves state, PKCE, and separate identity with email enabled", async () => {
  const db = database();
  const previousOrigin = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://team.test";
  let expectedChallenge = "", tokenRequests = 0;
  const providerServer = createHttpServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/token" && request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const params = new URLSearchParams(body);
      const verifier = params.get("code_verifier") || "";
      if (params.get("code") !== "fictional-code" || createHash("sha256").update(verifier).digest("base64url") !== expectedChallenge) {
        response.writeHead(400).end(JSON.stringify({ error: "invalid_grant" }));
        return;
      }
      tokenRequests++;
      response.end(JSON.stringify({ access_token: "fictional-access-token", token_type: "Bearer" }));
      return;
    }
    if (request.url === "/userinfo") {
      response.end(JSON.stringify({ sub: "google-subject", email: "member@team.test", name: "Member" }));
      return;
    }
    response.writeHead(404).end("{}");
  });
  providerServer.listen(0, "127.0.0.1");
  await once(providerServer, "listening");
  const base = `http://127.0.0.1:${providerServer.address().port}`;
  const provider = {
    id: "google", name: "Google", type: "oauth", clientId: "fictional-client", clientSecret: "fictional-secret",
    issuer: base, authorization: { url: `${base}/authorize` }, token: { url: `${base}/token` }, userinfo: { url: `${base}/userinfo` },
    checks: ["pkce", "state"], idToken: false,
    profile: (profile) => ({ id: profile.sub, email: profile.email, name: profile.name, image: null }),
  };
  const secret = "fictional-session-secret-for-auth-test";
  const baseOptions = {
    secret, session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
    callbacks: { jwt: async ({ token, account, user }) => minimizeIdentityToken(token, account, user?.id) },
    logger: { error() {}, warn() {}, debug() {} },
  };
  const request = async (options, action, providerId, method, cookies = {}, query = {}, body = {}) => AuthHandler({
    options, req: { action, providerId, method, cookies, query, body, headers: { host: "team.test", "x-forwarded-proto": "https" } },
  });
  const applyCookies = (jar, response) => { for (const cookie of response.cookies || []) if (cookie.value) jar[cookie.name] = cookie.value; };
  try {
    const adapter = d1AuthAdapter(db);
    const emailUser = await adapter.createUser({ email: "member@team.test", emailVerified: new Date(), name: null, image: null });
    for (const emailEnabled of [true, false]) {
      const options = { ...baseOptions, providers: emailEnabled ? [provider, { id: "email", type: "email" }] : [provider], ...(emailEnabled ? { adapter } : {}) };
      const jar = {};
      const csrf = await request(options, "csrf", undefined, "GET", jar);
      applyCookies(jar, csrf);
      const signIn = await request(options, "signin", "google", "POST", jar, {}, { csrfToken: csrf.body.csrfToken, callbackUrl: "https://team.test/#settings" });
      applyCookies(jar, signIn);
      const authorization = new URL(signIn.redirect);
      const state = authorization.searchParams.get("state");
      expectedChallenge = authorization.searchParams.get("code_challenge");
      assert.ok(state && expectedChallenge);
      assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
      assert.ok(jar["__Secure-next-auth.state"]);
      assert.ok(jar["__Secure-next-auth.pkce.code_verifier"]);
      if (emailEnabled) jar["__Secure-next-auth.session-token"] = await encode({ secret, token: { sub: `email:${emailUser.id}` } });

      const callbackOptions = authOptionsForRoute(options, ["callback", "google"]);
      for (const [cookies, callbackState] of [
        [{ ...jar, "__Secure-next-auth.state": "" }, state],
        [jar, "wrong-state"],
        [{ ...jar, "__Secure-next-auth.pkce.code_verifier": "" }, state],
      ]) {
        const before = tokenRequests;
        const rejected = await request(callbackOptions, "callback", "google", "GET", cookies, { code: "fictional-code", state: callbackState });
        assert.match(rejected.redirect, /error=OAuthCallback/);
        assert.equal(tokenRequests, before);
        assert.ok(!(rejected.cookies || []).some((cookie) => cookie.name === "__Secure-next-auth.session-token" && cookie.value));
      }

      const callback = await request(callbackOptions, "callback", "google", "GET", jar, { code: "fictional-code", state });
      assert.equal(callback.redirect, "https://team.test/#settings");
      const session = callback.cookies.find((cookie) => cookie.name === "__Secure-next-auth.session-token" && cookie.value);
      assert.ok(session);
      const token = await decode({ token: session.value, secret });
      assert.equal(token.sub, "google:google-subject");
      assert.equal(token.email, undefined);
      assert.ok(callback.cookies.some((cookie) => cookie.name === "__Secure-next-auth.state" && cookie.options.maxAge === 0));
      assert.ok(callback.cookies.some((cookie) => cookie.name === "__Secure-next-auth.pkce.code_verifier" && cookie.options.maxAge === 0));
      assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM auth_accounts").get().n, 0);
      assert.equal((await adapter.getUserByEmail("member@team.test")).id, emailUser.id);
    }
    assert.equal(tokenRequests, 2);
  } finally {
    if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = previousOrigin;
    await new Promise((resolve, reject) => providerServer.close((error) => error ? reject(error) : resolve()));
    db.close();
  }
});
