// ═══════════════════════════════════════════
// Planning — staff scheduling weekly grid + labor cost.
// Backed by /api/planning (server/routes/planning.js).
// ═══════════════════════════════════════════

(function () {
  const SHIFT_STATUS_LABELS = {
    planned:   'Prévu',
    confirmed: 'Confirmé',
    completed: 'Effectué',
    cancelled: 'Annulé',
  };
  const SHIFT_STATUS_COLORS = {
    planned:   '#6b7280',
    confirmed: '#2563eb',
    completed: '#22c55e',
    cancelled: '#ef4444',
  };
  const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  let _members = [];
  let _weekRefDate = null; // reference date for current week (any day inside)

  function fmtEur(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function fmtHours(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' h';
  }
  function isoToday() { return new Date().toISOString().slice(0, 10); }

  function shiftMonday(iso) {
    const d = new Date(iso + 'T00:00:00Z');
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (day - 1));
    return d.toISOString().slice(0, 10);
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function fmtDayHeader(iso) {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function statusBadge(status) {
    const label = SHIFT_STATUS_LABELS[status] || status || '—';
    const color = SHIFT_STATUS_COLORS[status] || '#6b7280';
    return `<span class="badge" style="background:${color};color:white;font-size:10px;padding:1px 6px;border-radius:6px">${escapeHtml(label)}</span>`;
  }

  async function renderPlanning() {
    const account = typeof getAccount === 'function' ? getAccount() : null;
    if (!account || account.role !== 'gerant') {
      location.hash = '#/';
      return;
    }
    if (!_weekRefDate) _weekRefDate = isoToday();
    const monday = shiftMonday(_weekRefDate);
    const sunday = addDays(monday, 6);

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
        <div>
          <h1><i data-lucide="calendar-clock" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Planning</h1>
          <p class="text-secondary">Plannings hebdomadaires, coût main d'œuvre, suivi des shifts.</p>
        </div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          <button id="planning-prev-week" class="btn btn-secondary"><i data-lucide="chevron-left" style="width:16px;height:16px"></i></button>
          <button id="planning-today" class="btn btn-secondary">Aujourd'hui</button>
          <button id="planning-next-week" class="btn btn-secondary"><i data-lucide="chevron-right" style="width:16px;height:16px"></i></button>
          <button id="planning-add-member" class="btn btn-secondary" style="display:flex;align-items:center;gap:var(--space-2)">
            <i data-lucide="user-plus" style="width:16px;height:16px"></i>Membre
          </button>
          <button id="planning-add-shift" class="btn btn-primary" style="display:flex;align-items:center;gap:var(--space-2)">
            <i data-lucide="plus" style="width:16px;height:16px"></i>Shift
          </button>
        </div>
      </div>

      <div id="planning-week-label" style="margin-bottom:var(--space-4);font-weight:600;color:var(--text-secondary)">
        Semaine du <span id="planning-week-from"></span> au <span id="planning-week-to"></span>
      </div>

      <div id="planning-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);margin-bottom:var(--space-5)"></div>

      <div id="planning-grid">
        <div class="skeleton skeleton-row"></div>
        <div class="skeleton skeleton-row"></div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    document.getElementById('planning-week-from').textContent = fmtDayHeader(monday);
    document.getElementById('planning-week-to').textContent   = fmtDayHeader(sunday);

    document.getElementById('planning-prev-week').addEventListener('click', () => {
      _weekRefDate = addDays(monday, -7);
      renderPlanning();
    });
    document.getElementById('planning-next-week').addEventListener('click', () => {
      _weekRefDate = addDays(monday, 7);
      renderPlanning();
    });
    document.getElementById('planning-today').addEventListener('click', () => {
      _weekRefDate = isoToday();
      renderPlanning();
    });
    document.getElementById('planning-add-member').addEventListener('click', () => openMemberModal());
    document.getElementById('planning-add-shift').addEventListener('click', () => openShiftModal());

    await Promise.all([loadKpis(monday, sunday), loadWeek(monday)]);
  }

  async function loadKpis(from, to) {
    try {
      const data = await API.getLaborCost({ from, to });
      const el = document.getElementById('planning-kpis');
      if (!el) return;
      el.innerHTML = `
        ${kpiCard('Heures planifiées', fmtHours(data.total_hours), 'clock')}
        ${kpiCard('Coût main d\'œuvre', fmtEur(data.total_cost), 'euro')}
        ${kpiCard('Couverts', data.total_covers > 0 ? data.total_covers.toLocaleString('fr-FR') : '—', 'users')}
        ${kpiCard('Coût / couvert', data.cost_per_cover != null ? fmtEur(data.cost_per_cover) : '—', 'percent')}
      `;
      if (window.lucide) lucide.createIcons();
    } catch (e) {
      // KPIs are optional — surface nothing rather than blocking the grid.
    }
  }

  function kpiCard(label, value, icon) {
    return `
      <div class="card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:13px">
          <i data-lucide="${icon}" style="width:14px;height:14px"></i>${escapeHtml(label)}
        </div>
        <div style="font-size:22px;font-weight:700">${value}</div>
      </div>
    `;
  }

  async function loadWeek(monday) {
    const grid = document.getElementById('planning-grid');
    if (!grid) return;
    let data;
    try {
      data = await API.getPlanningWeek(monday);
    } catch (e) {
      grid.innerHTML = `<div class="empty-state"><p>Erreur de chargement du planning${e && e.message ? ' : ' + escapeHtml(e.message) : ''}</p></div>`;
      return;
    }
    _members = data.members || [];

    if (_members.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6);text-align:center">
          <p style="margin-bottom:var(--space-3)">Aucun membre dans le planning. Commencez par ajouter votre équipe.</p>
          <button class="btn btn-primary" id="planning-empty-add">
            <i data-lucide="user-plus" style="width:16px;height:16px"></i> Ajouter un membre
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      const btn = document.getElementById('planning-empty-add');
      if (btn) btn.addEventListener('click', () => openMemberModal());
      return;
    }

    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const shiftsByMemberDay = new Map();
    for (const s of (data.shifts || [])) {
      const k = `${s.staff_member_id}|${s.date}`;
      if (!shiftsByMemberDay.has(k)) shiftsByMemberDay.set(k, []);
      shiftsByMemberDay.get(k).push(s);
    }

    const headerCells = days.map((iso, i) => `
      <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border-color);min-width:120px">
        <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase">${DAY_LABELS[i]}</div>
        <div style="font-weight:600">${fmtDayHeader(iso).split(' ').slice(1).join(' ')}</div>
      </th>
    `).join('');

    const memberRows = _members.map(m => {
      const memberHours = days.reduce((sum, iso) => {
        const arr = shiftsByMemberDay.get(`${m.id}|${iso}`) || [];
        return sum + arr.reduce((a, s) => a + (s.hours || 0), 0);
      }, 0);
      const cells = days.map(iso => {
        const arr = shiftsByMemberDay.get(`${m.id}|${iso}`) || [];
        const inner = arr.length === 0
          ? `<button class="planning-cell-add" data-add-shift data-member="${m.id}" data-date="${iso}" style="background:none;border:1px dashed var(--border-color);border-radius:6px;width:100%;padding:6px;color:var(--text-tertiary);font-size:11px;cursor:pointer">+</button>`
          : arr.map(s => `
              <button class="planning-shift" data-edit-shift="${s.id}" style="display:block;width:100%;text-align:left;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.3);border-radius:6px;padding:5px 7px;margin-bottom:4px;cursor:pointer">
                <div style="font-weight:600;font-size:12px">${escapeHtml(s.start_time.slice(0,5))} – ${escapeHtml(s.end_time.slice(0,5))}</div>
                <div style="font-size:10px;color:var(--text-secondary);display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:2px">
                  <span>${fmtHours(s.hours)}</span>
                  ${statusBadge(s.status)}
                </div>
              </button>
            `).join('');
        return `<td style="padding:6px;border-bottom:1px solid var(--border-color);vertical-align:top">${inner}</td>`;
      }).join('');
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid var(--border-color);vertical-align:top;min-width:160px">
            <div style="font-weight:600">${escapeHtml(m.name)}</div>
            <div style="font-size:11px;color:var(--text-tertiary)">${escapeHtml(m.role || 'Sans rôle')}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${fmtHours(memberHours)} planifiées</div>
          </td>
          ${cells}
        </tr>
      `;
    }).join('');

    grid.innerHTML = `
      <div class="table-container" style="overflow-x:auto;border:1px solid var(--border-color);border-radius:var(--radius-lg);background:var(--bg-card)">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border-color);min-width:160px">Membre</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${memberRows}</tbody>
        </table>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    grid.querySelectorAll('[data-edit-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.editShift);
        const shift = (data.shifts || []).find(s => s.id === id);
        if (shift) openShiftModal(shift);
      });
    });
    grid.querySelectorAll('[data-add-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        openShiftModal({
          staff_member_id: Number(btn.dataset.member),
          date: btn.dataset.date,
        });
      });
    });
  }

  // ─── Member modal ────────────────────────────────────────────────────────
  function openMemberModal(member) {
    const isEdit = !!(member && member.id);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px">
        <h2>${isEdit ? 'Modifier le membre' : 'Nouveau membre'}</h2>
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" class="form-control" id="m-name" value="${escapeHtml(member && member.name || '')}" data-ui="custom">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
          <div class="form-group">
            <label>Rôle</label>
            <input type="text" class="form-control" id="m-role" placeholder="Ex: Cuisinier" value="${escapeHtml(member && member.role || '')}" data-ui="custom">
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" class="form-control" id="m-phone" value="${escapeHtml(member && member.phone || '')}" data-ui="custom">
          </div>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" id="m-email" value="${escapeHtml(member && member.email || '')}" data-ui="custom">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
          <div class="form-group">
            <label>Taux horaire (€/h)</label>
            <input type="number" step="0.01" min="0" class="form-control" id="m-rate" value="${member && member.hourly_rate != null ? member.hourly_rate : ''}" data-ui="custom">
          </div>
          <div class="form-group">
            <label>Heures contractuelles / sem.</label>
            <input type="number" step="0.5" min="0" class="form-control" id="m-contract" value="${member && member.contract_hours != null ? member.contract_hours : 35}" data-ui="custom">
          </div>
        </div>
        <div id="m-error" style="color:var(--color-danger);font-size:13px;min-height:18px;margin-bottom:var(--space-3)"></div>
        <div class="actions-row" style="display:flex;justify-content:space-between;gap:var(--space-2)">
          <div>
            ${isEdit ? `<button class="btn" id="m-delete" style="color:var(--color-danger);border:1px solid rgba(217,48,37,0.3);background:transparent">Supprimer</button>` : ''}
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary" id="m-cancel">Annuler</button>
            <button class="btn btn-primary" id="m-save">${isEdit ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#m-save').addEventListener('click', async () => {
      const errEl = overlay.querySelector('#m-error');
      const payload = {
        name: overlay.querySelector('#m-name').value.trim(),
        role: overlay.querySelector('#m-role').value.trim() || null,
        email: overlay.querySelector('#m-email').value.trim() || null,
        phone: overlay.querySelector('#m-phone').value.trim() || null,
        hourly_rate: Number(overlay.querySelector('#m-rate').value) || 0,
        contract_hours: Number(overlay.querySelector('#m-contract').value) || 0,
      };
      if (!payload.name) { errEl.textContent = 'Le nom est requis'; return; }
      try {
        if (isEdit) await API.updateStaffMember(member.id, payload);
        else        await API.createStaffMember(payload);
        showToast(isEdit ? 'Membre mis à jour' : 'Membre ajouté', 'success');
        overlay.remove();
        renderPlanning();
      } catch (e) {
        errEl.textContent = e.message || 'Erreur';
      }
    });

    if (isEdit) {
      overlay.querySelector('#m-delete').addEventListener('click', () => {
        showConfirmModal('Supprimer le membre',
          `Supprimer ${member.name} du planning ? Les shifts existants seront conservés mais ne pourront plus être modifiés.`,
          async () => {
            try {
              await API.deleteStaffMember(member.id);
              showToast('Membre supprimé', 'success');
              overlay.remove();
              renderPlanning();
            } catch (e) {
              showToast(e.message || 'Erreur', 'error');
            }
          },
          { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
      });
    }

    overlay.querySelector('#m-name').focus();
  }

  // ─── Shift modal ─────────────────────────────────────────────────────────
  async function openShiftModal(shift) {
    const isEdit = !!(shift && shift.id);
    if (_members.length === 0) {
      try {
        _members = await API.getStaffMembers();
      } catch {}
      if (_members.length === 0) {
        showToast('Ajoutez au moins un membre avant de planifier un shift', 'info');
        openMemberModal();
        return;
      }
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px">
        <h2>${isEdit ? 'Modifier le shift' : 'Nouveau shift'}</h2>
        <div class="form-group">
          <label>Membre *</label>
          <select class="form-control" id="s-member" data-ui="custom">
            ${_members.map(m => `<option value="${m.id}" ${shift && Number(shift.staff_member_id) === m.id ? 'selected' : ''}>${escapeHtml(m.name)}${m.role ? ' — ' + escapeHtml(m.role) : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input type="date" class="form-control" id="s-date" value="${(shift && shift.date) || isoToday()}" data-ui="custom">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-3)">
          <div class="form-group">
            <label>Début *</label>
            <input type="time" class="form-control" id="s-start" value="${(shift && shift.start_time) ? shift.start_time.slice(0,5) : '09:00'}" data-ui="custom">
          </div>
          <div class="form-group">
            <label>Fin *</label>
            <input type="time" class="form-control" id="s-end" value="${(shift && shift.end_time) ? shift.end_time.slice(0,5) : '17:00'}" data-ui="custom">
          </div>
          <div class="form-group">
            <label>Pause (min)</label>
            <input type="number" min="0" step="5" class="form-control" id="s-break" value="${(shift && shift.break_minutes) || 0}" data-ui="custom">
          </div>
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select class="form-control" id="s-status" data-ui="custom">
            ${Object.entries(SHIFT_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${(shift && shift.status === k) || (!shift && k === 'planned') ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea class="form-control" id="s-notes" rows="2" data-ui="custom">${escapeHtml(shift && shift.notes || '')}</textarea>
        </div>
        <div id="s-error" style="color:var(--color-danger);font-size:13px;min-height:18px;margin-bottom:var(--space-3)"></div>
        <div class="actions-row" style="display:flex;justify-content:space-between;gap:var(--space-2)">
          <div>
            ${isEdit ? `<button class="btn" id="s-delete" style="color:var(--color-danger);border:1px solid rgba(217,48,37,0.3);background:transparent">Supprimer</button>` : ''}
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary" id="s-cancel">Annuler</button>
            <button class="btn btn-primary" id="s-save">${isEdit ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#s-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#s-save').addEventListener('click', async () => {
      const errEl = overlay.querySelector('#s-error');
      const payload = {
        staff_member_id: Number(overlay.querySelector('#s-member').value),
        date: overlay.querySelector('#s-date').value,
        start_time: overlay.querySelector('#s-start').value,
        end_time: overlay.querySelector('#s-end').value,
        break_minutes: Number(overlay.querySelector('#s-break').value) || 0,
        status: overlay.querySelector('#s-status').value,
        notes: overlay.querySelector('#s-notes').value.trim() || null,
      };
      if (!payload.staff_member_id) { errEl.textContent = 'Membre requis'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) { errEl.textContent = 'Date invalide'; return; }
      if (!/^\d{2}:\d{2}/.test(payload.start_time) || !/^\d{2}:\d{2}/.test(payload.end_time)) {
        errEl.textContent = 'Horaires requis'; return;
      }
      try {
        if (isEdit) await API.updateShift(shift.id, payload);
        else        await API.createShift(payload);
        showToast(isEdit ? 'Shift mis à jour' : 'Shift créé', 'success');
        overlay.remove();
        renderPlanning();
      } catch (e) {
        errEl.textContent = e.message || 'Erreur';
      }
    });

    if (isEdit) {
      overlay.querySelector('#s-delete').addEventListener('click', () => {
        showConfirmModal('Supprimer le shift', 'Supprimer ce shift ?', async () => {
          try {
            await API.deleteShift(shift.id);
            showToast('Shift supprimé', 'success');
            overlay.remove();
            renderPlanning();
          } catch (e) {
            showToast(e.message || 'Erreur', 'error');
          }
        }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
      });
    }
  }

  window.renderPlanning = renderPlanning;
})();
