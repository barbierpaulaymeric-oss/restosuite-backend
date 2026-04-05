// ═══════════════════════════════════════════
// SPA Router — Hash-based with role-based access control
// ═══════════════════════════════════════════

// Role access matrix for each route
const ROUTE_ROLES = {
  '/': ['gerant', 'cuisinier', 'equipier'],
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
  '/suppliers': ['gerant'],
  '/analytics': ['gerant'],
  '/team': ['gerant'],
  '/service': ['gerant', 'salle'],
  '/kitchen': ['gerant', 'cuisinier'],
  '/more': ['gerant', 'cuisinier', 'equipier'],
  '/subscribe': ['gerant'],
  '/supplier-portal': ['gerant'],
  '/scan-invoice': ['gerant'],
  '/mercuriale': ['gerant'],
  '/qrcodes': ['gerant'],
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

  // Default: deny access
  return false;
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
      return;
    }

    // Clean up service view if leaving it
    if (typeof _svcCleanup === 'function' && !path.startsWith('/service')) {
      _svcCleanup();
    }

    // Close any open modals on route change
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
      const route = link.dataset.route;
      const isActive = route === path ||
        (route !== '/' && path.startsWith(route)) ||
        (route === '/haccp' && path.startsWith('/haccp')) ||
        (route === '/stock' && path.startsWith('/stock')) ||
        (route === '/orders' && path.startsWith('/orders'));
      if (isActive) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Match route
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        route.handler(...match.slice(1));
        return;
      }
    }

    // 404 fallback
    document.getElementById('app').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤷</div>
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
