// Authentification — réutilise /api/auth/smart-login (mêmes comptes que le web).
import { CONFIG } from './config.js';
import { API, setToken, setCsrf, getToken } from './api.js';

export function isAuthed() { return !!getToken(); }

export function getAccount() {
  try { return JSON.parse(localStorage.getItem(CONFIG.accountKey) || 'null'); } catch { return null; }
}
function saveAccount(a) {
  try { a ? localStorage.setItem(CONFIG.accountKey, JSON.stringify(a)) : localStorage.removeItem(CONFIG.accountKey); } catch {}
}

/** Connexion email + mot de passe. Renvoie le compte ou lève une erreur lisible. */
export async function login(email, password) {
  // smart-login route vers le bon type de compte (resto / staff) côté serveur.
  const data = await API.post('/auth/smart-login', { email: email.trim().toLowerCase(), password });
  if (data.token) setToken(data.token);
  if (data.csrf_token) setCsrf(data.csrf_token);
  if (data.account) saveAccount(data.account);
  return data.account || null;
}

export function logout() {
  setToken(null);
  setCsrf(null);
  saveAccount(null);
}
