const VERSION='22';
const CACHE_NAME='pesquisafo-local-v'+VERSION;
const LOCAL_ASSETS=['./','index.html','app.html','calculadora.html','mapa.html','comparar.html','styles.css','modern.css','ui.js','quick-search.js','shared.js','app.js','comparar.js','pdf-export.js','manifest.json','locais.json','sw-register.js','icons/icon-192.png','icons/icon-512.png','vendor/leaflet.css','vendor/leaflet.js','vendor/jspdf.umd.min.js','offline-map/flores.json'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(LOCAL_ASSETS.map(url=>new Request(url,{cache:'reload'})));
  // v18 only displays its update button AFTER activation: migrate this legacy UI.
  const names=await caches.keys();if(names.includes('pesquisafo-v18'))await self.skipWaiting();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='STATUS')event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);const items=await Promise.all(LOCAL_ASSETS.map(url=>cache.match(url)));event.ports[0]?.postMessage({version:VERSION,ready:items.every(Boolean)});})());
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith('pesquisafo-')&&n!==CACHE_NAME).map(n=>caches.delete(n)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);const key=event.request.mode==='navigate'?url.origin+url.pathname:event.request;const cached=await cache.match(key);if(cached)return cached;try{return await fetch(event.request);}catch{return new Response('Recurso indisponível offline.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());
});