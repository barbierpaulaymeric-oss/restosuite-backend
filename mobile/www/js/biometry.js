// Verrouillage biométrique de l'app — Face ID / Touch ID (iOS) ou empreinte
// digitale (Android).
//
// Modèle : on conserve le token Bearer comme aujourd'hui dans localStorage ;
// la biométrie ajoute une étape de DÉVERROUILLAGE au boot. Le but n'est pas de
// chiffrer le token, c'est d'empêcher qu'un employé qui pose le téléphone dans
// la cuisine ouvre la session d'un autre.
//
// Le plugin natif (BiometricAuthNative, @aparajita/capacitor-biometric-auth)
// est exposé par Capacitor sous `window.Capacitor.Plugins.BiometricAuthNative`
// à condition que la WebView soit montée dans un contexte natif. En navigateur
// (preview, dev web), le plugin est absent → on dégrade en autorisant l'accès.

const FLAG_KEY = 'rs_biometry_enabled'; // user a accepté l'invitation
const ASKED_KEY = 'rs_biometry_asked';  // on n'invite qu'une fois

function getNativePlugin() {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
  return (C.Plugins && C.Plugins.BiometricAuthNative) || null;
}

export function isEnabled() { return localStorage.getItem(FLAG_KEY) === '1'; }
export function setEnabled(on) {
  try {
    if (on) localStorage.setItem(FLAG_KEY, '1');
    else localStorage.removeItem(FLAG_KEY);
  } catch {}
}
export function wasAsked() { return localStorage.getItem(ASKED_KEY) === '1'; }
export function markAsked() { try { localStorage.setItem(ASKED_KEY, '1'); } catch {} }

/** Le hardware est-il dispo et l'utilisateur a-t-il enrôlé un visage/empreinte ? */
export async function isAvailable() {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    const r = await plugin.checkBiometry();
    return !!(r && r.isAvailable);
  } catch { return false; }
}

/**
 * Demande à l'OS d'authentifier l'utilisateur. Renvoie true/false.
 * `reason` est affiché par iOS (Face ID prompt).
 */
export async function authenticate(reason = 'Déverrouiller RestoSuite Cuisine') {
  const plugin = getNativePlugin();
  if (!plugin) return true; // pas de hardware (web/preview) → on laisse passer

  try {
    await plugin.internalAuthenticate({
      reason,
      cancelTitle: 'Annuler',
      iosFallbackTitle: 'Utiliser le code',
      androidTitle: 'RestoSuite Cuisine',
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    });
    return true;
  } catch (e) {
    // userCancel / biometryLockout / authenticationFailed.
    return false;
  }
}
