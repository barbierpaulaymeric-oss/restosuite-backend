// ═══════════════════════════════════════════
// RestoSuite — App Bootstrap
// ═══════════════════════════════════════════

// ─── Theme Init (before paint) ───
(function() {
  const savedTheme = localStorage.getItem('restosuite_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    // Auto-detect from system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
})();

// Listen for system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('restosuite_theme')) {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  }
});

// ─── Plan hierarchy ───
const PLAN_ORDER_CLIENT = ['discovery', 'essential', 'professional', 'premium', 'enterprise'];
let _currentPlan = 'discovery';

function planRankClient(plan) {
  const idx = PLAN_ORDER_CLIENT.indexOf(plan);
  return idx === -1 ? 0 : idx;
}

function isPlanUnlocked(minPlan) {
  if (!minPlan) return true;
  return planRankClient(_currentPlan) >= planRankClient(minPlan);
}

// ─── Nav group definitions ───
const NAV_GROUPS = {
  cuisine: {
    label: 'Cuisine',
    items: [
      { label: 'Fiches Techniques',  route: '/',            icon: 'clipboard-list', roles: ['gerant','cuisinier','equipier'] },
      { label: 'Ingrédients',        route: '/ingredients', icon: 'package',        roles: ['gerant','cuisinier','equipier'] },
      { label: 'Stock & Réception',  route: '/stock',       icon: 'warehouse',      roles: ['gerant','cuisinier'] },
    ]
  },
  operations: {
    label: 'Opérations',
    items: [
      { label: 'Fournisseurs & Commandes', route: '/suppliers', icon: 'truck',        roles: ['gerant'],              minPlan: 'essential' },
      { label: 'Livraisons',             route: '/deliveries',icon: 'package-check',  roles: ['gerant','cuisinier'], minPlan: 'essential' },
      { label: 'Service (Salle)',        route: '/service',   icon: 'concierge-bell', roles: ['gerant','salle'] },
      { label: 'Cuisine (écran)',        route: '/kitchen',   icon: 'chef-hat',       roles: ['gerant','cuisinier'] },
    ]
  },
  haccp: {
    label: 'HACCP',
    subcategories: [
      {
        label: 'Températures (quotidien)',
        items: [
          { label: 'Relevés de température', route: '/haccp/temperatures', icon: 'thermometer',    roles: ['gerant','cuisinier'] },
          { label: 'Cuisson (CCP2)',         route: '/haccp/cooking',       icon: 'flame',          roles: ['gerant','cuisinier'] },
          { label: 'Refroidissement',        route: '/haccp/cooling',       icon: 'snowflake',      roles: ['gerant','cuisinier'] },
          { label: 'Remise en température',  route: '/haccp/reheating',     icon: 'microwave',      roles: ['gerant','cuisinier'] },
        ]
      },
      {
        label: 'Hygiène (quotidien / hebdo)',
        items: [
          { label: 'Plan de nettoyage',      route: '/haccp/cleaning',            icon: 'spray-can',     roles: ['gerant','cuisinier'] },
          { label: 'Non-conformités',        route: '/haccp/non-conformities',    icon: 'alert-triangle',roles: ['gerant','cuisinier'] },
          { label: 'Actions correctives',    route: '/haccp/corrective-actions',  icon: 'wrench',        roles: ['gerant','cuisinier'] },
        ]
      },
      {
        label: 'Traçabilité',
        items: [
          { label: 'Réception (CCP1)',       route: '/stock/reception',           icon: 'package-plus',   roles: ['gerant','cuisinier'] },
          { label: 'Scan étiquettes',        route: '/haccp/label-scan',          icon: 'scan-line',      roles: ['gerant','cuisinier'] },
          { label: 'Traçabilité aval',       route: '/traceability/downstream',   icon: 'package-check',  roles: ['gerant','cuisinier'] },
          { label: 'Allergènes (INCO)',      route: '/haccp/allergens',           icon: 'wheat-off',      roles: ['gerant','cuisinier'] },
        ]
      },
      {
        label: 'Plan HACCP (mensuel)',
        items: [
          { label: 'Plan formalisé',         route: '/haccp/plan',                icon: 'file-check',     roles: ['gerant'] },
          { label: 'Étalonnage',             route: '/haccp/calibrations',        icon: 'ruler',          roles: ['gerant','cuisinier'] },
          { label: 'Formation personnel',    route: '/haccp/training',            icon: 'graduation-cap', roles: ['gerant'] },
          { label: 'Santé personnel',        route: '/haccp/staff-health',        icon: 'heart-pulse',    roles: ['gerant'] },
        ]
      },
      {
        label: 'Autre (ponctuel)',
        items: [
          { label: 'Plats témoins',          route: '/haccp/witness-meals',       icon: 'archive',        roles: ['gerant','cuisinier'] },
          { label: 'Huile de friture',       route: '/haccp/fryers',              icon: 'droplet',        roles: ['gerant','cuisinier'] },
          { label: 'Lutte nuisibles',        route: '/haccp/pest-control',        icon: 'bug',            roles: ['gerant'] },
          { label: 'Maintenance équipement', route: '/haccp/maintenance',         icon: 'wrench',         roles: ['gerant'] },
          { label: 'Gestion des déchets',    route: '/haccp/waste',               icon: 'trash-2',        roles: ['gerant','cuisinier'] },
          { label: 'Analyse d\'eau',         route: '/haccp/water',               icon: 'droplets',       roles: ['gerant'] },
          { label: 'Audit PMS',              route: '/haccp/pms-audit',           icon: 'clipboard-check',roles: ['gerant'] },
          { label: 'TIAC',                   route: '/haccp/tiac',                icon: 'siren',          roles: ['gerant'] },
          { label: 'Retrait / rappel',       route: '/haccp/recall',              icon: 'rotate-ccw',     roles: ['gerant'] },
        ]
      },
    ]
  },
  config: {
    label: 'Paramètres',
    items: [
      { label: 'Équipe',              route: '/team',            icon: 'users',        roles: ['gerant'] },
      { label: 'Plans & Tarifs',      route: '/settings/plans',  icon: 'layers',       roles: ['gerant'] },
      { label: 'CRM & Fidélité',      route: '/crm',             icon: 'heart',        roles: ['gerant'], minPlan: 'essential' },
      { label: 'Intégrations',        route: '/integrations',    icon: 'plug',         roles: ['gerant'], minPlan: 'professional' },
      { label: 'QR Codes',            route: '/qrcodes',         icon: 'qr-code',      roles: ['gerant'], minPlan: 'essential' },
      { label: 'Bilan Carbone',       route: '/carbon',          icon: 'leaf',         roles: ['gerant'], minPlan: 'professional' },
      { label: 'Multi-Sites',         route: '/multi-site',      icon: 'building-2',   roles: ['gerant'], minPlan: 'premium' },
      { label: 'API',                 route: '/api-keys',        icon: 'key',          roles: ['gerant'], minPlan: 'enterprise' },
      { label: 'Portail Fournisseur', route: '/supplier-portal', icon: 'truck',        roles: ['gerant'], minPlan: 'essential' },
      { label: 'Journal erreurs',     route: '/errors-log',         icon: 'bug',          roles: ['gerant'] },
      { label: 'Agrément sanitaire',  route: '/settings/sanitary-approval', icon: 'badge-check', roles: ['gerant'] },
      { label: 'Se déconnecter',      route: null,               icon: 'log-out',      roles: ['gerant','cuisinier','equipier'], action: 'logout' },
    ]
  },
  pilotage: {
    label: 'Pilotage',
    items: [
      { label: 'Pilotage',          route: '/analytics',        icon: 'bar-chart-3',  roles: ['gerant'], minPlan: 'professional' },
      { label: 'Menu Engineering',  route: '/menu-engineering', icon: 'target',       roles: ['gerant'], minPlan: 'professional' },
      { label: 'Prédictions IA',    route: '/predictions',      icon: 'brain',        roles: ['gerant'], minPlan: 'professional' },
      { label: 'Mercuriale',        route: '/mercuriale',       icon: 'trending-up',  roles: ['gerant'], minPlan: 'essential' },
    ]
  },
  traceability: {
    label: 'Traçabilité',
    items: [
      { label: 'Traçabilité aval', route: '/traceability/downstream', icon: 'package-check', roles: ['gerant', 'cuisinier'] },
    ]
  },
  documents: {
    label: 'Documents',
    items: [
      { label: 'Diagrammes de fabrication', route: '/fabrication-diagrams', icon: 'git-branch', roles: ['gerant'] },
      { label: 'Export PMS complet', route: '/pms/export', icon: 'file-text', roles: ['gerant'] },
    ]
  },
};

