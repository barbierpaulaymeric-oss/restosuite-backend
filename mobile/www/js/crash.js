// Crash reporting léger — intercepte les erreurs JS et les promesses rejetées
// dans la WebView, les remonte à /api/errors/report (déjà en place côté serveur,
// rotation incluse, lecture via /api/errors/recent gérant only).
//
// On échantillonne et on déduplique : sur une boucle d'erreurs (ex. timer qui
// crashe à chaque tick), on enverrait 1000 lignes/min. Donc on garde un cache
// par signature et on n'envoie qu'au premier hit + un tick toutes les 60 s.
//
// Pas de Sentry / pas de SDK tiers : la prod hébergée sur Render n'a pas d'autre
// canal d'observabilité côté client, et /api/errors/report suffit pour les
// quelques utilisateurs qu'on a aujourd'hui.

import { API } from './api.js';
import { CONFIG } from './config.js';
import { isAuthed } from './auth.js';

const seen = new Map(); // sig → lastSentAt
const COOLDOWN_MS = 60_000;
const MAX_KEYS = 50;

function signature(payload) {
  // Une "même" erreur = même message tronqué + même source
  const m = (payload.message || '').slice(0, 80);
  const s = (payload.source || '').slice(0, 40);
  return m + '|' + s;
}

function shouldSend(sig) {
  const now = Date.now();
  const last = seen.get(sig);
  if (last && now - last < COOLDOWN_MS) return false;
  if (seen.size >= MAX_KEYS) {
    // garbage-collect les plus vieux
    const oldest = [...seen.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) seen.delete(oldest[0]);
  }
  seen.set(sig, now);
  return true;
}

function safeSend(payload) {
  if (!isAuthed()) return; // l'endpoint exige un JWT
  const sig = signature(payload);
  if (!shouldSend(sig)) return;
  // Best-effort : on enrichit avec le contexte mobile et on ne plante PAS
  // l'app si l'envoi échoue (sinon une boucle d'erreurs s'auto-amplifie).
  const enriched = {
    ...payload,
    type: payload.type || 'error',
    source: payload.source || (location && location.hash) || '',
  };
  enriched.message = `[mobile v${CONFIG.version}] ` + (payload.message || 'erreur sans message');
  API.post('/errors/report', enriched).catch(() => {});
}

export function installCrashReporting() {
  window.addEventListener('error', (e) => {
    // Erreur de chargement de ressource (script/link) — déjà gérée par le
    // filet inline dans index.html ; on ne double pas le ping.
    if (e && e.target && (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) return;
    safeSend({
      message: (e && e.message) || 'window error',
      source: (e && e.filename) || undefined,
      lineno: (e && e.lineno) || undefined,
      colno: (e && e.colno) || undefined,
      stack: e && e.error && e.error.stack ? String(e.error.stack) : undefined,
    });
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e && e.reason;
    let stack;
    let message;
    if (reason && typeof reason === 'object') {
      message = reason.message || String(reason);
      stack = reason.stack || undefined;
    } else {
      message = String(reason || 'unhandled rejection');
    }
    safeSend({
      message: 'UnhandledRejection: ' + message,
      stack,
      type: 'rejection',
    });
  });
}
