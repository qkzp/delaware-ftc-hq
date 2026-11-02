import {readFileSync,readdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("..",import.meta.url));
const packages=["react","react-dom","scheduler","react-server-dom-webpack","leaflet","lucide-react","drizzle-orm","next","vinext"];
const sections=["MyFTCSpace third-party notices\n\nUpstream notices for the principal shipped libraries and local fonts. These notices do not grant permission to use student media or FIRST trademarks. Map data attribution: https://www.openstreetmap.org/copyright\n"];
for(const name of packages){
 const dir=path.join(root,"node_modules",name),pkg=JSON.parse(readFileSync(path.join(dir,"package.json"),"utf8"));
 const notices=readdirSync(dir).filter(file=>/^(?:licen[sc]e|notice|third[_-]party[_-]licen[sc]es)(?:\.|$)/i.test(file));
 if(name==="drizzle-orm"&&!notices.length){
  sections.push(`${name} ${pkg.version}\nUpstream: https://raw.githubusercontent.com/drizzle-team/drizzle-orm/${pkg.version}/LICENSE\n\n${readFileSync(path.join(root,"docs/licenses",`drizzle-orm-${pkg.version}-LICENSE.txt`),"utf8")}`);
  continue;
 }
 if(!notices.length)throw new Error(`Missing license for ${name}; review before distribution.`);
 sections.push(`${name} ${pkg.version}\n${"=".repeat(60)}\n`+notices.map(file=>`${file}\n\n${readFileSync(path.join(dir,file),"utf8")}`).join("\n\n"));
}
for(const name of readdirSync(path.join(root,"public/fonts")).filter(file=>file.endsWith("-OFL.txt")))sections.push(`${name}\n${"=".repeat(60)}\n${readFileSync(path.join(root,"public/fonts",name),"utf8")}`);
writeFileSync(path.join(root,"public/third-party-notices.txt"),sections.join("\n\n")+"\n");
process.stdout.write("Third-party library and font notices retained.\n");
