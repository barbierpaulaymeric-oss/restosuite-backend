// ═══════════════════════════════════════════
// Admin Dashboard — Vue plateforme PA
// Stats globales + suivi d'activité des restaurateurs
// (réutilise isAdminUser / getStoredAccount définis dans admin.js)
// ═══════════════════════════════════════════

class AdminDashboardView {
  async render() {
    const account = getStoredAccount();
    if (!isAdminUser(account)) {
      document.getElementById('app').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="shield-off"></i></div>
          <p>Accès refusé.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1><i data-lucide="shield" style="width:22px;height:22px;vertical-align:-4px;margin-right:8px"></i>Dashboard Admin</h1>
          <p class="text-secondary">Vue globale de la plateforme — tous les restaurateurs inscrits</p>
        </div>
        <button class="btn btn-secondary" id="admin-export-csv" style="flex-shrink:0">
          <i data-lucide="download"></i> Exporter CSV
        </button>
      </div>

      <div id="admin-stats-row" class="kpi-grid" style="margin-bottom:2rem">
        <div class="loading-spinner" style="grid-column:1/-1"></div>
      </div>

      <div class="card" style="margin-bottom:2rem">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding:1rem 1.25rem">
          <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
            <h2 style="margin:0;font-size:1rem">Restaurateurs</h2>
            <div id="admin-activity-legend" style="display:flex;align-items:center;gap:.75rem;font-size:.72rem;color:var(--text-secondary)">
              <span style="display:inline-flex;align-items:center;gap:.3rem"><span class="admin-dot" style="background:#22c55e"></span> Actif</span>
              <span style="display:inline-flex;align-items:center;gap:.3rem"><span class="admin-dot" style="background:#f59e0b"></span> Inactif &gt; 14j</span>
              <span style="display:inline-flex;align-items:center;gap:.3rem"><span class="admin-dot" style="background:#ef4444"></span> Jamais reconnecté</span>
            </div>
          </div>
          <input type="text" id="admin-search" placeholder="Rechercher…" class="input" style="max-width:220px;padding:.35rem .75rem;font-size:.875rem" data-ui="custom">
        </div>
        <div id="admin-users-table">
          <div class="loading-spinner" style="padding:2rem"></div>
        </div>
      </div>
    `;

    // Style local pour les pastilles d'activité (injecté une seule fois)
    if (!document.getElementById('admin-dashboard-styles')) {
      const style = document.createElement('style');
      style.id = 'admin-dashboard-styles';
      style.textContent = `
        .admin-dot{display:inline-block;width:9px;height:9px;border-radius:999px;flex-shrink:0}
        .admin-activity{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;font-size:.8rem}
        .admin-activity-label{font-weight:600}
      `;
      document.head.appendChild(style);
    }

    if (window.lucide) lucide.createIcons();

    const token = localStorage.getItem('restosuite_token');
    const headers = { 'Authorization': 'Bearer ' + token };

    let statsRes, usersRes;
    try {
      [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
      ]);
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><p>Erreur de chargement : ${escapeHtml(e.message)}</p></div>`;
      return;
    }

    if (!statsRes.ok || !usersRes.ok) {
      app.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle"></i></div><p>Accès refusé ou erreur serveur.</p></div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const { totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth } = await statsRes.json();
    const { users } = await usersRes.json();

    // Tri par date d'inscription décroissante (sécurité — l'API trie déjà ainsi)
    const sorted = (users || []).slice().sort((a, b) =>
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );

    this._renderStats({ totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth }, sorted);
    this._allUsers = sorted;
    this._buildTable(sorted, document.getElementById('admin-users-table'));

    document.getElementById('admin-export-csv').addEventListener('click', () => this._exportCSV(sorted));
    document.getElementById('admin-search').addEventListener('input', (e) => {
      this._filterTable(sorted, e.target.value.trim().toLowerCase());
    });

    if (window.lucide) lucide.createIcons();
  }

  // ─── Calcul d'activité ──────────────────────────────
  _daysSince(dt) {
    if (!dt) return null;
    const then = new Date(dt).getTime();
    if (isNaN(then)) return null;
    return Math.floor((Date.now() - then) / 86400000);
  }

  // Renvoie { color, label, days } décrivant l'état d'activité d'un compte
  _activity(user) {
    const days = this._daysSince(user.last_login);
    if (days === null) {
      return { color: '#ef4444', label: 'Jamais reconnecté', days: null };
    }
    let color = '#22c55e';
    if (days > 14) color = '#f59e0b';
    if (days > 60) color = '#ef4444';

    let label;
    if (days === 0) label = "Aujourd'hui";
    else if (days === 1) label = 'Hier';
    else label = `Il y a ${days} j`;

    return { color, label, days };
  }

  _renderStats({ totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth }, users) {
    const planColors = { free: '#94a3b8', pro: '#E8722A' };

    const planBadges = (byPlan || []).map(p => {
      const c = planColors[p.plan] || '#94a3b8';
      return `<span style="display:inline-flex;align-items:center;gap:.35rem;background:${c}22;color:${c};border:1px solid ${c}44;padding:.2rem .6rem;border-radius:999px;font-size:.75rem;font-weight:600">${escapeHtml(p.plan)} <strong>${p.count}</strong></span>`;
    }).join(' ');

    // Compteurs d'activité dérivés de la liste
    const neverReconnected = users.filter(u => this._daysSince(u.last_login) === null).length;

    document.getElementById('admin-stats-row').innerHTML = `
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="users"></i></div>
        <div class="kpi-value">${totalUsers}</div>
        <div class="kpi-label">Restaurateurs inscrits</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="calendar"></i></div>
        <div class="kpi-value">${thisWeek}</div>
        <div class="kpi-label">Nouveaux cette semaine</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="trending-up"></i></div>
        <div class="kpi-value">${thisMonth}</div>
        <div class="kpi-label">Nouveaux ce mois</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="store"></i></div>
        <div class="kpi-value">${totalRestaurants}</div>
        <div class="kpi-label">Restaurants</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="color:#ef4444"><i data-lucide="user-x"></i></div>
        <div class="kpi-value" style="${neverReconnected ? 'color:#ef4444' : ''}">${neverReconnected}</div>
        <div class="kpi-label">Jamais reconnectés</div>
      </div>
      <div class="kpi-card" style="grid-column:1/-1">
        <div class="kpi-label" style="margin-bottom:.5rem">Répartition par plan</div>
        <div style="display:flex;flex-wrap:wrap;gap:.5rem">${planBadges || '<span class="text-secondary">—</span>'}</div>
      </div>
    `;
  }

  _filterTable(users, query) {
    const filtered = query
      ? users.filter(u =>
          (u.email || '').toLowerCase().includes(query) ||
          (u.name || '').toLowerCase().includes(query) ||
          (u.restaurant_name || '').toLowerCase().includes(query) ||
          (u.plan || '').toLowerCase().includes(query)
        )
      : users;
    this._buildTable(filtered, document.getElementById('admin-users-table'));
    if (window.lucide) lucide.createIcons();
  }

  _buildTable(users, container) {
    if (!users.length) {
      container.innerHTML = `<div class="empty-state" style="padding:2rem"><p>Aucun résultat.</p></div>`;
      return;
    }

    const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
    const fmtFull = (dt) => dt ? new Date(dt).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' }) : '—';

    const planBadge = (plan) => {
      const colors = { free: '#94a3b8', pro: '#E8722A' };
      const c = colors[plan] || '#94a3b8';
      return `<span style="background:${c}22;color:${c};border:1px solid ${c}44;padding:.15rem .5rem;border-radius:999px;font-size:.75rem;font-weight:600;white-space:nowrap">${escapeHtml(plan || 'free')}</span>`;
    };

    const rows = users.map(u => {
      const act = this._activity(u);
      const activityCell = `
        <span class="admin-activity" title="Dernière connexion : ${fmtFull(u.last_login)}">
          <span class="admin-dot" style="background:${act.color}"></span>
          <span class="admin-activity-label" style="color:${act.color}">${act.label}</span>
        </span>`;
      return `
      <tr>
        <td style="font-size:.85rem">${escapeHtml(u.name || '—')}</td>
        <td style="font-size:.85rem">${escapeHtml(u.email || '—')}</td>
        <td style="font-size:.85rem">${escapeHtml(u.restaurant_name || '—')}</td>
        <td>${planBadge(u.plan)}</td>
        <td style="font-size:.8rem;white-space:nowrap">${fmt(u.created_at)}</td>
        <td style="font-size:.8rem;white-space:nowrap">${fmt(u.last_login)}</td>
        <td>${activityCell}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Restaurant</th>
              <th>Plan</th>
              <th>Inscription</th>
              <th>Dernière connexion</th>
              <th>Activité</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:.75rem 1.25rem;font-size:.8rem;color:var(--text-secondary)">${users.length} restaurateur(s)</div>
    `;
  }

  _exportCSV(users) {
    const headers = ['nom', 'email', 'restaurant', 'plan', 'inscription', 'derniere_connexion', 'jours_depuis_connexion'];
    const rows = users.map(u => {
      const days = this._daysSince(u.last_login);
      return [
        u.name || '',
        u.email || '',
        u.restaurant_name || '',
        u.plan || 'free',
        u.created_at || '',
        u.last_login || '',
        days === null ? 'jamais' : days,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restosuite-restaurateurs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function renderAdminDashboard() {
  new AdminDashboardView().render();
}
