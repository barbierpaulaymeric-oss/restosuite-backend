// ═══════════════════════════════════════════
// Service View — Enhanced Service Mode
// ═══════════════════════════════════════════

const SERVICE_POLL_INTERVAL = 8000;
let _serviceInterval = null;
let _serviceCheckInterval = null;
let _serviceState = {
  selectedTable: null,
  tables: {},
  menu: [],
  allOrders: [],
  account: null,
  mobileTab: 'tables',
  serviceActive: false,
  serviceSession: null,
  serviceConfig: null,
  tableList: []
};

async function renderServiceView() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  _serviceState.account = getAccount();

  // Full-screen layout
  app.style.maxWidth = 'none';
  app.style.padding = '0';
  if (nav) nav.style.display = 'none';

  // Check service config and active session
  try {
    const [config, active] = await Promise.all([
      API.getServiceConfig(),
      API.getActiveService()
    ]);
    _serviceState.serviceConfig = config;
    _serviceState.serviceActive = !!active.session;
    _serviceState.serviceSession = active.session;
  } catch (e) {
    _serviceState.serviceConfig = {};
  }

  // Load tables from DB
  try {
    const tables = await API.request('/onboarding/status');
    _serviceState.tableList = tables.tables || [];
  } catch (e) {}

  const tableCount = _serviceState.tableList.length || 20;

  if (!_serviceState.serviceActive) {
    // Show service configuration / start screen
    _svcRenderConfigScreen(app);
  } else {
    // Show full service interface
    _svcRenderServiceUI(app, tableCount);
    await _svcLoadData(tableCount);
    _svcRenderTables(tableCount);
    _svcRenderMenu();
    _svcRenderTracking();
    _svcUpdateServiceMetrics();
  }

  // Start polling
  _svcStartPolling(tableCount);
}

