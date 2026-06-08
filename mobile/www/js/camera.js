// Caméra native — wrapper minimal autour de @capacitor/camera, via le proxy
// global Capacitor.Plugins.Camera (l'app n'est pas bundlée, donc on évite
// l'import ESM qui ne se résoudrait pas dans WKWebView).
//
// En dev navigateur, le plugin n'existe pas → on dégrade sur un <input
// type=file accept=image/*> qui ouvre la galerie/le picker système.

function getPlugin() {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
  return (C.Plugins && C.Plugins.Camera) || null;
}

/**
 * Capture une photo et renvoie son contenu en base64 (sans préfixe data:).
 * @param {{quality?:number, source?:'camera'|'gallery'|'prompt'}} opts
 * @returns {Promise<{base64:string, mimeType:string} | null>}  null si annulé
 */
export async function capturePhoto(opts = {}) {
  const plugin = getPlugin();
  const quality = opts.quality ?? 80;

  if (plugin) {
    // iOS et Android exigent qu'on DEMANDE explicitement les permissions
    // caméra / photothèque avant le premier getPhoto. Si on saute l'étape,
    // getPhoto throw "User denied access" SANS afficher le prompt système →
    // l'utilisateur n'a même pas l'occasion d'accepter.
    try {
      const status = (plugin.checkPermissions && await plugin.checkPermissions()) || {};
      const needCamera = (opts.source === 'camera') || (opts.source === 'prompt');
      const needPhotos = (opts.source === 'gallery') || (opts.source === 'prompt');
      const toAsk = [];
      if (needCamera && status.camera !== 'granted') toAsk.push('camera');
      if (needPhotos && status.photos !== 'granted' && status.photos !== 'limited') toAsk.push('photos');
      if (toAsk.length && plugin.requestPermissions) {
        await plugin.requestPermissions({ permissions: toAsk });
      }
    } catch (e) {
      // pas bloquant : getPhoto re-demandera de toute façon
      console.warn('[camera] permission check failed', e);
    }

    try {
      const photo = await plugin.getPhoto({
        quality,
        allowEditing: false,
        // base64 directement → on évite un round-trip filesystem + lecture
        resultType: 'base64',
        source: opts.source === 'gallery' ? 'PHOTOS' : opts.source === 'prompt' ? 'PROMPT' : 'CAMERA',
        // Photo doit cadrer un BL : portrait
        direction: 'REAR',
        saveToGallery: false,
      });
      return {
        base64: photo.base64String,
        mimeType: 'image/' + (photo.format || 'jpeg'),
      };
    } catch (e) {
      const msg = (e && (e.message || e.errorMessage)) || '';
      // userCancelled / "User cancelled photos app" n'est pas une erreur réelle.
      if (/cancel/i.test(msg)) return null;
      // Permission denied : on remonte un message clair.
      if (/denied|permission/i.test(msg)) {
        const err = new Error('Accès caméra refusé. Activez-le dans Réglages → RestoSuite Cuisine.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      throw e;
    }
  }

  // Fallback navigateur : <input type=file>
  return await pickFileFallback();
}

function pickFileFallback() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = String(r.result || '');
        const [meta, b64] = dataUrl.split(',');
        const mime = (meta.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
        resolve({ base64: b64, mimeType: mime });
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
