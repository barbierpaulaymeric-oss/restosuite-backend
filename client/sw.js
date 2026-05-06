// Bumped 2026-05-06 (v38): hotfix — Fournisseurs sidebar entry was
// dead-clicking because client/js/views/mercuriale.js declared a
// top-level `function renderSuppliers(suppliers)` that clobbered the
// canonical `renderSuppliers()` from views/suppliers.js (concat bundle
// = single global scope, last decl wins). Renamed mercuriale's helper
// to `renderMercurialeSuppliers`. Router /suppliers now resolves to
// the real list view again.
// (v37 was Opérations sidebar cleanup.)
const CACHE_NAME = 'restosuite-v38';
const STATIC_ASSETS = [
  '/app',
  '/css/style.css',
  // The actual bundled SPA is /js/app.bundle.js — pre-cache it on install
  // so the network-first fetch handler has a reliable fallback. The old
  // STATIC_ASSETS list pointed at /js/app.js (the unbundled source) which
  // doesn't exist in production, so the bundle was only ever cached
  // dynamically and never invalidated.
  '/js/app.bundle.js',
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

// Activate: clean old caches + nudge open clients to reload so they pick up
// the new bundle. Without this nudge a user who already has the SPA loaded
// keeps running the OLD JS in memory until they manually reload, which
// looked like "the fix isn't deployed" in production reports. The page-side
// listener in app.js does a hard reload when it sees `{ type: 'sw-update' }`.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.postMessage({ type: 'sw-update', cache: CACHE_NAME }); } catch {}
    }
  })());
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
