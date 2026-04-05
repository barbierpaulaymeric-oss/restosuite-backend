// ═══════════════════════════════════════════
// Kitchen View — Écran Cuisine
// ═══════════════════════════════════════════

let kitchenRefreshInterval = null;
let _kitchenPrevOrderIds = null;

async function renderKitchenView() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');

  // Full-screen layout for kitchen
  app.style.maxWidth = 'none';
  app.style.padding = '0';
  if (nav) nav.style.display = 'none';

  app.innerHTML = `
    <div class="kitchen-shell">
      <header class="kitchen-header">
        <div class="kitchen-header__left">
          <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 28px; width: auto;">
          <span class="kitchen-header__title">Cuisine</span>
        </div>
        <div class="kitchen-header__right">
          <span class="kitchen-header__clock" id="kitchen-clock"></span>
          <button class="btn btn-secondary btn-sm" aria-label="Rafraîchir" onclick="renderKitchenView()"><i data-lucide="refresh-cw" style="width:16px;height:16px"></i></button>
          <button class="btn btn-secondary btn-sm" onclick="_kitchenExit()">Quitter</button>
        </div>
      </header>
      <div class="kitchen-body" id="kitchen-tickets">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  // Clear previous interval
  if (kitchenRefreshInterval) {
    clearInterval(kitchenRefreshInterval);
    kitchenRefreshInterval = null;
  }

  _kitchenPrevOrderIds = null;
  await loadKitchenTickets();
  _kitchenUpdateClock();

  // Auto-refresh every 10s
  kitchenRefreshInterval = setInterval(async () => {
    if (location.hash === '#/kitchen') {
      await loadKitchenTickets();
      _kitchenUpdateClock();
    } else {
      clearInterval(kitchenRefreshInterval);
      kitchenRefreshInterval = null;
      // Restore layout
      app.style.maxWidth = '';
      app.style.padding = '';
      if (nav) nav.style.display = '';
    }
  }, 10000);
}

function _kitchenUpdateClock() {
  const el = document.getElementById('kitchen-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function _kitchenExit() {
  if (kitchenRefreshInterval) {
    clearInterval(kitchenRefreshInterval);
    kitchenRefreshInterval = null;
  }
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (app) { app.style.maxWidth = ''; app.style.padding = ''; }
  if (nav) nav.style.display = '';
  location.hash = '#/';
}

async function loadKitchenTickets() {
  let orders = [];
  try {
    orders = await API.getOrders();
    // Show only envoyé and prêt orders (from salle/service)
    orders = orders.filter(o => o.status === 'envoyé' || o.status === 'prêt');
    orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } catch (e) {
    return;
  }

  // Detect new orders for notification sound
  const currentIds = new Set(orders.map(o => o.id));
  if (_kitchenPrevOrderIds !== null) {
    const hasNewOrders = orders.some(o => !_kitchenPrevOrderIds.has(o.id));
    if (hasNewOrders) {
      _kitchenPlaySound();
    }
  }
  _kitchenPrevOrderIds = currentIds;

  const el = document.getElementById('kitchen-tickets');
  if (!el) return;

  if (orders.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding-top:120px">
        <div class="empty-icon" style="font-size:4rem">✅</div>
        <h3>Pas de commande en attente</h3>
        <p>Les nouvelles commandes apparaîtront ici automatiquement.</p>
      </div>
    `;
    return;
  }

  el.innerHTML = `<div class="kitchen-grid">${orders.map(order => {
    const elapsed = _kitchenElapsed(order.created_at);
    const isReady = order.status === 'prêt';
    const isLate = !isReady && (Date.now() - new Date(order.created_at).getTime()) > 20 * 60000;

    return `
      <div class="kitchen-ticket ${isReady ? 'kitchen-ticket--ready' : ''} ${isLate ? 'kitchen-ticket--late' : ''}">
        <div class="kitchen-ticket__header">
          <span class="kitchen-ticket__table">Table ${order.table_number}</span>
          <span class="kitchen-ticket__id">#${order.id}</span>
          <span class="kitchen-ticket__timer ${isLate ? 'kitchen-ticket__timer--late' : ''}">${elapsed}</span>
        </div>
        ${order.notes ? `<div class="kitchen-ticket__notes">📌 ${escapeHtml(order.notes)}</div>` : ''}
        <div class="kitchen-ticket__items">
          ${order.items.map(item => {
            const itemStatusClass = item.status === 'prêt' ? 'kitchen-item--ready' :
              item.status === 'en_préparation' ? 'kitchen-item--cooking' : '';
            return `
              <div class="kitchen-item ${itemStatusClass}">
                <span class="kitchen-item__qty">${item.quantity}×</span>
                <span class="kitchen-item__name">${escapeHtml(item.recipe_name)}</span>
                ${item.notes ? `<span class="kitchen-item__notes">(${escapeHtml(item.notes)})</span>` : ''}
                <div class="kitchen-item__actions">
                  ${item.status === 'en_attente' ?
                    `<button class="btn btn-sm btn-secondary" onclick="updateKitchenItem(${order.id}, ${item.id}, 'en_préparation')">🔥 Prép.</button>` : ''}
                  ${item.status === 'en_préparation' ?
                    `<button class="btn btn-sm btn-primary" onclick="updateKitchenItem(${order.id}, ${item.id}, 'prêt')">✅ Prêt</button>` : ''}
                  ${item.status === 'prêt' ?
                    `<span class="badge badge-success">✅ Prêt</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ${isReady ? `<div class="kitchen-ticket__footer"><span class="badge badge-success" style="font-size:1rem;padding:6px 12px">✅ Tout est prêt — En attente service</span></div>` : ''}
      </div>
    `;
  }).join('')}</div>`;
}

async function updateKitchenItem(orderId, itemId, status) {
  try {
    await API.updateOrderItem(orderId, itemId, { status });
    await loadKitchenTickets();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── Kitchen notification sound ───
function _kitchenPlaySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.15);
    }, 200);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) { /* Web Audio not available */ }
}

// Also keep the global version for service.js compatibility
function playKitchenNotificationSound() {
  _kitchenPlaySound();
}

function _kitchenElapsed(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h${mins > 0 ? String(mins).padStart(2, '0') : ''}`;
}
