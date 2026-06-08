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
import { queue } from '../queue.js';
import { fetchWithCache } from '../store.js';
import { capturePhoto } from '../camera.js';

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
      const r = await queue.post(
        '/purchase-orders/' + po.id + '/receive',
        issues.length ? { reception_notes: issues.join(' ; ') } : {},
        'Réception ' + (po.supplier_name || ('#' + po.id))
      );
      if (r && r.queued) toast('Réception en attente d\'envoi (hors-ligne)', 'warn');
      else toast(issues.length ? 'Réception validée avec écarts signalés' : 'Réception validée — stock mis à jour', 'ok');
      onDone();
    } catch (e) {
      toast(e && e.message || 'Échec de la réception', 'error');
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
    const scanBtn = h('button', { class: 'btn btn-primary', onclick: openScan },
      [icon('camera', 22), 'Scanner un BL papier']);
    root.replaceChildren(
      h('div', { class: 'screen-title' }, 'Réceptions'),
      scanBtn,
      h('p', { class: 'section-label' }, 'Livraisons à contrôler'),
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

  // ── Scan BL — photo → /api/ai/scan-delivery → résumé extrait ───────
  async function openScan() {
    root.replaceChildren(emptyState('camera', 'Ouverture de la caméra…'));
    let shot;
    try { shot = await capturePhoto({ quality: 80, source: 'prompt' }); }
    catch (e) {
      const msg = (e && e.code === 'PERMISSION_DENIED')
        ? e.message
        : (e && e.message) || 'Caméra inaccessible';
      toast(msg, 'error');
      showList();
      return;
    }
    if (!shot) { showList(); return; }
    showScanned(shot);
  }

  async function showScanned(shot) {
    root.replaceChildren(emptyState('camera', 'Alto lit le bon de livraison…'));
    try {
      const data = await API.post('/ai/scan-delivery', {
        image_base64: shot.base64,
        mime_type: shot.mimeType,
      });
      renderScanResult(data);
    } catch (e) {
      toast(e && e.code === 'NETWORK' ? 'Hors-ligne — scan impossible' : 'Échec du scan', 'error');
      showList();
    }
  }

  // Récap éditable d'un BL scanné : tous les champs sont modifiables
  // (l'IA peut se tromper). Bouton valider → POST /from-scan crée le PO
  // directement au statut réceptionnée + stock mouvementé côté serveur.
  function renderScanResult(data) {
    const state = {
      supplier_name: (data && data.supplier_name) || '',
      delivery_number: (data && data.delivery_number) || '',
      delivery_date: (data && data.delivery_date) || '',
      items: ((data && Array.isArray(data.items)) ? data.items : []).map((it) => ({
        product_name: it.product_name || '',
        quantity: it.quantity != null ? it.quantity : '',
        unit: it.unit || 'kg',
        unit_price: it.unit_price != null ? it.unit_price : '',
        total_price: it.total_price != null ? it.total_price : '',
      })),
    };

    function field(label, value, onChange, opts = {}) {
      const inp = h('input', {
        class: 'field', value: value == null ? '' : String(value),
        type: opts.type || 'text', inputmode: opts.inputmode || undefined,
        step: opts.step || undefined,
        placeholder: opts.placeholder || '',
        oninput: (e) => onChange(e.target.value),
        style: opts.style || '',
      });
      return h('div', { style: 'margin-bottom:10px' }, [
        h('div', { class: 'section-label', style: 'margin:0 0 4px' }, label),
        inp,
      ]);
    }

    function renderItemRow(it, i) {
      const removeBtn = h('button', {
        class: 'btn btn-ghost', style: 'width:auto; min-height:36px; padding:0 12px; font-size:13px',
        onclick: () => { state.items.splice(i, 1); paint(); },
      }, 'Supprimer la ligne');

      return h('div', { class: 'card', style: 'margin-bottom:10px' }, [
        h('div', { class: 'section-label', style: 'margin:0 0 6px' }, 'Article ' + (i + 1)),
        field('Désignation', it.product_name, (v) => { it.product_name = v; }),
        h('div', { style: 'display:flex; gap:8px' }, [
          h('div', { style: 'flex:1' }, [
            field('Quantité', it.quantity, (v) => { it.quantity = v; }, { type: 'number', inputmode: 'decimal', step: '0.01' }),
          ]),
          h('div', { style: 'flex:1' }, [
            field('Unité', it.unit, (v) => { it.unit = v; }, { placeholder: 'kg, l, pièce…' }),
          ]),
        ]),
        h('div', { style: 'display:flex; gap:8px' }, [
          h('div', { style: 'flex:1' }, [
            field('PU € (HT)', it.unit_price, (v) => { it.unit_price = v; recomputeTotal(it); }, { type: 'number', inputmode: 'decimal', step: '0.01' }),
          ]),
          h('div', { style: 'flex:1' }, [
            field('Total €', it.total_price, (v) => { it.total_price = v; }, { type: 'number', inputmode: 'decimal', step: '0.01' }),
          ]),
        ]),
        h('div', { style: 'text-align:right' }, [removeBtn]),
      ]);
    }
    function recomputeTotal(it) {
      const q = parseFloat(it.quantity); const pu = parseFloat(it.unit_price);
      if (!isNaN(q) && !isNaN(pu)) it.total_price = (q * pu).toFixed(2);
    }
    function addItem() {
      state.items.push({ product_name: '', quantity: '', unit: 'kg', unit_price: '', total_price: '' });
      paint();
    }

    function computeGrandTotal() {
      return state.items.reduce((s, it) => s + (parseFloat(it.total_price) || 0), 0);
    }

    async function validate() {
      if (!state.supplier_name.trim()) {
        toast('Nom du fournisseur requis', 'error');
        return;
      }
      const items = state.items
        .filter((it) => (it.product_name || '').trim() && parseFloat(it.quantity) > 0)
        .map((it) => ({
          product_name: it.product_name.trim(),
          quantity: parseFloat(it.quantity) || 0,
          unit: (it.unit || 'pièce').trim(),
          unit_price: parseFloat(it.unit_price) || 0,
          total_price: parseFloat(it.total_price) || 0,
        }));
      if (items.length === 0) { toast('Au moins une ligne valide requise', 'error'); return; }

      validateBtn.disabled = true; validateBtn.textContent = 'Enregistrement…';
      try {
        await API.post('/purchase-orders/from-scan', {
          supplier_name: state.supplier_name.trim(),
          delivery_number: state.delivery_number.trim() || null,
          delivery_date: state.delivery_date.trim() || null,
          items,
        });
        toast('Réception enregistrée — stock mis à jour', 'ok');
        showList();
      } catch (e) {
        toast((e && e.message) || 'Échec de la validation', 'error');
        validateBtn.disabled = false;
        validateBtn.textContent = 'Valider la réception';
      }
    }

    const validateBtn = h('button', { class: 'btn btn-primary', onclick: validate },
      [icon('check', 22), 'Valider la réception']);
    const cancelBtn = h('button', { class: 'btn btn-ghost', onclick: showList }, 'Annuler');

    function paint() {
      const headBlock = h('div', { class: 'card', style: 'margin-bottom:14px' }, [
        h('div', { class: 'detail-name', style: 'margin:0 0 8px' }, 'BL scanné'),
        h('p', { class: 'lr-sub', style: 'margin:0 0 14px' }, 'Vérifiez les valeurs extraites par Alto, ajustez si besoin, puis validez.'),
        field('Fournisseur', state.supplier_name, (v) => { state.supplier_name = v; }),
        h('div', { style: 'display:flex; gap:8px' }, [
          h('div', { style: 'flex:1' }, [field('N° BL', state.delivery_number, (v) => { state.delivery_number = v; })]),
          h('div', { style: 'flex:1' }, [field('Date', state.delivery_date, (v) => { state.delivery_date = v; }, { type: 'date' })]),
        ]),
      ]);

      const rows = state.items.length
        ? state.items.map(renderItemRow)
        : [emptyState('truck', 'Aucune ligne détectée', 'Ajoutez une ligne manuellement ci-dessous.')];

      const addBtn = h('button', { class: 'btn btn-ghost', onclick: addItem }, [icon('plus', 20), 'Ajouter une ligne']);
      const total = h('div', { class: 'order-total' }, 'Total estimé : ' + computeGrandTotal().toFixed(2).replace('.', ',') + ' €');

      root.replaceChildren(
        h('button', { class: 'btn btn-ghost detail-back', onclick: showList }, [icon('logout', 20), 'Retour']),
        headBlock,
        h('div', { class: 'section-label' }, 'Lignes (' + state.items.length + ')'),
        ...rows,
        addBtn,
        h('div', { style: 'height:8px' }),
        total,
        h('div', { style: 'height:14px' }),
        validateBtn,
        h('div', { style: 'height:8px' }),
        cancelBtn,
        h('div', { style: 'height:24px' }),
      );
    }
    paint();
  }

  showList();
  return root;
}
