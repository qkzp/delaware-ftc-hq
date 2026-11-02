import test, {after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite-legacy";

const vite=await createServer({configFile:false,cacheDir:".sites-runtime/test-cache-"+process.pid,server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {minimizeIdentityToken,privateSessionUser}=await vite.ssrLoadModule("/server/auth-profile.ts");

test("OAuth sessions retain a provider-scoped identifier without profile name, email or image",async()=>{
  const token=minimizeIdentityToken({sub:"raw-subject",name:"Private profile",email:"private@example.org",picture:"https://example.org/private.png"},{provider:"google",providerAccountId:"account-1"});
  assert.deepEqual(token,{sub:"google:account-1"});
  const renewed=minimizeIdentityToken(token,null);
  assert.equal(renewed.sub,"google:account-1");
  assert.deepEqual(privateSessionUser(token),{id:"google:account-1"});
  assert.equal(privateSessionUser({}),undefined);
});

test("identical provider subjects cannot merge Google and Microsoft identities",async()=>{
  const google=minimizeIdentityToken({},{provider:"google",providerAccountId:"same-subject"});
  const microsoft=minimizeIdentityToken({},{provider:"azure-ad",providerAccountId:"same-subject"});
  assert.notEqual(google.sub,microsoft.sub);
});
