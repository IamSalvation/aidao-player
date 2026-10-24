const CACHE_NAME = 'aidao-v1';
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
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // Don't cache blob URLs (your music/video files)
  if (e.request.url.startsWith('blob:')) return;
  
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
