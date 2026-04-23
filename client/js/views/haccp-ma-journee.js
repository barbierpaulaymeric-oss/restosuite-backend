// ═══════════════════════════════════════════
// Ma journée HACCP — Vue quotidienne dynamique
// Route #/haccp/ma-journee
// ═══════════════════════════════════════════

async function renderHACCPMaJournee() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.getMaJourneeHACCP();
    const dateStr = new Date(data.date + 'T12:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    const statusIcon  = (s) => s === 'done' ? '✅' : s === 'partial' ? '⚠️' : s === 'na' ? '—' : '⏰';
    const statusLabel = (s) => s === 'done' ? 'Effectué' : s === 'partial' ? 'Partiel' : s === 'na' ? 'N/A' : 'En attente';
    const statusBadge = (s) => s === 'done' ? 'badge--success' : s === 'partial' ? 'badge--warning' : s === 'na' ? '' : 'badge--secondary';

    const allTasks  = data.slots.flatMap(s => s.tasks);
    const totalTasks = allTasks.filter(t => t.status !== 'na').length;
    const doneTasks  = allTasks.filter(t => t.status === 'done').length;
    const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
    const barColor = pct === 100 ? 'var(--color-success)' : 'var(--color-accent)';

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="calendar-check" style="width:24px;height:24px;vertical-align:middle;margin-right:8px" aria-hidden="true"></i>Ma journée HACCP</h1>
        </div>

        <div class="haccp-breadcrumb">
          <a href="#/haccp" class="haccp-breadcrumb__back">
            <i data-lucide="chevron-left"></i>
            <span>HACCP</span>
          </a>
        </div>

        <div class="card" style="margin-bottom:var(--space-5);padding:var(--space-4)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
            <span style="font-weight:600;text-transform:capitalize">${escapeHtml(dateStr)}</span>
            <span class="badge ${pct === 100 ? 'badge--success' : 'badge--secondary'}">${doneTasks}/${totalTasks} tâches</span>
          </div>
          <div style="background:var(--border-default);border-radius:var(--radius-full);height:8px;overflow:hidden" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression journalière HACCP">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:var(--radius-full);transition:width 0.4s ease"></div>
          </div>
        </div>

        ${data.slots.map(slot => `
          <div style="margin-bottom:var(--space-5)">
            <div class="section-title" style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
              <i data-lucide="${slot.icon}" style="width:18px;height:18px" aria-hidden="true"></i>
              <span>${escapeHtml(slot.label)}</span>
              <span class="text-secondary" style="font-size:var(--text-xs);font-weight:400">${escapeHtml(slot.time)}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-2)">
              ${slot.tasks.map(task => `
                <a href="#${task.route}" class="card" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);text-decoration:none;border:1px solid var(--border-default);border-radius:var(--radius-lg);background:var(--bg-elevated);transition:box-shadow 0.15s" aria-label="${escapeHtml(task.label)} — ${escapeHtml(task.detail)}">
                  <i data-lucide="${task.icon}" style="width:20px;height:20px;flex-shrink:0;color:var(--color-accent)" aria-hidden="true"></i>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:500;font-size:var(--text-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(task.label)}</div>
                    <div class="text-secondary" style="font-size:var(--text-xs)">${escapeHtml(task.detail)}</div>
                  </div>
                  <span class="badge ${statusBadge(task.status)}" style="flex-shrink:0" aria-label="${escapeHtml(statusLabel(task.status))}">${statusIcon(task.status)} ${escapeHtml(statusLabel(task.status))}</span>
                </a>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(e.message)}</p></div>`;
  }
}
