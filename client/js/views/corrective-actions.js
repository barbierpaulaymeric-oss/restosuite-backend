// ═══════════════════════════════════════════
// Actions correctives — Route #/haccp/corrective-actions
// ═══════════════════════════════════════════

const CA_CATEGORY_LABELS = {
  temperature: 'Température',
  cleaning: 'Nettoyage',
  reception: 'Réception',
  storage: 'Stockage',
  preparation: 'Préparation',
  service: 'Service',
};

const CA_CATEGORY_COLORS = {
  temperature: '#e3821b',
  cleaning:    '#3b82f6',
  reception:   '#8b5cf6',
  storage:     '#06b6d4',
  preparation: '#10b981',
  service:     '#f43f5e',
};

const CA_STATUS_LABELS = {
  en_cours: 'En cours',
  'terminé': 'Terminé',
  'escaladé': 'Escaladé',
};

const CA_STATUS_COLORS = {
  en_cours:  'var(--color-warning)',
  'terminé': 'var(--color-success)',
  'escaladé':'var(--color-danger)',
};

function caStatusBadge(status) {
  const color = CA_STATUS_COLORS[status] || 'var(--color-text-muted)';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;background:${color}20;color:${color};border:1px solid ${color}40">${CA_STATUS_LABELS[status] || status}</span>`;
}

function caCategoryBadge(cat) {
  const color = CA_CATEGORY_COLORS[cat] || 'var(--color-text-muted)';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.72rem;font-weight:600;background:${color}18;color:${color};border:1px solid ${color}30">${CA_CATEGORY_LABELS[cat] || cat}</span>`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch (e) { return d; }
}

