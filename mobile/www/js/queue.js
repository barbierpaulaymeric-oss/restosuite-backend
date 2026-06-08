// File d'attente des écritures hors-ligne.
//
// En cuisine, le réseau est capricieux (tablette murale, recoin froid, néons qui
// brouillent le Wi-Fi). On ne veut PAS qu'un relevé de T° saisi à la main soit
// perdu parce que le serveur n'a pas répondu. Pattern : on tente l'appel ; si
// `NETWORK` échoue, on persiste l'opération dans localStorage et on rejoue dès
// que `navigator.onLine` repasse à true (ou au prochain boot).
//
// Volontairement simple : pas d'ordre garanti entre tenants/utilisateurs (un
// seul compte par appareil), FIFO, pas de coalescing. Les opérations sont
// idempotentes côté serveur (POST T° crée une nouvelle ligne, POST cleaning/:id/done
// est sans effet si déjà coché — voir feedback_insert_or_replace_needs_unique).
import { API } from './api.js';

const KEY = 'rs_outbox_v1';
const listeners = new Set();
let flushing = false;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  emit();
}
function emit() { for (const fn of listeners) try { fn(getPending()); } catch {} }

export function getPending() { return read(); }
export function pendingCount() { return read().length; }
export function subscribe(fn) { listeners.add(fn); fn(getPending()); return () => listeners.delete(fn); }

/** Persiste une opération (déjà tentée et échouée NETWORK). */
function persist(method, path, body, label) {
  const items = read();
  items.push({ id: Date.now() + ':' + Math.random().toString(36).slice(2, 7), method, path, body, label, ts: Date.now() });
  write(items);
}

function isNetworkErr(e) { return e && (e.code === 'NETWORK' || e.status === 0); }

/**
 * POST/PUT avec mise en file si le réseau est coupé.
 * @returns { queued:true } si différé, sinon la réponse serveur.
 * Le label sert au toast / aux logs ; il n'est PAS envoyé au serveur.
 */
export async function sendOrQueue(method, path, body, label) {
  try {
    if (method === 'POST') return await API.post(path, body);
    if (method === 'PUT') return await API.put(path, body);
    if (method === 'DELETE') return await API.del(path);
    throw new Error('méthode non supportée: ' + method);
  } catch (e) {
    if (isNetworkErr(e)) {
      persist(method, path, body || null, label || (method + ' ' + path));
      return { queued: true };
    }
    throw e;
  }
}

export const queue = {
  post: (path, body, label) => sendOrQueue('POST', path, body, label),
  put: (path, body, label) => sendOrQueue('PUT', path, body, label),
  del: (path, label) => sendOrQueue('DELETE', path, null, label),
};

/** Rejoue le buffer dans l'ordre. Stoppe au premier NETWORK (reseau toujours
 * mort). Les erreurs métier (4xx/5xx non-réseau) DROP l'opération — sinon on
 * reste bloqué éternellement sur un payload invalide. */
export async function flush() {
  if (flushing) return { flushed: 0, remaining: pendingCount() };
  flushing = true;
  let flushed = 0;
  try {
    let items = read();
    while (items.length > 0) {
      const op = items[0];
      try {
        if (op.method === 'POST') await API.post(op.path, op.body);
        else if (op.method === 'PUT') await API.put(op.path, op.body);
        else if (op.method === 'DELETE') await API.del(op.path);
        items.shift(); flushed++; write(items);
      } catch (e) {
        if (isNetworkErr(e)) break; // réseau toujours HS → on s'arrête
        // Erreur métier : on log + on jette, sinon on bloque la file.
        console.warn('[queue] drop op (erreur non-réseau):', op, e);
        items.shift(); write(items);
      }
    }
    return { flushed, remaining: items.length };
  } finally { flushing = false; }
}

/** Branche les déclencheurs automatiques. À appeler une fois au boot. */
export function installAutoFlush() {
  // Au démarrage si déjà en ligne
  if (navigator.onLine !== false) setTimeout(flush, 1500);
  // Quand on repasse en ligne
  window.addEventListener('online', () => { flush(); });
  // Filet périodique (visualViewport peut louper online)
  setInterval(() => { if (navigator.onLine !== false && pendingCount() > 0) flush(); }, 30000);
}
