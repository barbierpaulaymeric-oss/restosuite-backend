// ═══════════════════════════════════════════
// Admin Dashboard — Vue PA
// ═══════════════════════════════════════════

const ADMIN_EMAILS_CLIENT = ['barbierpaulaymeric@gmail.com'];

function isAdminUser(account) {
  if (!account) return false;
  return ADMIN_EMAILS_CLIENT.includes((account.email || '').toLowerCase());
}

function getStoredAccount() {
  try {
    return JSON.parse(localStorage.getItem('restosuite_account') || 'null');
  } catch { return null; }
}

class AdminView {
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
          <p class="text-secondary">Vue globale de tous les comptes RestoSuite</p>
        </div>
        <button class="btn btn-secondary" id="admin-export-csv" style="flex-shrink:0">
          <i data-lucide="download"></i> Exporter CSV
        </button>
      </div>

      <div id="admin-stats-row" class="kpi-grid" style="margin-bottom:2rem">
        <div class="loading-spinner" style="grid-column:1/-1"></div>
      </div>

      <div class="card" style="margin-bottom:2rem">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem">
          <h2 style="margin:0;font-size:1rem">Comptes clients</h2>
          <input type="text" id="admin-search" placeholder="Rechercher…" class="input" style="max-width:220px;padding:.35rem .75rem;font-size:.875rem">
        </div>
        <div id="admin-users-table">
          <div class="loading-spinner" style="padding:2rem"></div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    const token = localStorage.getItem('restosuite_token');
    const headers = { 'Authorization': 'Bearer ' + token };

    // Load stats + users in parallel
    const [statsRes, usersRes] = await Promise.all([
      fetch('/api/admin/stats', { headers }),
      fetch('/api/admin/users', { headers }),
    ]).catch(e => {
      app.innerHTML = `<div class="empty-state"><p>Erreur de chargement : ${escapeHtml(e.message)}</p></div>`;
      return [null, null];
    });

    if (!statsRes || !usersRes) return;

    if (!statsRes.ok || !usersRes.ok) {
      app.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle"></i></div><p>Accès refusé ou erreur serveur.</p></div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const { totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth } = await statsRes.json();
    const { users } = await usersRes.json();

    this._renderStats({ totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth });
    this._renderTable(users);

    document.getElementById('admin-export-csv').addEventListener('click', () => this._exportCSV(users));
    document.getElementById('admin-search').addEventListener('input', (e) => {
      this._filterTable(users, e.target.value.trim().toLowerCase());
    });

    if (window.lucide) lucide.createIcons();
  }

  _renderStats({ totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth }) {
    const planColors = {
      discovery: '#94a3b8',
      essential: '#60a5fa',
      professional: '#E8722A',
      premium: '#a78bfa',
      enterprise: '#f59e0b',
    };

    const planBadges = (byPlan || []).map(p =>
      `<span style="display:inline-flex;align-items:center;gap:.35rem;background:${planColors[p.plan] || '#94a3b8'}22;color:${planColors[p.plan] || '#94a3b8'};border:1px solid ${planColors[p.plan] || '#94a3b8'}44;padding:.2rem .6rem;border-radius:999px;font-size:.75rem;font-weight:600">${escapeHtml(p.plan)} <strong>${p.count}</strong></span>`
    ).join(' ');

    document.getElementById('admin-stats-row').innerHTML = `
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="users"></i></div>
        <div class="kpi-value">${totalUsers}</div>
        <div class="kpi-label">Comptes inscrits</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="store"></i></div>
        <div class="kpi-value">${totalRestaurants}</div>
        <div class="kpi-label">Restaurants</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="calendar"></i></div>
        <div class="kpi-value">${thisWeek}</div>
        <div class="kpi-label">Inscrits cette semaine</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><i data-lucide="trending-up"></i></div>
        <div class="kpi-value">${thisMonth}</div>
        <div class="kpi-label">Inscrits ce mois</div>
      </div>
      <div class="kpi-card" style="grid-column:1/-1">
        <div class="kpi-label" style="margin-bottom:.5rem">Répartition par plan</div>
        <div style="display:flex;flex-wrap:wrap;gap:.5rem">${planBadges || '<span class="text-secondary">—</span>'}</div>
      </div>
    `;
  }

  _renderTable(users) {
    this._allUsers = users;
    this._buildTable(users, document.getElementById('admin-users-table'));
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
      const colors = { discovery:'#94a3b8', essential:'#60a5fa', professional:'#E8722A', premium:'#a78bfa', enterprise:'#f59e0b' };
      const c = colors[plan] || '#94a3b8';
      return `<span style="background:${c}22;color:${c};border:1px solid ${c}44;padding:.15rem .5rem;border-radius:999px;font-size:.75rem;font-weight:600;white-space:nowrap">${escapeHtml(plan || 'discovery')}</span>`;
    };

    const rows = users.map(u => `
      <tr>
        <td style="font-size:.85rem">${escapeHtml(u.email || '—')}</td>
        <td style="font-size:.85rem">${escapeHtml(u.name || '—')}</td>
        <td style="font-size:.85rem">${escapeHtml(u.restaurant_name || '—')}</td>
        <td>${planBadge(u.plan)}</td>
        <td style="font-size:.8rem;white-space:nowrap">${fmt(u.created_at)}</td>
        <td style="font-size:.8rem;white-space:nowrap" title="${fmtFull(u.last_login)}">${fmt(u.last_login)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nom</th>
              <th>Restaurant</th>
              <th>Plan</th>
              <th>Inscription</th>
              <th>Dernière connexion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:.75rem 1.25rem;font-size:.8rem;color:var(--text-secondary)">${users.length} compte(s)</div>
    `;
  }

  _exportCSV(users) {
    const headers = ['email', 'nom', 'restaurant', 'plan', 'inscription', 'dernière_connexion'];
    const rows = users.map(u => [
      u.email || '',
      u.name || '',
      u.restaurant_name || '',
      u.plan || 'discovery',
      u.created_at || '',
      u.last_login || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restosuite-clients-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function renderAdmin() {
  new AdminView().render();
}
