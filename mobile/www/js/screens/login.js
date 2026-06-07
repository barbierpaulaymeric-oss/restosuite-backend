// Login — mêmes identifiants que la version web (smart-login).
import { h, icon, toast } from '../ui.js';
import { login } from '../auth.js';

export function LoginScreen(onSuccess) {
  const email = h('input', { class: 'field', type: 'email', placeholder: 'Email', autocomplete: 'username', inputmode: 'email' });
  const pass = h('input', { class: 'field', type: 'password', placeholder: 'Mot de passe', autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn btn-primary' }, 'Se connecter');

  async function submit() {
    if (!email.value || !pass.value) { toast('Email et mot de passe requis', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Connexion…';
    try {
      await login(email.value, pass.value);
      onSuccess();
    } catch (e) {
      toast(e.message || 'Identifiants incorrects', 'error');
      btn.disabled = false; btn.textContent = 'Se connecter';
    }
  }
  btn.addEventListener('click', submit);
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  return h('div', { class: 'login-wrap' }, [
    h('div', { class: 'login-brand' }, [
      h('div', { class: 'brand-mark' }, 'RS'),
      h('h1', {}, 'RestoSuite Cuisine'),
      h('p', {}, 'Connectez-vous avec votre compte RestoSuite'),
    ]),
    email,
    pass,
    btn,
  ]);
}
