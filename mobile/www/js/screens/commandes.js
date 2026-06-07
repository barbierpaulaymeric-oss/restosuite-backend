// Commandes fournisseurs — renouveler en 2 taps + nouvelle commande rapide.
//
// Un seul écran, plusieurs vues pilotées par ?view= :
//   (défaut)      → liste des dernières commandes + bouton « Nouvelle commande »
//   view=reorder  → renouvellement pré-rempli (id=…) : on ajuste les quantités puis on envoie
//   view=new      → nouvelle commande : choix fournisseur → mercuriale → quantités → envoi
//
// API : GET /purchase-orders, GET /purchase-orders/:id, POST /purchase-orders,
//       PUT /purchase-orders/:id (status 'envoyée'), GET /suppliers, GET /suppliers/:id/prices.
import { h, icon, emptyState, toast } from '../ui.js';
import { API } from '../api.js';
import { fetchWithCache } from '../store.js';
import { navigate } from '../router.js';

const euros = (n) => (Number(n) || 0).toFixed(2).replace('.', ',') + ' €';
const frDate = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

// ── Composant : ligne avec stepper +/- (gros doigts) ──────────────
function qtyRow({ title, sub, qty, step = 1, onChange }) {
  const val = h('div', { class: 'qty-val' }, String(qty));
  let q = qty;
  const set = (next) => {
    q = Math.max(0, Math.round(next * 100) / 100);
    val.textContent = String(q);
    onChange(q);
  };
  return h('div', { class: 'order-line' }, [
    h('div', { class: 'lr-main' }, [
      h('div', { class: 'lr-title' }, title),
      sub ? h('div', { class: 'lr-sub' }, sub) : null,
    ]),
    h('div', { class: 'qty-stepper' }, [
      h('button', { class: 'qty-btn', 'aria-label': 'Moins', onclick: () => set(q - step) }, '−'),
      val,
      h('button', { class: 'qty-btn', 'aria-label': 'Plus', onclick: () => set(q + step) }, '+'),
    ]),
  ]);
}

// ── Envoi commun : crée le brouillon puis tente l'envoi au fournisseur ──
async function createAndSend({ supplier_id, items, sendBtn }) {
  const lines = items
    .filter((it) => it.quantity > 0)
    .map((it) => ({
      ingredient_id: it.ingredient_id || null,
      product_name: it.product_name,
      quantity: it.quantity,
      unit: it.unit || 'kg',
      unit_price: it.unit_price || 0,
    }));
  if (!lines.length) { toast('Ajoutez au moins un article', 'error'); return; }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Envoi…';
  try {
    const po = await API.post('/purchase-orders', { supplier_id, items: lines });
    // Tente la transition brouillon → envoyée (peut échouer si intégration non câblée).
    try {
      await API.put(`/purchase-orders/${po.id}`, { status: 'envoyée' });
      toast('Commande envoyée au fournisseur', 'ok');
    } catch (e) {
      toast('Commande enregistrée (brouillon) — envoi à finaliser', 'warn');
    }
    navigate('commandes');
  } catch (e) {
    toast(e.message || 'Échec de la commande', 'error');
    sendBtn.disabled = false;
    sendBtn.textContent = 'Envoyer la commande';
  }
}

function backBar(label) {
  return h('button', { class: 'btn btn-ghost', style: 'width:auto; padding:0 16px; margin-bottom:12px', onclick: () => navigate('commandes') }, ['← ', label]);
}