const ROUTE_TO_GROUP = {
  '/': 'cuisine', '/new': 'cuisine', '/ingredients': 'cuisine',
  '/stock': 'cuisine', '/recipe': 'cuisine', '/edit': 'cuisine',
  '/orders': 'operations', '/suppliers': 'operations',
  '/deliveries': 'operations', '/service': 'operations',
  '/kitchen': 'operations', '/scan-invoice': 'operations',
  '/analytics': 'pilotage',
  '/menu-engineering': 'pilotage', '/predictions': 'pilotage',
  '/mercuriale': 'pilotage', '/import-mercuriale': 'pilotage',
  '/more': 'config', '/team': 'config', '/integrations': 'config',
  '/multi-site': 'config', '/api-keys': 'config', '/qrcodes': 'config',
  '/carbon': 'config', '/supplier-portal': 'config', '/errors-log': 'config',
  '/crm': 'config', '/subscribe': 'config', '/settings/plans': 'config',
  '/settings': 'config',
  '/settings/sanitary-approval': 'config',
  '/traceability/downstream': 'haccp',
  '/fabrication-diagrams': 'documents',
  '/pms/export': 'documents',
  '/haccp': 'haccp',
  '/haccp/temperatures': 'haccp',
  '/haccp/cooking': 'haccp',
  '/haccp/cooling': 'haccp',
  '/haccp/reheating': 'haccp',
  '/haccp/cleaning': 'haccp',
  '/haccp/non-conformities': 'haccp',
  '/haccp/corrective-actions': 'haccp',
  '/haccp/allergens': 'haccp',
  '/haccp/allergens-plan': 'haccp',
  '/haccp/plan': 'haccp',
  '/haccp/calibrations': 'haccp',
  '/haccp/training': 'haccp',
  '/haccp/staff-health': 'haccp',
  '/haccp/witness-meals': 'haccp',
  '/haccp/fryers': 'haccp',
  '/haccp/pest-control': 'haccp',
  '/haccp/maintenance': 'haccp',
  '/haccp/waste': 'haccp',
  '/haccp/water': 'haccp',
  '/haccp/pms-audit': 'haccp',
  '/haccp/tiac': 'haccp',
  '/haccp/recall': 'haccp',
  '/stock/reception': 'haccp',
};

