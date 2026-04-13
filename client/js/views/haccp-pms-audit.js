// ═══════════════════════════════════════════
// Vérification du PMS — Route #/haccp/pms-audit
// ═══════════════════════════════════════════

const PMS_STATUS_CONFIG = {
  planifié:        { color: '#3b9ede', bg: '#e8f4fd', label: 'Planifié'          },
  réalisé:         { color: '#27ae60', bg: '#f0fff4', label: 'Réalisé'           },
  actions_en_cours:{ color: '#e67e22', bg: '#fff8f0', label: 'Actions en cours'  },
  clôturé:         { color: '#888',    bg: '#f5f5f5', label: 'Clôturé'           },
};

const SEVERITY_CONFIG = {
  conforme:    { color: '#27ae60', label: '✔ Conforme'    },
  mineure:     { color: '#e67e22', label: '⚠ Mineure'     },
  majeure:     { color: '#dc3545', label: '✘ Majeure'     },
  'en attente':{ color: '#888',    label: '… En attente'  },
};

function statusBadge(status) {
  const c = PMS_STATUS_CONFIG[status] || { color: '#888', bg: '#f5f5f5', label: status };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600;color:${c.color};background:${c.bg};border:1px solid ${c.color}33">${c.label}</span>`;
}

function scoreColor(score) {
  if (score === null || score === undefined) return '#888';
  if (score >= 80) return '#27ae60';
  if (score >= 60) return '#e67e22';
  return '#dc3545';
}

