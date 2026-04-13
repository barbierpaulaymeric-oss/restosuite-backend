// ═══════════════════════════════════════════
// HACCP Cleaning — Route #/haccp/cleaning
// ═══════════════════════════════════════════

async function renderHACCPCleaning() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [tasks, todayData] = await Promise.all([
      API.getCleaningTasks(),
      API.getCleaningToday(),
    ]);

    const account = getAccount();
    const isGerant = account && account.role === 'gerant';
    const freqLabels = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel' };

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="sparkles" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Plan de nettoyage</h1>
          ${isGerant ? `
          <button class="btn btn-primary" id="btn-add-task">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter
          </button>
          ` : ''}
        </div>

        ${HACCP_SUBNAV_FULL}

        <!-- Today's status -->
        <div class="haccp-cleaning-today-box">
          <h3>Aujourd'hui — ${todayData.done}/${todayData.total} effectuées</h3>
          <div class="haccp-cleaning-progress">
            <div class="haccp-cleaning-progress__bar">
              <div class="haccp-cleaning-progress__fill" style="width:${todayData.total > 0 ? (todayData.done / todayData.total * 100) : 0}%"></div>
            </div>
          </div>
          <div class="haccp-cleaning-list" style="margin-top:var(--space-3)">
            ${todayData.tasks.map(task => `
              <div class="haccp-cleaning-item ${task.done_today ? 'haccp-cleaning-item--done' : ''}">
                <button class="haccp-cleaning-check ${task.done_today ? 'checked' : ''}" 
                        data-task-id="${task.id}" ${task.done_today ? 'disabled' : ''}>
                  ${task.done_today ? '✓' : ''}
                </button>
                <div class="haccp-cleaning-item__info">
                  <span class="haccp-cleaning-item__name">${escapeHtml(task.name)}</span>
                  <span class="haccp-cleaning-item__zone">${escapeHtml(task.zone)} · ${task.product ? escapeHtml(task.product) : ''}</span>
                </div>
                ${task.done_today ? `<span class="haccp-cleaning-item__done-by">${escapeHtml(task.done_by || '')} ${new Date(task.done_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Export -->
        <div class="haccp-export-bar">
          <label class="text-secondary text-sm">Export PDF :</label>
          <input type="date" class="form-control" id="export-from" lang="fr" style="min-height:36px;width:auto">
          <span class="text-secondary">→</span>
          <input type="date" class="form-control" id="export-to" lang="fr" style="min-height:36px;width:auto">
          <button class="btn btn-secondary btn-sm" id="btn-export-cleaning">📄 Exporter</button>
        </div>

        <!-- All tasks -->
        <div class="section-title">Toutes les tâches</div>
        <div class="haccp-tasks-grid">
          ${tasks.map(task => `
            <div class="card" style="cursor:default;border-left-color:${task.frequency === 'daily' ? 'var(--color-accent)' : task.frequency === 'weekly' ? 'var(--color-info)' : 'var(--color-warning)'}">
              <div class="card-header">
                <span class="card-title">${escapeHtml(task.name)}</span>
                <span class="card-category">${freqLabels[task.frequency] || task.frequency}</span>
              </div>
              <p class="text-secondary text-sm">📍 ${escapeHtml(task.zone)}</p>
              ${task.product ? `<p class="text-secondary text-sm">🧴 ${escapeHtml(task.product)}</p>` : ''}
              ${task.method ? `<p class="text-secondary text-sm" style="font-style:italic">📋 ${escapeHtml(task.method)}</p>` : ''}
              ${isGerant ? `
              <div class="actions-row" style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-light)">
                <button class="btn btn-ghost btn-sm btn-edit-task" data-id="${task.id}">✏️ Modifier</button>
                <button class="btn btn-ghost btn-sm btn-delete-task" data-id="${task.id}" data-name="${escapeHtml(task.name)}">🗑️ Supprimer</button>
              </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    setupCleaningEvents(tasks);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupCleaningEvents(tasks) {
  // Mark done
  document.querySelectorAll('.haccp-cleaning-check:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = Number(btn.dataset.taskId);
      const account = getAccount();
      try {
        await API.markCleaningDone(taskId, { completed_by: account ? account.id : null });
        showToast('Tâche validée ✓', 'success');
        renderHACCPCleaning();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });

  // Add task
  document.getElementById('btn-add-task')?.addEventListener('click', () => showCleaningTaskModal(null));

  // Edit tasks
  document.querySelectorAll('.btn-edit-task').forEach(btn => {
    btn.addEventListener('click', () => {
      const task = tasks.find(t => t.id === Number(btn.dataset.id));
      if (task) showCleaningTaskModal(task);
    });
  });

  // Delete tasks
  document.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskName = btn.dataset.name;
      showConfirmModal('Supprimer la tâche', `Êtes-vous sûr de vouloir supprimer la tâche "${taskName}" ?`, async () => {
        try {
          await API.deleteCleaningTask(Number(btn.dataset.id));
          showToast('Tâche supprimée', 'success');
          renderHACCPCleaning();
        } catch (err) {
          showToast('Erreur : ' + err.message, 'error');
        }
      }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
      return;
    });
  });

  // Export
  document.getElementById('btn-export-cleaning')?.addEventListener('click', async () => {
    const from = document.getElementById('export-from').value;
    const to = document.getElementById('export-to').value;
    try {
      const url = await API.getHACCPExportUrl('cleaning', from, to);
      const a = document.createElement('a');
      a.href = url;
      a.download = `haccp-nettoyage-${from || 'all'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF exporté ✓', 'success');
    } catch (err) {
      showToast('Erreur export : ' + err.message, 'error');
    }
  });
}

function showCleaningTaskModal(task) {
  const isEdit = !!task;
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? '<i data-lucide="pencil" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Modifier la tâche' : '<i data-lucide="plus" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Nouvelle tâche'}</h2>
      <div class="form-group">
        <label>Nom de la tâche</label>
        <input type="text" class="form-control" id="task-name" value="${isEdit ? escapeHtml(task.name) : ''}" placeholder="ex: Nettoyage plan de travail">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Zone</label>
          <input type="text" class="form-control" id="task-zone" value="${isEdit ? escapeHtml(task.zone) : ''}" placeholder="ex: Cuisine">
        </div>
        <div class="form-group">
          <label>Fréquence</label>
          <select class="form-control" id="task-frequency">
            <option value="daily" ${isEdit && task.frequency === 'daily' ? 'selected' : ''}>Quotidien</option>
            <option value="weekly" ${isEdit && task.frequency === 'weekly' ? 'selected' : ''}>Hebdomadaire</option>
            <option value="monthly" ${isEdit && task.frequency === 'monthly' ? 'selected' : ''}>Mensuel</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Produit</label>
        <input type="text" class="form-control" id="task-product" value="${isEdit && task.product ? escapeHtml(task.product) : ''}" placeholder="ex: Dégraissant + désinfectant">
      </div>
      <div class="form-group">
        <label>Méthode</label>
        <textarea class="form-control" id="task-method" rows="2" placeholder="ex: Nettoyer, rincer, désinfecter">${isEdit && task.method ? escapeHtml(task.method) : ''}</textarea>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="task-cancel">Annuler</button>
        <button class="btn btn-primary" id="task-save">${isEdit ? 'Modifier' : 'Créer'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('task-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('task-save').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('task-name').value.trim(),
      zone: document.getElementById('task-zone').value.trim(),
      frequency: document.getElementById('task-frequency').value,
      product: document.getElementById('task-product').value.trim() || null,
      method: document.getElementById('task-method').value.trim() || null,
    };
    if (!payload.name || !payload.zone) {
      showToast('Le nom et la zone sont requis', 'error');
      return;
    }
    try {
      if (isEdit) {
        await API.updateCleaningTask(task.id, payload);
      } else {
        await API.createCleaningTask(payload);
      }
      overlay.remove();
      showToast(isEdit ? 'Tâche modifiée ✓' : 'Tâche créée ✓', 'success');
      renderHACCPCleaning();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