// ─── Command Palette shortcut ───
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    toggleCommandPalette();
  }
});

// ─── PWA Install Prompt ───
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (localStorage.getItem('restosuite_install_dismissed')) return;

  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-content">
      <img src="assets/icon-192.png" width="40" height="40" style="border-radius:8px">
      <div>
        <strong>Installer RestoSuite</strong>
        <small>Accès rapide depuis votre écran d'accueil</small>
      </div>
    </div>
    <div class="install-actions">
      <button class="install-btn" id="installBtn">Installer</button>
      <button class="install-dismiss" id="dismissBtn">Plus tard</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
    banner.remove();
  });

  document.getElementById('dismissBtn').addEventListener('click', () => {
    localStorage.setItem('restosuite_install_dismissed', 'true');
    banner.remove();
  });
}

// ─── Trial status cache ───
let _trialStatus = null;
let _trialStatusIntervalId = null;

function getTrialStatus() { return _trialStatus; }

function clearTrialStatusInterval() {
  if (_trialStatusIntervalId) {
    clearInterval(_trialStatusIntervalId);
    _trialStatusIntervalId = null;
  }
}

async function fetchTrialStatus() {
  const account = getAccount();
  if (!account) return null;
  try {
    const status = await API.request(`/accounts/${account.id}/status`);
    _trialStatus = status;
    return status;
  } catch (e) {
    console.warn('Could not fetch trial status:', e);
    return null;
  }
}

