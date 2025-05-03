const CACHE_NAME = 'agendamento-cache-v1';
const ASSETS = [
  '/frontend/pages/agendamento.html',
  '/frontend/assets/css/styles.css',
  '/frontend/assets/js/main.js',
  '/frontend/manifest.json',
  // se tiver ícones:
  '/frontend/assets/icons/icon-192.png',
  '/frontend/assets/icons/icon-512.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(cached => cached || fetch(evt.request))
  );
});