// ═══ CONFIG / START SCREEN ═══
function _svcRenderConfigScreen(app) {
  const config = _serviceState.serviceConfig || {};
  app.innerHTML = `
    <div class="svc-config-screen">
      <header class="svc-header">
        <div class="svc-header__left">
          <img src="assets/logo-icon.svg" alt="RestoSuite" style="height:28px;width:auto">
          <span class="svc-header__title">Mode Service</span>
        </div>
        <div class="svc-header__right">
          <button class="btn btn-secondary btn-sm" onclick="_svcExit()">← Retour</button>
        </div>
      </header>

      <div style="max-width:480px;margin:60px auto;padding:0 var(--space-4)">
        <div style="text-align:center;margin-bottom:var(--space-8)">
          <div style="font-size:3.5rem;margin-bottom:var(--space-3)">🍽️</div>
          <h1 style="font-size:var(--text-2xl);margin-bottom:var(--space-2)">Mode Service</h1>
          <p style="color:var(--text-secondary)">Configurez les horaires et lancez le service. L'interface s'adapte automatiquement pour gérer les commandes en temps réel.</p>
        </div>

        <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-4)">
          <h3 style="font-size:var(--text-base);margin-bottom:var(--space-4)">Horaires du service</h3>
          <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-3)">
            <div style="flex:1">
              <label style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:4px;display:block">Début</label>
              <input type="time" class="form-control" id="svc-start-time" lang="fr" value="${config.service_start || '11:30'}" style="font-size:var(--text-lg);text-align:center">
            </div>
            <div style="flex:1">
              <label style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:4px;display:block">Fin</label>
              <input type="time" class="form-control" id="svc-end-time" lang="fr" value="${config.service_end || '14:30'}" style="font-size:var(--text-lg);text-align:center">
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="svc-save-config" style="width:100%">Enregistrer les horaires</button>
        </div>

        <button class="btn btn-primary" id="svc-start-btn" style="width:100%;padding:16px;font-size:var(--text-lg);border-radius:var(--radius-lg)">
          🚀 Lancer le service
        </button>

        <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md)">
          <p style="font-size:var(--text-sm);color:var(--text-secondary);margin:0;line-height:1.6">
            <strong>Pendant le service :</strong> l'interface passe en mode plein écran avec les bons en temps réel, le suivi des tables et les métriques clés. Le reste du logiciel reste accessible via le menu rapide.
          </p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('svc-save-config').addEventListener('click', async () => {
    const start = document.getElementById('svc-start-time').value;
    const end = document.getElementById('svc-end-time').value;
    try {
      await API.updateServiceConfig({ service_start: start, service_end: end });
      showToast('Horaires enregistrés', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  document.getElementById('svc-start-btn').addEventListener('click', async () => {
    const start = document.getElementById('svc-start-time').value;
    const end = document.getElementById('svc-end-time').value;
    try {
      await API.updateServiceConfig({ service_start: start, service_end: end });
      await API.startService();
      _serviceState.serviceActive = true;
      renderServiceView();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
}

// ═══ FULL SERVICE UI ═══
function _svcRenderServiceUI(app, tableCount) {
  app.innerHTML = `
    <div class="svc-shell">
      <header class="svc-header">
        <div class="svc-header__left">
          <img src="assets/logo-icon.svg" alt="RestoSuite" style="height:28px;width:auto">
          <span class="svc-header__title">Service</span>
          <span class="svc-header__user">— ${escapeHtml(_serviceState.account?.name || '')}</span>
        </div>
        <div class="svc-header__center" id="svc-metrics-bar">
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-time">--:--</span><span class="svc-metric__label">Durée</span></div>
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-orders">0</span><span class="svc-metric__label">Commandes</span></div>
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-covers">0</span><span class="svc-metric__label">Couverts</span></div>
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-pending">0</span><span class="svc-metric__label">En cours</span></div>
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-avg">0min</span><span class="svc-metric__label">Moy. ticket</span></div>
        </div>
        <div class="svc-header__right">
          <button class="svc-header__btn" id="svc-notif-btn" title="Notifications">🔔 <span class="svc-notif-badge hidden" id="svc-notif-count">0</span></button>
          <button class="svc-header__btn" id="svc-quick-menu" title="Menu rapide">☰</button>
          <button class="svc-header__btn svc-header__btn--stop" id="svc-stop-btn" title="Fin du service">⏹ Fin</button>
        </div>
      </header>

      <div class="svc-mobile-tabs" id="svc-mobile-tabs">
        <button class="svc-tab active" data-tab="tables">Tables</button>
        <button class="svc-tab" data-tab="order">Commande</button>
        <button class="svc-tab" data-tab="tracking">Suivi</button>
      </div>

      <div class="svc-body">
        <div class="svc-col-left" id="svc-tables-panel">
          <h2 class="svc-section-title">Plan de salle</h2>
          <div class="svc-tables-grid" id="svc-tables-grid"></div>
          <div class="svc-tracking-section" id="svc-tracking-inline"></div>
        </div>
        <div class="svc-col-right" id="svc-order-panel">
          <div class="svc-no-table" id="svc-no-table">
            <div class="svc-no-table__icon">🍽️</div>
            <p>Sélectionnez une table pour commencer</p>
          </div>
          <div class="svc-order-content hidden" id="svc-order-content">
            <div class="svc-order-header">
              <h2 id="svc-order-title">Table —</h2>
              <button class="btn btn-danger btn-sm" id="svc-close-table-btn" title="Terminer la table">Terminer</button>
            </div>
            <div class="svc-order-cols">
              <div class="svc-menu-panel" id="svc-menu-panel">
                <h3 class="svc-section-subtitle">Menu</h3>
                <div id="svc-menu-list"></div>
              </div>
              <div class="svc-cart-panel" id="svc-cart-panel">
                <h3 class="svc-section-subtitle">Commande en cours</h3>
                <div id="svc-cart-items"></div>
                <div class="svc-cart-covers" style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) 0">
                  <label for="svc-order-covers" style="font-size:var(--text-sm);color:var(--text-secondary);flex:1">👥 Couverts</label>
                  <input type="number" class="form-control" id="svc-order-covers" min="0" max="999" step="1" placeholder="—" style="max-width:100px;text-align:center" data-ui="custom">
                </div>
                <div class="svc-cart-notes">
                  <textarea class="form-control svc-notes-input" id="svc-order-notes" rows="2" placeholder="Notes (allergies, demandes spéciales...)" data-ui="custom"></textarea>
                </div>
                <div class="svc-cart-total" id="svc-cart-total">Total : 0,00 €</div>
                <div class="svc-cart-actions">
                  <button class="btn btn-secondary svc-action-btn" id="svc-save-btn">💾 Sauvegarder</button>
                  <button class="btn btn-primary svc-action-btn" id="svc-send-btn">🔔 Envoyer en cuisine</button>
                </div>
                <div class="svc-table-orders" id="svc-table-orders"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="svc-col-tracking hidden" id="svc-tracking-panel">
          <h2 class="svc-section-title">Suivi des commandes</h2>
          <div id="svc-tracking-list"></div>
        </div>
      </div>
    </div>
  `;

  // Mobile tab handlers
  document.querySelectorAll('.svc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _serviceState.mobileTab = tab.dataset.tab;
      document.querySelectorAll('.svc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _svcUpdateMobileVisibility();
    });
  });

  // Stop service
  document.getElementById('svc-stop-btn').addEventListener('click', _svcStopService);

  // Quick menu — go back to main app
  document.getElementById('svc-quick-menu').addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
      <div class="modal" style="max-width:300px;padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Menu rapide</h3>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          <a href="#/" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">📋 Fiches techniques</a>
          <a href="#/stock" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">📦 Stock</a>
          <a href="#/haccp" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">✅ HACCP</a>
          <a href="#/kitchen" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">👨‍🍳 Écran cuisine</a>
          <a href="#/analytics" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">📊 Analytics</a>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:var(--space-3)" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  });

  // Close table / save / send
  document.getElementById('svc-close-table-btn').addEventListener('click', _svcCloseTable);
  document.getElementById('svc-save-btn').addEventListener('click', () => _svcSaveOrder(false));
  document.getElementById('svc-send-btn').addEventListener('click', () => _svcSaveOrder(true));
}

// ═══ STOP SERVICE + RECAP ═══
async function _svcStopService() {
  const activeOrders = _serviceState.allOrders.filter(o => ['envoyé', 'en_cours'].includes(o.status));
  const title = activeOrders.length > 0
    ? `Il reste ${activeOrders.length} commande(s) en cours`
    : 'Terminer le service ?';
  const message = activeOrders.length > 0
    ? 'Voulez-vous vraiment arrêter le service avec des commandes en cours ?'
    : 'Le récapitulatif du service sera affiché.';

  showConfirmModal(title, message, async () => {
    try {
      const result = await API.stopService();
      _serviceState.serviceActive = false;
      _svcShowRecap(result.recap);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, { confirmText: 'Terminer le service', confirmClass: 'btn btn-danger' });
}

function _svcShowRecap(recap) {
  const app = document.getElementById('app');
  const duration = recap.started_at && recap.ended_at
    ? _svcFormatDuration(new Date(recap.ended_at) - new Date(recap.started_at))
    : '—';

  app.innerHTML = `
    <div class="svc-config-screen">
      <header class="svc-header">
        <div class="svc-header__left">
          <img src="assets/logo-icon.svg" alt="RestoSuite" style="height:28px;width:auto">
          <span class="svc-header__title">Récapitulatif du service</span>
        </div>
        <div class="svc-header__right">
          <button class="btn btn-secondary btn-sm" onclick="_svcExit()">← Retour</button>
        </div>
      </header>

      <div style="max-width:500px;margin:40px auto;padding:0 var(--space-4)">
        <div style="text-align:center;margin-bottom:var(--space-6)">
          <div style="font-size:3rem;margin-bottom:var(--space-2)">🏁</div>
          <h1 style="font-size:var(--text-2xl);margin-bottom:var(--space-1)">Service terminé</h1>
          <p style="color:var(--text-secondary)">${recap.started_at ? new Date(recap.started_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-5)">
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${recap.total_orders || 0}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Commandes</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${recap.total_covers || 0}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Couverts</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${recap.total_items || 0}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Plats servis</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${formatCurrency(recap.total_revenue || 0)}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Chiffre d'affaires</div>
          </div>
        </div>

        <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
          <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Performance</h3>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--border-light)">
            <span style="color:var(--text-secondary);font-size:var(--text-sm)">Durée du service</span>
            <span style="font-weight:600">${duration}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--border-light)">
            <span style="color:var(--text-secondary);font-size:var(--text-sm)">Ticket moyen</span>
            <span style="font-weight:600">${recap.total_covers > 0 ? formatCurrency((recap.total_revenue || 0) / recap.total_covers) + ' / couvert' : '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--border-light)">
            <span style="color:var(--text-secondary);font-size:var(--text-sm)">Temps moyen par commande</span>
            <span style="font-weight:600">${recap.avg_ticket_time_min || 0} min</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0">
            <span style="color:var(--text-secondary);font-size:var(--text-sm)">Heure de pointe</span>
            <span style="font-weight:600">${recap.peak_hour ? recap.peak_hour + 'h' : '—'}</span>
          </div>
        </div>

        <button class="btn btn-primary" style="width:100%;padding:14px;border-radius:var(--radius-lg)" onclick="_svcExit()">
          Retour à l'accueil
        </button>
      </div>
    </div>
  `;
}

function _svcFormatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

// ═══ SERVICE METRICS UPDATER ═══
function _svcUpdateServiceMetrics() {
  if (!_serviceState.serviceSession) return;
  const started = new Date(_serviceState.serviceSession.started_at);
  const now = new Date();
  const elapsed = now - started;
  const el = document.getElementById('svc-m-time');
  if (el) el.textContent = _svcFormatDuration(elapsed);

  // Count orders
  const sessionOrders = _serviceState.allOrders.filter(o => o.status !== 'annulé');
  const totalOrders = sessionOrders.length;
  const totalCovers = sessionOrders.reduce((s, o) => s + (o.covers || 0), 0);
  const pending = _serviceState.allOrders.filter(o => ['envoyé', 'en_cours'].includes(o.status)).length;
  const completed = _serviceState.allOrders.filter(o => o.status === 'terminé');

  const ordersEl = document.getElementById('svc-m-orders');
  const coversEl = document.getElementById('svc-m-covers');
  const pendingEl = document.getElementById('svc-m-pending');
  const avgEl = document.getElementById('svc-m-avg');

  if (ordersEl) ordersEl.textContent = totalOrders;
  if (coversEl) coversEl.textContent = totalCovers;
  if (pendingEl) {
    pendingEl.textContent = pending;
    pendingEl.style.color = pending > 5 ? 'var(--color-danger)' : pending > 2 ? 'var(--color-warning)' : '';
  }

  if (avgEl && completed.length > 0) {
    const totalMin = completed.reduce((sum, o) => {
      return sum + (new Date(o.updated_at) - new Date(o.created_at)) / 60000;
    }, 0);
    avgEl.textContent = Math.round(totalMin / completed.length) + 'min';
  }
}

// ═══ POLLING ═══
function _svcStartPolling(tableCount) {
  if (_serviceInterval) clearInterval(_serviceInterval);
  _serviceInterval = setInterval(async () => {
    if (!location.hash.startsWith('#/service')) {
      _svcCleanup();
      return;
    }
    if (_serviceState.serviceActive) {
      await _svcRefreshOrders(tableCount);
      _svcUpdateServiceMetrics();
      _svcCheckAutoStop(tableCount);
    }
  }, SERVICE_POLL_INTERVAL);
}

// Check if service should auto-stop
async function _svcCheckAutoStop(tableCount) {
  const config = _serviceState.serviceConfig;
  if (!config || !config.service_end) return;

  // Don't auto-stop within the first 15 minutes of service
  const session = _serviceState.serviceSession;
  if (session && session.started_at) {
    const startedAt = new Date(session.started_at);
    const minRuntime = 15 * 60 * 1000; // 15 minutes minimum
    if (Date.now() - startedAt.getTime() < minRuntime) return;
  }

  const now = new Date();
  const [endH, endM] = config.service_end.split(':').map(Number);
  const endTime = new Date();
  endTime.setHours(endH, endM, 0, 0);

  // If end time is before start time (e.g. service_end=02:00 for night service),
  // it means the end is the next day — don't stop prematurely
  if (config.service_start) {
    const [startH, startM] = config.service_start.split(':').map(Number);
    if (endH < startH || (endH === startH && endM < startM)) {
      // Night service: end time is next day
      endTime.setDate(endTime.getDate() + 1);
    }
  }

  // If past end time, check for active orders
  if (now > endTime) {
    const activeOrders = _serviceState.allOrders.filter(o =>
      ['envoyé', 'en_cours', 'prêt', 'reçu'].includes(o.status)
    );
    if (activeOrders.length === 0) {
      // Auto-stop
      try {
        const result = await API.stopService();
        _serviceState.serviceActive = false;
        _svcShowRecap(result.recap);
      } catch (e) { /* silent */ }
    }
  }
}

function _svcCleanup() {
  if (_serviceInterval) { clearInterval(_serviceInterval); _serviceInterval = null; }
  if (_serviceCheckInterval) { clearInterval(_serviceCheckInterval); _serviceCheckInterval = null; }
  const app = document.getElementById('app');
  if (app) { app.style.maxWidth = ''; app.style.padding = ''; }
  const nav = document.getElementById('nav');
  if (nav) nav.style.display = '';
}

function _svcExit() {
  _svcCleanup();
  location.hash = '#/';
}

// ═══ DATA LOADING ═══
async function _svcLoadData(tableCount) {
  try {
    const [recipes, orders] = await Promise.all([
      API.getRecipes(),
      API.getOrders()
    ]);

    const plats = recipes.filter(r => (r.recipe_type || 'plat') === 'plat');
    const grouped = {};
    const categoryOrder = ['entrée', 'plat', 'dessert', 'boisson', 'accompagnement'];
    for (const r of plats) {
      const cat = r.category || 'Autres';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }
    _serviceState.menu = Object.entries(grouped).sort((a, b) => {
      const ia = categoryOrder.indexOf(a[0]);
      const ib = categoryOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    _serviceState.allOrders = orders;
    _svcBuildTableState(tableCount);
  } catch (e) {
    showToast('Erreur chargement données service', 'error');
  }
}

async function _svcRefreshOrders(tableCount) {
  try {
    const prevStates = {};
    for (let t = 1; t <= tableCount; t++) {
      const td = _serviceState.tables[t];
      if (td) prevStates[t] = td.orders.filter(o => o.status === 'prêt').length;
    }

    _serviceState.allOrders = await API.getOrders();
    _svcBuildTableState(tableCount);

    for (let t = 1; t <= tableCount; t++) {
      const td = _serviceState.tables[t];
      if (td) {
        const readyNow = td.orders.filter(o => o.status === 'prêt').length;
        if (readyNow > (prevStates[t] || 0)) _svcNotifyReady(t);
      }
    }

    _svcRenderTables(tableCount);
    _svcRenderTracking();
    if (_serviceState.selectedTable) _svcRenderTableOrders();
  } catch (e) { /* silent */ }
}

function _svcBuildTableState(tableCount) {
  const tables = {};
  for (let t = 1; t <= tableCount; t++) {
    tables[t] = { orders: [], currentDraft: null };
  }
  for (const order of _serviceState.allOrders) {
    const tn = order.table_number;
    if (tn >= 1 && tn <= tableCount) {
      if (!tables[tn]) tables[tn] = { orders: [], currentDraft: null };
      tables[tn].orders.push(order);
      if (order.status === 'en_cours') tables[tn].currentDraft = order;
    }
  }
  const prev = _serviceState.tables;
  for (let t = 1; t <= tableCount; t++) {
    if (prev[t] && prev[t]._localDraft) tables[t]._localDraft = prev[t]._localDraft;
  }
  _serviceState.tables = tables;
}

function _svcNotifyReady(tableNum) {
  showToast(`✅ Table ${tableNum} — Plat(s) prêt(s) !`, 'success');
  if (typeof playKitchenNotificationSound === 'function') playKitchenNotificationSound();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  const badge = document.getElementById('svc-notif-count');
  if (badge) {
    const current = parseInt(badge.textContent) || 0;
    badge.textContent = current + 1;
    badge.classList.remove('hidden');
  }
}

// ═══ TABLE STATE / GRID ═══
function _svcGetTableStatus(tableNum) {
  const td = _serviceState.tables[tableNum];
  if (!td) return 'libre';
  const activeOrders = td.orders.filter(o => !['terminé', 'annulé'].includes(o.status));
  if (activeOrders.length === 0 && !td._localDraft) return 'libre';
  if (td._localDraft && td._localDraft.length > 0) return 'draft';
  if (activeOrders.some(o => o.status === 'en_cours')) return 'draft';
  if (activeOrders.some(o => o.status === 'prêt')) return 'ready';
  if (activeOrders.some(o => {
    const elapsed = (Date.now() - new Date(o.created_at).getTime()) / 60000;
    return o.status === 'envoyé' && elapsed > 20;
  })) return 'late';
  if (activeOrders.some(o => o.status === 'envoyé')) return 'sent';
  return 'libre';
}

function _svcRenderTables(tableCount) {
  const grid = document.getElementById('svc-tables-grid');
  if (!grid) return;

  let html = '';
  for (let t = 1; t <= tableCount; t++) {
    const status = _svcGetTableStatus(t);
    const selected = _serviceState.selectedTable === t ? ' svc-table--selected' : '';
    const activeOrders = (_serviceState.tables[t]?.orders || []).filter(o => !['terminé', 'annulé'].includes(o.status));
    const itemCount = activeOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0);
    // Get elapsed time for the oldest active order
    let timerHtml = '';
    if (activeOrders.length > 0) {
      const oldest = activeOrders.reduce((a, b) => new Date(a.created_at) < new Date(b.created_at) ? a : b);
      const elapsed = Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 60000);
      if (elapsed > 0) {
        const timerColor = elapsed > 20 ? 'var(--color-danger)' : elapsed > 10 ? 'var(--color-warning)' : 'var(--text-tertiary)';
        timerHtml = `<span class="svc-table-timer" style="color:${timerColor}">${elapsed}′</span>`;
      }
    }
    html += `
      <button class="svc-table-btn svc-table--${status}${selected}" data-table="${t}">
        <span class="svc-table-num">${t}</span>
        ${itemCount > 0 ? `<span class="svc-table-count">${itemCount}</span>` : ''}
        ${timerHtml}
        <span class="svc-table-status">${_svcStatusIcon(status)}</span>
      </button>
    `;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.svc-table-btn').forEach(btn => {
    btn.addEventListener('click', () => _svcSelectTable(parseInt(btn.dataset.table), tableCount));
  });
}

function _svcStatusIcon(status) {
  switch (status) {
    case 'libre': return '';
    case 'draft': return '📝';
    case 'sent': return '🔵';
    case 'ready': return '✅';
    case 'late': return '🔴';
    default: return '';
  }
}

// ═══ SELECT TABLE ═══
function _svcSelectTable(tableNum) {
  _serviceState.selectedTable = tableNum;
  const tableCount = Object.keys(_serviceState.tables).length;
  _svcRenderTables(tableCount);

  const noTable = document.getElementById('svc-no-table');
  const content = document.getElementById('svc-order-content');
  if (noTable) noTable.classList.add('hidden');
  if (content) content.classList.remove('hidden');

  document.getElementById('svc-order-title').textContent = `Table ${tableNum}`;

  const td = _serviceState.tables[tableNum];
  if (!td._localDraft) {
    if (td.currentDraft && td.currentDraft.items) {
      td._localDraft = td.currentDraft.items.map(it => ({
        recipe_id: it.recipe_id, name: it.recipe_name, price: it.selling_price || 0, quantity: it.quantity, notes: it.notes || ''
      }));
    } else {
      td._localDraft = [];
    }
  }

  const notesEl = document.getElementById('svc-order-notes');
  if (notesEl) notesEl.value = td.currentDraft?.notes || '';

  const coversEl = document.getElementById('svc-order-covers');
  if (coversEl) coversEl.value = (td.currentDraft?.covers != null) ? td.currentDraft.covers : '';

  _svcRenderCart();
  _svcRenderTableOrders();

  if (window.innerWidth < 768) {
    _serviceState.mobileTab = 'order';
    document.querySelectorAll('.svc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'order'));
    _svcUpdateMobileVisibility();
  }
}

// ═══ MENU ═══
function _svcRenderMenu() {
  const el = document.getElementById('svc-menu-list');
  if (!el) return;

  if (_serviceState.menu.length === 0) {
    el.innerHTML = '<p class="text-muted" style="padding:16px">Aucun plat au menu.</p>';
    return;
  }

  const emojis = { 'entrée': '🥗', 'plat': '🍽️', 'dessert': '🍰', 'boisson': '🥂', 'accompagnement': '🥬', 'Autres': '📋' };

  let html = '';
  for (const [cat, items] of _serviceState.menu) {
    const emoji = emojis[cat] || '📋';
    html += `<div class="svc-menu-category"><h4 class="svc-menu-cat-title">${emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</h4><div class="svc-menu-items">`;
    for (const item of items) {
      html += `
        <button class="svc-menu-item" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-price="${item.selling_price || 0}">
          <span class="svc-menu-item__name">${escapeHtml(item.name)}</span>
          <span class="svc-menu-item__price">${item.selling_price ? formatCurrency(item.selling_price) : '—'}</span>
          <span class="svc-menu-item__add">+</span>
        </button>
      `;
    }
    html += '</div></div>';
  }
  el.innerHTML = html;

  el.querySelectorAll('.svc-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_serviceState.selectedTable) { showToast('Sélectionnez une table', 'error'); return; }
      _svcAddItem(parseInt(btn.dataset.id), btn.dataset.name, parseFloat(btn.dataset.price));
    });
  });
}

// ═══ CART ═══
function _svcAddItem(recipeId, name, price) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft;
  const existing = draft.find(i => i.recipe_id === recipeId);
  if (existing) { existing.quantity++; } else { draft.push({ recipe_id: recipeId, name, price, quantity: 1, notes: '' }); }
  _svcRenderCart();
  _svcRenderTables(Object.keys(_serviceState.tables).length);
}

function _svcChangeQty(recipeId, delta) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft;
  const item = draft.find(i => i.recipe_id === recipeId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) _serviceState.tables[tn]._localDraft = draft.filter(i => i.recipe_id !== recipeId);
  _svcRenderCart();
  _svcRenderTables(Object.keys(_serviceState.tables).length);
}

function _svcRemoveItem(recipeId) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  _serviceState.tables[tn]._localDraft = _serviceState.tables[tn]._localDraft.filter(i => i.recipe_id !== recipeId);
  _svcRenderCart();
  _svcRenderTables(Object.keys(_serviceState.tables).length);
}

function _svcRenderCart() {
  const el = document.getElementById('svc-cart-items');
  const totalEl = document.getElementById('svc-cart-total');
  const tn = _serviceState.selectedTable;
  if (!el || !tn) return;

  const draft = _serviceState.tables[tn]._localDraft || [];
  if (draft.length === 0) {
    el.innerHTML = '<p class="text-muted svc-empty-cart">Aucun plat ajouté</p>';
    totalEl.textContent = 'Total : 0,00 €';
    return;
  }

  let total = 0;
  el.innerHTML = draft.map(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    return `
      <div class="svc-cart-item">
        <span class="svc-cart-item__qty">${item.quantity}×</span>
        <span class="svc-cart-item__name">${escapeHtml(item.name)}</span>
        <span class="svc-cart-item__price">${formatCurrency(subtotal)}</span>
        <div class="svc-cart-item__actions">
          <button class="svc-qty-btn" onclick="_svcChangeQty(${item.recipe_id}, -1)">−</button>
          <button class="svc-qty-btn" onclick="_svcChangeQty(${item.recipe_id}, 1)">+</button>
          <button class="svc-qty-btn svc-qty-btn--delete" onclick="_svcRemoveItem(${item.recipe_id})">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  totalEl.textContent = `Total : ${formatCurrency(total)}`;
}

// ═══ SAVE / SEND ORDER ═══
async function _svcSaveOrder(sendImmediately) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft || [];
  if (draft.length === 0) { showToast('Ajoutez au moins un plat', 'error'); return; }

  const notes = document.getElementById('svc-order-notes')?.value?.trim() || null;
  const coversRaw = document.getElementById('svc-order-covers')?.value;
  const coversNum = (coversRaw !== undefined && coversRaw !== null && coversRaw !== '') ? parseInt(coversRaw, 10) : null;
  const covers = (Number.isInteger(coversNum) && coversNum >= 0 && coversNum <= 999) ? coversNum : null;
  const td = _serviceState.tables[tn];

  try {
    if (td.currentDraft) await API.cancelOrder(td.currentDraft.id);

    const order = await API.createOrder({
      table_number: tn,
      notes,
      covers,
      items: draft.map(i => ({ recipe_id: i.recipe_id, quantity: i.quantity, notes: i.notes || null }))
    });

    if (sendImmediately) {
      const result = await API.sendOrder(order.id);
      if (result.warnings?.length > 0) showToast(`⚠️ Stock insuffisant pour ${result.warnings.length} ingrédient(s)`, 'info');
      showToast(`Table ${tn} — Commande envoyée en cuisine !`, 'success');
      _serviceState.tables[tn]._localDraft = [];
    } else {
      showToast(`Table ${tn} — Commande sauvegardée`, 'success');
      _serviceState.tables[tn]._localDraft = null;
    }

    const tableCount = Object.keys(_serviceState.tables).length;
    await _svcRefreshOrders(tableCount);
    if (_serviceState.selectedTable === tn) _svcSelectTable(tn);
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ═══ CLOSE TABLE ═══
async function _svcCloseTable() {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const td = _serviceState.tables[tn];
  const activeOrders = td.orders.filter(o => !['terminé', 'annulé'].includes(o.status));
  if (activeOrders.length === 0 && (!td._localDraft || td._localDraft.length === 0)) {
    showToast('Cette table est déjà libre', 'info'); return;
  }

  showConfirmModal(`Terminer la table ${tn} ?`, `${activeOrders.length} commande(s) seront marquées comme terminées.`, async () => {
    try {
      for (const order of activeOrders) await API.closeOrder(order.id);
      _serviceState.tables[tn]._localDraft = [];
      showToast(`Table ${tn} terminée`, 'success');
      _serviceState.selectedTable = null;
      document.getElementById('svc-no-table')?.classList.remove('hidden');
      document.getElementById('svc-order-content')?.classList.add('hidden');
      await _svcRefreshOrders(Object.keys(_serviceState.tables).length);
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
  }, { confirmText: 'Terminer', confirmClass: 'btn btn-primary' });
}

// ═══ TABLE ORDERS / TRACKING ═══
function _svcRenderTableOrders() {
  const el = document.getElementById('svc-table-orders');
  const tn = _serviceState.selectedTable;
  if (!el || !tn) return;

  const td = _serviceState.tables[tn];
  const sentOrders = td.orders.filter(o => ['envoyé', 'prêt'].includes(o.status));
  if (sentOrders.length === 0) { el.innerHTML = ''; return; }

  let html = '<h4 class="svc-section-subtitle" style="margin-top:16px">Commandes envoyées</h4>';
  for (const order of sentOrders) {
    const readyCls = order.status === 'prêt' ? 'svc-sent-order--ready' : '';
    const badgeCls = order.status === 'prêt' ? 'badge-success' : 'badge-info';
    const badgeLabel = order.status === 'prêt' ? '✅ Prêt' : '⏳ En cuisine';
    html += `<div class="svc-sent-order ${readyCls}">
      <div class="svc-sent-order__header">
        <span class="badge ${badgeCls}">${badgeLabel}</span>
        <span class="svc-sent-order__time">${getElapsedTime(order.created_at)}</span>
      </div>`;
    for (const item of order.items) {
      html += `<div class="svc-sent-item"><span>${item.quantity}× ${escapeHtml(item.recipe_name)}</span><span class="svc-sent-item__status">${getItemStatusIcon(item.status)}</span></div>`;
    }
    if (order.status === 'prêt') {
      html += `<button class="btn btn-primary btn-sm svc-served-btn" onclick="_svcMarkServed(${order.id})">🍽️ Marquer servi</button>`;
    }
    html += '</div>';
  }
  el.innerHTML = html;
}

async function _svcMarkServed(orderId) {
  try {
    await API.closeOrder(orderId);
    showToast('Commande marquée comme servie', 'success');
    await _svcRefreshOrders(Object.keys(_serviceState.tables).length);
    if (_serviceState.selectedTable) _svcRenderTableOrders();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

function _svcRenderTracking() {
  const el = document.getElementById('svc-tracking-list');
  const inlineEl = document.getElementById('svc-tracking-inline');
  if (!el) return;

  const activeOrders = _serviceState.allOrders.filter(o => ['envoyé', 'prêt'].includes(o.status));
  activeOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let html = '';
  if (activeOrders.length === 0) {
    html = '<div class="svc-empty-tracking"><p class="text-muted">Aucune commande en cours</p></div>';
  } else {
    for (const order of activeOrders) {
      const elapsed = getElapsedTime(order.created_at);
      const isReady = order.status === 'prêt';
      const isLate = !isReady && (Date.now() - new Date(order.created_at).getTime()) > 20 * 60000;
      const cardCls = isReady ? 'svc-track-card--ready' : isLate ? 'svc-track-card--late' : '';
      const badgeCls = isReady ? 'badge-success' : isLate ? 'badge--danger' : 'badge-info';
      const badgeTxt = isReady ? '✅ Prêt' : isLate ? '⚠️ En retard' : '⏳ En cuisine';
      html += `<div class="svc-track-card ${cardCls}">
        <div class="svc-track-card__header">
          <span class="svc-track-card__table" onclick="_svcSelectTable(${order.table_number})">Table ${order.table_number}</span>
          <span class="svc-track-card__time">${elapsed}</span>
          <span class="badge ${badgeCls}">${badgeTxt}</span>
        </div>
        <div class="svc-track-card__items">`;
      for (const it of order.items) {
        html += `<span class="svc-track-item">${it.quantity}× ${escapeHtml(it.recipe_name)} ${getItemStatusIcon(it.status)}</span>`;
      }
      html += '</div>';
      if (isReady) html += `<button class="btn btn-primary btn-sm" onclick="_svcMarkServed(${order.id})" style="margin-top:8px">🍽️ Servi</button>`;
      html += '</div>';
    }
  }

  el.innerHTML = html;
  if (inlineEl) {
    inlineEl.innerHTML = activeOrders.length > 0 ? `<h3 class="svc-section-subtitle" style="margin-top:20px">Suivi rapide</h3>${html}` : '';
  }
}

// ═══ MOBILE VISIBILITY ═══
function _svcUpdateMobileVisibility() {
  const tables = document.getElementById('svc-tables-panel');
  const order = document.getElementById('svc-order-panel');
  const tracking = document.getElementById('svc-tracking-panel');
  if (!tables || !order || !tracking) return;
  if (window.innerWidth >= 768) {
    tables.classList.remove('hidden');
    order.classList.remove('hidden');
    tracking.classList.add('hidden');
    return;
  }
  tables.classList.toggle('hidden', _serviceState.mobileTab !== 'tables');
  order.classList.toggle('hidden', _serviceState.mobileTab !== 'order');
  tracking.classList.toggle('hidden', _serviceState.mobileTab !== 'tracking');
}

window.addEventListener('resize', _svcUpdateMobileVisibility);
