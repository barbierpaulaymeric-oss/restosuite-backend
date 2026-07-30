// ═══════════════════════════════════════════
// Salle — Dining-room view (card-grid "table tents")
// Replaces the previous /service screen. Cuisine moved to /kitchen (KDS).
// ═══════════════════════════════════════════

const SALLE_POLL_INTERVAL = 6000;
let _salleInterval = null;
let _salleTimerInterval = null;
let _salleState = {
  account: null,
  service: { active: false, session: null, config: {} },
  tables: [],
  orders: [],
  zoneFilter: 'all',
  selectedTableId: null,
  draft: {},
  draftCovers: null,
  draftNotes: '',
  recipes: [],
  menuSearch: ''
};

async function renderServiceView() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  _salleState.account = getAccount();

  app.style.maxWidth = 'none';
  app.style.padding = '0';
  if (nav) nav.style.display = 'none';

  app.innerHTML = `
    <div class="salle-shell" id="salle-shell">
      <header class="salle-topbar">
        <div class="salle-topbar__brand">
          <img src="assets/logo-icon.svg" alt="RestoSuite" style="height:22px">
          <span class="salle-topbar__title">Salle</span>
          <span class="salle-topbar__sep">•</span>
          <span class="salle-topbar__user">${escapeHtml(_salleState.account?.name || '')}</span>
        </div>
        <div class="salle-topbar__stats" id="salle-stats">
          <div class="salle-stat"><span class="salle-stat__val" id="salle-s-occ">0/0</span><span class="salle-stat__lbl">Tables</span></div>
          <div class="salle-stat"><span class="salle-stat__val" id="salle-s-cov">0</span><span class="salle-stat__lbl">Couverts</span></div>
          <div class="salle-stat"><span class="salle-stat__val" id="salle-s-ca">0 €</span><span class="salle-stat__lbl">CA en cours</span></div>
          <div class="salle-stat"><span class="salle-stat__val" id="salle-s-time">--:--</span><span class="salle-stat__lbl">Service</span></div>
        </div>
        <div class="salle-topbar__actions">
          <button class="salle-btn salle-btn--ghost" id="salle-go-cuisine" title="Écran cuisine">
            <span aria-hidden="true">👨‍🍳</span> Cuisine
          </button>
          <button class="salle-btn salle-btn--ghost" id="salle-quick-menu" title="Menu rapide">☰</button>
          <button class="salle-btn salle-btn--primary hidden" id="salle-start-btn">▶ Lancer le service</button>
          <button class="salle-btn salle-btn--danger hidden" id="salle-stop-btn">⏹ Fin</button>
          <button class="salle-btn salle-btn--ghost" id="salle-exit-btn" title="Quitter">✕</button>
        </div>
      </header>

      <div class="salle-zonebar" id="salle-zonebar"></div>

      <div class="salle-body" id="salle-body">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  document.getElementById('salle-exit-btn').addEventListener('click', _salleExit);
  document.getElementById('salle-go-cuisine').addEventListener('click', () => { location.hash = '#/kitchen'; });
  document.getElementById('salle-quick-menu').addEventListener('click', _salleQuickMenu);
  document.getElementById('salle-start-btn').addEventListener('click', _salleStart);
  document.getElementById('salle-stop-btn').addEventListener('click', _salleStop);

  await _salleLoad();
  _salleStartPolling();
  _salleStartTimer();
}

// ═══ DATA ═══
async function _salleLoad() {
  try {
    const [floor, recipesResp] = await Promise.all([
      API.request('/service/floor'),
      API.getRecipes()
    ]);
    _salleState.service = floor.service;
    _salleState.tables = floor.tables || [];
    _salleState.orders = floor.orders || [];

    const list = Array.isArray(recipesResp) ? recipesResp : (recipesResp.recipes || []);
    _salleState.recipes = list.filter(r => {
      const rt = r.recipe_type || 'plat';
      if (rt === 'sous_recette' || rt === 'base') return false;
      if (r.category === 'sauce' || r.category === 'base') return false;
      return true;
    });
  } catch (e) {
    showToast('Erreur de chargement de la salle', 'error');
  }
  _salleRenderAll();
}

async function _salleRefresh() {
  try {
    const floor = await API.request('/service/floor');
    const prevReady = new Set(
      _salleState.orders.filter(o => o.status === 'prêt').map(o => o.id)
    );
    _salleState.service = floor.service;
    _salleState.tables = floor.tables || [];
    _salleState.orders = floor.orders || [];

    const nowReady = _salleState.orders.filter(o => o.status === 'prêt' && !prevReady.has(o.id));
    if (nowReady.length > 0) _salleNotifyReady(nowReady);

    _salleRenderAll();
  } catch (e) { /* silent during polling */ }
}

function _salleStartPolling() {
  if (_salleInterval) clearInterval(_salleInterval);
  _salleInterval = setInterval(() => {
    if (!location.hash.startsWith('#/service')) return _salleCleanup();
    _salleRefresh();
  }, SALLE_POLL_INTERVAL);
}
function _salleStartTimer() {
  if (_salleTimerInterval) clearInterval(_salleTimerInterval);
  _salleTimerInterval = setInterval(() => {
    if (!location.hash.startsWith('#/service')) return _salleCleanup();
    _salleRenderTimers();
    _salleUpdateStats();
  }, 1000);
}
function _salleCleanup() {
  if (_salleInterval) { clearInterval(_salleInterval); _salleInterval = null; }
  if (_salleTimerInterval) { clearInterval(_salleTimerInterval); _salleTimerInterval = null; }
  const app = document.getElementById('app');
  if (app) { app.style.maxWidth = ''; app.style.padding = ''; }
  const nav = document.getElementById('nav');
  if (nav) nav.style.display = '';
}
function _salleExit() { _salleCleanup(); location.hash = '#/'; }

// ═══ RENDER ═══
function _salleRenderAll() {
  _salleRenderTopbar();
  _salleRenderZoneBar();
  _salleRenderGrid();
  _salleUpdateStats();
}

function _salleRenderTopbar() {
  const startBtn = document.getElementById('salle-start-btn');
  const stopBtn = document.getElementById('salle-stop-btn');
  if (!startBtn || !stopBtn) return;
  if (_salleState.service.active) {
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
  } else {
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
  }
}

function _salleRenderZoneBar() {
  const bar = document.getElementById('salle-zonebar');
  if (!bar) return;
  const zones = Array.from(new Set(_salleState.tables.map(t => t.zone || 'Salle')));
  zones.sort();
  const all = ['all', ...zones];
  bar.innerHTML = all.map(z => {
    const label = z === 'all' ? 'Toutes' : z;
    const active = _salleState.zoneFilter === z ? ' salle-zone--active' : '';
    const count = z === 'all'
      ? _salleState.tables.length
      : _salleState.tables.filter(t => (t.zone || 'Salle') === z).length;
    return `<button class="salle-zone${active}" data-zone="${escapeHtml(z)}">
      <span class="salle-zone__name">${escapeHtml(label)}</span>
      <span class="salle-zone__count">${count}</span>
    </button>`;
  }).join('');
  bar.querySelectorAll('.salle-zone').forEach(btn => {
    btn.addEventListener('click', () => {
      _salleState.zoneFilter = btn.dataset.zone;
      _salleRenderAll();
    });
  });
}

function _salleRenderGrid() {
  const body = document.getElementById('salle-body');
  if (!body) return;
  if (_salleState.tables.length === 0) {
    body.innerHTML = `
      <div class="salle-empty">
        <div class="salle-empty__icon">🍽️</div>
        <h2>Aucune table configurée</h2>
        <p>Ajoutez vos tables depuis les réglages de l'établissement pour commencer le service en salle.</p>
        <a href="#/qrcodes" class="salle-btn salle-btn--primary" style="text-decoration:none;display:inline-flex;margin-top:12px">Gérer mes tables</a>
      </div>
    `;
    return;
  }
  const filtered = _salleState.zoneFilter === 'all'
    ? _salleState.tables
    : _salleState.tables.filter(t => (t.zone || 'Salle') === _salleState.zoneFilter);

  body.innerHTML = `<div class="salle-grid">${filtered.map(t => _salleCardHTML(t)).join('')}</div>`;
  body.querySelectorAll('.salle-card').forEach(card => {
    const id = parseInt(card.dataset.tableId);
    card.addEventListener('click', () => _salleOpenTable(id));
  });
}

function _salleTableState(table) {
  const orders = _salleState.orders.filter(o => o.table_number === table.table_number);
  const draft = orders.find(o => o.status === 'en_cours');
  const sent = orders.filter(o => ['envoyé','prêt','servi'].includes(o.status));
  const ready = sent.some(o => o.status === 'prêt');
  const allActive = [...(draft ? [draft] : []), ...sent];
  if (allActive.length === 0) return { status: 'libre', orders: [], oldest: null, total: 0, covers: 0 };

  const oldest = allActive.reduce((a,b) => new Date(a.created_at) < new Date(b.created_at) ? a : b);
  const total = allActive.reduce((s,o) => s + (o.total_cost || 0), 0);
  const covers = allActive.reduce((mx,o) => Math.max(mx, o.covers || 0), 0);

  let status;
  if (ready) status = 'ready';
  else if (sent.some(o => o.status === 'servi') && !draft) status = 'served';
  else if (draft) status = 'draft';
  else status = 'occupied';

  return { status, orders: allActive, oldest, total, covers };
}

function _salleStatusPill(status) {
  const map = {
    libre:    { txt: 'Libre',         cls: 'salle-pill--libre' },
    draft:    { txt: 'Prise de cmd.', cls: 'salle-pill--draft' },
    occupied: { txt: 'Occupée',       cls: 'salle-pill--occupied' },
    ready:    { txt: 'Prêt à servir', cls: 'salle-pill--ready' },
    served:   { txt: 'À débarrasser', cls: 'salle-pill--served' }
  };
  const m = map[status] || map.libre;
  return `<span class="salle-pill ${m.cls}">${m.txt}</span>`;
}

function _salleCardHTML(table) {
  const st = _salleTableState(table);
  const elapsed = st.oldest ? Math.floor((Date.now() - new Date(st.oldest.created_at).getTime()) / 60000) : 0;
  const elapsedTxt = elapsed >= 60 ? `${Math.floor(elapsed/60)}h${String(elapsed%60).padStart(2,'0')}` : `${elapsed}′`;
  const elapsedCls = elapsed > 30 ? 'salle-card__timer--late' : elapsed > 15 ? 'salle-card__timer--warn' : '';
  const ringCls = `salle-card--${st.status}`;
  const itemCount = st.orders.reduce((s,o) => s + (o.items?.length || 0), 0);

  return `
    <button class="salle-card ${ringCls}" data-table-id="${table.id}" data-status="${st.status}">
      <div class="salle-card__head">
        <div class="salle-card__num">${table.table_number}</div>
        <div class="salle-card__zone">${escapeHtml(table.zone || 'Salle')}</div>
      </div>
      <div class="salle-card__body">
        ${_salleStatusPill(st.status)}
        <div class="salle-card__meta">
          <span class="salle-card__seats">${st.covers > 0 ? `👥 ${st.covers}` : `▢ ${table.seats || 4}`}</span>
          ${itemCount > 0 ? `<span class="salle-card__items">🍽️ ${itemCount}</span>` : ''}
        </div>
      </div>
      <div class="salle-card__foot">
        ${st.status !== 'libre' ? `<span class="salle-card__total">${formatCurrency(st.total)}</span>` : '<span class="salle-card__total" style="opacity:.4">—</span>'}
        ${st.oldest ? `<span class="salle-card__timer ${elapsedCls}" data-created-at="${st.oldest.created_at}">${elapsedTxt}</span>` : ''}
      </div>
    </button>
  `;
}

function _salleRenderTimers() {
  document.querySelectorAll('.salle-card__timer[data-created-at]').forEach(el => {
    const created = new Date(el.dataset.createdAt);
    const elapsed = Math.floor((Date.now() - created.getTime()) / 60000);
    const txt = elapsed >= 60 ? `${Math.floor(elapsed/60)}h${String(elapsed%60).padStart(2,'0')}` : `${elapsed}′`;
    el.textContent = txt;
    el.classList.toggle('salle-card__timer--late', elapsed > 30);
    el.classList.toggle('salle-card__timer--warn', elapsed > 15 && elapsed <= 30);
  });
  if (_salleState.service.session) {
    const el = document.getElementById('salle-s-time');
    if (el) {
      const ms = Date.now() - new Date(_salleState.service.session.started_at).getTime();
      const min = Math.floor(ms / 60000);
      const h = Math.floor(min / 60);
      el.textContent = h > 0 ? `${h}h${String(min%60).padStart(2,'0')}` : `${min}min`;
    }
  } else {
    const el = document.getElementById('salle-s-time');
    if (el) el.textContent = '—';
  }
}

function _salleUpdateStats() {
  const totalTables = _salleState.tables.length;
  let occupied = 0, totalCovers = 0, totalCA = 0;
  for (const t of _salleState.tables) {
    const st = _salleTableState(t);
    if (st.status !== 'libre') {
      occupied++;
      totalCovers += st.covers;
      totalCA += st.total;
    }
  }
  const occEl = document.getElementById('salle-s-occ');
  const covEl = document.getElementById('salle-s-cov');
  const caEl = document.getElementById('salle-s-ca');
  if (occEl) occEl.textContent = `${occupied}/${totalTables}`;
  if (covEl) covEl.textContent = totalCovers;
  if (caEl) caEl.textContent = formatCurrency(totalCA);
}

// ═══ TABLE MODAL — take order ═══
function _salleOpenTable(tableId) {
  const table = _salleState.tables.find(t => t.id === tableId);
  if (!table) return;
  _salleState.selectedTableId = tableId;

  const existingDraft = _salleState.orders.find(
    o => o.table_number === table.table_number && o.status === 'en_cours'
  );
  _salleState.draft = {};
  if (existingDraft && existingDraft.items) {
    for (const it of existingDraft.items) {
      _salleState.draft[it.recipe_id] = {
        recipe_id: it.recipe_id,
        name: it.recipe_name,
        price: it.selling_price || 0,
        quantity: it.quantity,
        notes: it.notes || ''
      };
    }
  }
  _salleState.draftCovers = existingDraft?.covers ?? null;
  _salleState.draftNotes = existingDraft?.notes || '';
  _salleState.draftSeatAllergies = _salleParseSeatAllergies(existingDraft?.seat_allergies);
  _salleState.menuSearch = '';

  _salleRenderModal(table);
}

function _salleParseSeatAllergies(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (e) { /* swallow */ }
  return {};
}

function _salleCloseModal() {
  document.getElementById('salle-modal-overlay')?.remove();
  _salleState.selectedTableId = null;
}

function _salleRenderModal(table) {
  document.getElementById('salle-modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'salle-modal-overlay';
  overlay.id = 'salle-modal-overlay';

  const sentOrders = _salleState.orders.filter(
    o => o.table_number === table.table_number && o.status !== 'en_cours'
  );

  overlay.innerHTML = `
    <div class="salle-modal" role="dialog" aria-modal="true">
      <header class="salle-modal__head">
        <div class="salle-modal__title">
          <span class="salle-modal__num">Table ${table.table_number}</span>
          <span class="salle-modal__zone">${escapeHtml(table.zone || 'Salle')} · ${table.seats || 4} places</span>
        </div>
        <button class="salle-modal__close" id="salle-modal-close" aria-label="Fermer">✕</button>
      </header>

      <div class="salle-modal__body">
        <div class="salle-modal__menu">
          <div class="salle-modal__search">
            <input type="search" id="salle-modal-search" placeholder="Rechercher un plat…" class="form-control" data-ui="custom">
          </div>
          <div class="salle-modal__menu-list" id="salle-menu-list"></div>
        </div>

        <div class="salle-modal__cart">
          <h3 class="salle-modal__section">Commande</h3>
          <div id="salle-cart-items" class="salle-cart"></div>

          <div class="salle-covers">
            <span class="salle-covers__label">👥 Couverts</span>
            <div class="salle-covers__stepper">
              <button type="button" class="salle-covers__btn" id="salle-covers-dec" aria-label="Moins">−</button>
              <input type="text" inputmode="numeric" id="salle-cart-covers" maxlength="3" placeholder="0" value="${_salleState.draftCovers ?? ''}">
              <button type="button" class="salle-covers__btn" id="salle-covers-inc" aria-label="Plus">+</button>
            </div>
          </div>

          <div class="salle-seat-allergies" id="salle-seat-allergies"></div>

          <label class="salle-cart-meta__field salle-cart-meta__field--full">
            <span>📝 Notes générales (demandes table)</span>
            <textarea id="salle-cart-notes" rows="2" class="form-control" data-ui="custom">${escapeHtml(_salleState.draftNotes)}</textarea>
          </label>

          <div class="salle-cart__total" id="salle-cart-total">Total : 0,00 €</div>

          <div class="salle-cart__actions">
            <button class="salle-btn salle-btn--ghost" id="salle-action-save">💾 Sauvegarder</button>
            <button class="salle-btn salle-btn--primary" id="salle-action-send">🔔 Envoyer en cuisine</button>
          </div>

          <div class="salle-modal__sent" id="salle-modal-sent"></div>

          <div class="salle-modal__danger">
            <button class="salle-btn salle-btn--ghost" id="salle-action-split" title="Diviser l'addition">➗ Diviser l'addition</button>
            <button class="salle-btn salle-btn--danger" id="salle-action-close">Terminer la table</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _salleCloseModal(); });
  document.getElementById('salle-modal-close').addEventListener('click', _salleCloseModal);

  document.getElementById('salle-action-save').addEventListener('click', () => _salleSaveOrder(table, false));
  document.getElementById('salle-action-send').addEventListener('click', () => _salleSaveOrder(table, true));
  document.getElementById('salle-action-close').addEventListener('click', () => _salleCloseTable(table));
  document.getElementById('salle-action-split').addEventListener('click', () => _salleSplitBill(table));

  const search = document.getElementById('salle-modal-search');
  let st;
  search.addEventListener('input', () => {
    clearTimeout(st);
    st = setTimeout(() => {
      _salleState.menuSearch = (search.value || '').trim().toLowerCase();
      _salleRenderMenu();
    }, 120);
  });

  const coversInp = document.getElementById('salle-cart-covers');
  const setCovers = (n, opts = {}) => {
    n = Math.max(0, Math.min(999, n | 0));
    _salleState.draftCovers = n === 0 && opts.allowZero !== true ? null : n;
    coversInp.value = n === 0 ? '' : String(n);
    _salleRenderSeatAllergies();
  };
  coversInp.addEventListener('input', (e) => {
    const digits = (e.target.value || '').replace(/\D+/g, '').slice(0, 3);
    e.target.value = digits;
    _salleState.draftCovers = digits === '' ? null : parseInt(digits, 10);
    _salleRenderSeatAllergies();
  });
  document.getElementById('salle-covers-dec').addEventListener('click', () => {
    setCovers((_salleState.draftCovers || 0) - 1, { allowZero: true });
  });
  document.getElementById('salle-covers-inc').addEventListener('click', () => {
    setCovers((_salleState.draftCovers || 0) + 1);
  });

  document.getElementById('salle-cart-notes').addEventListener('input', (e) => {
    _salleState.draftNotes = e.target.value;
  });

  _salleRenderMenu();
  _salleRenderCart();
  _salleRenderSeatAllergies();
  _salleRenderSent(table, sentOrders);
}

