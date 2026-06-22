// Login — mêmes identifiants que la version web (smart-login).
import { h, icon, toast } from '../ui.js';
import { login } from '../auth.js';
import { isAvailable as bioAvailable, isEnabled as bioEnabled, setEnabled as setBioEnabled, wasAsked as bioAsked, markAsked as markBioAsked } from '../biometry.js';

export function LoginScreen(onSuccess) {
  const email = h('input', { class: 'field', type: 'email', placeholder: 'Email', autocomplete: 'username', inputmode: 'email' });
  const pass = h('input', { class: 'field', type: 'password', placeholder: 'Mot de passe', autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn btn-primary' }, 'Se connecter');

  async function submit() {
    if (!email.value || !pass.value) { toast('Email et mot de passe requis', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Connexion…';
    try {
      await login(email.value, pass.value);
      // Première connexion sur cet appareil : on propose Face/Touch ID si dispo.
      // (On ne demande qu'UNE fois — l'utilisateur peut désactiver depuis Service.)
      if (!bioAsked() && !bioEnabled()) {
        markBioAsked();
        const ok = await bioAvailable();
        if (ok) {
          const enable = confirm('Activer Face ID / Touch ID pour déverrouiller l\'app plus rapidement ?');
          if (enable) setBioEnabled(true);
        }
      }
      onSuccess();
    } catch (e) {
      // Sur mauvais identifiants, garder l'email et ne vider QUE le mot de passe.
      const msg = (e && e.code === 'BAD_CREDENTIALS')
        ? 'Mot de passe ou identifiant incorrect'
        : (e.message || 'Connexion échouée');
      toast(msg, 'error');
      pass.value = '';
      pass.focus();
      btn.disabled = false; btn.textContent = 'Se connecter';
    }
  }
  btn.addEventListener('click', submit);
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  return h('div', { class: 'login-wrap' }, [
    h('div', { class: 'login-brand' }, [
      h('img', { class: 'brand-mark', src: './assets/logo-restosuite.svg', alt: 'RestoSuite' }),
      h('h1', {}, 'RestoSuite Cuisine'),
      h('p', {}, 'Connectez-vous avec votre compte RestoSuite'),
    ]),
    email,
    pass,
    btn,
  ]);
}