async function renderCorrectiveActions() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [logResp, statsResp, tplResp] = await Promise.all([
      API.request('/corrective-actions/log'),
      API.request('/corrective-actions/stats'),
      API.request('/corrective-actions/templates'),
    ]);

    const logItems = logResp.items || [];
    const stats    = statsResp || {};
    const templates = tplResp.items || [];

    // KPI helpers
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth  = logItems.filter(i => i.created_at >= monthStart).length;

    let activeTab = 'log';

    function renderView() {
      app.innerHTML = `
        <div class="haccp-page">
          <div class="page-header">
            <h1><i data-lucide="shield-alert" style="width:22px;height:22px;vertical-align:middle;margin-right:8px;color:var(--color-danger)"></i>Actions correctives</h1>
            <button class="btn btn-primary" id="btn-new-ca">
              <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle action
            </button>
          </div>

          ${haccpBreadcrumb('hygiene')}

          <!-- KPI bar -->
          <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:20px">
            <div class="kpi-card ${stats.total_en_cours > 0 ? 'kpi-card--danger' : 'kpi-card--success'}">
              <div class="kpi-value">${stats.total_en_cours || 0}</div>
              <div class="kpi-label">En cours</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${thisMonth}</div>
              <div class="kpi-label">Ce mois</div>
            </div>
            <div class="kpi-card kpi-card--success">
              <div class="kpi-value">${stats.total_termine || 0}</div>
              <div class="kpi-label">Terminées</div>
            </div>
            <div class="kpi-card ${stats.total_escalade > 0 ? 'kpi-card--danger' : ''}">
              <div class="kpi-value">${stats.total_escalade || 0}</div>
              <div class="kpi-label">Escaladées</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${stats.avg_resolution_hours != null ? stats.avg_resolution_hours + 'h' : '—'}</div>
              <div class="kpi-label">Délai moyen</div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="tabs" style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--color-border)">
            <button class="tab-btn ${activeTab === 'log' ? 'tab-btn--active' : ''}" data-tab="log" style="padding:8px 18px;background:none;border:none;cursor:pointer;font-weight:${activeTab==='log'?'700':'400'};color:${activeTab==='log'?'var(--color-accent)':'var(--color-text-muted)'};border-bottom:2px solid ${activeTab==='log'?'var(--color-accent)':'transparent'};margin-bottom:-2px">
              <i data-lucide="clipboard-list" style="width:16px;height:16px;vertical-align:middle;margin-right:6px"></i>Journal des actions
            </button>
            <button class="tab-btn ${activeTab === 'templates' ? 'tab-btn--active' : ''}" data-tab="templates" style="padding:8px 18px;background:none;border:none;cursor:pointer;font-weight:${activeTab==='templates'?'700':'400'};color:${activeTab==='templates'?'var(--color-accent)':'var(--color-text-muted)'};border-bottom:2px solid ${activeTab==='templates'?'var(--color-accent)':'transparent'};margin-bottom:-2px">
              <i data-lucide="library" style="width:16px;height:16px;vertical-align:middle;margin-right:6px"></i>Modèles d'actions
            </button>
          </div>

          <div id="ca-tab-content"></div>
        </div>
      `;

      if (window.lucide) lucide.createIcons({ nodes: [app] });

      renderTabContent();
      setupTabEvents();
      setupNewActionButton();
    }

    function renderTabContent() {
      const container = document.getElementById('ca-tab-content');
      if (activeTab === 'log') {
        renderLogTab(container);
      } else {
        renderTemplatesTab(container);
      }
    }

    function renderLogTab(container) {
      // current filter state
      const catFilter    = container ? (container.dataset.catFilter || '') : '';
      const statusFilter = container ? (container.dataset.statusFilter || '') : '';

      let filtered = logItems;
      if (catFilter)    filtered = filtered.filter(i => i.category === catFilter);
      if (statusFilter) filtered = filtered.filter(i => i.status === statusFilter);

      const catOptions = ['', ...Object.keys(CA_CATEGORY_LABELS)].map(c =>
        `<option value="${c}" ${catFilter === c ? 'selected' : ''}>${c ? CA_CATEGORY_LABELS[c] : 'Toutes catégories'}</option>`
      ).join('');

      const statusOptions = ['', 'en_cours', 'terminé', 'escaladé'].map(s =>
        `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s ? CA_STATUS_LABELS[s] : 'Tous statuts'}</option>`
      ).join('');

      container.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
          <select id="ca-filter-cat" class="form-control" style="min-width:160px">${catOptions}</select>
          <select id="ca-filter-status" class="form-control" style="min-width:140px">${statusOptions}</select>
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <i data-lucide="check-circle-2" style="width:40px;height:40px;color:var(--color-success);margin-bottom:8px"></i>
            <p>Aucune action corrective enregistrée</p>
          </div>
        ` : `
          <div class="table-container">
            <table>
              <thead><tr>
                <th>Date</th>
                <th>Catégorie</th>
                <th>Déclencheur</th>
                <th>Responsable</th>
                <th>Statut</th>
                <th></th>
              </tr></thead>
              <tbody>
                ${filtered.map(item => `
                  <tr style="cursor:pointer" class="ca-log-row" data-id="${item.id}">
                    <td style="white-space:nowrap">${fmtDate(item.created_at)}</td>
                    <td>${caCategoryBadge(item.category)}</td>
                    <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(item.trigger_description || '')}">${escapeHtml(item.trigger_description || '—')}</td>
                    <td>${escapeHtml(item.responsible_person || '—')}</td>
                    <td>${caStatusBadge(item.status)}</td>
                    <td style="text-align:right;white-space:nowrap">
                      ${item.status === 'en_cours' ? `
                        <button class="btn btn-sm btn-success ca-complete-btn" data-id="${item.id}" style="margin-right:4px">
                          <i data-lucide="check" style="width:14px;height:14px"></i> Terminer
                        </button>
                        <button class="btn btn-sm btn-danger ca-escalate-btn" data-id="${item.id}">
                          <i data-lucide="alert-triangle" style="width:14px;height:14px"></i> Escalader
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      `;

      if (window.lucide) lucide.createIcons({ nodes: [container] });

      // Filters
      document.getElementById('ca-filter-cat')?.addEventListener('change', (e) => {
        container.dataset.catFilter = e.target.value;
        renderLogTab(container);
      });
      document.getElementById('ca-filter-status')?.addEventListener('change', (e) => {
        container.dataset.statusFilter = e.target.value;
        renderLogTab(container);
      });

      // Row click → edit modal
      container.querySelectorAll('.ca-log-row').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.ca-complete-btn') || e.target.closest('.ca-escalate-btn')) return;
          const id = parseInt(row.dataset.id, 10);
          const item = logItems.find(i => i.id === id);
          if (item) showEditLogModal(item);
        });
      });

      // Complete buttons
      container.querySelectorAll('.ca-complete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = parseInt(btn.dataset.id, 10);
          try {
            await API.request(`/corrective-actions/log/${id}`, {
              method: 'PUT',
              body: { status: 'terminé', completed_at: new Date().toISOString() },
            });
            await refreshData();
          } catch (err) {
            showToast('Erreur lors de la mise à jour', 'error');
          }
        });
      });

      // Escalate buttons
      container.querySelectorAll('.ca-escalate-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = parseInt(btn.dataset.id, 10);
          try {
            await API.request(`/corrective-actions/log/${id}`, {
              method: 'PUT',
              body: { status: 'escaladé' },
            });
            await refreshData();
          } catch (err) {
            showToast('Erreur lors de la mise à jour', 'error');
          }
        });
      });
    }

    function renderTemplatesTab(container) {
      // Group by category
      const grouped = {};
      templates.forEach(t => {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
      });

      container.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button class="btn btn-primary" id="btn-new-template">
            <i data-lucide="plus" style="width:16px;height:16px"></i> Nouveau modèle
          </button>
        </div>

        ${Object.keys(CA_CATEGORY_LABELS).map(cat => {
          const items = grouped[cat] || [];
          if (items.length === 0) return '';
          return `
            <div style="margin-bottom:20px">
              <h3 style="display:flex;align-items:center;gap:8px;margin-bottom:10px;color:${CA_CATEGORY_COLORS[cat]}">
                <i data-lucide="tag" style="width:16px;height:16px"></i>
                ${CA_CATEGORY_LABELS[cat]}
                <span style="font-size:0.75rem;font-weight:400;color:var(--color-text-muted)">${items.length} modèle${items.length > 1 ? 's' : ''}</span>
              </h3>
              <div style="display:grid;gap:8px">
                ${items.map(t => `
                  <div class="card" style="padding:12px 16px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start">
                    <div>
                      <div style="font-weight:600;margin-bottom:4px">${escapeHtml(t.trigger_condition || '—')}</div>
                      <div style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:4px">${escapeHtml(t.action_description || '—')}</div>
                      <div style="display:flex;gap:12px;font-size:0.78rem;color:var(--color-text-muted)">
                        ${t.deadline_hours != null ? `<span><i data-lucide="clock" style="width:12px;height:12px;vertical-align:middle"></i> ${t.deadline_hours === 0 ? 'Immédiat' : t.deadline_hours + 'h max'}</span>` : ''}
                        ${t.responsible_role ? `<span><i data-lucide="user" style="width:12px;height:12px;vertical-align:middle"></i> ${escapeHtml(t.responsible_role)}</span>` : ''}
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0">
                      <button class="btn btn-sm btn-outline ca-edit-tpl-btn" data-id="${t.id}" title="Modifier">
                        <i data-lucide="pencil" style="width:14px;height:14px"></i>
                      </button>
                      <button class="btn btn-sm btn-outline ca-toggle-tpl-btn" data-id="${t.id}" data-active="${t.is_active}" title="${t.is_active ? 'Désactiver' : 'Activer'}">
                        <i data-lucide="${t.is_active ? 'eye-off' : 'eye'}" style="width:14px;height:14px"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        ${templates.length === 0 ? `
          <div class="empty-state">
            <i data-lucide="clipboard" style="width:40px;height:40px;color:var(--color-text-muted);margin-bottom:8px"></i>
            <p>Aucun modèle d'action corrective</p>
          </div>
        ` : ''}
      `;

      if (window.lucide) lucide.createIcons({ nodes: [container] });

      // New template
      document.getElementById('btn-new-template')?.addEventListener('click', () => showTemplateModal());

      // Edit template
      container.querySelectorAll('.ca-edit-tpl-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id, 10);
          const tpl = templates.find(t => t.id === id);
          if (tpl) showTemplateModal(tpl);
        });
      });

      // Toggle active
      container.querySelectorAll('.ca-toggle-tpl-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.dataset.id, 10);
          const isActive = btn.dataset.active === '1';
          try {
            await API.request(`/corrective-actions/templates/${id}`, {
              method: 'PUT',
              body: { is_active: isActive ? 0 : 1 },
            });
            await refreshData();
          } catch (err) {
            showToast('Erreur lors de la mise à jour', 'error');
          }
        });
      });
    }

    function setupTabEvents() {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.tab;
          renderView();
        });
      });
    }

    function setupNewActionButton() {
      document.getElementById('btn-new-ca')?.addEventListener('click', () => showNewLogModal());
    }

    async function refreshData() {
      const [logResp2, statsResp2, tplResp2] = await Promise.all([
        API.request('/corrective-actions/log'),
        API.request('/corrective-actions/stats'),
        API.request('/corrective-actions/templates'),
      ]);
      logItems.length = 0; logItems.push(...(logResp2.items || []));
      Object.assign(stats, statsResp2 || {});
      templates.length = 0; templates.push(...(tplResp2.items || []));
      renderView();
    }

    // ── Modal: New log entry ──
    function showNewLogModal() {
      const tplOptions = templates.map(t =>
        `<option value="${t.id}" data-category="${t.category}" data-trigger="${escapeHtml(t.trigger_condition || '')}" data-action="${escapeHtml(t.action_description || '')}">${CA_CATEGORY_LABELS[t.category] || t.category} — ${escapeHtml(t.trigger_condition || 'Sans titre')}</option>`
      ).join('');

      const catOptions = Object.entries(CA_CATEGORY_LABELS).map(([v, l]) =>
        `<option value="${v}">${l}</option>`
      ).join('');

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <h2><i data-lucide="shield-alert" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"></i>Nouvelle action corrective</h2>
            <button class="modal-close" id="ca-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Modèle (optionnel)</label>
              <select id="ca-tpl-select" class="form-control">
                <option value="">— Saisie libre —</option>
                ${tplOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Catégorie <span style="color:var(--color-danger)">*</span></label>
              <select id="ca-category" class="form-control">
                ${catOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Déclencheur (description du problème)</label>
              <input type="text" id="ca-trigger" class="form-control" placeholder="Ex: Température chambre froide à 6°C à 8h30">
            </div>
            <div class="form-group">
              <label>Action prise</label>
              <textarea id="ca-action" class="form-control" rows="3" placeholder="Décrivez l'action corrective mise en place"></textarea>
            </div>
            <div class="form-group">
              <label>Responsable</label>
              <input type="text" id="ca-responsible" class="form-control" placeholder="Nom ou poste">
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea id="ca-notes" class="form-control" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="ca-modal-cancel">Annuler</button>
            <button class="btn btn-primary" id="ca-modal-save">
              <i data-lucide="save" style="width:16px;height:16px"></i> Enregistrer
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons({ nodes: [overlay] });

      // Template auto-fill
      document.getElementById('ca-tpl-select').addEventListener('change', function () {
        const opt = this.options[this.selectedIndex];
        if (this.value) {
          document.getElementById('ca-category').value = opt.dataset.category || '';
          document.getElementById('ca-trigger').value  = opt.dataset.trigger  || '';
          document.getElementById('ca-action').value   = opt.dataset.action   || '';
        }
      });

      overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
      document.getElementById('ca-modal-cancel').addEventListener('click', () => overlay.remove());

      document.getElementById('ca-modal-save').addEventListener('click', async () => {
        const category = document.getElementById('ca-category').value;
        if (!category) { showToast('Catégorie requise', 'error'); return; }
        const template_id = document.getElementById('ca-tpl-select').value || null;
        const payload = {
          template_id: template_id ? parseInt(template_id, 10) : null,
          category,
          trigger_description: document.getElementById('ca-trigger').value.trim(),
          action_taken: document.getElementById('ca-action').value.trim(),
          responsible_person: document.getElementById('ca-responsible').value.trim(),
          notes: document.getElementById('ca-notes').value.trim(),
        };
        try {
          await API.request('/corrective-actions/log', { method: 'POST', body: payload });
          overlay.remove();
          showToast('Action corrective enregistrée', 'success');
          await refreshData();
        } catch (err) {
          showToast('Erreur lors de l\'enregistrement', 'error');
        }
      });
    }

    // ── Modal: Edit log entry ──
    function showEditLogModal(item) {
      const statusOptions = ['en_cours', 'terminé', 'escaladé'].map(s =>
        `<option value="${s}" ${item.status === s ? 'selected' : ''}>${CA_STATUS_LABELS[s]}</option>`
      ).join('');

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <h2><i data-lucide="pencil" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"></i>Modifier l'action corrective</h2>
            <button class="modal-close" id="ca-edit-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Catégorie</label>
              <div>${caCategoryBadge(item.category)}</div>
            </div>
            <div class="form-group">
              <label>Déclencheur</label>
              <div style="font-size:0.9rem;color:var(--color-text)">${escapeHtml(item.trigger_description || '—')}</div>
            </div>
            <div class="form-group">
              <label>Action prise</label>
              <textarea id="ca-edit-action" class="form-control" rows="3">${escapeHtml(item.action_taken || '')}</textarea>
            </div>
            <div class="form-group">
              <label>Responsable</label>
              <input type="text" id="ca-edit-responsible" class="form-control" value="${escapeHtml(item.responsible_person || '')}">
            </div>
            <div class="form-group">
              <label>Statut</label>
              <select id="ca-edit-status" class="form-control">${statusOptions}</select>
            </div>
            <div class="form-group">
              <label>Date de début</label>
              <input type="datetime-local" id="ca-edit-started" class="form-control" value="${item.started_at ? item.started_at.slice(0, 16) : ''}">
            </div>
            <div class="form-group">
              <label>Date de clôture</label>
              <input type="datetime-local" id="ca-edit-completed" class="form-control" value="${item.completed_at ? item.completed_at.slice(0, 16) : ''}">
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea id="ca-edit-notes" class="form-control" rows="2">${escapeHtml(item.notes || '')}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="ca-edit-cancel">Annuler</button>
            <button class="btn btn-primary" id="ca-edit-save">
              <i data-lucide="save" style="width:16px;height:16px"></i> Enregistrer
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons({ nodes: [overlay] });

      overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
      document.getElementById('ca-edit-cancel').addEventListener('click', () => overlay.remove());

      document.getElementById('ca-edit-save').addEventListener('click', async () => {
        const payload = {
          action_taken: document.getElementById('ca-edit-action').value.trim(),
          responsible_person: document.getElementById('ca-edit-responsible').value.trim(),
          status: document.getElementById('ca-edit-status').value,
          started_at: document.getElementById('ca-edit-started').value || null,
          completed_at: document.getElementById('ca-edit-completed').value || null,
          notes: document.getElementById('ca-edit-notes').value.trim(),
        };
        try {
          await API.request(`/corrective-actions/log/${item.id}`, { method: 'PUT', body: payload });
          overlay.remove();
          showToast('Action mise à jour', 'success');
          await refreshData();
        } catch (err) {
          showToast('Erreur lors de la mise à jour', 'error');
        }
      });
    }

    // ── Modal: Template CRUD ──
    function showTemplateModal(tpl = null) {
      const catOptions = Object.entries(CA_CATEGORY_LABELS).map(([v, l]) =>
        `<option value="${v}" ${tpl && tpl.category === v ? 'selected' : ''}>${l}</option>`
      ).join('');

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="max-width:540px">
          <div class="modal-header">
            <h2><i data-lucide="library" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"></i>${tpl ? 'Modifier le modèle' : 'Nouveau modèle'}</h2>
            <button class="modal-close" id="ca-tpl-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Catégorie <span style="color:var(--color-danger)">*</span></label>
              <select id="tpl-category" class="form-control">${catOptions}</select>
            </div>
            <div class="form-group">
              <label>Condition déclenchante</label>
              <input type="text" id="tpl-trigger" class="form-control" value="${escapeHtml(tpl ? tpl.trigger_condition || '' : '')}" placeholder="Ex: Température > 4°C en chambre froide">
            </div>
            <div class="form-group">
              <label>Description de l'action</label>
              <textarea id="tpl-action" class="form-control" rows="3" placeholder="Décrivez les étapes de l'action corrective">${escapeHtml(tpl ? tpl.action_description || '' : '')}</textarea>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label>Rôle responsable</label>
                <input type="text" id="tpl-role" class="form-control" value="${escapeHtml(tpl ? tpl.responsible_role || '' : '')}" placeholder="cuisinier / gerant">
              </div>
              <div class="form-group">
                <label>Délai max (heures)</label>
                <input type="number" id="tpl-deadline" class="form-control" value="${tpl ? (tpl.deadline_hours != null ? tpl.deadline_hours : '') : ''}" min="0" placeholder="0 = immédiat">
              </div>
            </div>
            <div class="form-group">
              <label>Procédure d'escalade</label>
              <textarea id="tpl-escalation" class="form-control" rows="2" placeholder="Conditions et contacts d'escalade">${escapeHtml(tpl ? tpl.escalation_procedure || '' : '')}</textarea>
            </div>
            <div class="form-group">
              <label>Documents requis</label>
              <input type="text" id="tpl-docs" class="form-control" value="${escapeHtml(tpl ? tpl.documentation_required || '' : '')}" placeholder="Ex: Fiche de non-conformité, relevé température">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="ca-tpl-cancel">Annuler</button>
            <button class="btn btn-primary" id="ca-tpl-save">
              <i data-lucide="save" style="width:16px;height:16px"></i> Enregistrer
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons({ nodes: [overlay] });

      overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
      document.getElementById('ca-tpl-cancel').addEventListener('click', () => overlay.remove());

      document.getElementById('ca-tpl-save').addEventListener('click', async () => {
        const category = document.getElementById('tpl-category').value;
        if (!category) { showToast('Catégorie requise', 'error'); return; }
        const deadlineVal = document.getElementById('tpl-deadline').value;
        const payload = {
          category,
          trigger_condition: document.getElementById('tpl-trigger').value.trim(),
          action_description: document.getElementById('tpl-action').value.trim(),
          responsible_role: document.getElementById('tpl-role').value.trim(),
          deadline_hours: deadlineVal !== '' ? parseInt(deadlineVal, 10) : null,
          escalation_procedure: document.getElementById('tpl-escalation').value.trim(),
          documentation_required: document.getElementById('tpl-docs').value.trim(),
        };
        try {
          if (tpl) {
            await API.request(`/corrective-actions/templates/${tpl.id}`, { method: 'PUT', body: payload });
          } else {
            await API.request('/corrective-actions/templates', { method: 'POST', body: payload });
          }
          overlay.remove();
          showToast(tpl ? 'Modèle mis à jour' : 'Modèle créé', 'success');
          await refreshData();
        } catch (err) {
          showToast("Erreur lors de l'enregistrement", 'error');
        }
      });
    }

    renderView();

  } catch (e) {
    console.error('renderCorrectiveActions error:', e);
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Erreur lors du chargement des actions correctives.</p></div>`;
  }
}
