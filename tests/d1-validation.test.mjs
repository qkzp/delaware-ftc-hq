import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite-legacy";

const vite=await createServer({configFile:false,cacheDir:".sites-runtime/test-cache-d1-validation-"+process.pid,plugins:[{name:"fictional-server-only",resolveId(id){if(id==="server-only")return "\0fictional-server-only";},load(id){if(id==="\0fictional-server-only")return "export {}";}}],server:{middlewareMode:true,watch:null,hmr:false},appType:"custom",logLevel:"silent"});
after(()=>vite.close());
const {validateD1Response}=await vite.ssrLoadModule("/server/d1-validation.ts");

test("fictional provider responses preserve empty SELECT results and optional D1 fields",()=>{
 const one=validateD1Response({success:true,result:[{success:true,results:[]}]},[true]);
 assert.deepEqual(one,[{success:true,results:[],meta:{changes:0,last_row_id:undefined}}]);
 const batch=validateD1Response({success:true,result:[{results:[{id:"fictional"}]},{meta:{changes:1}},{success:true}]},[true,false,false]);
 assert.deepEqual(batch.map(row=>row.meta.changes),[0,1,0]);assert.deepEqual(batch[0].results,[{id:"fictional"}]);
});

test("fictional provider responses fail closed for partial, malformed and failed statements",()=>{
 const statements=[true,false];
 for(const payload of [
  null,{}, {success:false,result:[{results:[]},{success:true}]},
  {success:true,result:[]}, {success:true,result:[{results:[]}]},
  {success:true,result:[{results:[]},{success:true},{success:true}]},
  {success:true,result:[null,{success:true}]}, {success:true,result:[{results:[]},{}]},
  {success:true,result:[{results:[]},{success:false}]},
  {success:true,result:[{success:true},{success:true}]},
  {success:true,result:[{results:"not rows"},{success:true}]},
  {success:true,result:[{results:["not a row"]},{success:true}]},
  {success:true,result:[{results:[]},{meta:{changes:"one"}}]},
  {success:true,result:[{results:[]},{meta:{changes:-1}}]},
 ])assert.throws(()=>validateD1Response(payload,statements),/incomplete response/);
});

test("row-returning writes require results even when the SQL is not a SELECT",()=>{
 // DELETE ... RETURNING is consumed through .all() by the email-token adapter.
 assert.throws(()=>validateD1Response({success:true,result:[{success:true,meta:{changes:1}}]},[true]),/incomplete response/);
 assert.deepEqual(validateD1Response({success:true,result:[{success:true,results:[]}]},[true])[0].results,[]);
 assert.deepEqual(validateD1Response({success:true,result:[{success:true,results:[{token:"fictional"}]}]},[true])[0].results,[{token:"fictional"}]);
 assert.equal(validateD1Response({success:true,result:[{success:true,meta:{changes:1}}]},[false])[0].meta.changes,1);
});

test("the remote adapter distinguishes .all() from .run() for RETURNING statements",async()=>{
 const {getPlatformD1}=await vite.ssrLoadModule("/server/platform-storage.ts");
 const keys=["CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_D1_DATABASE_ID","CLOUDFLARE_D1_API_TOKEN"],prior=Object.fromEntries(keys.map(key=>[key,process.env[key]])),oldFetch=globalThis.fetch;
 try{
  for(const key of keys)process.env[key]="fictional";
  globalThis.fetch=async()=>Response.json({success:true,result:[{success:true,meta:{changes:1}}]});
  const query=getPlatformD1().prepare("DELETE FROM auth_verification_tokens WHERE token=? RETURNING token").bind("fictional");
  await assert.rejects(query.all(),/incomplete response/);
  assert.equal((await query.run()).meta.changes,1);
  globalThis.fetch=async()=>Response.json({success:true,result:[{success:true,results:[]}]});
  assert.deepEqual((await query.all()).results,[]);
 }finally{globalThis.fetch=oldFetch;for(const key of keys){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