// ═══════════════════════════════════════════
// Vue : liste des dernières commandes
// ═══════════════════════════════════════════
function ListView() {
  const list = h('div', {}, [emptyState('commandes', 'Chargement…')]);
  const root = h('div', {}, [
    h('div', { class: 'screen-title' }, 'Commandes'),
    h('button', { class: 'btn btn-primary', onclick: () => navigate('commandes', { view: 'new' }) }, [icon('plus', 22), 'Nouvelle commande']),
    h('p', { class: 'section-label' }, 'Renouveler en 2 taps'),
    list,
  ]);

  (async () => {
    try {
      const { value, stale } = await fetchWithCache('purchase_orders', () => API.get('/purchase-orders'));
      // L'API renvoie un tableau direct ; on reste tolérant aux variantes.
      const orders = Array.isArray(value) ? value : (value.orders || value.purchase_orders || []);
      if (stale) toast('Mode hors-ligne', 'warn');
      if (!orders.length) { list.replaceChildren(emptyState('commandes', 'Aucune commande récente', 'Vos dernières commandes apparaîtront ici pour renouvellement.')); return; }
      list.replaceChildren(...orders.slice(0, 10).map((o) => {
        const count = (o.items && o.items.length) || 0;
        const sub = [frDate(o.created_at), `${count} article${count > 1 ? 's' : ''}`, euros(o.total_amount)].filter(Boolean).join(' · ');
        return h('div', { class: 'list-row' }, [
          h('div', { class: 'lr-main' }, [
            h('div', { class: 'lr-title' }, o.supplier_name || 'Fournisseur'),
            h('div', { class: 'lr-sub' }, sub),
          ]),
          h('button', { class: 'btn btn-primary', style: 'width:auto; padding:0 14px; min-height:48px', onclick: () => navigate('commandes', { view: 'reorder', id: o.id }) }, [icon('refresh', 20), 'Refaire']),
        ]);
      }));
    } catch (e) {
      list.replaceChildren(emptyState('commandes', 'Indisponible hors-ligne'));
    }
  })();

  return root;
}

// ═══════════════════════════════════════════
// Vue : renouvellement pré-rempli
// ═══════════════════════════════════════════
function ReorderView(id) {
  const body = h('div', {}, [emptyState('refresh', 'Chargement de la commande…')]);
  const root = h('div', {}, [backBar('Commandes'), body]);

  (async () => {
    let po;
    try {
      po = await API.get(`/purchase-orders/${id}`);
    } catch (e) {
      body.replaceChildren(emptyState('commandes', 'Commande introuvable')); return;
    }
    const items = (po.items || []).map((it) => ({
      ingredient_id: it.ingredient_id,
      product_name: it.ingredient_name || it.product_name,
      quantity: Number(it.quantity) || 0,
      unit: it.unit || 'kg',
      unit_price: Number(it.unit_price) || 0,
    }));
    if (!items.length) { body.replaceChildren(emptyState('commandes', 'Cette commande ne contient aucun article')); return; }

    const total = h('div', { class: 'order-total' }, '');
    const recompute = () => { total.textContent = 'Total estimé : ' + euros(items.reduce((s, it) => s + it.quantity * it.unit_price, 0)); };

    const lines = items.map((it) => qtyRow({
      title: it.product_name,
      sub: it.unit_price ? `${euros(it.unit_price)} / ${it.unit}` : it.unit,
      qty: it.quantity,
      onChange: (q) => { it.quantity = q; recompute(); },
    }));
    recompute();

    const sendBtn = h('button', { class: 'btn btn-primary' }, 'Envoyer la commande');
    sendBtn.addEventListener('click', () => createAndSend({ supplier_id: po.supplier_id, items, sendBtn }));

    body.replaceChildren(
      h('div', { class: 'screen-title' }, 'Renouveler'),
      h('p', { class: 'section-label', style: 'margin-top:-8px' }, po.supplier_name || 'Fournisseur'),
      ...lines,
      total,
      h('div', { style: 'height:12px' }),
      sendBtn,
    );
  })();

  return root;
}

