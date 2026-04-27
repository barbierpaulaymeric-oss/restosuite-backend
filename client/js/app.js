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

// ─── Nav group definitions ───
const NAV_GROUPS = {
  cuisine: {
    label: 'Cuisine',
    items: [
      { label: 'Fiches Techniques',  route: '/recipes',     icon: 'clipboard-list', roles: ['gerant','cuisinier','equipier'] },
      { label: 'Ingrédients',        route: '/ingredients', icon: 'package',        roles: ['gerant','cuisinier','equipier'] },
      { label: 'Stock & Réception',  route: '/stock',       icon: 'warehouse',      roles: ['gerant','cuisinier'] },
    ]
  },
  operations: {
    label: 'Opérations',
    items: [
      // The label promised "& Commandes" but the route used to point at
      // /suppliers (just the suppliers list, no orders). Two clicks to reach
      // the orders dashboard. Route now points straight at /orders, which
      // already shows orders + has a "Fournisseurs" button to drill back.
      { label: 'Commandes',              route: '/orders',    icon: 'clipboard-pen',  roles: ['gerant'] },
      { label: 'Fournisseurs',          route: '/suppliers',  icon: 'truck',         roles: ['gerant'] },
      { label: 'Livraisons',             route: '/deliveries',icon: 'package-check',  roles: ['gerant','cuisinier'] },
      { label: 'Messages',               route: '/messages',  icon: 'message-square', roles: ['gerant','cuisinier'], badgeKey: 'messages' },
      { label: 'Service (Salle)',        route: '/service',   icon: 'concierge-bell', roles: ['gerant','salle'] },
      { label: 'Cuisine (écran)',        route: '/kitchen',   icon: 'chef-hat',       roles: ['gerant','cuisinier'] },
    ]
  },
  haccp: {
    label: 'HACCP',
    items: [
      { label: 'Ma journée HACCP', route: '/haccp/ma-journee',      icon: 'calendar-check',  roles: ['gerant','cuisinier'] },
      { label: 'Températures',     route: '/haccp/hub/temperatures', icon: 'thermometer',     roles: ['gerant','cuisinier'] },
      { label: 'Hygiène',          route: '/haccp/hub/hygiene',      icon: 'spray-can',       roles: ['gerant','cuisinier'] },
      { label: 'Traçabilité',      route: '/haccp/hub/tracabilite',  icon: 'package-check',   roles: ['gerant','cuisinier'] },
      { label: 'Plan HACCP',       route: '/haccp/hub/plan',         icon: 'file-check',      roles: ['gerant','cuisinier'] },
      { label: 'Autre',            route: '/haccp/hub/autre',        icon: 'more-horizontal', roles: ['gerant','cuisinier'] },
    ]
  },
  config: {
    label: 'Paramètres',
    items: [
      { label: 'Équipe',              route: '/team',            icon: 'users',        roles: ['gerant'] },
      { label: 'Abonnement',          route: '/subscribe',       icon: 'layers',       roles: ['gerant'] },
      { label: 'CRM & Fidélité',      route: '/crm',             icon: 'heart',        roles: ['gerant'] },
      { label: 'Intégrations',        route: '/integrations',    icon: 'plug',         roles: ['gerant'] },
      { label: 'QR Codes',            route: '/qrcodes',         icon: 'qr-code',      roles: ['gerant'] },
      { label: 'Bilan Carbone',       route: '/carbon',          icon: 'leaf',         roles: ['gerant'] },
      { label: 'Multi-Sites',         route: '/multi-site',      icon: 'building-2',   roles: ['gerant'] },
      { label: 'API',                 route: '/api-keys',        icon: 'key',          roles: ['gerant'] },
      { label: 'Portail Fournisseur', route: '/supplier-portal', icon: 'truck',        roles: ['gerant'] },
      { label: 'Journal erreurs',     route: '/errors-log',         icon: 'bug',          roles: ['gerant'] },
      { label: 'Agrément sanitaire',  route: '/settings/sanitary-approval', icon: 'badge-check', roles: ['gerant'] },
      { label: 'Se déconnecter',      route: null,               icon: 'log-out',      roles: ['gerant','cuisinier','equipier'], action: 'logout' },
    ]
  },
  pilotage: {
    label: 'Pilotage',
    items: [
      { label: 'Pilotage',          route: '/analytics',        icon: 'bar-chart-3',  roles: ['gerant'] },
      { label: 'Menu Engineering',  route: '/menu-engineering', icon: 'target',       roles: ['gerant'] },
      { label: 'Prédictions IA',    route: '/predictions',      icon: 'brain',        roles: ['gerant'] },
      { label: 'Mercuriale',        route: '/mercuriale',       icon: 'trending-up',  roles: ['gerant'] },
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
  '/': 'cuisine', '/recipes': 'cuisine', '/new': 'cuisine', '/ingredients': 'cuisine',
  '/stock': 'cuisine', '/recipe': 'cuisine', '/edit': 'cuisine',
  '/orders': 'operations', '/suppliers': 'operations',
  '/deliveries': 'operations', '/service': 'operations', '/messages': 'operations',
  '/kitchen': 'operations', '/scan-invoice': 'operations',
  '/analytics': 'pilotage',
  '/menu-engineering': 'pilotage', '/predictions': 'pilotage',
  '/mercuriale': 'pilotage', '/import-mercuriale': 'pilotage',
  '/more': 'config', '/team': 'config', '/integrations': 'config',
  '/multi-site': 'config', '/api-keys': 'config', '/qrcodes': 'config',
  '/carbon': 'config', '/supplier-portal': 'config', '/errors-log': 'config',
  '/crm': 'config', '/subscribe': 'config',
  '/settings': 'config',
  '/settings/sanitary-approval': 'config',
  '/traceability/downstream': 'haccp',
  '/fabrication-diagrams': 'documents',
  '/pms/export': 'documents',
  '/haccp': 'haccp',
  '/haccp/ma-journee': 'haccp',
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
  '/haccp/hub/temperatures': 'haccp',
  '/haccp/hub/hygiene':      'haccp',
  '/haccp/hub/tracabilite':  'haccp',
  '/haccp/hub/plan':         'haccp',
  '/haccp/hub/autre':        'haccp',
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
    // Background poll (5-min ticker, app-wide). A transient 401 here used to
    // trigger api.js's full cleanup-and-reload — yanking the user out of
    // whichever screen they were on, which the user reported as "session
    // expiring between pages". noRedirectOn401 keeps it silent; the user's
    // NEXT real action hits 401 and reloads normally.
    const status = await API.request(`/accounts/${account.id}/status`, { noRedirectOn401: true });
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
  Router.add(/^\/recipes$/, renderDashboard);
  Router.add(/^\/new$/, () => renderRecipeForm(null));
  Router.add(/^\/recipe\/(\d+)$/, (id) => renderRecipeDetail(parseInt(id)));
  Router.add(/^\/edit\/(\d+)$/, (id) => renderRecipeForm(parseInt(id)));
  Router.add(/^\/ingredients$/, renderIngredients);
  Router.add(/^\/stock$/, renderStockDashboard);
  Router.add(/^\/deliveries$/, renderDeliveries);
  Router.add(/^\/deliveries\/(\d+)$/, (id) => renderDeliveryDetail(parseInt(id)));
  Router.add(/^\/messages$/, renderMessagesConversations);
  Router.add(/^\/messages\/(\d+)$/, (id) => renderMessagesThread(parseInt(id)));
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
  Router.add(/^\/haccp\/ma-journee$/, renderHACCPMaJournee);
  Router.add(/^\/haccp\/reception$/, () => renderHACCPReception());
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
  Router.add(/^\/haccp\/pms-audit$/, renderHACCPPmsAudit);
  Router.add(/^\/haccp\/tiac$/, renderHACCPTIAC);
  Router.add(/^\/haccp\/witness-meals$/, renderHACCPWitnessMeals);
  Router.add(/^\/haccp\/staff-health$/, renderHACCPStaffHealth);
  Router.add(/^\/haccp\/hub\/temperatures$/, () => renderHACCPHub('temperatures'));
  Router.add(/^\/haccp\/hub\/hygiene$/,      () => renderHACCPHub('hygiene'));
  Router.add(/^\/haccp\/hub\/tracabilite$/,  () => renderHACCPHub('tracabilite'));
  Router.add(/^\/haccp\/hub\/plan$/,         () => renderHACCPHub('plan'));
  Router.add(/^\/haccp\/hub\/autre$/,        () => renderHACCPHub('autre'));
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
  Router.add(/^\/settings$/, () => { location.hash = '#/subscribe'; });
  Router.add(/^\/settings\/plans$/, () => { location.hash = '#/subscribe'; });
  Router.add(/^\/errors-log$/, () => new ErrorsLogView().render());
  Router.add(/^\/traceability\/downstream$/, renderTraceabilityDownstream);
  Router.add(/^\/fabrication-diagrams$/, renderFabricationDiagrams);
  Router.add(/^\/pms\/export$/, renderPMSExport);
  Router.add(/^\/docs$/, () => { location.hash = '#/fabrication-diagrams'; });
  Router.add(/^\/admin$/, renderAdmin);
}

function bootApp(role, account, opts = {}) {
  applyRole(role);
  updateNavUser(account);
  registerRoutes();
  initNavGroups(role);
  initMobileNav(role);

  // Poll the messages unread count so the nav badge stays current. Only for
  // roles that can see Messages (gérant + cuisinier). The polling helper
  // lives in views/messages.js.
  if (typeof startMessagesNavBadgePolling === 'function' && (role === 'gerant' || role === 'cuisinier')) {
    startMessagesNavBadgePolling();
  }

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

  // Trial banner — read-only / expired warnings come from the trial-status helper.
  fetchTrialStatus().then(() => renderTrialBanner());

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
      const isActive = currentPath === item.route || (item.route !== '/' && currentPath.startsWith(item.route));
      return `<a href="#${item.route}" data-route="${escapeHtml(item.route)}" class="nav-panel-item${isActive ? ' active' : ''}">
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

// ═══════════════════════════════════════════
// Mobile hamburger nav overlay
// ═══════════════════════════════════════════
function initMobileNav(role) {
  const hamburgerBtn = document.getElementById('nav-hamburger-btn');
  const overlay = document.getElementById('mobile-nav-overlay');
  const closeBtn = document.getElementById('mobile-nav-close');
  const body = document.getElementById('mobile-nav-body');
  if (!hamburgerBtn || !overlay || !body) return;

  const currentPath = () => location.hash.replace('#', '') || '/';

  function buildMenu() {
    body.innerHTML = '';
    const groupOrder = ['cuisine', 'operations', 'haccp', 'pilotage', 'documents', 'config'];
    groupOrder.forEach(key => {
      const group = NAV_GROUPS[key];
      if (!group) return;

      let items = [];
      if (Array.isArray(group.subcategories)) {
        group.subcategories.forEach(sub => {
          sub.items.filter(i => i.roles.includes(role)).forEach(i => items.push(i));
        });
      } else if (Array.isArray(group.items)) {
        items = group.items.filter(i => i.roles.includes(role));
      }
      if (items.length === 0) return;

      const section = document.createElement('div');
      section.className = 'mobile-nav-section';
      const title = document.createElement('div');
      title.className = 'mobile-nav-section-title';
      title.textContent = group.label;
      section.appendChild(title);

      items.forEach(item => {
        const path = currentPath();
        const isActive = item.route && (path === item.route || (item.route !== '/' && path.startsWith(item.route)));

        let el;
        if (item.action === 'logout') {
          el = document.createElement('button');
          el.className = 'mobile-nav-item mobile-nav-item--danger';
          el.addEventListener('click', () => { closeOverlay(); logout(); });
        } else {
          el = document.createElement('a');
          el.href = '#' + item.route;
          el.dataset.route = item.route;
          el.className = 'mobile-nav-item' + (isActive ? ' active' : '');
          el.addEventListener('click', closeOverlay);
        }
        el.innerHTML = `<i data-lucide="${item.icon}"></i><span>${escapeHtml(item.label)}</span>`;
        section.appendChild(el);
      });
      body.appendChild(section);
    });


    // Add Alto direct link (not in NAV_GROUPS — direct href)
    const altoSection = document.createElement('div');
    altoSection.className = 'mobile-nav-section';
    const altoTitle = document.createElement('div');
    altoTitle.className = 'mobile-nav-section-title';
    altoTitle.textContent = 'Alto IA';
    altoSection.appendChild(altoTitle);
    const altoEl = document.createElement('a');
    const isAltoActive = currentPath() === '/ia' || currentPath().startsWith('/ia');
    altoEl.href = '#/ia';
    altoEl.className = 'mobile-nav-item' + (isAltoActive ? ' active' : '');
    altoEl.innerHTML = `<i data-lucide="sparkles"></i><span>Alto — Assistant IA</span>`;
    altoEl.addEventListener('click', closeOverlay);
    altoSection.appendChild(altoEl);
    body.appendChild(altoSection);

    if (window.lucide) lucide.createIcons({ nodes: [body] });
  }

  function openOverlay() {
    buildMenu();
    overlay.classList.add('open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    hamburgerBtn.focus();
  }

  hamburgerBtn.addEventListener('click', () => {
    if (overlay.classList.contains('open')) closeOverlay();
    else openOverlay();
  });
  closeBtn.addEventListener('click', closeOverlay);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeOverlay();
  });
  window.addEventListener('hashchange', closeOverlay);
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

  // No auth → show login (jump to register if landing CTA used)
  const login = new LoginView();
  if (location.hash === '#register') {
    login.mode = 'register';
    history.replaceState(null, '', location.pathname); // clear hash so back-nav is clean
  }
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