// Common allergens — clickable chip preset to speed up the waiter's input.
const _SALLE_ALLERGY_PRESETS = [
  'gluten', 'lactose', 'arachides', 'fruits à coque', 'œufs',
  'poisson', 'crustacés', 'soja', 'céleri', 'moutarde',
  'sésame', 'sulfites', 'lupin', 'mollusques',
  'végétarien', 'vegan', 'sans porc', 'sans alcool'
];

function _salleRenderSeatAllergies() {
  const el = document.getElementById('salle-seat-allergies');
  if (!el) return;
  const n = _salleState.draftCovers || 0;
  if (n <= 0) {
    el.innerHTML = `
      <div class="salle-seat-allergies__hint">
        💡 Ajoutez le nombre de couverts pour saisir les allergies par position.
      </div>
    `;
    return;
  }

  let html = `
    <div class="salle-seat-allergies__head">
      <span class="salle-seat-allergies__title">⚠️ Allergies / régimes par position</span>
      <span class="salle-seat-allergies__sub">Cliquez sur une étiquette ou tapez librement</span>
    </div>
    <div class="salle-seat-allergies__rows">
  `;
  for (let i = 1; i <= n; i++) {
    const value = _salleState.draftSeatAllergies?.[i] || '';
    const filled = value ? 'salle-seat-row--filled' : '';
    html += `
      <div class="salle-seat-row ${filled}">
        <span class="salle-seat-row__pos">P${i}</span>
        <input type="text" class="salle-seat-row__input" data-pos="${i}" maxlength="200" placeholder="Aucune allergie" value="${escapeHtml(value)}">
        <button type="button" class="salle-seat-row__clear" data-clear-pos="${i}" title="Effacer" aria-label="Effacer position ${i}">✕</button>
      </div>
    `;
  }
  html += `</div>
    <div class="salle-seat-allergies__presets" id="salle-seat-presets" hidden>
      <span class="salle-seat-allergies__presets-label">Suggestions :</span>
      ${_SALLE_ALLERGY_PRESETS.map(p => `<button type="button" class="salle-seat-chip" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('')}
    </div>
  `;
  el.innerHTML = html;

  let activePos = null;
  el.querySelectorAll('.salle-seat-row__input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const pos = parseInt(inp.dataset.pos, 10);
      const v = e.target.value;
      if (v) _salleState.draftSeatAllergies[pos] = v;
      else delete _salleState.draftSeatAllergies[pos];
      inp.parentElement.classList.toggle('salle-seat-row--filled', !!v);
    });
    inp.addEventListener('focus', () => {
      activePos = parseInt(inp.dataset.pos, 10);
      const presets = document.getElementById('salle-seat-presets');
      if (presets) presets.hidden = false;
    });
  });
  el.querySelectorAll('.salle-seat-row__clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = parseInt(btn.dataset.clearPos, 10);
      delete _salleState.draftSeatAllergies[pos];
      const inp = el.querySelector(`.salle-seat-row__input[data-pos="${pos}"]`);
      if (inp) { inp.value = ''; inp.parentElement.classList.remove('salle-seat-row--filled'); }
    });
  });
  el.querySelectorAll('.salle-seat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (activePos == null) return;
      const inp = el.querySelector(`.salle-seat-row__input[data-pos="${activePos}"]`);
      if (!inp) return;
      const current = inp.value.trim();
      const preset = chip.dataset.preset;
      const next = current ? `${current}, ${preset}` : preset;
      inp.value = next;
      _salleState.draftSeatAllergies[activePos] = next;
      inp.parentElement.classList.add('salle-seat-row--filled');
      inp.focus();
    });
  });
}

function _salleRenderMenu() {
  const el = document.getElementById('salle-menu-list');
  if (!el) return;
  const q = _salleState.menuSearch;
  const grouped = {};
  for (const r of _salleState.recipes) {
    if (q && !(r.name || '').toLowerCase().includes(q)) continue;
    const cat = r.category || 'Autres';
    (grouped[cat] = grouped[cat] || []).push(r);
  }
  const order = ['entrée', 'entrée froide', 'entrée chaude', 'plat', 'plat principal', 'dessert', 'boisson', 'accompagnement'];
  const cats = Object.keys(grouped).sort((a,b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  if (cats.length === 0) {
    el.innerHTML = `<div class="salle-empty-menu">Aucun plat${q ? ` pour « ${escapeHtml(q)} »` : ''}.<br><a href="#/recipes/new">+ Créer une fiche</a></div>`;
    return;
  }

  let html = '';
  for (const cat of cats) {
    const items = grouped[cat];
    html += `<div class="salle-menu-cat"><h4>${escapeHtml(cat.charAt(0).toUpperCase() + cat.slice(1))} <span class="salle-menu-cat__count">${items.length}</span></h4>`;
    for (const r of items) {
      const price = r.selling_price || 0;
      html += `
        <button class="salle-menu-item" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-price="${price}">
          <span class="salle-menu-item__name">${escapeHtml(r.name)}</span>
          <span class="salle-menu-item__price">${price ? formatCurrency(price) : '—'}</span>
          <span class="salle-menu-item__add">+</span>
        </button>
      `;
    }
    html += '</div>';
  }
  el.innerHTML = html;
  el.querySelectorAll('.salle-menu-item').forEach(btn => {
    btn.addEventListener('click', () => _salleAdd(parseInt(btn.dataset.id), btn.dataset.name, parseFloat(btn.dataset.price)));
  });
}

function _salleAdd(rid, name, price) {
  const item = _salleState.draft[rid];
  if (item) item.quantity++;
  else _salleState.draft[rid] = { recipe_id: rid, name, price, quantity: 1, notes: '' };
  _salleRenderCart();
}
function _salleQty(rid, delta) {
  const it = _salleState.draft[rid];
  if (!it) return;
  it.quantity += delta;
  if (it.quantity <= 0) delete _salleState.draft[rid];
  _salleRenderCart();
}
function _salleRemove(rid) { delete _salleState.draft[rid]; _salleRenderCart(); }

function _salleRenderCart() {
  const el = document.getElementById('salle-cart-items');
  const totalEl = document.getElementById('salle-cart-total');
  if (!el || !totalEl) return;
  const items = Object.values(_salleState.draft);
  if (items.length === 0) {
    el.innerHTML = '<div class="salle-cart__empty">Aucun plat ajouté</div>';
    totalEl.textContent = 'Total : 0,00 €';
    return;
  }
  let total = 0;
  el.innerHTML = items.map(it => {
    const subtotal = it.price * it.quantity;
    total += subtotal;
    return `
      <div class="salle-cart__item">
        <span class="salle-cart__qty">${it.quantity}×</span>
        <span class="salle-cart__name">${escapeHtml(it.name)}</span>
        <span class="salle-cart__price">${formatCurrency(subtotal)}</span>
        <span class="salle-cart__ctrls">
          <button class="salle-cart__btn" data-act="dec" data-id="${it.recipe_id}">−</button>
          <button class="salle-cart__btn" data-act="inc" data-id="${it.recipe_id}">+</button>
          <button class="salle-cart__btn salle-cart__btn--del" data-act="del" data-id="${it.recipe_id}">×</button>
        </span>
      </div>
    `;
  }).join('');
  totalEl.textContent = `Total : ${formatCurrency(total)}`;
  el.querySelectorAll('.salle-cart__btn').forEach(b => {
    b.addEventListener('click', () => {
      const id = parseInt(b.dataset.id);
      if (b.dataset.act === 'inc') _salleQty(id, 1);
      else if (b.dataset.act === 'dec') _salleQty(id, -1);
      else _salleRemove(id);
    });
  });
}

function _salleRenderSent(table, sentOrders) {
  const el = document.getElementById('salle-modal-sent');
  if (!el) return;
  if (!sentOrders.length) { el.innerHTML = ''; return; }
  let html = '<h3 class="salle-modal__section">Envoyé en cuisine</h3>';
  for (const o of sentOrders) {
    const elapsedMin = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
    const isReady = o.status === 'prêt';
    const isServed = o.status === 'servi';
    const cls = isReady ? 'salle-sent--ready' : isServed ? 'salle-sent--served' : '';
    const badge = isReady ? '✅ Prêt' : isServed ? '🍽️ Servi' : '⏳ En cuisine';
    const sa = _salleParseSeatAllergies(o.seat_allergies);
    const saEntries = Object.entries(sa).sort((a,b) => Number(a[0]) - Number(b[0]));
    const saChips = saEntries.length > 0
      ? `<div class="salle-sent__allergies">${saEntries.map(([pos, txt]) =>
          `<span class="salle-sent__allergy-chip">P${pos} · ${escapeHtml(txt)}</span>`
        ).join('')}</div>`
      : '';
    html += `<div class="salle-sent ${cls}">
      <div class="salle-sent__head">
        <span class="salle-sent__badge">${badge}</span>
        <span class="salle-sent__time">${elapsedMin}′</span>
        <span class="salle-sent__total">${formatCurrency(o.total_cost || 0)}</span>
      </div>
      ${saChips}
      <ul class="salle-sent__items">
        ${(o.items || []).filter(it => it.status !== 'annulé').map(it => `
          <li>
            <span>${escapeHtml(it.quantity)}× ${escapeHtml(it.recipe_name)}</span>
            <span class="salle-sent__item-status">${_salleItemStatusIcon(it.status)}</span>
          </li>
        `).join('')}
      </ul>
      ${isReady ? `<button class="salle-btn salle-btn--primary salle-btn--sm" data-mark-served="${o.id}">🍽️ Marquer servi</button>` : ''}
    </div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-mark-served]').forEach(b => {
    b.addEventListener('click', async () => {
      try {
        await API.closeOrder(parseInt(b.dataset.markServed));
        showToast('Commande servie', 'success');
        await _salleRefresh();
        _salleOpenTable(table.id);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

function _salleItemStatusIcon(s) {
  switch (s) {
    case 'prêt': return '✅';
    case 'en_préparation': return '🔥';
    case 'servi': return '🍽️';
    default: return '⏳';
  }
}

async function _salleSaveOrder(table, sendImmediately) {
  const items = Object.values(_salleState.draft);
  if (items.length === 0) { showToast('Ajoutez au moins un plat', 'error'); return; }

  let coversValue = null;
  if (_salleState.draftCovers != null && _salleState.draftCovers !== '') {
    const n = parseInt(_salleState.draftCovers, 10);
    if (Number.isInteger(n) && n >= 0 && n <= 999) coversValue = n;
  }

  try {
    const existingDraft = _salleState.orders.find(
      o => o.table_number === table.table_number && o.status === 'en_cours'
    );
    if (existingDraft) await API.cancelOrder(existingDraft.id);

    // Build the seat-allergies payload — keep only non-empty entries that are
    // within the configured covers count. Server normalises again, but trim
    // up-front so the wire payload matches what the cuisinier will see.
    const seatPayload = {};
    const ceiling = coversValue || 0;
    for (const [k, v] of Object.entries(_salleState.draftSeatAllergies || {})) {
      const pos = parseInt(k, 10);
      if (!Number.isInteger(pos) || pos < 1) continue;
      if (ceiling > 0 && pos > ceiling) continue;
      if (typeof v === 'string' && v.trim()) seatPayload[pos] = v.trim();
    }

    const order = await API.createOrder({
      table_number: table.table_number,
      notes: _salleState.draftNotes || null,
      covers: coversValue,
      seat_allergies: Object.keys(seatPayload).length > 0 ? seatPayload : null,
      items: items.map(i => ({ recipe_id: i.recipe_id, quantity: i.quantity, notes: i.notes || null }))
    });

    if (sendImmediately) {
      const result = await API.sendOrder(order.id);
      if (result.warnings?.length > 0) {
        showToast(`⚠️ Stock bas pour ${result.warnings.length} ingrédient(s)`, 'info');
      }
      showToast(`Table ${table.table_number} — Commande envoyée 🔔`, 'success');
      _salleCloseModal();
    } else {
      showToast(`Table ${table.table_number} — Commande sauvegardée`, 'success');
    }
    await _salleRefresh();
    if (!sendImmediately && _salleState.selectedTableId === table.id) {
      _salleOpenTable(table.id);
    }
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function _salleCloseTable(table) {
  const tableOrders = _salleState.orders.filter(
    o => o.table_number === table.table_number && !['terminé','annulé'].includes(o.status)
  );
  if (tableOrders.length === 0) {
    showToast('Cette table est déjà libre', 'info');
    return;
  }
  showConfirmModal(
    `Terminer la table ${table.table_number} ?`,
    `${tableOrders.length} commande(s) seront marquées terminées.`,
    async () => {
      try {
        for (const o of tableOrders) {
          if (o.status === 'en_cours') await API.cancelOrder(o.id);
          else await API.closeOrder(o.id);
        }
        showToast(`Table ${table.table_number} terminée`, 'success');
        _salleCloseModal();
        await _salleRefresh();
      } catch (e) { showToast(e.message, 'error'); }
    },
    { confirmText: 'Terminer', confirmClass: 'salle-btn salle-btn--primary' }
  );
}

function _salleSplitBill(table) {
  const sent = _salleState.orders.filter(
    o => o.table_number === table.table_number && ['envoyé','prêt','servi'].includes(o.status)
  );
  const total = sent.reduce((s,o) => s + (o.total_cost || 0), 0);
  if (total <= 0) { showToast('Aucune commande à diviser', 'info'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'salle-modal-overlay';
  overlay.style.zIndex = '10010';
  overlay.innerHTML = `
    <div class="salle-modal" style="max-width:380px">
      <header class="salle-modal__head">
        <div class="salle-modal__title"><span class="salle-modal__num" style="font-size:1.2rem">Diviser l'addition</span></div>
        <button class="salle-modal__close" aria-label="Fermer">✕</button>
      </header>
      <div style="padding:20px">
        <p style="margin:0 0 8px;color:var(--text-secondary);font-size:14px">Table ${table.table_number} — Total ${formatCurrency(total)}</p>
        <label style="display:block;margin:12px 0">
          <span style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:4px">Nombre de personnes</span>
          <input type="number" id="salle-split-n" min="2" max="20" value="2" class="form-control" style="font-size:1.5rem;text-align:center">
        </label>
        <div id="salle-split-result" style="font-size:1.4rem;font-weight:700;color:var(--color-accent);text-align:center;padding:16px;background:var(--bg-elevated);border-radius:10px;margin-top:8px"></div>
        <p style="font-size:12px;color:var(--text-tertiary);margin-top:8px;text-align:center">Information indicative — saisissez les paiements dans votre TPE</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.salle-modal__close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  const inp = overlay.querySelector('#salle-split-n');
  const result = overlay.querySelector('#salle-split-result');
  const recompute = () => {
    const n = Math.max(2, Math.min(20, parseInt(inp.value, 10) || 2));
    result.textContent = `${formatCurrency(total / n)} / personne`;
  };
  inp.addEventListener('input', recompute);
  recompute();
}

// ═══ NOTIFICATIONS ═══
function _salleNotifyReady(orders) {
  const tables = orders.map(o => o.table_number).join(', ');
  showToast(`✅ Table ${tables} — Prêt à servir !`, 'success');
  if (typeof playKitchenNotificationSound === 'function') playKitchenNotificationSound();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ═══ START / STOP ═══
async function _salleStart() {
  try {
    await API.startService();
    showToast('🚀 Service lancé', 'success');
    await _salleRefresh();
  } catch (e) { showToast(e.message, 'error'); }
}
async function _salleStop() {
  const active = _salleState.orders.filter(o => ['envoyé','en_cours','prêt'].includes(o.status));
  const msg = active.length > 0
    ? `Il reste ${active.length} commande(s) en cours. Continuer ?`
    : 'Le récapitulatif du service sera affiché.';
  showConfirmModal('Terminer le service ?', msg, async () => {
    try {
      const result = await API.stopService();
      _salleShowRecap(result.recap);
    } catch (e) { showToast(e.message, 'error'); }
  }, { confirmText: 'Terminer le service', confirmClass: 'salle-btn salle-btn--danger' });
}

function _salleShowRecap(recap) {
  const overlay = document.createElement('div');
  overlay.className = 'salle-modal-overlay';
  overlay.id = 'salle-modal-overlay';
  const dur = recap.started_at && recap.ended_at
    ? (() => {
        const ms = new Date(recap.ended_at) - new Date(recap.started_at);
        const m = Math.floor(ms / 60000);
        return m >= 60 ? `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}` : `${m}min`;
      })()
    : '—';
  overlay.innerHTML = `
    <div class="salle-modal" style="max-width:520px">
      <header class="salle-modal__head">
        <div class="salle-modal__title">
          <span class="salle-modal__num" style="font-size:1.4rem">🏁 Service terminé</span>
        </div>
        <button class="salle-modal__close" aria-label="Fermer">✕</button>
      </header>
      <div style="padding:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="salle-recap__cell"><strong>${recap.total_orders || 0}</strong><span>Commandes</span></div>
          <div class="salle-recap__cell"><strong>${recap.total_covers || 0}</strong><span>Couverts</span></div>
          <div class="salle-recap__cell"><strong>${recap.total_items || 0}</strong><span>Plats servis</span></div>
          <div class="salle-recap__cell"><strong>${formatCurrency(recap.total_revenue || 0)}</strong><span>CA</span></div>
        </div>
        <div style="background:var(--bg-elevated);border-radius:10px;padding:12px;margin-bottom:16px;font-size:14px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light)"><span>Durée</span><strong>${dur}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light)"><span>Ticket moyen</span><strong>${recap.total_covers > 0 ? formatCurrency((recap.total_revenue || 0) / recap.total_covers) + '/cv' : '—'}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light)"><span>Temps moyen / commande</span><strong>${recap.avg_ticket_time_min || 0} min</strong></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span>Heure de pointe</span><strong>${recap.peak_hour ? recap.peak_hour + 'h' : '—'}</strong></div>
        </div>
        <button class="salle-btn salle-btn--primary" style="width:100%" id="salle-recap-close">Retour à la salle</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.salle-modal__close').addEventListener('click', () => { overlay.remove(); _salleRefresh(); });
  document.getElementById('salle-recap-close').addEventListener('click', () => { overlay.remove(); _salleRefresh(); });
}

// ═══ QUICK MENU ═══
function _salleQuickMenu() {
  const overlay = document.createElement('div');
  overlay.className = 'salle-modal-overlay';
  overlay.innerHTML = `
    <div class="salle-modal" style="max-width:320px">
      <header class="salle-modal__head">
        <div class="salle-modal__title"><span class="salle-modal__num" style="font-size:1.1rem">Menu rapide</span></div>
        <button class="salle-modal__close" aria-label="Fermer">✕</button>
      </header>
      <div style="padding:16px;display:flex;flex-direction:column;gap:8px">
        <a href="#/kitchen" class="salle-btn salle-btn--ghost" style="text-decoration:none;justify-content:flex-start">👨‍🍳 Écran cuisine</a>
        <a href="#/recipes" class="salle-btn salle-btn--ghost" style="text-decoration:none;justify-content:flex-start">📋 Fiches techniques</a>
        <a href="#/stock" class="salle-btn salle-btn--ghost" style="text-decoration:none;justify-content:flex-start">📦 Stock</a>
        <a href="#/analytics" class="salle-btn salle-btn--ghost" style="text-decoration:none;justify-content:flex-start">📊 Pilotage</a>
        <a href="#/settings/service-hours" class="salle-btn salle-btn--ghost" style="text-decoration:none;justify-content:flex-start">⚙️ Horaires de service</a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.salle-modal__close').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => overlay.remove()));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
