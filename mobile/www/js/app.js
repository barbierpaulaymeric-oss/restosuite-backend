// Point d'entrée — monte le shell (header + vue + tab bar + micro), gère la
// garde d'authentification et le routeur.
import { h, icon, emptyState } from './ui.js';
import { isAuthed, logout } from './auth.js';
import { defineRoutes, startRouter, navigate, onRouteChange } from './router.js';
import { startVoice } from './screens/alto.js';
import { ServiceScreen } from './screens/service.js';
import { FichesScreen } from './screens/fiches.js';
import { FicheDetailScreen } from './screens/fiche-detail.js';
import { HaccpScreen } from './screens/haccp.js';
import { ReceptionsScreen } from './screens/receptions.js';
import { CommandesScreen } from './screens/commandes.js';
import { AltoScreen } from './screens/alto.js';
import { AllergenesScreen } from './screens/allergenes.js';
import { LoginScreen } from './screens/login.js';

const root = document.getElementById('root');

// Onglets bas — exactement les 5 destinations demandées.
const TABS = [
  { name: 'fiches', label: 'Fiches', icon: 'fiches' },
  { name: 'haccp', label: 'HACCP', icon: 'haccp' },
  { name: 'receptions', label: 'Réceptions', icon: 'receptions' },
  { name: 'commandes', label: 'Commandes', icon: 'commandes' },
  { name: 'alto', label: 'Alto', icon: 'alto' },
];

defineRoutes({
  service: ServiceScreen,
  fiches: FichesScreen,
  haccp: HaccpScreen,
  receptions: ReceptionsScreen,
  commandes: CommandesScreen,
  alto: AltoScreen,
  allergenes: AllergenesScreen,
  // Détail d'une fiche — ingrédients, food cost, allergènes INCO, dictée Alto.
  fiche: FicheDetailScreen,
});

function mountShell() {
  const view = h('main', { class: 'app-main', id: 'view' });

  const tabbar = h('nav', { class: 'tabbar' },
    TABS.map((t) =>
      h('button', { class: 'tab', 'data-tab': t.name, onclick: () => navigate(t.name) }, [
        icon(t.icon, 26),
        h('span', {}, t.label),
      ])
    )
  );

  // Le titre/logo ramène à l'écran d'accueil « Service ».
  const header = h('header', { class: 'app-header' }, [
    h('button', { class: 'brand', onclick: () => navigate('service') }, [
      h('span', { class: 'brand-mark' }, 'RS'),
      h('span', {}, 'Service'),
    ]),
    h('div', { class: 'header-spacer' }),
    h('button', { class: 'header-action', 'aria-label': 'Déconnexion', onclick: () => { logout(); boot(); } }, [icon('logout', 22)]),
  ]);

  const mic = h('button', { class: 'mic-btn', 'aria-label': 'Dictée Alto', onclick: () => startVoice('command') }, [icon('mic', 30)]);

  root.replaceChildren(h('div', { class: 'app-shell' }, [header, view, tabbar, mic]));
  root.removeAttribute('aria-busy');

  // Surligne l'onglet actif (Service n'est pas un onglet → aucun actif).
  onRouteChange((name) => {
    tabbar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  });

  startRouter(view);
}

function boot() {
  if (!isAuthed()) {
    root.replaceChildren(LoginScreen(boot));
    root.removeAttribute('aria-busy');
    return;
  }
  mountShell();
}

// Session expirée (401) → retour au login.
window.addEventListener('auth:expired', () => boot());

boot();
