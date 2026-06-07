// Réception de marchandises — liste des commandes en attente puis contrôle
// ligne par ligne (reçu conforme / écart quantité / manquant / non conforme).
// API : GET /purchase-orders (filtré envoyée·confirmée), POST /:id/receive.
//
// Le backend ne réécrit pas les quantités à la réception : il crée les mouvements
// de stock à partir des lignes commandées et accepte une note libre. On consigne
// donc les écarts repérés dans `reception_notes` (traçabilité + alerte gérant),
// ce qui est l'usage réel d'un contrôle à quai.
import { h, icon, emptyState, toast } from '../ui.js';
import { API } from '../api.js';
import { fetchWithCache } from '../store.js';

// Statuts réceptionnables côté serveur (POST /receive).
const RECEIVABLE = new Set(['envoyée', 'confirmée']);

function fmtQty(n) { const r = Math.round(Number(n) * 100) / 100; return Number.isInteger(r) ? String(r) : String(r).replace('.', ','); }

// ── Détail : contrôle d'une livraison ──────────────────────────
function ControlView(po, onDone) {
  const items = po.items || [];
  // État de contrôle par ligne : 'ok' | 'short' | 'missing' | 'quality'.
  const state = items.map(() => ({ status: 'ok', received: null, note: '' }));

  function rowEl(item, i) {
    const st = state[i];
    const statusRow = h('div', { style: 'display:flex; gap:8px; margin-top:10px; flex-wrap:wrap' });
    const extra = h('div', {});

    const OPTIONS = [
      { k: 'ok', label: 'Conforme' },
      { k: 'short', label: 'Écart qté' },
      { k: 'missing', label: 'Manquant' },
      { k: 'quality', label: 'Qualité' },
    ];
    function paintStatus() {
      statusRow.replaceChildren(...OPTIONS.map((o) => h('button', {
        class: 'btn ' + (st.status === o.k ? (o.k === 'ok' ? 'btn-primary' : 'btn-primary') : 'btn-ghost'),
        style: 'width:auto; min-height:44px; font-size:14px; padding:0 14px',
        onclick: () => { st.status = o.k; paintStatus(); paintExtra(); },
      }, o.label)));
    }
    function paintExtra() {
      if (st.status === 'short') {
        const inp = h('input', { class: 'field', type: 'number', inputmode: 'decimal', placeholder: `Reçu (commandé : ${fmtQty(item.quantity)} ${item.unit || ''})`, value: st.received ?? '', oninput: (e) => { st.received = e.target.value; } });
        extra.replaceChildren(h('div', { style: 'height:10px' }), inp);
      } else if (st.status === 'quality') {
        const inp = h('input', { class: 'field', placeholder: 'Problème constaté (ex. emballage déchiré)', value: st.note, oninput: (e) => { st.note = e.target.value; } });
        extra.replaceChildren(h('div', { style: 'height:10px' }), inp);
      } else {
        extra.replaceChildren();
      }
    }
    paintStatus(); paintExtra();

    return h('div', { class: 'card', style: 'margin-bottom:10px' }, [
      h('div', { style: 'display:flex; align-items:baseline; gap:10px' }, [
        h('div', { style: 'flex:1; font-size:16px; font-weight:700' }, item.ingredient_name || item.product_name || 'Article'),
        h('div', { class: 'ing-qty' }, fmtQty(item.quantity) + ' ' + (item.unit || '')),
      ]),
      statusRow,
      extra,
    ]);
  }

  function buildNotes() {
    const issues = [];
    items.forEach((item, i) => {
      const st = state[i];
      const name = item.ingredient_name || item.product_name || 'Article';
      if (st.status === 'short') issues.push(`${name} : reçu ${st.received || '?'} / ${fmtQty(item.quantity)} ${item.unit || ''}`);
      else if (st.status === 'missing') issues.push(`${name} : MANQUANT`);
      else if (st.status === 'quality') issues.push(`${name} : non conforme${st.note ? ' (' + st.note + ')' : ''}`);
    });
    return issues;
  }

  const confirmBtn = h('button', { class: 'btn btn-primary', onclick: confirmReceive }, [icon('check', 22), 'Valider la réception']);

  async function confirmReceive() {
    const issues = buildNotes();
    if (issues.length) {
      const ok = confirm('Écarts signalés :\n\n' + issues.join('\n') + '\n\nValider quand même la réception ?');
      if (!ok) return;
    }
    confirmBtn.disabled = true;
    try {
      await API.post('/purchase-orders/' + po.id + '/receive', issues.length ? { reception_notes: issues.join(' ; ') } : {});
      toast(issues.length ? 'Réception validée avec écarts signalés' : 'Réception validée — stock mis à jour', 'ok');
      onDone();
    } catch (e) {
      toast(e && e.code === 'NETWORK' ? 'Hors-ligne — réception impossible' : (e.message || 'Échec de la réception'), 'error');
      confirmBtn.disabled = false;
    }
  }

  return h('div', {}, [
    h('button', { class: 'btn btn-ghost detail-back', onclick: onDone }, [icon('logout', 20), 'Retour']),
    h('div', { class: 'detail-name' }, po.supplier_name || 'Fournisseur'),
    h('div', { class: 'detail-cat' }, [po.reference || `#${po.id}`, items.length ? ` · ${items.length} ligne(s)` : ''].join('')),
    h('div', { class: 'section-label' }, 'Contrôle des lignes'),
    items.length ? h('div', {}, items.map((it, i) => rowEl(it, i))) : emptyState('truck', 'Aucune ligne', 'Cette commande ne contient pas d\'articles.'),
    h('div', { style: 'height:8px' }),
    confirmBtn,
    h('div', { style: 'height:24px' }),
  ]);
}