// ═══════════════════════════════════════════
// Vue : nouvelle commande (fournisseur → mercuriale → envoi)
// ═══════════════════════════════════════════
function NewView() {
  const body = h('div', {});
  const root = h('div', {}, [body]);

  // Étape 1 — choix du fournisseur
  (async () => {
    body.replaceChildren(emptyState('truck', 'Chargement des fournisseurs…'));
    let suppliers = [];
    try {
      const { value } = await fetchWithCache('suppliers', () => API.get('/suppliers'));
      suppliers = Array.isArray(value) ? value : [];
    } catch (e) {
      body.replaceChildren(emptyState('truck', 'Indisponible hors-ligne')); return;
    }
    if (!suppliers.length) { body.replaceChildren(emptyState('truck', 'Aucun fournisseur', 'Ajoutez des fournisseurs depuis l\'app web.')); return; }

    const listWrap = h('div', {});
    const search = h('input', {
      class: 'field', type: 'search', placeholder: 'Rechercher un fournisseur…',
      oninput: (e) => renderSuppliers(e.target.value),
    });
    function renderSuppliers(term = '') {
      const t = term.trim().toLowerCase();
      const rows = suppliers.filter((s) => !t || (s.name || '').toLowerCase().includes(t));
      if (!rows.length) { listWrap.replaceChildren(emptyState('truck', 'Aucun fournisseur trouvé')); return; }
      listWrap.replaceChildren(...rows.map((s) =>
        h('div', { class: 'list-row', onclick: () => pickSupplier(s) }, [
          h('div', { class: 'lr-main' }, [h('div', { class: 'lr-title' }, s.name)]),
          icon('plus', 20),
        ])
      ));
    }
    renderSuppliers();
    body.replaceChildren(
      backBar('Commandes'),
      h('div', { class: 'screen-title' }, 'Nouvelle commande'),
      h('p', { class: 'section-label', style: 'margin-top:-8px' }, '1 · Choisir le fournisseur'),
      search,
      h('div', { style: 'height:12px' }),
      listWrap,
    );
  })();

  // Étape 2 — mercuriale + saisie des quantités
  async function pickSupplier(supplier) {
    body.replaceChildren(emptyState('commandes', 'Chargement de la mercuriale…'));
    let prices = [];
    try {
      prices = await API.get(`/suppliers/${supplier.id}/prices`);
      prices = Array.isArray(prices) ? prices : [];
    } catch (e) {
      body.replaceChildren(emptyState('commandes', 'Mercuriale indisponible')); return;
    }
    if (!prices.length) { body.replaceChildren(emptyState('commandes', 'Mercuriale vide', `Aucun tarif enregistré pour ${supplier.name}.`)); return; }

    const items = prices.map((p) => ({
      ingredient_id: p.ingredient_id || null,
      product_name: p.ingredient_name || p.product_name || 'Produit',
      quantity: 0,
      unit: p.unit || 'kg',
      unit_price: Number(p.price) || 0,
    }));

    const total = h('div', { class: 'order-total' }, 'Total estimé : ' + euros(0));
    const recompute = () => { total.textContent = 'Total estimé : ' + euros(items.reduce((s, it) => s + it.quantity * it.unit_price, 0)); };

    const linesWrap = h('div', {});
    function renderLines(term = '') {
      const t = term.trim().toLowerCase();
      const rows = items.filter((it) => !t || it.product_name.toLowerCase().includes(t));
      linesWrap.replaceChildren(...rows.map((it) => qtyRow({
        title: it.product_name,
        sub: it.unit_price ? `${euros(it.unit_price)} / ${it.unit}` : it.unit,
        qty: it.quantity,
        onChange: (q) => { it.quantity = q; recompute(); },
      })));
    }

    const search = h('input', {
      class: 'field', type: 'search', placeholder: 'Filtrer un produit…',
      oninput: (e) => renderLines(e.target.value),
    });
    renderLines();

    const sendBtn = h('button', { class: 'btn btn-primary' }, 'Envoyer la commande');
    sendBtn.addEventListener('click', () => createAndSend({ supplier_id: supplier.id, items, sendBtn }));

    body.replaceChildren(
      // Retour vers l'étape 1 (liste fournisseurs) en re-rendant la vue « new ».
      h('button', { class: 'btn btn-ghost', style: 'width:auto; padding:0 16px; margin-bottom:12px', onclick: () => navigate('commandes', { view: 'new' }) }, '← Fournisseurs'),
      h('div', { class: 'screen-title' }, supplier.name),
      h('p', { class: 'section-label', style: 'margin-top:-8px' }, '2 · Quantités à commander'),
      search,
      h('div', { style: 'height:12px' }),
      linesWrap,
      total,
      h('div', { style: 'height:12px' }),
      sendBtn,
    );
  }

  return root;
}

export function CommandesScreen(query) {
  const view = query.get('view');
  if (view === 'reorder' && query.get('id')) return ReorderView(query.get('id'));
  if (view === 'new') return NewView();
  return ListView();
}
