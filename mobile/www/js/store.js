// Cache offline simple (localStorage) — consultation des fiches techniques sans
// connexion en cuisine. On garde un snapshot horodaté par clé ; l'écran tente le
// réseau d'abord, puis retombe sur le cache si hors-ligne.
const PREFIX = 'rs_cache_';

export function cacheSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {}
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw); // { at, value }
  } catch { return null; }
}

/**
 * Récupère via le réseau et met en cache ; bascule sur le cache si offline.
 * @returns {{value:any, stale:boolean, at:number|null}}
 */
export async function fetchWithCache(key, fetcher) {
  try {
    const value = await fetcher();
    cacheSet(key, value);
    return { value, stale: false, at: Date.now() };
  } catch (e) {
    const cached = cacheGet(key);
    if (cached) return { value: cached.value, stale: true, at: cached.at };
    throw e;
  }
}

export function isOnline() { return navigator.onLine !== false; }