function renderTrialBanner() {
  // Remove existing banner
  const existing = document.querySelector('.trial-banner');
  if (existing) existing.remove();

  const status = _trialStatus;
  if (!status) return;

  // Pro users: no banner
  if (status.status === 'pro') {
    document.body.classList.remove('read-only-mode');
    return;
  }

  let bannerHTML = '';

  if (status.status === 'expired') {
    document.body.classList.add('read-only-mode');
    bannerHTML = `
      <div class="trial-banner trial-banner--expired">
        <span>Votre essai gratuit est terminé. Vos données sont en lecture seule.</span>
        <a href="#/subscribe" class="btn btn-primary btn-sm">Passer en Pro — 39€/mois</a>
      </div>
    `;
  } else if (status.status === 'trial') {
    document.body.classList.remove('read-only-mode');
    const daysLeft = status.daysLeft;
    
    if (daysLeft <= 3) {
      bannerHTML = `
        <div class="trial-banner trial-banner--urgent">
          <span>Plus que <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> d'essai gratuit — vos données passeront en lecture seule</span>
          <a href="#/subscribe">Passer en Pro</a>
        </div>
      `;
    } else if (daysLeft <= 14) {
      bannerHTML = `
        <div class="trial-banner trial-banner--warning">
          <span>Plus que ${daysLeft} jours d'essai gratuit</span>
          <a href="#/subscribe">Passer en Pro</a>
        </div>
      `;
    }
    // daysLeft > 14: no banner
  }

  if (bannerHTML) {
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);
  }

  // Also render a compact trial badge in the nav
  renderTrialHeaderBadge();
}

function renderTrialHeaderBadge() {
  const existing = document.querySelector('.trial-header-badge');
  if (existing) existing.remove();

  const status = _trialStatus;
  if (!status || status.status !== 'trial') return;

  const daysLeft = status.daysLeft;
  let badgeClass, label;
  if (daysLeft <= 3) {
    badgeClass = 'trial-header-badge--red';
    label = `Essai : ${daysLeft}j — Passer en Pro`;
  } else if (daysLeft <= 14) {
    badgeClass = 'trial-header-badge--yellow';
    label = `Essai : ${daysLeft}j`;
  } else {
    badgeClass = 'trial-header-badge--green';
    label = `Essai : ${daysLeft}j restants`;
  }

  const nav = document.getElementById('nav');
  if (!nav) return;
  const navLinks = nav.querySelector('.nav-links');
  if (!navLinks) return;

  const badge = document.createElement('a');
  badge.href = '#/subscribe';
  badge.className = `trial-header-badge ${badgeClass}`;
  badge.textContent = label;
  navLinks.insertBefore(badge, navLinks.firstChild);
}

