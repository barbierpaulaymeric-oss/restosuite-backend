// Commandes fournisseurs rapides — renouveler une commande en 2 taps.
import { h, icon, emptyState, toast } from '../ui.js';
import { API } from '../api.js';
import { fetchWithCache } from '../store.js';

export function CommandesScreen(query) {
  const list = h('div', {}, [emptyState('commandes', 'Chargement…')]);
  const root = h('div', {}, [
    h('div', { class: 'screen-title' }, 'Commandes'),
    h('p', { class: 'section-label', style: 'margin-top:-8px' }, 'Renouveler en 2 taps'),
    list,
  ]);

  (async () => {
    try {
      const { value, stale } = await fetchWithCache('purchase_orders', () => API.get('/purchase-orders?limit=20'));
      const orders = value.orders || value.purchase_orders || value.purchaseOrders || [];
      if (stale) toast('Mode hors-ligne', 'warn');
      if (!orders.length) { list.replaceChildren(emptyState('commandes', 'Aucune commande récente', 'Vos dernières commandes apparaîtront ici pour renouvellement.')); return; }
      list.replaceChildren(...orders.map((o) =>
        h('div', { class: 'list-row' }, [
          h('div', { class: 'lr-main' }, [
            h('div', { class: 'lr-title' }, o.supplier_name || o.supplier || 'Fournisseur'),
            h('div', { class: 'lr-sub' }, [o.reference || o.ref || `#${o.id}`, o.total ? ` · ${o.total} €` : ''].join('')),
          ]),
          h('button', { class: 'btn btn-primary', style: 'width:auto; padding:0 16px; min-height:48px', onclick: () => toast('Renouvellement — à brancher sur POST /purchase-orders', 'ok') }, [icon('refresh', 20), 'Refaire']),
        ])
      ));
    } catch (e) {
      list.replaceChildren(emptyState('commandes', 'Indisponible hors-ligne'));
    }
  })();

  return root;
}
