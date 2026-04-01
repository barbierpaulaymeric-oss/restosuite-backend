// ═══════════════════════════════════════════
// SPA Router — Hash-based
// ═══════════════════════════════════════════

const Router = {
  routes: [],

  add(pattern, handler) {
    this.routes.push({ pattern, handler });
  },

  navigate(hash) {
    const path = hash.replace('#', '') || '/';

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
      const route = link.dataset.route;
      const isActive = route === path || 
        (route !== '/' && path.startsWith(route)) ||
        (route === '/haccp' && path.startsWith('/haccp')) ||
        (route === '/stock' && path.startsWith('/stock'));
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