function registerRoutes() {
  // Prevent double-registration
  if (Router.routes.length > 0) return;

  Router.add(/^\/$/, renderDashboard);
  Router.add(/^\/new$/, () => renderRecipeForm(null));
  Router.add(/^\/recipe\/(\d+)$/, (id) => renderRecipeDetail(parseInt(id)));
  Router.add(/^\/edit\/(\d+)$/, (id) => renderRecipeForm(parseInt(id)));
  Router.add(/^\/ingredients$/, renderIngredients);
  Router.add(/^\/stock$/, renderStockDashboard);
  Router.add(/^\/deliveries$/, renderDeliveries);
  Router.add(/^\/deliveries\/(\d+)$/, (id) => renderDeliveryDetail(parseInt(id)));
  Router.add(/^\/stock\/reception$/, renderStockReception);
  Router.add(/^\/stock\/movements$/, renderStockMovements);
  Router.add(/^\/stock\/variance$/, renderStockVariance);
  Router.add(/^\/orders$/, renderOrdersDashboard);
  Router.add(/^\/orders\/new$/, renderNewOrder);
  Router.add(/^\/orders\/(\d+)$/, (id) => renderOrderDetail(parseInt(id)));
  Router.add(/^\/kitchen$/, renderKitchenView);
  Router.add(/^\/suppliers$/, renderSuppliers);
  Router.add(/^\/ia$/, renderAIAssistant);
  Router.add(/^\/haccp$/, renderHACCPDashboard);
  Router.add(/^\/haccp\/temperatures$/, renderHACCPTemperatures);
  Router.add(/^\/haccp\/calibrations$/, renderHACCPCalibrations);
  Router.add(/^\/haccp\/cleaning$/, renderHACCPCleaning);
  Router.add(/^\/haccp\/traceability$/, renderHACCPTraceability);
  Router.add(/^\/haccp\/cooling$/, renderHACCPCooling);
  Router.add(/^\/haccp\/cooking$/, renderHACCPCooking);
  Router.add(/^\/haccp\/reheating$/, renderHACCPReheating);
  Router.add(/^\/haccp\/fryers$/, renderHACCPFryers);
  Router.add(/^\/haccp\/non-conformities$/, renderHACCPNonConformities);
  Router.add(/^\/haccp\/allergens$/, renderHACCPAllergens);
  Router.add(/^\/haccp\/plan$/, renderHACCPPlan);
  Router.add(/^\/haccp\/recall$/, renderHACCPRecall);
  Router.add(/^\/haccp\/training$/, renderHACCPTraining);
  Router.add(/^\/haccp\/pest-control$/, renderHACCPPestControl);
  Router.add(/^\/haccp\/maintenance$/, renderHACCPMaintenance);
  Router.add(/^\/haccp\/waste$/, renderHACCPWaste);
  Router.add(/^\/haccp\/corrective-actions$/, renderCorrectiveActions);
  Router.add(/^\/haccp\/allergens-plan$/, renderHACCPAllergensplan);
  Router.add(/^\/haccp\/water$/, renderHACCPWater);
  Router.add(/^\/haccp\/label-scan$/, renderHACCPLabelScan);
  Router.add(/^\/haccp\/pms-audit$/, renderHACCPPmsAudit);
  Router.add(/^\/haccp\/tiac$/, renderHACCPTIAC);
  Router.add(/^\/haccp\/witness-meals$/, renderHACCPWitnessMeals);
  Router.add(/^\/haccp\/staff-health$/, renderHACCPStaffHealth);
  Router.add(/^\/settings\/sanitary-approval$/, renderSanitaryApproval);
  Router.add(/^\/analytics$/, renderAnalytics);
  Router.add(/^\/health$/, () => { location.hash = '#/analytics'; });
  Router.add(/^\/more$/, () => new MoreView().render());
  Router.add(/^\/team$/, renderTeam);
  Router.add(/^\/subscribe$/, renderSubscribe);
  Router.add(/^\/supplier-portal$/, renderSupplierPortalManage);
  Router.add(/^\/service$/, renderServiceView);
  Router.add(/^\/scan-invoice$/, renderScanInvoice);
  Router.add(/^\/mercuriale$/, renderMercuriale);
  Router.add(/^\/import-mercuriale$/, renderImportMercuriale);
  Router.add(/^\/chef$/, () => { location.hash = '#/ia'; });
  Router.add(/^\/menu-engineering$/, renderMenuEngineering);
  Router.add(/^\/carbon$/, renderCarbon);
  Router.add(/^\/integrations$/, renderIntegrations);
  Router.add(/^\/multi-site$/, renderMultiSite);
  Router.add(/^\/predictions$/, renderPredictions);
  Router.add(/^\/crm$/, renderCRM);
  Router.add(/^\/api-keys$/, renderAPIKeys);
  Router.add(/^\/qrcodes$/, renderQRCodes);
  Router.add(/^\/settings$/, () => { location.hash = '#/settings/plans'; });
  Router.add(/^\/settings\/plans$/, (highlightPlan) => renderPlans(highlightPlan));
  Router.add(/^\/errors-log$/, () => new ErrorsLogView().render());
  Router.add(/^\/traceability\/downstream$/, renderTraceabilityDownstream);
  Router.add(/^\/fabrication-diagrams$/, renderFabricationDiagrams);
  Router.add(/^\/pms\/export$/, renderPMSExport);
  Router.add(/^\/admin$/, renderAdmin);
}

