const CACHE_NAME = 'pesquisafo-v6';

// Ficheiros do próprio site (mesma origem) — se algum destes falhar a
// descarregar, a instalação do Service Worker falha toda, por isso só
// devem estar aqui ficheiros que sabemos que existem sempre.
const LOCAL_ASSETS = [
  './',
  'index.html',
  'app.html',
  'calculadora.html',
  'mapa.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'Locais etiquetados.json',
  'sw-register.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png'
];

// Bibliotecas externas (CDN) usadas pelo Mapa e pela Calculadora.
// Guardadas à parte com "no-cors" e sem bloquear a instalação caso uma
// falhe (ex: sem internet na primeira visita) — assim a app instala-se
// sempre, mesmo que fique sem estas bibliotecas em cache até à próxima vez
// que houver ligação.
const CDN_ASSETS = [
  'https://unpkg.com/maplibre-gl@5.18.0/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@5.18.0/dist/maplibre-gl.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(LOCAL_ASSETS);
      await Promise.allSettled(
        CDN_ASSETS.map(url => cache.add(new Request(url, { mode: 'no-cors' })))
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resposta => {
        // Guarda em cache pedidos que ainda não estavam lá (ex: bibliotecas
        // CDN que falharam na instalação inicial), para funcionarem offline
        // a partir da próxima vez.
        if (event.request.method === 'GET' && resposta && (resposta.ok || resposta.type === 'opaque')) {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia)).catch(() => {});
        }
        return resposta;
      }).catch(() => cached);
    })
  );
});
