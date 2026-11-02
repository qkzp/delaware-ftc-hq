/* Public immutable assets only. Never cache pages, sessions, API responses or team files. */
const CACHE="myftc-public-assets-v1";
const eligible=url=>url.origin===self.location.origin&&(url.pathname.startsWith("/_next/static/")||/^\/fonts\/[^/]+\.(?:woff2|woff)$/.test(url.pathname)||url.pathname==="/favicon.svg");
self.addEventListener("install",event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{try{for(const name of await caches.keys())if(name.startsWith("myftc-public-assets-")&&name!==CACHE)await caches.delete(name);}catch{}await self.clients.claim();})());});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET"||!eligible(new URL(event.request.url)))return;event.respondWith((async()=>{
 let cache,hit;try{cache=await caches.open(CACHE);hit=await cache.match(event.request);}catch{return fetch(event.request);}
 if(hit&&new URL(event.request.url).pathname.startsWith("/_next/static/"))return hit;
 try{const response=await fetch(event.request);if(response.ok&&response.type==="basic"&&!/no-store|private/i.test(response.headers.get("Cache-Control")||"")){try{await cache.put(event.request,response.clone());const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-100)))await cache.delete(key);}catch{}}return response;}catch(error){if(hit)return hit;throw error;}
 })());});
