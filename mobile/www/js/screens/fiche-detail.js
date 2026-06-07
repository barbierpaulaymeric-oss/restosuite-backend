// Détail d'une fiche technique — ingrédients, food cost, allergènes INCO,
// dictée d'une modification à Alto. Cache offline par fiche (consultation en
// cuisine sans réseau). API : GET /recipes/:id (+ /recipes/:id/allergens).
import { h, icon, emptyState, toast } from '../ui.js';
import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { fetchWithCache } from '../store.js';
import { navigate } from '../router.js';
import { startVoice } from './alto.js';

// Les 14 allergènes INCO (mêmes codes/emoji que le backend) — la fiche met en
// évidence ceux présents, les 14 restent affichés pour une lecture sans ambiguïté.
const INCO = [
  { code: 'gluten', name: 'Gluten', emoji: '🌾' },
  { code: 'crustaces', name: 'Crustacés', emoji: '🦐' },
  { code: 'oeufs', name: 'Œufs', emoji: '🥚' },
  { code: 'poissons', name: 'Poissons', emoji: '🐟' },
  { code: 'arachides', name: 'Arachides', emoji: '🥜' },
  { code: 'soja', name: 'Soja', emoji: '🫘' },
  { code: 'lait', name: 'Lait', emoji: '🥛' },
  { code: 'fruits_coque', name: 'Fruits à coque', emoji: '🌰' },
  { code: 'celeri', name: 'Céleri', emoji: '🥬' },
  { code: 'moutarde', name: 'Moutarde', emoji: '🟡' },
  { code: 'sesame', name: 'Sésame', emoji: '⚪' },
  { code: 'sulfites', name: 'Sulfites', emoji: '🍷' },
  { code: 'lupin', name: 'Lupin', emoji: '🌿' },
  { code: 'mollusques', name: 'Mollusques', emoji: '🦪' },
];

function fmtQty(n) {
  if (n == null || isNaN(n)) return '—';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}

