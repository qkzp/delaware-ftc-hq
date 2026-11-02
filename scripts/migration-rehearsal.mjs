import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
export function migrationRehearsal(root=fileURLToPath(new URL("..",import.meta.url))){
 const db=new DatabaseSync(":memory:"),migrations=[];
 try{
  for(const name of readdirSync(path.join(root,"drizzle")).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
   const source=readFileSync(path.join(root,"drizzle",name),"utf8").replace(/\r\n/g,"\n");
   db.exec("BEGIN");try{db.exec(source);db.exec("COMMIT");}catch{db.exec("ROLLBACK");throw new Error(`Migration rehearsal failed at ${name}. No production database was contacted.`);}
   migrations.push({name,sha256:createHash("sha256").update(source).digest("hex")});
  }
  const integrity=db.prepare("PRAGMA integrity_check").get().integrity_check;
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>({name,columns:db.prepare(`PRAGMA table_info("${name.replaceAll('"','""')}")`).all().map(column=>({name:column.name,type:column.type,notNull:!!column.notnull,primaryKey:column.pk}))}));
  const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);
  return {ok:integrity==="ok",target:"local-in-memory-sqlite",productionModified:false,integrity,migrations,tables,indexes};
 }finally{db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.stdout.write(JSON.stringify(migrationRehearsal(),null,2)+"\n");