function showPlanGateModal(planLabel) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;text-align:center">
      <div style="font-size:2.5rem;margin-bottom:var(--space-3)">🔒</div>
      <h2 style="margin-bottom:var(--space-3)">Fonctionnalité ${escapeHtml(planLabel)}</h2>
      <p class="text-secondary" style="margin-bottom:var(--space-5)">
        Cette fonctionnalité nécessite le plan <strong>${escapeHtml(planLabel)}</strong>.<br>
        Passez à un plan supérieur pour y accéder.
      </p>
      <div class="actions-row" style="justify-content:center;gap:var(--space-3)">
        <button class="btn btn-secondary" id="plan-gate-cancel">Fermer</button>
        <a href="#/settings/plans" class="btn btn-primary" id="plan-gate-go">Voir les tarifs →</a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('plan-gate-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('plan-gate-go').addEventListener('click', () => overlay.remove());
}

function bootApp(role, account, opts = {}) {
  applyRole(role);
  updateNavUser(account);
  registerRoutes();
  initNavGroups(role);

  // Filter nav items based on role — hide links user cannot access
  const navLinks = document.querySelectorAll('.nav-link[data-roles]');
  navLinks.forEach(link => {
    const allowedRoles = link.dataset.roles.split(',').map(r => r.trim());
    if (!allowedRoles.includes(role)) {
      link.style.display = 'none';
    } else {
      link.style.display = '';
    }
  });

  // Show admin nav link only for admin users
  const adminNavLink = document.getElementById('nav-admin-link');
  if (adminNavLink) {
    adminNavLink.style.display = isAdminUser(account) ? '' : 'none';
  }

  // Role-based redirect: salle goes to service view, cuisine goes to kitchen
  if (role === 'salle') {
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';
    location.hash = '#/service';
  } else if (role === 'cuisinier') {
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';
    location.hash = '#/kitchen';
  } else {
    location.hash = '#/';
  }
  Router.init();
  if (window.lucide) lucide.createIcons();
  const displayName = account ? account.name : role;
  console.log('%c RestoSuite ', 'background:#E8722A;color:#fff;border-radius:4px;padding:2px 8px;font-weight:600', `loaded (${displayName})`);

  // Fetch trial status and plan in parallel
  fetchTrialStatus().then(() => renderTrialBanner());
  API.getCurrentPlan().then(data => {
    // If user is in active trial, give them full access (enterprise-level)
    // so no plan-gate badges/locks appear in the UI during trial.
    if (data.trial_active || data.status === 'trial') {
      _currentPlan = 'enterprise';
    } else {
      _currentPlan = data.plan || 'discovery';
    }
    // Re-render nav to remove any stale lock badges
    if (typeof renderNav === 'function') renderNav();
  }).catch(() => {});

  // Refresh trial status every 5 minutes (store interval ID for cleanup on logout)
  clearTrialStatusInterval();
  _trialStatusIntervalId = setInterval(() => fetchTrialStatus().then(() => renderTrialBanner()), 5 * 60 * 1000);

  // First-login onboarding tour (gérant only, runs once, skips if role-
  // redirected to /kitchen or /service since the nav is hidden there).
  if (role === 'gerant' && typeof maybeStartOnboardingTour === 'function') {
    maybeStartOnboardingTour(account);
  }
}

