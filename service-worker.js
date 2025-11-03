const CACHE_NAME = 'pesquisafo-v2';
const urlsToCache = [
  './',
  'index.html',
  'app.html',
  'calculadora.html',
  'mapa.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'Locais etiquetados.json',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});
