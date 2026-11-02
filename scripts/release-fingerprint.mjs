import {createHash} from "node:crypto";
import {readdirSync,readFileSync,writeFileSync,existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
export function sourceHashes(root) {
 const files=[];
 function visit(relative) {
  const absolute=path.join(root,relative);
  if(!existsSync(absolute))return;
  for(const entry of readdirSync(absolute,{withFileTypes:true})){
   const name=path.posix.join(relative,entry.name);
   if(entry.isSymbolicLink())throw new Error(`Release source cannot contain a symlink: ${name}`);
   if(entry.isDirectory())visit(name);
   else if(entry.isFile()&&name!=="server/release-manifest.json")files.push(name);
  }
 }
 for(const dir of ["app","src","server","db","drizzle","worker","lib","scripts","public","docs","config","types"])visit(dir);
 for(const file of ["auth.ts","package.json","package-lock.json","vite.config.ts","next.config.ts","vercel.json",".env.example","cloudflare-env.d.ts","tsconfig.json",".openai/hosting.json","README.md"])if(existsSync(path.join(root,file)))files.push(file);
 const sources={};
 for(const file of [...new Set(files)].sort()){
  let bytes=readFileSync(path.join(root,file));
  if(/\.(?:[cm]?[jt]sx?|json|css|md|sql|html|svg|txt)$/.test(file))bytes=Buffer.from(bytes.toString("utf8").replace(/\r\n/g,"\n"));
  // Vercel reserializes this file before the build; retain configuration semantics.
  if(file==="vercel.json")bytes=Buffer.from(JSON.stringify(JSON.parse(bytes.toString("utf8")))+"\n");
  sources[file]={bytes:bytes.byteLength,sha256:createHash("sha256").update(bytes).digest("hex")};
 }
 return sources;
}
export function fingerprint(root) {
 const hash=createHash("sha256");
 for(const [file,source] of Object.entries(sourceHashes(root))) {hash.update(file+"\0"+source.bytes+"\0"+source.sha256+"\0");}
 return "sha256:"+hash.digest("hex");
}
export function writeReleaseFingerprint(root) {
 const target=path.join(root,"server/release-manifest.json"),sources=sourceHashes(root),previous=existsSync(target)?JSON.parse(readFileSync(target,"utf8")):{};
 const sourceChanges=previous.sources?[...new Set([...Object.keys(previous.sources),...Object.keys(sources)])].filter(file=>JSON.stringify(previous.sources[file])!==JSON.stringify(sources[file])):[];
 const manifest={releaseId:fingerprint(root),algorithm:"sha256",sources,sourceChanges};
 writeFileSync(path.join(root,"server/release-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(fileURLToPath(new URL("..",import.meta.url)));
 if(process.argv.includes("--check")){
  const actual=JSON.parse(readFileSync(path.join(root,"server/release-manifest.json"),"utf8")).releaseId;
  if(actual!==fingerprint(root))throw new Error("Source changed after its release fingerprint was generated. Rebuild and review this source.");
  process.stdout.write(actual+"\n");
 }else process.stdout.write(writeReleaseFingerprint(root).releaseId+"\n");
}
