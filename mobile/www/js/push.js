// Notifications push — wrapper minimal autour de @capacitor/push-notifications.
//
// Côté serveur, le token de l'appareil est envoyé à `/api/devices/register`
// avec la plateforme ('ios'|'android'). C'est tout ce dont le backend a besoin
// pour pouvoir pousser des alertes (relances HACCP T° non saisies, commande
// confirmée par le fournisseur, etc.) — la composition + envoi via APNs/FCM
// reste à brancher côté serveur en fonction des certificats Apple Developer
// (clé p8 / FCM service account).
//
// Comme pour les autres plugins, on attaque la registry globale plutôt que
// l'import ESM (qui ne résout pas les bare specifiers dans WKWebView sans
// bundler).
import { API } from './api.js';
import { CONFIG } from './config.js';

function getPlugin() {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
  return (C.Plugins && C.Plugins.PushNotifications) || null;
}

function getPlatform() {
  const C = window.Capacitor;
  return (C && C.getPlatform && C.getPlatform()) || 'web';
}

const SENT_KEY = 'rs_push_token_sent';

async function postToken(token, platform) {
  // On évite de spammer le serveur si on a déjà envoyé ce même token.
  try {
    if (localStorage.getItem(SENT_KEY) === token) return;
  } catch {}
  try {
    await API.post('/devices/register', {
      token,
      platform,
      app_version: CONFIG.version,
    });
    try { localStorage.setItem(SENT_KEY, token); } catch {}
  } catch (e) {
    // Échec silencieux : on retentera au prochain boot.
    console.warn('[push] enregistrement token échoué', e);
  }
}

/**
 * Initialise les push : demande la permission, s'enregistre auprès d'APNs/FCM,
 * envoie le token au serveur. À appeler APRÈS login (sinon l'API renvoie 401).
 */
export async function initPush() {
  const plugin = getPlugin();
  if (!plugin) return; // web / preview : no-op

  try {
    const perm = await plugin.requestPermissions();
    if (!perm || perm.receive !== 'granted') return;

    plugin.addListener('registration', (t) => {
      const token = t && t.value;
      if (token) postToken(token, getPlatform());
    });
    plugin.addListener('registrationError', (e) => {
      console.warn('[push] registration error', e);
    });
    // Foreground notification → toast léger. La gestion d'ouverture (tap) est
    // gérée par 'pushNotificationActionPerformed' si on en ajoute plus tard.
    plugin.addListener('pushNotificationReceived', (n) => {
      const title = (n && (n.title || n.data?.title)) || 'Notification';
      const body = (n && (n.body || n.data?.body)) || '';
      try {
        window.dispatchEvent(new CustomEvent('push:received', { detail: { title, body, raw: n } }));
      } catch {}
    });

    await plugin.register();
  } catch (e) {
    console.warn('[push] init failed', e);
  }
}

/** Désinscrit le device (à appeler au logout — best-effort). */
export async function teardownPush() {
  const plugin = getPlugin();
  try { plugin && plugin.removeAllListeners && (await plugin.removeAllListeners()); } catch {}
  try { localStorage.removeItem(SENT_KEY); } catch {}
}