function updateNavUser(account) {
  // Remove existing user badge if any
  const existing = document.querySelector('.nav-user-badge');
  if (existing) existing.remove();

  if (!account) return;

  const nav = document.getElementById('nav');
  if (!nav) return;

  const badge = document.createElement('div');
  badge.className = 'nav-user-badge';
  badge.innerHTML = `${renderAvatar(account.name, 32)}<span class="nav-user-name">${escapeHtml(account.name)}</span>`;
  badge.addEventListener('click', () => {
    location.hash = '#/more';
  });

  // Insert into nav-links
  const navLinks = nav.querySelector('.nav-links');
  if (navLinks) {
    navLinks.appendChild(badge);
  }
}

function initNavGroups(role) {
  const panel = document.getElementById('nav-panel');
  const panelContent = document.getElementById('nav-panel-content');
  if (!panel || !panelContent) return;

  const backdrop = panel.querySelector('.nav-panel-backdrop');
  let activeGroupKey = null;

  function closePanel() {
    panel.classList.remove('open');
    document.querySelectorAll('.nav-link.panel-open').forEach(el => el.classList.remove('panel-open'));
    activeGroupKey = null;
  }

  function openPanel(btn, groupKey) {
    const group = NAV_GROUPS[groupKey];
    if (!group) return;

    const currentPath = location.hash.replace('#', '') || '/';

    function renderItem(item) {
      if (item.action === 'logout') {
        return `<button class="nav-panel-item nav-panel-item--danger" onclick="logout()">
          <i data-lucide="${item.icon}"></i>
          <span class="nav-panel-item__label">${escapeHtml(item.label)}</span>
        </button>`;
      }
      const locked = item.minPlan && !isPlanUnlocked(item.minPlan);
      const isActive = !locked && (currentPath === item.route || (item.route !== '/' && currentPath.startsWith(item.route)));
      if (locked) {
        const PLAN_LABELS = { essential: 'Essential', professional: 'Pro', premium: 'Premium', enterprise: 'Groupe' };
        const badge = PLAN_LABELS[item.minPlan] || item.minPlan;
        return `<button class="nav-panel-item nav-panel-item--locked" data-required-plan="${escapeHtml(item.minPlan)}" data-action="plan-gate">
          <i data-lucide="${item.icon}"></i>
          <span class="nav-panel-item__label">${escapeHtml(item.label)}</span>
          <span class="nav-plan-badge">${escapeHtml(badge)}</span>
        </button>`;
      }
      return `<a href="#${item.route}" class="nav-panel-item${isActive ? ' active' : ''}">
        <i data-lucide="${item.icon}"></i>
        <span class="nav-panel-item__label">${escapeHtml(item.label)}</span>
      </a>`;
    }

    let body = '';
    let accessibleCount = 0;
    let onlyItem = null;

    if (Array.isArray(group.subcategories)) {
      const sections = [];
      for (const sub of group.subcategories) {
        const subAccessible = sub.items.filter(item => item.roles.includes(role));
        if (subAccessible.length === 0) continue;
        accessibleCount += subAccessible.length;
        if (subAccessible.length === 1 && !onlyItem) onlyItem = subAccessible[0];
        sections.push(
          `<div class="nav-panel-subtitle">${escapeHtml(sub.label)}</div>` +
          subAccessible.map(renderItem).join('')
        );
      }
      body = sections.join('');
    } else {
      const accessible = group.items.filter(item => item.roles.includes(role));
      accessibleCount = accessible.length;
      if (accessible.length === 1) onlyItem = accessible[0];
      body = accessible.map(renderItem).join('');
    }

    if (accessibleCount === 0) return;

    // Single accessible item → navigate directly, no panel
    if (accessibleCount === 1 && onlyItem) {
      closePanel();
      location.hash = '#' + onlyItem.route;
      return;
    }

    panelContent.innerHTML = `
      <div class="nav-panel-title">${escapeHtml(group.label)}</div>
      ${body}
    `;

    if (window.lucide) lucide.createIcons({ nodes: [panelContent] });

    // Desktop: position dropdown under the button
    if (window.innerWidth >= 768) {
      const rect = btn.getBoundingClientRect();
      const sheet = panelContent.parentElement;
      sheet.style.left = Math.max(8, rect.left - 20) + 'px';
    }

    panel.classList.add('open');
    btn.classList.add('panel-open');
    activeGroupKey = groupKey;

    panelContent.querySelectorAll('.nav-panel-item').forEach(item => {
      item.addEventListener('click', closePanel, { once: true });
    });

    // Plan gate : intercepte les clics sur fonctionnalités verrouillées
    panelContent.querySelectorAll('[data-action="plan-gate"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const plan = btn.dataset.requiredPlan;
        const PLAN_LABELS = { essential: 'Essential', professional: 'Pro', premium: 'Premium', enterprise: 'Groupe' };
        const label = PLAN_LABELS[plan] || plan;
        showPlanGateModal(label);
      });
    });
  }

  document.querySelectorAll('.nav-link[data-group]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const groupKey = btn.dataset.group;
      if (activeGroupKey === groupKey && panel.classList.contains('open')) {
        closePanel();
      } else {
        closePanel();
        openPanel(btn, groupKey);
      }
    });
  });

  if (backdrop) backdrop.addEventListener('click', closePanel);
  window.addEventListener('hashchange', closePanel);
}

