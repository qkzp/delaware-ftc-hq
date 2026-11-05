import test,{after} from "node:test";
import assert from "node:assert/strict";
import React,{act} from "react";
import {JSDOM} from "jsdom";
import {createServer} from "vite-legacy";

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:"https://team.test/signin",pretendToBeVisual:true});
Object.defineProperties(globalThis,{
  window:{value:dom.window,configurable:true},document:{value:dom.window.document,configurable:true},
  navigator:{value:dom.window.navigator,configurable:true},location:{value:dom.window.location,configurable:true},
});
const {createRoot}=await import("react-dom/client");
const vite=await createServer({configFile:false,cacheDir:".sites-runtime/oauth-test-cache-"+process.pid,esbuild:{jsx:"automatic"},plugins:[{name:"fictional-server-only",resolveId(id){if(id==="server-only")return "\0fictional-server-only";},load(id){if(id==="\0fictional-server-only")return "export {}";}}],server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
const {default:OAuthSignIn}=await vite.ssrLoadModule("/src/components/OAuthSignIn.tsx");
after(async()=>{await vite.close();dom.window.close();});

test("the sign-in page presents enabled providers as actions rather than broken GET links",async()=>{
  const names=["NEXTAUTH_SECRET","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","MICROSOFT_CLIENT_ID","MICROSOFT_CLIENT_SECRET","APPLE_CLIENT_ID","APPLE_CLIENT_SECRET","RESEND_API_KEY","EMAIL_FROM"];
  const original=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  try{
    for(const name of names)delete process.env[name];
    const {default:LoginPage}=await vite.ssrLoadModule("/app/signin/page.tsx");
    Object.assign(process.env,{NEXTAUTH_SECRET:"test-secret",GOOGLE_CLIENT_ID:"test-client",GOOGLE_CLIENT_SECRET:"test-client-secret"});
    const {renderToStaticMarkup}=await import("react-dom/server");
    const markup=renderToStaticMarkup(await LoginPage({searchParams:Promise.resolve({callbackUrl:"/enroll"})}));
    assert.match(markup,/<button[^>]*>Continue with Google<\/button>/);
    assert.doesNotMatch(markup,/href="\/api\/auth\/signin\/google/);
    assert.doesNotMatch(markup,/Continue with Microsoft|Continue with Apple/);
    delete process.env.GOOGLE_CLIENT_SECRET;
    const unconfigured=renderToStaticMarkup(await LoginPage({searchParams:Promise.resolve({})}));
    assert.match(unconfigured,/configure at least one method/);
    assert.doesNotMatch(unconfigured,/Continue with Google/);
  }finally{
    for(const name of names){if(original[name]===undefined)delete process.env[name];else process.env[name]=original[name];}
  }
});

test("each OAuth button starts a CSRF-protected provider POST and preserves the local callback",async()=>{
  const previousFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async(url,options={})=>{
    const path=String(url);
    requests.push({path,options});
    if(path.endsWith("/providers"))return Response.json(Object.fromEntries(["google","azure-ad","apple"].map(id=>[id,{id,type:"oauth"}])));
    if(path.endsWith("/csrf"))return Response.json({csrfToken:"fictional-csrf-token"});
    if(path.includes("/signin/"))return Response.json({url:"https://team.test/signin"});
    throw new Error(`Unexpected auth request: ${path}`);
  };
  const container=document.getElementById("root"),root=createRoot(container);
  try{
    for(const [provider,label] of [["google","Google"],["azure-ad","Microsoft"],["apple","Apple"]]){
      await act(async()=>root.render(React.createElement(OAuthSignIn,{key:provider,provider,label,callbackUrl:"/enroll"})));
      const button=container.querySelector("button");
      assert.equal(button.textContent,`Continue with ${label}`);
      await act(async()=>button.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));
      const request=requests.findLast(item=>item.path.endsWith(`/signin/${provider}`));
      assert.ok(request,`${provider} should initiate its own sign-in endpoint`);
      assert.equal(request.options.method.toLowerCase(),"post");
      const body=new URLSearchParams(request.options.body);
      assert.equal(body.get("csrfToken"),"fictional-csrf-token");
      assert.equal(body.get("callbackUrl"),"/enroll");
      assert.equal(button.disabled,true,"sign-in stays pending until the browser navigates");
      assert.match(container.querySelector('[role="status"]').textContent,new RegExp(`Connecting to ${label}`));
      const requestCount=requests.length;
      await act(async()=>button.click());
      assert.equal(requests.length,requestCount,"repeated clicks do not start another sign-in");
      const restored=new dom.window.Event("pageshow");
      Object.defineProperty(restored,"persisted",{value:true});
      await act(async()=>dom.window.dispatchEvent(restored));
      assert.equal(button.disabled,false,"restoring the page after canceling sign-in allows another attempt");
    }
  }finally{
    await act(async()=>root.unmount());
    globalThis.fetch=previousFetch;
  }
});

test("a failed sign-in request explains the error and lets the user retry",async()=>{
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async(url)=>{
    if(String(url).endsWith("/providers"))return Response.json({google:{id:"google",type:"oauth"}});
    if(String(url).endsWith("/csrf"))return Response.json({csrfToken:"fictional-csrf-token"});
    throw new Error("Network unavailable");
  };
  const container=document.getElementById("root"),root=createRoot(container);
  try{
    await act(async()=>root.render(React.createElement(OAuthSignIn,{provider:"google",label:"Google",callbackUrl:"/"})));
    await act(async()=>container.querySelector("button").dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));
    assert.match(container.querySelector('[role="alert"]').textContent,/could not start sign-in/i);
    assert.equal(container.querySelector("button").disabled,false);
    assert.equal(container.querySelector('[role="status"]').textContent,"");
  }finally{
    await act(async()=>root.unmount());
    globalThis.fetch=previousFetch;
  }
});
