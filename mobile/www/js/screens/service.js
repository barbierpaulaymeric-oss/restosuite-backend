// Écran d'accueil « Service » — actions rapides en 2 taps, pensé mise en place + coup de feu.
import { h, icon } from '../ui.js';
import { navigate } from '../router.js';
import { getAccount } from '../auth.js';
import { startVoice } from './alto.js';

function tile({ iconName, label, sub, onClick, wide }) {
  const content = [
    h('div', { class: 'qt-icon' }, [icon(iconName, 26)]),
    h('div', { class: wide ? 'qt-text' : '' }, [
      h('div', { class: 'qt-label' }, label),
      sub ? h('div', { class: 'qt-sub' }, sub) : null,
    ]),
  ];
  return h('button', { class: 'quick-tile' + (wide ? ' wide' : ''), onclick: onClick }, content);
}

export function ServiceScreen() {
  const acc = getAccount();
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Mise en place' : hour < 15 ? 'Service midi' : hour < 18 ? 'Mise en place du soir' : 'Service du soir';

  return h('div', {}, [
    h('div', { class: 'screen-title' }, greet),
    acc ? h('p', { class: 'section-label', style: 'margin-top:-8px' }, (acc.name || acc.first_name || '').toUpperCase()) : null,

    // Actions rapides prioritaires
    h('div', { class: 'quick-grid' }, [
      tile({ iconName: 'thermometer', label: 'Relevé T°', sub: 'Saisie en 2 taps', onClick: () => navigate('haccp', { action: 'new-temp' }) }),
      tile({ iconName: 'truck', label: 'Réceptionner', sub: 'Livraison vs commande', onClick: () => navigate('receptions') }),
      tile({ iconName: 'checklist', label: 'Checklist HACCP', sub: 'du jour', onClick: () => navigate('haccp', { tab: 'checklist' }) }),
      tile({ iconName: 'timer', label: 'Minuterie', sub: 'Cuisson', onClick: () => navigate('haccp', { action: 'timer' }) }),
    ]),

    h('div', { class: 'section-label' }, 'Consulter'),
    h('div', { class: 'quick-grid' }, [
      tile({ iconName: 'fiches', label: 'Fiches techniques', sub: 'Recherche vocale', onClick: () => navigate('fiches') }),
      tile({ iconName: 'allergen', label: 'Allergènes', sub: 'Par plat', onClick: () => navigate('fiches', { filter: 'allergenes' }) }),
    ]),

    h('div', { class: 'section-label' }, 'Renouveler'),
    h('div', { class: 'quick-grid' }, [
      tile({ wide: true, iconName: 'refresh', label: 'Refaire une commande', sub: 'Renouveler une commande fournisseur en 2 taps', onClick: () => navigate('commandes', { action: 'reorder' }) }),
    ]),

    // Recherche vocale rapide
    h('div', { class: 'section-label' }, 'Assistant Alto'),
    h('button', { class: 'btn btn-primary', onclick: () => startVoice('search') }, [icon('mic', 22), 'Chercher une fiche à la voix']),
  ]);
}