(async function init() {
  // Check supplier session first
  const supplierSession = getSupplierSession();
  if (supplierSession && getSupplierToken()) {
    document.body.classList.add('supplier-mode');
    bootSupplierApp(supplierSession);
    return;
  }

  // Check for JWT token
  const token = localStorage.getItem('restosuite_token');

  if (token) {
    try {
      // Verify token with server
      const result = await API.getMe();
      const account = result.account;

      // Update stored account with fresh data
      localStorage.setItem('restosuite_account', JSON.stringify(account));

      // Check if onboarding is complete
      if (account.onboarding_step < 7 && account.is_owner) {
        // Show onboarding wizard
        const nav = document.getElementById('nav');
        if (nav) nav.style.display = 'none';

        const wizard = new OnboardingWizard(() => {
          if (nav) nav.style.display = '';
          bootApp(account.role, account);
        });
        wizard.show();
        return;
      }

      // Fournisseur case
      if (account.role === 'fournisseur') {
        const login = new LoginView();
        login.mode = 'login';
        login.render();
        return;
      }

      bootApp(account.role, account);
      return;
    } catch (e) {
      // Token invalid — clear and show login
      console.warn('Token verification failed:', e);
      localStorage.removeItem('restosuite_token');
      localStorage.removeItem('restosuite_account');
    }
  }

  // Fallback: check old account-based auth (legacy)
  const account = getAccount();
  if (account && !token) {
    if (account.role === 'fournisseur') {
      const login = new LoginView();
      login.render();
      return;
    }
    bootApp(account.role, account);
    return;
  }

  // Fallback: check old role system (legacy)
  const role = localStorage.getItem('restosuite_role');
  if (role && role !== 'fournisseur') {
    bootApp(role, null);
    return;
  }

  if (role === 'fournisseur') {
    const login = new LoginView();
    login.render();
    return;
  }

  // No auth → show login
  const login = new LoginView();
  login.render();
})();

// ─── Client-side error monitoring ───
(function() {
  let _errorBuffer = [];
  let _flushTimer = null;

  function reportErrors() {
    if (!_errorBuffer.length) return;
    const token = localStorage.getItem('restosuite_token');
    if (!token) { _errorBuffer = []; return; }

    const batch = _errorBuffer.splice(0);
    batch.forEach(entry => {
      fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(entry),
      }).catch(() => {}); // silent fail — monitoring ne doit pas casser l'app
    });
  }

  function scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(() => {
      _flushTimer = null;
      reportErrors();
    }, 2000);
  }

  function captureError(opts) {
    _errorBuffer.push(opts);
    scheduleFlush();
  }

  window.onerror = function(message, source, lineno, colno, error) {
    captureError({
      type: 'onerror',
      message: String(message),
      source,
      lineno,
      colno,
      stack: error && error.stack ? error.stack : undefined,
    });
  };

  window.onunhandledrejection = function(event) {
    const reason = event.reason;
    captureError({
      type: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error && reason.stack ? reason.stack : undefined,
    });
  };
})();
