// ═══════════════════════════════════════════
// Kitchen Display System (KDS) — 3 lanes: Nouveau, En préparation, Prêt
// ═══════════════════════════════════════════

const KDS_POLL_INTERVAL = 7000;
let _kdsInterval = null;
let _kdsTimerInterval = null;
let _kdsState = {
  orders: [],
  prevIds: null,
  soundOn: true,
  fullscreen: false
};

async function renderKitchenView() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');

  app.style.maxWidth = 'none';
  app.style.padding = '0';
  if (nav) nav.style.display = 'none';

  app.innerHTML = `
    <div class="kds-shell">
      <header class="kds-topbar">
        <div class="kds-topbar__brand">
          <img src="assets/logo-icon.svg" alt="RestoSuite" style="height:22px">
          <span class="kds-topbar__title">Cuisine</span>
          <span class="kds-topbar__sep">•</span>
          <span class="kds-topbar__clock" id="kds-clock">--:--</span>
        </div>
        <div class="kds-topbar__stats">
          <div class="kds-stat"><span class="kds-stat__val" id="kds-s-new">0</span><span class="kds-stat__lbl">Nouveau</span></div>
          <div class="kds-stat"><span class="kds-stat__val" id="kds-s-cook">0</span><span class="kds-stat__lbl">En préparation</span></div>
          <div class="kds-stat"><span class="kds-stat__val" id="kds-s-ready">0</span><span class="kds-stat__lbl">Prêt</span></div>
        </div>
        <div class="kds-topbar__actions">
          <button class="kds-btn" id="kds-sound-btn" title="Son notification">🔔</button>
          <button class="kds-btn" id="kds-fullscreen-btn" title="Plein écran">⛶</button>
          <button class="kds-btn" id="kds-refresh-btn" title="Rafraîchir">↻</button>
          <button class="kds-btn kds-btn--ghost" id="kds-go-salle">Salle</button>
          <button class="kds-btn kds-btn--ghost" id="kds-exit-btn" title="Quitter">✕</button>
        </div>
      </header>

      <div class="kds-body" id="kds-body">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  document.getElementById('kds-exit-btn').addEventListener('click', _kdsExit);
  document.getElementById('kds-go-salle').addEventListener('click', () => { location.hash = '#/service'; });
  document.getElementById('kds-refresh-btn').addEventListener('click', _kdsLoad);
  document.getElementById('kds-fullscreen-btn').addEventListener('click', _kdsToggleFullscreen);
  document.getElementById('kds-sound-btn').addEventListener('click', () => {
    _kdsState.soundOn = !_kdsState.soundOn;
    document.getElementById('kds-sound-btn').textContent = _kdsState.soundOn ? '🔔' : '🔕';
    showToast(_kdsState.soundOn ? 'Son activé' : 'Son désactivé', 'info');
  });

  _kdsState.prevIds = null;
  await _kdsLoad();
  _kdsUpdateClock();
  _kdsStartPolling();
  _kdsStartTimers();
}

async function _kdsLoad() {
  try {
    const data = await API.request('/service/kds');
    const orders = data.orders || [];

    const currentIds = new Set(orders.map(o => o.id));
    if (_kdsState.prevIds !== null) {
      const hasNew = orders.some(o => !_kdsState.prevIds.has(o.id) && o.status === 'envoyé');
      if (hasNew && _kdsState.soundOn) _kdsPlaySound();
    }
    _kdsState.prevIds = currentIds;
    _kdsState.orders = orders;
    _kdsRender();
  } catch (e) { /* silent */ }
}

function _kdsStartPolling() {
  if (_kdsInterval) clearInterval(_kdsInterval);
  _kdsInterval = setInterval(() => {
    if (location.hash !== '#/kitchen') return _kdsCleanup();
    _kdsLoad();
  }, KDS_POLL_INTERVAL);
}

function _kdsStartTimers() {
  if (_kdsTimerInterval) clearInterval(_kdsTimerInterval);
  _kdsTimerInterval = setInterval(() => {
    if (location.hash !== '#/kitchen') return _kdsCleanup();
    _kdsUpdateClock();
    _kdsUpdateTimers();
  }, 1000);
}

function _kdsCleanup() {
  if (_kdsInterval) { clearInterval(_kdsInterval); _kdsInterval = null; }
  if (_kdsTimerInterval) { clearInterval(_kdsTimerInterval); _kdsTimerInterval = null; }
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (app) { app.style.maxWidth = ''; app.style.padding = ''; }
  if (nav) nav.style.display = '';
}

function _kdsExit() {
  _kdsCleanup();
  location.hash = '#/';
}

function _kdsUpdateClock() {
  const el = document.getElementById('kds-clock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ═══ Item-level lane assignment ═══
// We display ITEMS in lanes (not full orders) so the cuisinier sees granular state.
// Lane mapping:
//   en_attente            → Nouveau
//   en_préparation        → En préparation
//   prêt                  → Prêt
// Items 'servi' or 'annulé' don't appear on the KDS.
function _kdsLanes() {
  const lanes = { nouveau: [], cook: [], ready: [] };
  for (const o of _kdsState.orders) {
    for (const it of (o.items || [])) {
      if (it.status === 'servi' || it.status === 'annulé') continue;
      const ticket = {
        order: o,
        item: it
      };
      if (it.status === 'en_attente' || it.status === 'attente') lanes.nouveau.push(ticket);
      else if (it.status === 'en_préparation') lanes.cook.push(ticket);
      else if (it.status === 'prêt') lanes.ready.push(ticket);
    }
  }
  // Sort each lane by oldest first
  for (const k of Object.keys(lanes)) {
    lanes[k].sort((a,b) => new Date(a.order.created_at) - new Date(b.order.created_at));
  }
  return lanes;
}

function _kdsRender() {
  const body = document.getElementById('kds-body');
  if (!body) return;

  const lanes = _kdsLanes();
  const counts = {
    nouveau: lanes.nouveau.length,
    cook: lanes.cook.length,
    ready: lanes.ready.length
  };
  const newEl = document.getElementById('kds-s-new');
  const cookEl = document.getElementById('kds-s-cook');
  const readyEl = document.getElementById('kds-s-ready');
  if (newEl) newEl.textContent = counts.nouveau;
  if (cookEl) cookEl.textContent = counts.cook;
  if (readyEl) readyEl.textContent = counts.ready;

  if (counts.nouveau + counts.cook + counts.ready === 0) {
    body.innerHTML = `
      <div class="kds-empty">
        <div class="kds-empty__icon">✓</div>
        <h2>Cuisine au calme</h2>
        <p>Aucune commande en attente. Les nouveaux bons apparaîtront ici dès qu'ils sont envoyés.</p>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="kds-lanes">
      <section class="kds-lane kds-lane--new">
        <header class="kds-lane__head">
          <span class="kds-lane__icon">📥</span>
          <h2>Nouveau</h2>
          <span class="kds-lane__count">${counts.nouveau}</span>
        </header>
        <div class="kds-lane__body">
          ${lanes.nouveau.map(t => _kdsTicketHTML(t, 'nouveau')).join('') || '<div class="kds-lane__empty">—</div>'}
        </div>
      </section>
      <section class="kds-lane kds-lane--cook">
        <header class="kds-lane__head">
          <span class="kds-lane__icon">🔥</span>
          <h2>En préparation</h2>
          <span class="kds-lane__count">${counts.cook}</span>
        </header>
        <div class="kds-lane__body">
          ${lanes.cook.map(t => _kdsTicketHTML(t, 'cook')).join('') || '<div class="kds-lane__empty">—</div>'}
        </div>
      </section>
      <section class="kds-lane kds-lane--ready">
        <header class="kds-lane__head">
          <span class="kds-lane__icon">✅</span>
          <h2>Prêt</h2>
          <span class="kds-lane__count">${counts.ready}</span>
        </header>
        <div class="kds-lane__body">
          ${lanes.ready.map(t => _kdsTicketHTML(t, 'ready')).join('') || '<div class="kds-lane__empty">—</div>'}
        </div>
      </section>
    </div>
  `;

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const orderId = parseInt(btn.dataset.orderId);
      const itemId = parseInt(btn.dataset.itemId);
      const action = btn.dataset.action;
      let nextStatus;
      if (action === 'start') nextStatus = 'en_préparation';
      else if (action === 'ready') nextStatus = 'prêt';
      else if (action === 'undo') nextStatus = 'en_préparation';
      if (!nextStatus) return;
      try {
        await API.updateOrderItem(orderId, itemId, { status: nextStatus });
        await _kdsLoad();
      } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
    });
  });
}

function _kdsParseSeatAllergies(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (e) { /* swallow */ }
  return {};
}

function _kdsTicketHTML(ticket, lane) {
  const o = ticket.order;
  const it = ticket.item;
  const elapsed = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
  const urgent = elapsed > 15 ? 'kds-ticket--urgent' : elapsed > 8 ? 'kds-ticket--warn' : '';
  const fresh = elapsed < 2 ? 'kds-ticket--fresh' : '';

  // Free-text allergy/notes detection (legacy global notes field)
  const noteText = [o.notes, it.notes].filter(Boolean).join(' • ');
  const hasAllergy = noteText && /allergi|sans|gluten|lactose|noix|arachide|fruit\s*de\s*mer/i.test(noteText);

  // Per-seat allergies — render as red chips so the cuisinier sees them at a glance
  const seatAllergies = _kdsParseSeatAllergies(o.seat_allergies);
  const seatEntries = Object.entries(seatAllergies).sort((a,b) => Number(a[0]) - Number(b[0]));
  const seatBadges = seatEntries.length > 0
    ? `<div class="kds-ticket__seat-allergies">
        ${seatEntries.map(([pos, txt]) =>
          `<span class="kds-ticket__seat-chip"><span class="kds-ticket__seat-chip-pos">P${escapeHtml(String(pos))}</span><span class="kds-ticket__seat-chip-txt">${escapeHtml(txt)}</span></span>`
        ).join('')}
      </div>`
    : '';

  let actions = '';
  if (lane === 'nouveau') {
    actions = `<button class="kds-ticket__btn kds-ticket__btn--primary" data-action="start" data-order-id="${o.id}" data-item-id="${it.id}">🔥 Démarrer</button>
               <button class="kds-ticket__btn kds-ticket__btn--ready" data-action="ready" data-order-id="${o.id}" data-item-id="${it.id}">✅ Prêt</button>`;
  } else if (lane === 'cook') {
    actions = `<button class="kds-ticket__btn kds-ticket__btn--ready" data-action="ready" data-order-id="${o.id}" data-item-id="${it.id}">✅ Prêt</button>`;
  } else if (lane === 'ready') {
    actions = `<button class="kds-ticket__btn kds-ticket__btn--ghost" data-action="undo" data-order-id="${o.id}" data-item-id="${it.id}">↶ Re-prep</button>`;
  }

  const allergyClass = (hasAllergy || seatEntries.length > 0) ? 'kds-ticket--has-allergy' : '';

  return `
    <article class="kds-ticket ${urgent} ${fresh} ${allergyClass}" data-created-at="${o.created_at}">
      <header class="kds-ticket__head">
        <span class="kds-ticket__table">T${escapeHtml(o.table_number)}</span>
        <span class="kds-ticket__id">#${o.id}</span>
        <span class="kds-ticket__timer" data-created-at="${o.created_at}">${elapsed}′</span>
      </header>
      <div class="kds-ticket__body">
        <div class="kds-ticket__qty">${escapeHtml(it.quantity)}×</div>
        <div class="kds-ticket__name">${escapeHtml(it.recipe_name || '?')}</div>
      </div>
      ${seatBadges}
      ${noteText ? `<div class="kds-ticket__notes ${hasAllergy ? 'kds-ticket__notes--allergy' : ''}">
        ${hasAllergy ? '⚠️ ' : '📝 '}${escapeHtml(noteText)}
      </div>` : ''}
      <footer class="kds-ticket__foot">${actions}</footer>
    </article>
  `;
}

function _kdsUpdateTimers() {
  document.querySelectorAll('.kds-ticket').forEach(card => {
    const created = card.dataset.createdAt;
    if (!created) return;
    const elapsed = Math.floor((Date.now() - new Date(created).getTime()) / 60000);
    const timer = card.querySelector('.kds-ticket__timer');
    if (timer) timer.textContent = `${elapsed}′`;
    card.classList.toggle('kds-ticket--urgent', elapsed > 15);
    card.classList.toggle('kds-ticket--warn', elapsed > 8 && elapsed <= 15);
    card.classList.toggle('kds-ticket--fresh', elapsed < 2);
  });
}

function _kdsToggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

// ─── Sound notification ───
function _kdsPlaySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start(); osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      gain2.gain.value = 0.3;
      osc2.start(); osc2.stop(ctx.currentTime + 0.15);
    }, 200);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) { /* Web Audio not available */ }
}
function playKitchenNotificationSound() { _kdsPlaySound(); }

// Backwards-compat helper still referenced by orders.js view
async function updateKitchenItem(orderId, itemId, status) {
  try {
    await API.updateOrderItem(orderId, itemId, { status });
    await _kdsLoad();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}
