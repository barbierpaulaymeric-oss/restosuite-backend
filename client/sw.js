const CACHE_NAME = 'restosuite-v2';
const STATIC_ASSETS = [
  '/app',
  '/css/style.css',
  '/js/app.js',
  '/js/router.js',
  '/js/api.js',
  '/assets/logo-icon.svg',
  '/assets/logo-full.svg',
  '/assets/icon-192.png',
  '/manifest.json'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets might fail, continue anyway
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
        );
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback (for API calls, always network)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API calls: always network
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Static assets: network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
