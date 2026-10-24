const CACHE_NAME = 'aidao-v2'; // Bumped version to force update
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './jsmediatags.min.js',
  './manifest.json',
  './assets/aidao_player_logo_only-removebg-preview.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force the new service worker to take over immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key); // Delete old caches
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.startsWith('blob:')) return;
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
