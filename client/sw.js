// Bumped 2026-05-05 (v26): four UX fixes — (1) ui-select dropdowns inside
// modals no longer get clipped by overflow:auto (fixed-positioning escape
// when any ancestor clips); (2) supplier-portal empty state rewritten as
// invitation CTA + new modal collecting name/email/phone (email → SMTP
// invite to supplier; phone-only → SMTP alert to ADMIN_NOTIFY_EMAIL);
// (3) admin route hardcodes barbierpaulaymeric@gmail.com as default
// (matches client allowlist) + falls back to DB email lookup for legacy
// JWTs; (4) integrations + multi-site wizard from v25 carry forward.
const CACHE_NAME = 'restosuite-v26';
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
