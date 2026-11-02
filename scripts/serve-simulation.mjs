import {createServer} from "vite-legacy";
const server=await createServer({configFile:false,cacheDir:".sites-runtime/browser-simulation",esbuild:{jsx:"automatic"},server:{host:"127.0.0.1",port:3198,strictPort:true,hmr:false},appType:"spa",logLevel:"warn"});
await server.listen();
process.stdout.write("Fictional-data accessibility simulation ready at http://127.0.0.1:3198/tests/browser/\n");
