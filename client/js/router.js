// ═══════════════════════════════════════════
// SPA Router — Hash-based with role-based access control
// ═══════════════════════════════════════════

// Role access matrix for each route
const ROUTE_ROLES = {
  '/': ['gerant', 'cuisinier', 'equipier'],
  '/recipes': ['gerant', 'cuisinier', 'equipier'],
  '/new': ['gerant'],
  '/recipe/': ['gerant', 'cuisinier', 'equipier'],
  '/edit/': ['gerant'],
  '/ingredients': ['gerant', 'cuisinier', 'equipier'],
  '/stock': ['gerant', 'cuisinier'],
  '/stock/': ['gerant', 'cuisinier'],
  '/deliveries': ['gerant', 'cuisinier'],
  '/deliveries/': ['gerant', 'cuisinier'],
  '/orders': ['gerant'],
  '/orders/': ['gerant'],
  '/haccp': ['gerant', 'cuisinier'],
  '/haccp/': ['gerant', 'cuisinier'],
  '/haccp/ma-journee': ['gerant', 'cuisinier'],
  '/haccp/reception': ['gerant', 'cuisinier'],
  '/haccp/calibrations': ['gerant', 'cuisinier'],
  '/suppliers': ['gerant'],
  '/ia': ['gerant', 'cuisinier', 'equipier'],
  '/analytics': ['gerant'],
  '/team': ['gerant'],
  '/service': ['gerant', 'salle'],
  '/kitchen': ['gerant', 'cuisinier'],
  '/more': ['gerant', 'cuisinier', 'equipier'],
  '/subscribe': ['gerant'],
  '/supplier-portal': ['gerant'],
  '/scan-invoice': ['gerant', 'cuisinier'],
  '/mercuriale': ['gerant'],
  '/qrcodes': ['gerant'],
  '/errors-log': ['gerant'],
  '/fabrication-diagrams': ['gerant'],
  '/crm': ['gerant'],
  '/carbon': ['gerant'],
  '/multi-site': ['gerant'],
  '/api-keys': ['gerant'],
  '/integrations': ['gerant'],
  '/predictions': ['gerant'],
  '/menu-engineering': ['gerant'],
  '/traceability/downstream': ['gerant', 'cuisinier'],
  '/pms/export': ['gerant'],
  '/settings/sanitary-approval': ['gerant'],
  '/import-mercuriale': ['gerant'],
  '/admin': ['admin'],
  '/chef': ['gerant'],
};

function isRouteAllowed(path, role) {
  // Check exact match first
  if (ROUTE_ROLES[path]) {
    return ROUTE_ROLES[path].includes(role);
  }

  // Check prefix match (for parametrized routes)
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
    if (routePrefix.endsWith('/') && path.startsWith(routePrefix)) {
      return allowedRoles.includes(role);
    }
  }

  // Default: allow access for unmapped routes
  return true;
}

const Router = {
  routes: [],

  add(pattern, handler) {
    this.routes.push({ pattern, handler });
  },

  navigate(hash) {
    const path = hash.replace('#', '') || '/';
    const role = typeof getRole === 'function' ? getRole() : null;

    // Role-based access control: redirect to home if user doesn't have access
    if (role && !isRouteAllowed(path, role)) {
      console.warn(`Access denied to ${path} for role ${role}`);
      location.hash = '#/';
      if (typeof showToast === 'function') {
        showToast('Accès non autorisé', 'error');
      }
      return;
    }

    // Clean up service view if leaving it
    if (typeof _svcCleanup === 'function' && !path.startsWith('/service')) {
      _svcCleanup();
    }

    // Close any open modals on route change
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

    // Update nav active state — direct links
    document.querySelectorAll('.nav-link[data-route]').forEach(link => {
      const route = link.dataset.route;
      const isActive = route === path || (route !== '/' && path.startsWith(route));
      link.classList.toggle('active', isActive);
    });

    // Update nav active state — group buttons
    if (typeof ROUTE_TO_GROUP !== 'undefined') {
      let activeGroup = ROUTE_TO_GROUP[path];
      if (!activeGroup) {
        const key = Object.keys(ROUTE_TO_GROUP).find(p => p !== '/' && path.startsWith(p));
        activeGroup = key ? ROUTE_TO_GROUP[key] : null;
      }
      document.querySelectorAll('.nav-link[data-group]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.group === activeGroup);
      });
    }

    // Match route
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        route.handler(...match.slice(1));
        // Belt-and-suspenders alongside the MutationObserver in
        // ui-components.js: catch any data-ui elements that views
        // injected synchronously before the observer fired.
        try { window.UI && window.UI.enhanceAll && window.UI.enhanceAll(); } catch {}
        return;
      }
    }

    // 404 fallback
    document.getElementById('app').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="search-x" style="width:48px;height:48px;color:var(--text-tertiary)"></i></div>
        <p>Page introuvable</p>
        <a href="#/" class="btn btn-primary">Retour aux fiches</a>
      </div>
    `;
  },

  init() {
    window.addEventListener('hashchange', () => this.navigate(location.hash));
    this.navigate(location.hash || '#/');
  }
};
