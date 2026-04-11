// ═══════════════════════════════════════════
// Multi-Sites — Gestion multi-établissements
// ═══════════════════════════════════════════

async function renderMultiSite() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="building-2" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Multi-Sites
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Gérez tous vos établissements depuis un seul tableau de bord</p>
    </div>
    <div id="multisite-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadMultiSite();
}

async function loadMultiSite() {
  const content = document.getElementById('multisite-content');
  try {
    const [sites, comparison] = await Promise.all([
      API.request('/sites'),
      API.request('/sites/compare/all?days=30')
    ]);
    renderMultiSiteContent(sites, comparison);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function renderMultiSiteContent(sites, comparison) {
  const content = document.getElementById('multisite-content');
  const compMap = {};
  for (const s of comparison.sites) compMap[s.id] = s;

  content.innerHTML = `
    <!-- Comparaison -->
    ${comparison.sites.length > 1 ? `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Comparaison des sites (30 jours)</h3>
      <div style="overflow-x:auto">
        <table class="table" style="font-size:var(--text-sm)">
          <thead>
            <tr>
              <th>Site</th>
              <th style="text-align:right">Chiffre d'affaires</th>
              <th style="text-align:right">Commandes</th>
              <th style="text-align:right">Ticket moyen</th>
              <th style="text-align:right">Équipe</th>
              <th style="text-align:right">Tables</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.sites.map(s => `
              <tr>
                <td style="font-weight:600">${escapeHtml(s.name)}</td>
                <td style="text-align:right">${s.revenue.toFixed(0)} €</td>
                <td style="text-align:right">${s.orders}</td>
                <td style="text-align:right">${s.avg_ticket.toFixed(2)} €</td>
                <td style="text-align:right">${s.staff}</td>
                <td style="text-align:right">${s.tables}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Sites list -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <h3>${sites.length} établissement${sites.length > 1 ? 's' : ''}</h3>
      <button class="btn btn-primary btn-sm" onclick="showAddSiteModal()">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Ajouter un site
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-3)">
      ${sites.map(site => {
        const comp = compMap[site.id] || {};
        return `
        <div class="card" style="padding:var(--space-4)">
          <div style="display:flex;align-items:start;gap:var(--space-3)">
            <div style="width:48px;height:48px;border-radius:12px;background:var(--color-accent);display:flex;align-items:center;justify-content:center;color:white;font-size:1.2rem;font-weight:700;flex-shrink:0">
              ${(site.name || 'R').charAt(0).toUpperCase()}
            </div>
            <div style="flex:1">
              <h3 style="margin:0">${escapeHtml(site.name || 'Mon restaurant')}</h3>
              <p class="text-secondary text-sm" style="margin:2px 0 0">${escapeHtml(site.address || '')} ${escapeHtml(site.city || '')}</p>
              ${site.phone ? `<p class="text-secondary" style="font-size:10px">${escapeHtml(site.phone)}</p>` : ''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-light)">
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.table_count || 0}</div>
              <div class="text-secondary text-sm">Tables</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.staff_count || 0}</div>
              <div class="text-secondary text-sm">Équipe</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.covers || 0}</div>
              <div class="text-secondary text-sm">Couverts</div>
            </div>
          </div>
          ${comp.revenue > 0 ? `
          <div style="margin-top:var(--space-2);padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md);font-size:var(--text-xs);text-align:center">
            <span style="font-weight:600">${comp.revenue.toFixed(0)} €</span> CA 30j
            · <span style="font-weight:600">${comp.orders}</span> commandes
            · Ticket moy. <span style="font-weight:600">${comp.avg_ticket.toFixed(2)} €</span>
          </div>
          ` : ''}
          <div style="margin-top:var(--space-3);display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="editSite(${site.id})">Modifier</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function showAddSiteModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h2>Nouvel établissement</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom *</label>
          <input type="text" class="input" id="site-name" placeholder="Nom du restaurant">
        </div>
        <div class="form-group">
          <label class="label">Type</label>
          <select class="input" id="site-type">
            <option value="restaurant">Restaurant</option>
            <option value="brasserie">Brasserie</option>
            <option value="bistrot">Bistrot</option>
            <option value="gastronomique">Gastronomique</option>
            <option value="fast-casual">Fast Casual</option>
            <option value="traiteur">Traiteur</option>
            <option value="dark-kitchen">Dark Kitchen</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Adresse</label>
          <input type="text" class="input" id="site-address" placeholder="Adresse">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Ville</label>
            <input type="text" class="input" id="site-city" placeholder="Ville">
          </div>
          <div class="form-group">
            <label class="label">Code postal</label>
            <input type="text" class="input" id="site-postal" placeholder="75001">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Téléphone</label>
            <input type="tel" class="input" id="site-phone" placeholder="01 23 45 67 89">
          </div>
          <div class="form-group">
            <label class="label">Couverts</label>
            <input type="number" class="input" id="site-covers" value="30" min="1">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveSite()">Créer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('site-name').focus();
}

async function saveSite() {
  const name = document.getElementById('site-name').value.trim();
  if (!name) return showToast('Nom requis', 'error');

  try {
    await API.request('/sites', {
      method: 'POST',
      body: {
        name,
        type: document.getElementById('site-type').value,
        address: document.getElementById('site-address').value || null,
        city: document.getElementById('site-city').value || null,
        postal_code: document.getElementById('site-postal').value || null,
        phone: document.getElementById('site-phone').value || null,
        covers: parseInt(document.getElementById('site-covers').value) || 30
      }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Établissement créé', 'success');
    loadMultiSite();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function editSite(id) {
  try {
    const site = await API.request(`/sites/${id}`);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h2>Modifier ${escapeHtml(site.name)}</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="label">Nom</label>
            <input type="text" class="input" id="edit-site-name" value="${escapeHtml(site.name || '')}">
          </div>
          <div class="form-group">
            <label class="label">Adresse</label>
            <input type="text" class="input" id="edit-site-address" value="${escapeHtml(site.address || '')}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
            <div class="form-group">
              <label class="label">Ville</label>
              <input type="text" class="input" id="edit-site-city" value="${escapeHtml(site.city || '')}">
            </div>
            <div class="form-group">
              <label class="label">Téléphone</label>
              <input type="tel" class="input" id="edit-site-phone" value="${escapeHtml(site.phone || '')}">
            </div>
          </div>
          <div class="form-group">
            <label class="label">Couverts</label>
            <input type="number" class="input" id="edit-site-covers" value="${site.covers || 30}">
          </div>
          <div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
            <p class="text-secondary text-sm"><strong>${site.table_count || 0}</strong> tables · <strong>${site.staff_count || 0}</strong> membres d'équipe</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
          <button class="btn btn-primary" onclick="updateSite(${id})">Enregistrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function updateSite(id) {
  try {
    await API.request(`/sites/${id}`, {
      method: 'PUT',
      body: {
        name: document.getElementById('edit-site-name').value,
        address: document.getElementById('edit-site-address').value || null,
        city: document.getElementById('edit-site-city').value || null,
        phone: document.getElementById('edit-site-phone').value || null,
        covers: parseInt(document.getElementById('edit-site-covers').value) || 30
      }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Site mis à jour', 'success');
    loadMultiSite();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
