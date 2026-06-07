// Fiches techniques — consultation rapide + recherche (texte ou voix), avec cache offline.
import { h, icon, emptyState, toast } from '../ui.js';
import { API } from '../api.js';
import { fetchWithCache } from '../store.js';
import { navigate } from '../router.js';
import { startVoice } from './alto.js';

export function FichesScreen(query) {
  const onlyAllergenes = query.get('filter') === 'allergenes';
  const list = h('div', {}, [emptyState('search', 'Chargement des fiches…')]);

  const search = h('input', {
    class: 'field', type: 'search', placeholder: 'Rechercher un plat, un ingrédient…',
    oninput: (e) => render(e.target.value),
  });

  const root = h('div', {}, [
    h('div', { class: 'screen-title' }, onlyAllergenes ? 'Allergènes' : 'Fiches techniques'),
    h('div', { style: 'display:flex; gap:10px; align-items:center' }, [
      h('div', { style: 'flex:1' }, [search]),
      h('button', { class: 'header-action', onclick: () => startVoice('search'), 'aria-label': 'Recherche vocale' }, [icon('mic', 22)]),
    ]),
    list,
  ]);

  let all = [];
  function render(term = '') {
    const t = term.trim().toLowerCase();
    const rows = all.filter((r) => !t || (r.name || '').toLowerCase().includes(t) || (r.category || '').toLowerCase().includes(t));
    if (!rows.length) { list.replaceChildren(emptyState('fiches', t ? 'Aucune fiche trouvée' : 'Aucune fiche', t ? 'Essayez un autre terme' : null)); return; }
    list.replaceChildren(...rows.map((r) =>
      h('div', { class: 'list-row', onclick: () => navigate('fiche', { id: r.id }) }, [
        h('div', { class: 'lr-main' }, [
          h('div', { class: 'lr-title' }, r.name || 'Sans nom'),
          h('div', { class: 'lr-sub' }, [r.category || 'Non classé', r.portions ? ` · ${r.portions} portions` : ''].join('')),
        ]),
        icon('search', 20),
      ])
    ));
  }

  (async () => {
    try {
      const { value, stale } = await fetchWithCache('recipes', () => API.get('/recipes?limit=500'));
      all = value.recipes || [];
      if (stale) toast('Mode hors-ligne — fiches en cache', 'warn');
      render(search.value);
    } catch (e) {
      list.replaceChildren(emptyState('fiches', 'Indisponible hors-ligne', 'Connectez-vous une fois pour télécharger les fiches.'));
    }
  })();

  return root;
}
