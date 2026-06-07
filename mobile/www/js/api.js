// Client API mobile — parle au même backend que la version web (restosuite.fr/api).
//
// Transport : window.fetch. En contexte natif, le plugin CapacitorHttp patche
// fetch pour passer par la couche HTTP native → pas de restriction CORS ni de
// blocage des cookies cross-origin. On s'appuie donc sur le token Bearer (renvoyé
// dans le body du login) plutôt que sur le cookie HttpOnly, qui ne survivrait pas
// au cross-origin capacitor://localhost → www.restosuite.fr.
import { CONFIG } from './config.js';

let csrfToken = null; // en mémoire uniquement (jamais persisté)
export function setCsrf(t) { csrfToken = t || null; }

export function getToken() {
  try { return localStorage.getItem(CONFIG.tokenKey); } catch { return null; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(CONFIG.tokenKey, t) : localStorage.removeItem(CONFIG.tokenKey); } catch {}
}

class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (method !== 'GET' && method !== 'HEAD' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let body = options.body;
  if (body && typeof body === 'object') body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(CONFIG.apiBase + path, { method, headers, body });
  } catch (e) {
    // Coupure réseau : laisse l'appelant basculer sur le cache offline.
    throw new ApiError('offline', 0, 'NETWORK');
  }

  if (res.status === 401) {
    // Session expirée → on purge et on laisse l'app rediriger vers le login.
    setToken(null);
    csrfToken = null;
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError('Session expirée', 401, 'UNAUTHORIZED');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || res.statusText, res.status, data.code);
  return data;
}

export const API = {
  request,
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  ApiError,
};