async function renderHACCPPmsAudit() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [{ items }, { upcoming, overdue }] = await Promise.all([
      API.request('/pms-audit'),
      API.request('/pms-audit/schedule'),
    ]);

    // Parse findings JSON for each item
    items.forEach(item => {
      if (typeof item.findings === 'string') {
        try { item.findings = JSON.parse(item.findings); } catch (_) { item.findings = []; }
      }
      item.findings = item.findings || [];
    });

    const done = items.filter(i => ['réalisé', 'actions_en_cours', 'clôturé'].includes(i.status));
    const avgScore = done.length > 0
      ? Math.round(done.filter(i => i.overall_score !== null).reduce((a, b) => a + b.overall_score, 0) / done.filter(i => i.overall_score !== null).length)
      : null;

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="clipboard-check" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Vérification du PMS</h1>
          <button class="btn btn-primary" id="btn-new-pms-audit">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvel audit
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">Le PMS doit faire l'objet de <strong>vérifications régulières</strong> (internes trimestrielles, externes annuelles). Ces audits permettent de valider l'efficacité des mesures et de déclencher les actions correctives nécessaires.</span>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Audits réalisés</div>
            <div class="kpi-card__value">${done.length}</div>
          </div>
          <div class="kpi-card ${avgScore !== null && avgScore >= 80 ? 'kpi-card--success' : avgScore !== null && avgScore < 60 ? 'kpi-card--alert' : ''}">
            <div class="kpi-card__label">Score moyen</div>
            <div class="kpi-card__value" style="color:${scoreColor(avgScore)}">${avgScore !== null ? avgScore + '/100' : '—'}</div>
          </div>
          <div class="kpi-card ${upcoming.length > 0 ? 'kpi-card--info' : ''}">
            <div class="kpi-card__label">Planifiés</div>
            <div class="kpi-card__value">${upcoming.length}</div>
          </div>
          <div class="kpi-card ${overdue.length > 0 ? 'kpi-card--alert' : ''}">
            <div class="kpi-card__label">En retard</div>
            <div class="kpi-card__value">${overdue.length}</div>
          </div>
        </div>

        ${overdue.length > 0 ? `
        <div style="background:#fff5f5;border:1px solid #dc3545;border-radius:8px;padding:12px 16px;margin-bottom:16px">
          <strong style="color:#dc3545"><i data-lucide="alert-circle" style="width:16px;height:16px;vertical-align:middle;margin-right:4px"></i>Audits en retard</strong>
          <ul style="margin:8px 0 0;padding-left:20px">
            ${overdue.map(a => `<li class="text-sm">${new Date(a.audit_date).toLocaleDateString('fr-FR')} — ${escapeHtml(a.auditor_name)} (${a.audit_type})</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${upcoming.length > 0 ? `
        <div style="background:#f0fff4;border:1px solid #27ae60;border-radius:8px;padding:12px 16px;margin-bottom:16px">
          <strong style="color:#27ae60"><i data-lucide="calendar" style="width:16px;height:16px;vertical-align:middle;margin-right:4px"></i>Prochains audits planifiés</strong>
          <ul style="margin:8px 0 0;padding-left:20px">
            ${upcoming.map(a => `<li class="text-sm">${new Date(a.audit_date).toLocaleDateString('fr-FR')} — ${escapeHtml(a.auditor_name)} (${a.audit_type})</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Historique audits -->
        <div class="section-title">Historique des audits</div>
        <div style="display:flex;flex-direction:column;gap:16px" id="pms-audit-list">
          ${items.length === 0
            ? '<div class="empty-state"><p>Aucun audit enregistré</p></div>'
            : items.map(item => {
              const majorFindings = item.findings.filter(f => f.severity === 'majeure');
              const minorFindings = item.findings.filter(f => f.severity === 'mineure');
              return `
                <div style="border:1px solid var(--color-border,#e0e0e0);border-radius:8px;overflow:hidden">
                  <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--color-bg-secondary,#f8f9fa);flex-wrap:wrap">
                    <span style="font-weight:700;font-size:15px">${new Date(item.audit_date).toLocaleDateString('fr-FR')}</span>
                    <span class="text-sm text-secondary">${item.audit_type === 'interne' ? '🏠 Interne' : '🏢 Externe'} · ${item.scope}</span>
                    <span class="text-sm">${escapeHtml(item.auditor_name)}</span>
                    ${statusBadge(item.status)}
                    ${item.overall_score !== null ? `
                      <span style="margin-left:auto;font-size:22px;font-weight:800;color:${scoreColor(item.overall_score)}">${item.overall_score}<span style="font-size:13px;color:var(--color-text-secondary,#888)">/100</span></span>
                    ` : '<span style="margin-left:auto;color:#888;font-size:13px">Score N/A</span>'}
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-ghost btn-sm" onclick="openPmsAuditModal(${item.id})"><i data-lucide="edit-2" style="width:14px;height:14px"></i></button>
                      <button class="btn btn-ghost btn-sm text-danger" onclick="deletePmsAudit(${item.id})"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
                    </div>
                  </div>
                  ${item.findings.length > 0 ? `
                  <div style="padding:12px 16px">
                    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                      ${majorFindings.length > 0 ? `<span style="color:#dc3545;font-size:12px;font-weight:600">✘ ${majorFindings.length} majeure${majorFindings.length > 1 ? 's' : ''}</span>` : ''}
                      ${minorFindings.length > 0 ? `<span style="color:#e67e22;font-size:12px;font-weight:600">⚠ ${minorFindings.length} mineure${minorFindings.length > 1 ? 's' : ''}</span>` : ''}
                      ${item.findings.filter(f => f.severity === 'conforme').length > 0 ? `<span style="color:#27ae60;font-size:12px;font-weight:600">✔ ${item.findings.filter(f => f.severity === 'conforme').length} conforme${item.findings.filter(f => f.severity === 'conforme').length > 1 ? 's' : ''}</span>` : ''}
                    </div>
                    <table style="width:100%;font-size:13px;border-collapse:collapse">
                      <thead>
                        <tr style="background:var(--color-bg-secondary,#f8f9fa)">
                          <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--color-border,#e0e0e0);width:160px">Section</th>
                          <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--color-border,#e0e0e0)">Constat</th>
                          <th style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--color-border,#e0e0e0);width:120px">Sévérité</th>
                          <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--color-border,#e0e0e0)">Action requise</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${item.findings.map(f => {
                          const sc = SEVERITY_CONFIG[f.severity] || { color: '#888', label: f.severity };
                          return `
                            <tr>
                              <td style="padding:6px 10px;border-bottom:1px solid var(--color-border,#e0e0e0);font-weight:600">${escapeHtml(f.section)}</td>
                              <td style="padding:6px 10px;border-bottom:1px solid var(--color-border,#e0e0e0)">${escapeHtml(f.finding)}</td>
                              <td style="padding:6px 10px;border-bottom:1px solid var(--color-border,#e0e0e0);text-align:center;color:${sc.color};font-weight:600;white-space:nowrap">${sc.label}</td>
                              <td style="padding:6px 10px;border-bottom:1px solid var(--color-border,#e0e0e0);color:var(--color-text-secondary,#666)">${escapeHtml(f.action_required || '—')}</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                  ` : ''}
                  ${item.notes ? `<div style="padding:8px 16px;border-top:1px solid var(--color-border,#e0e0e0);color:var(--color-text-secondary,#666);font-size:13px"><em>${escapeHtml(item.notes)}</em></div>` : ''}
                </div>
              `;
            }).join('')
          }
        </div>
      </div>

      <!-- Modal audit -->
      <div id="pms-audit-modal" class="modal-overlay" style="display:none">
        <div class="modal" style="max-width:680px;width:95%;max-height:90vh;overflow-y:auto">
          <div class="modal-header">
            <h3 id="pms-audit-modal-title">Nouvel audit</h3>
            <button class="modal-close" onclick="closePmsAuditModal()">×</button>
          </div>
          <div class="modal-body" id="pms-audit-modal-body"></div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    window._pmsAuditItems = items;

    document.getElementById('btn-new-pms-audit').addEventListener('click', () => openPmsAuditModal(null));

  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function openPmsAuditModal(id) {
  const item = id ? (window._pmsAuditItems || []).find(i => i.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);

  const DEFAULT_SECTIONS = [
    'Températures', 'Nettoyage & Désinfection', 'Traçabilité',
    'Gestion des allergènes', 'Lutte contre les nuisibles',
    'Formation du personnel', 'Maintenance des équipements',
  ];

  const findings = item ? item.findings : DEFAULT_SECTIONS.map(s => ({
    section: s, finding: '', severity: 'en attente', action_required: ''
  }));

  document.getElementById('pms-audit-modal-title').textContent = item ? 'Modifier l\'audit' : 'Nouvel audit PMS';
  document.getElementById('pms-audit-modal-body').innerHTML = `
    <form id="pms-audit-form" style="display:flex;flex-direction:column;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Date d'audit *</label>
          <input type="date" name="audit_date" class="form-control" required value="${item ? item.audit_date : today}">
        </div>
        <div class="form-group">
          <label class="form-label">Auditeur *</label>
          <input type="text" name="auditor_name" class="form-control" required value="${escapeHtml(item ? item.auditor_name : '')}">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Type d'audit</label>
          <select name="audit_type" class="form-control">
            <option value="interne" ${(!item || item.audit_type === 'interne') ? 'selected' : ''}>Interne</option>
            <option value="externe" ${item && item.audit_type === 'externe' ? 'selected' : ''}>Externe</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Périmètre</label>
          <select name="scope" class="form-control">
            <option value="complet" ${(!item || item.scope === 'complet') ? 'selected' : ''}>Complet</option>
            <option value="partiel" ${item && item.scope === 'partiel' ? 'selected' : ''}>Partiel</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Statut</label>
          <select name="status" class="form-control">
            <option value="planifié" ${(!item || item.status === 'planifié') ? 'selected' : ''}>Planifié</option>
            <option value="réalisé" ${item && item.status === 'réalisé' ? 'selected' : ''}>Réalisé</option>
            <option value="actions_en_cours" ${item && item.status === 'actions_en_cours' ? 'selected' : ''}>Actions en cours</option>
            <option value="clôturé" ${item && item.status === 'clôturé' ? 'selected' : ''}>Clôturé</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Score global (0–100)</label>
          <input type="number" name="overall_score" class="form-control" min="0" max="100" value="${item && item.overall_score !== null ? item.overall_score : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Prochain audit prévu</label>
          <input type="date" name="next_audit_date" class="form-control" value="${item ? item.next_audit_date || '' : ''}">
        </div>
      </div>

      <div style="border-top:1px solid var(--color-border,#e0e0e0);padding-top:14px">
        <strong class="text-sm">Constats par section</strong>
        <div id="findings-list" style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
          ${findings.map((f, idx) => `
            <div style="border:1px solid var(--color-border,#e0e0e0);border-radius:6px;padding:10px" data-finding-idx="${idx}">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <input type="text" class="form-control finding-section" placeholder="Section" value="${escapeHtml(f.section || '')}" style="flex:1">
                <select class="form-control finding-severity" style="width:160px">
                  <option value="en attente" ${f.severity === 'en attente' ? 'selected' : ''}>En attente</option>
                  <option value="conforme" ${f.severity === 'conforme' ? 'selected' : ''}>Conforme</option>
                  <option value="mineure" ${f.severity === 'mineure' ? 'selected' : ''}>Mineure</option>
                  <option value="majeure" ${f.severity === 'majeure' ? 'selected' : ''}>Majeure</option>
                </select>
                <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="removeFinding(this)"><i data-lucide="x" style="width:14px;height:14px"></i></button>
              </div>
              <textarea class="form-control finding-finding" placeholder="Constat" rows="2" style="margin-bottom:6px">${escapeHtml(f.finding || '')}</textarea>
              <input type="text" class="form-control finding-action" placeholder="Action requise (si applicable)" value="${escapeHtml(f.action_required || '')}">
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="addFinding()">
          <i data-lucide="plus" style="width:14px;height:14px"></i> Ajouter une section
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea name="notes" class="form-control" rows="2">${escapeHtml(item ? item.notes || '' : '')}</textarea>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closePmsAuditModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">${item ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>
  `;

  document.getElementById('pms-audit-modal').style.display = 'flex';
  if (window.lucide) lucide.createIcons();

  document.getElementById('pms-audit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const findingEls = document.querySelectorAll('#findings-list [data-finding-idx]');
    const findingsData = Array.from(findingEls).map(el => ({
      section: el.querySelector('.finding-section').value,
      finding: el.querySelector('.finding-finding').value,
      severity: el.querySelector('.finding-severity').value,
      action_required: el.querySelector('.finding-action').value || null,
    }));

    const score = fd.get('overall_score');
    const data = {
      audit_date: fd.get('audit_date'),
      auditor_name: fd.get('auditor_name'),
      audit_type: fd.get('audit_type'),
      scope: fd.get('scope'),
      status: fd.get('status'),
      overall_score: score !== '' ? Number(score) : null,
      next_audit_date: fd.get('next_audit_date') || null,
      notes: fd.get('notes'),
      findings: findingsData,
    };
    try {
      if (item) {
        await API.request(`/pms-audit/${item.id}`, { method: 'PUT', body: data });
      } else {
        await API.request('/pms-audit', { method: 'POST', body: data });
      }
      closePmsAuditModal();
      renderHACCPPmsAudit();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  });
}

function addFinding() {
  const list = document.getElementById('findings-list');
  const idx = list.children.length;
  const div = document.createElement('div');
  div.style.cssText = 'border:1px solid var(--color-border,#e0e0e0);border-radius:6px;padding:10px';
  div.setAttribute('data-finding-idx', idx);
  div.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input type="text" class="form-control finding-section" placeholder="Section" style="flex:1">
      <select class="form-control finding-severity" style="width:160px">
        <option value="en attente">En attente</option>
        <option value="conforme">Conforme</option>
        <option value="mineure">Mineure</option>
        <option value="majeure">Majeure</option>
      </select>
      <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="removeFinding(this)"><i data-lucide="x" style="width:14px;height:14px"></i></button>
    </div>
    <textarea class="form-control finding-finding" placeholder="Constat" rows="2" style="margin-bottom:6px"></textarea>
    <input type="text" class="form-control finding-action" placeholder="Action requise (si applicable)">
  `;
  list.appendChild(div);
  if (window.lucide) lucide.createIcons();
}

function removeFinding(btn) {
  btn.closest('[data-finding-idx]').remove();
}

function closePmsAuditModal() {
  document.getElementById('pms-audit-modal').style.display = 'none';
}

async function deletePmsAudit(id) {
  if (!confirm('Supprimer cet audit ?')) return;
  try {
    await API.request(`/pms-audit/${id}`, { method: 'DELETE' });
    renderHACCPPmsAudit();
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
}
