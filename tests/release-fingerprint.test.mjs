import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fingerprint,sourceHashes} from "../scripts/release-fingerprint.mjs";

function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),"myftc-release-hash-"));
 t.after(()=>{
  const resolved=path.resolve(root),expected=path.resolve(tmpdir())+path.sep;
  assert.ok(resolved.startsWith(expected)&&path.basename(resolved).startsWith("myftc-release-hash-"));
  rmSync(resolved,{recursive:true,force:true});
 });
 for(const dir of ["scripts/vite","src","public"])mkdirSync(path.join(root,dir),{recursive:true});
 return root;
}

test("release hashes match across LF and CRLF for tracked text formats",t=>{
 const root=fixture(t),files=[".env.example","scripts/deploy.sh","scripts/vite/component.LICENSE","src/app.ts"];
 for(const file of files)writeFileSync(path.join(root,file),"first line\nhéllo\n");
 const lfSources=sourceHashes(root),lfFingerprint=fingerprint(root);
 for(const file of files)writeFileSync(path.join(root,file),"first line\r\nhéllo\r\n");
 assert.deepEqual(sourceHashes(root),lfSources);
 assert.equal(fingerprint(root),lfFingerprint);
 writeFileSync(path.join(root,"scripts/deploy.sh"),"first line\r\nchanged line\r\n");
 assert.notEqual(fingerprint(root),lfFingerprint);
});

test("release hashes preserve binary bytes, even with a text extension",t=>{
 const root=fixture(t),cases=[
  ["public/image.bin",Buffer.from([0xff,0x41,0x0d,0x0a,0x42]),Buffer.from([0xff,0x41,0x0a,0x42])],
  ["scripts/non-utf8.sh",Buffer.from([0xff,0x41,0x0d,0x0a,0x42]),Buffer.from([0xff,0x41,0x0a,0x42])],
  ["scripts/embedded-nul.sh",Buffer.from([0,0x41,0x0d,0x0a,0x42]),Buffer.from([0,0x41,0x0a,0x42])],
 ];
 for(const [file,original] of cases)writeFileSync(path.join(root,file),original);
 const before=sourceHashes(root);
 for(const [file,original] of cases)assert.equal(before[file].sha256,createHash("sha256").update(original).digest("hex"));
 for(const [file,,changed] of cases)writeFileSync(path.join(root,file),changed);
 const after=sourceHashes(root);
 for(const [file] of cases)assert.notEqual(after[file].sha256,before[file].sha256);
});
