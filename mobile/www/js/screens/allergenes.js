// Allergènes — consultation ultra-rapide pour répondre à un client en salle.
// Recherche par nom de plat → affichage visuel des 14 allergènes INCO (pastilles).
// API : GET /api/allergens (référentiel 14 INCO), GET /api/allergens/recipes/:id.
import { h, icon, emptyState, toast } from '../ui.js';
import { API } from '../api.js';
import { fetchWithCache } from '../store.js';
import { startVoice } from './alto.js';

export function AllergenesScreen() {
  const list = h('div', {}, [emptyState('search', 'Chargement des plats…')]);
  const panel = h('div', {}); // détail allergènes du plat sélectionné

  const search = h('input', {
    class: 'field', type: 'search', placeholder: 'Nom du plat…',
    oninput: (e) => render(e.target.value),
  });

  const root = h('div', {}, [
    h('div', { class: 'screen-title' }, 'Allergènes'),
    h('p', { class: 'section-label', style: 'margin-top:-8px' }, 'Réponse client en salle'),
    h('div', { style: 'display:flex; gap:10px; align-items:center' }, [
      h('div', { style: 'flex:1' }, [search]),
      h('button', { class: 'header-action', onclick: () => startVoice('chat', (t) => { search.value = t; render(t); }), 'aria-label': 'Recherche vocale' }, [icon('mic', 22)]),
    ]),
    panel,
    list,
  ]);

  let recipes = [];
  let inco = []; // référentiel des 14 allergènes

  function showPlat(r) {
    panel.replaceChildren(h('div', { class: 'card' }, [emptyState('allergen', 'Analyse…')]));
    (async () => {
      try {
        const data = await API.get(`/allergens/recipes/${r.id}`);
        const present = new Set((data.allergens || []).map((a) => a.code));
        const grid = h('div', { class: 'allergen-grid' }, inco.map((a) =>
          h('div', { class: 'allergen-pastille ' + (present.has(a.code) ? 'on' : 'off') }, [
            h('span', { class: 'ap-icon' }, a.icon || '•'),
            h('span', { class: 'ap-name' }, a.name),
          ])
        ));
        panel.replaceChildren(h('div', { class: 'card allergen-card' }, [
          h('div', { class: 'allergen-head' }, [
            h('div', { class: 'lr-title' }, data.recipe_name || r.name),
            h('span', { class: 'badge ' + (present.size ? 'badge-warn' : 'badge-ok') }, present.size ? `${present.size} allergène${present.size > 1 ? 's' : ''}` : 'Aucun déclaré'),
          ]),
          grid,
        ]));
      } catch (e) {
        panel.replaceChildren(h('div', { class: 'card' }, [emptyState('allergen', 'Allergènes indisponibles')]));
      }
    })();
  }

  function render(term = '') {
    const t = term.trim().toLowerCase();
    if (!t) { list.replaceChildren(emptyState('search', 'Cherchez un plat', 'Tapez ou dictez le nom du plat pour voir ses allergènes.')); return; }
    const rows = recipes.filter((r) => (r.name || '').toLowerCase().includes(t)).slice(0, 20);
    if (!rows.length) { list.replaceChildren(emptyState('allergen', 'Aucun plat trouvé')); return; }
    list.replaceChildren(...rows.map((r) =>
      h('div', { class: 'list-row', onclick: () => showPlat(r) }, [
        h('div', { class: 'lr-main' }, [
          h('div', { class: 'lr-title' }, r.name || 'Sans nom'),
          h('div', { class: 'lr-sub' }, r.category || 'Non classé'),
        ]),
        icon('allergen', 20),
      ])
    ));
  }

  (async () => {
    try {
      const [{ value: recData, stale }, { value: incoData }] = await Promise.all([
        fetchWithCache('recipes', () => API.get('/recipes?limit=500')),
        fetchWithCache('allergens_inco', () => API.get('/allergens')),
      ]);
      recipes = recData.recipes || [];
      inco = Array.isArray(incoData) ? incoData : [];
      if (stale) toast('Mode hors-ligne — données en cache', 'warn');
      render('');
    } catch (e) {
      list.replaceChildren(emptyState('allergen', 'Indisponible hors-ligne', 'Connectez-vous une fois pour télécharger les plats.'));
    }
  })();

  return root;
}
