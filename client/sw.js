// Bumped 2026-06-04 (v54): Import de fiches techniques depuis un fichier Excel/CSV
// — page dédiée #/import-recipes (upload → aperçu éditable → import), modèle
// Excel téléchargeable, endpoints POST /api/recipes/import(/preview) + GET
// /api/recipes/import/template, entrées d'import (page fiches, hero dashboard),
// et affordance « Coller mes fiches » dans Alto.
// Bumped 2026-06-04 (v52): Quick wins rétention — email de bienvenue à
// l'inscription, dashboard « premier jour » (hero CTA 3 options au lieu du mur
// de zéros), mention de l'import de fiches existantes, instrumentation
// d'activation (first_recipe_at / activated_at).
// Bumped 2026-06-04 (v50): Intégration Umami (analytics self-hosted, sans cookie)
// via /js/umami.js sur la landing, le blog et l'app + events data-umami-event
// (cta-essai-gratuit, inscription-submit, blog-click).
// Bumped 2026-06-04 (v49): Nouveau portail admin plateforme (#/admin-dashboard).
// Vue PA réservée aux administrateurs : KPI (restaurateurs inscrits, nouveaux
// cette semaine/ce mois, restaurants, jamais reconnectés), tableau des
// restaurateurs trié par date d'inscription avec pastilles d'activité
// (vert = actif, ambre > 14j, rouge = jamais reconnecté) + compteur de jours
// depuis la dernière connexion. Le lien Admin de la nav pointe désormais ici.
const CACHE_NAME = 'restosuite-v57';
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