function photoUrl(p) {
  if (!p) return null;
  if (/^https?:\/\//.test(p)) return p;
  return CONFIG.assetBase + (p.startsWith('/') ? p : '/' + p);
}

export function FicheDetailScreen(query) {
  const id = query.get('id');
  const body = h('div', {}, [emptyState('fiches', 'Chargement de la fiche…')]);

  const back = h('button', { class: 'btn btn-ghost detail-back', onclick: () => history.back() }, [icon('logout', 20), 'Retour']);

  const root = h('div', {}, [back, body]);

  function render(recipe, allergenCodes) {
    const ings = recipe.ingredients || [];
    const fcPct = recipe.food_cost_percent;
    // Code couleur food cost : ≤30 % bon, ≤35 % à surveiller, au-delà trop élevé.
    const fcClass = fcPct == null ? '' : fcPct <= 30 ? 'good' : fcPct <= 35 ? 'warn' : 'bad';

    const present = new Set(allergenCodes);
    const anyPresent = present.size > 0;

    // Zone d'affichage de la modification dictée (remplie par Alto au besoin).
    const noteSlot = h('div', {});

    // replaceChildren() stringifie un argument null en texte « null » (contrairement
    // à h()) → on filtre les nœuds conditionnels avant de monter.
    const parts = [
      recipe.photo_url ? h('img', { class: 'detail-hero', src: photoUrl(recipe.photo_url), alt: recipe.name, onerror: (e) => e.target.remove() }) : null,
      h('div', { class: 'detail-name' }, recipe.name || 'Sans nom'),
      h('div', { class: 'detail-cat' }, recipe.category || 'Non classé'),

      // Portions / préparation / cuisson
      h('div', { class: 'meta-grid' }, [
        h('div', { class: 'meta-cell' }, [
          h('div', { class: 'mc-val' }, recipe.portions ? String(recipe.portions) : '—'),
          h('div', { class: 'mc-lbl' }, 'Portions'),
        ]),
        h('div', { class: 'meta-cell' }, [
          h('div', { class: 'mc-val' }, recipe.prep_time_min ? recipe.prep_time_min + ' min' : '—'),
          h('div', { class: 'mc-lbl' }, 'Préparation'),
        ]),
        h('div', { class: 'meta-cell' }, [
          h('div', { class: 'mc-val' }, recipe.cooking_time_min ? recipe.cooking_time_min + ' min' : '—'),
          h('div', { class: 'mc-lbl' }, 'Cuisson'),
        ]),
      ]),

      // Food cost
      h('div', { class: 'section-label' }, 'Food cost'),
      h('div', { class: 'cost-card' }, [
        h('div', { class: 'cc' }, [
          h('div', { class: 'cc-val' }, recipe.cost_per_portion != null ? fmtQty(recipe.cost_per_portion) + ' €' : '—'),
          h('div', { class: 'cc-lbl' }, 'Coût / portion'),
        ]),
        h('div', { class: 'cc' }, [
          h('div', { class: 'cc-val ' + fcClass }, fcPct != null ? fmtQty(fcPct) + ' %' : '—'),
          h('div', { class: 'cc-lbl' }, 'Food cost'),
        ]),
        h('div', { class: 'cc' }, [
          h('div', { class: 'cc-val' }, recipe.selling_price ? fmtQty(recipe.selling_price) + ' €' : '—'),
          h('div', { class: 'cc-lbl' }, 'Prix vente'),
        ]),
      ]),
      recipe.missing_price_count ? h('p', { class: 'section-label', style: 'color:var(--warn); margin-top:8px' }, `⚠ ${recipe.missing_price_count} ingrédient(s) sans prix — coût partiel`) : null,

      // Ingrédients
      h('div', { class: 'section-label' }, `Ingrédients${ings.length ? ' (' + ings.length + ')' : ''}`),
      ings.length
        ? h('div', {}, ings.map((ing) => h('div', { class: 'ing-row' + (ing.missing_price ? ' missing' : '') }, [
            h('div', {}, [
              h('div', { class: 'ing-name' }, ing.is_sub_recipe ? (ing.sub_recipe_name || 'Sous-recette') : (ing.ingredient_name || 'Ingrédient')),
              ing.is_sub_recipe ? h('div', { class: 'ing-sub' }, 'Sous-recette') : null,
            ]),
            h('div', { style: 'flex:1' }),
            h('div', { class: 'ing-qty' }, fmtQty(ing.gross_quantity) + ' ' + (ing.unit || '')),
          ])))
        : emptyState('fiches', 'Aucun ingrédient', null),

      // Allergènes
      h('div', { class: 'section-label' }, 'Allergènes (INCO)'),
      anyPresent
        ? h('div', { class: 'allergen-grid' }, INCO.filter((a) => present.has(a.code)).concat(INCO.filter((a) => !present.has(a.code))).map((a) =>
            h('div', { class: 'allergen-chip' + (present.has(a.code) ? ' present' : '') }, [
              h('span', { class: 'ac-emoji' }, a.emoji),
              h('span', { class: 'ac-name' }, a.name),
            ])))
        : h('div', { class: 'allergen-none' }, '✓ Aucun allergène majeur déclaré'),

      // Dictée modification
      h('div', { style: 'height:18px' }),
      h('button', { class: 'btn btn-primary', onclick: () => {
        startVoice('command', (text) => {
          if (!text) return;
          noteSlot.replaceChildren(h('div', { class: 'dictation-note' }, [
            h('div', { class: 'dn-lbl' }, 'Modification dictée'),
            h('div', {}, text),
          ]));
          toast('Modification notée', 'ok');
        });
      } }, [icon('mic', 22), 'Dicter une modification à Alto']),
      noteSlot,
      h('div', { style: 'height:24px' }),
    ];
    body.replaceChildren(...parts.filter(Boolean));
  }

  (async () => {
    if (!id) { body.replaceChildren(emptyState('fiches', 'Fiche introuvable', null)); return; }
    try {
      // Recette + allergènes en parallèle, chacun caché pour la consultation offline.
      const [{ value: recipe, stale }, allergensRes] = await Promise.all([
        fetchWithCache('recipe_' + id, () => API.get('/recipes/' + id)),
        fetchWithCache('recipe_allergens_' + id, () => API.get('/recipes/' + id + '/allergens')).catch(() => ({ value: { allergens: [] } })),
      ]);
      const codes = (allergensRes.value.allergens || []).map((a) => a.code);
      if (stale) toast('Mode hors-ligne — fiche en cache', 'warn');
      render(recipe, codes);
    } catch (e) {
      body.replaceChildren(emptyState('fiches', 'Indisponible hors-ligne', 'Ouvrez cette fiche une fois en ligne pour la consulter ensuite.'));
    }
  })();

  return root;
}