export function ReceptionsScreen() {
  const root = h('div', {});

  function showList() {
    const list = h('div', {}, [emptyState('truck', 'Chargement des livraisons…')]);
    root.replaceChildren(
      h('div', { class: 'screen-title' }, 'Réceptions'),
      h('p', { class: 'section-label', style: 'margin-top:-8px' }, 'Livraisons à contrôler'),
      list,
    );

    (async () => {
      try {
        const { value, stale } = await fetchWithCache('purchase_orders_receive', () => API.get('/purchase-orders'));
        const orders = (Array.isArray(value) ? value : []).filter((o) => RECEIVABLE.has(o.status));
        if (stale) toast('Mode hors-ligne — données en cache', 'warn');
        if (!orders.length) { list.replaceChildren(emptyState('truck', 'Aucune livraison en attente', 'Les commandes envoyées ou confirmées apparaîtront ici pour contrôle.')); return; }
        list.replaceChildren(...orders.map((o) => h('div', { class: 'list-row', onclick: () => openControl(o) }, [
          h('div', { class: 'lr-main' }, [
            h('div', { class: 'lr-title' }, o.supplier_name || 'Fournisseur'),
            h('div', { class: 'lr-sub' }, [o.reference || `#${o.id}`, (o.items ? ` · ${o.items.length} ligne(s)` : ''), o.total_amount ? ` · ${fmtQty(o.total_amount)} €` : ''].join('')),
          ]),
          h('span', { class: 'badge ' + (o.status === 'confirmée' ? 'badge-ok' : 'badge-warn') }, o.status),
        ])));
      } catch (e) {
        list.replaceChildren(emptyState('truck', 'Indisponible hors-ligne', 'Connectez-vous pour charger les livraisons à réceptionner.'));
      }
    })();
  }

  async function openControl(o) {
    // La liste embarque déjà les lignes ; on rafraîchit si possible pour être à jour.
    root.replaceChildren(emptyState('truck', 'Ouverture…'));
    let po = o;
    try { po = await API.get('/purchase-orders/' + o.id); } catch { /* on garde la version en cache */ }
    root.replaceChildren(ControlView(po, showList));
  }

  showList();
  return root;
}
