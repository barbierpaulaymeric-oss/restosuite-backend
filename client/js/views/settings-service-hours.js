// ═══════════════════════════════════════════
// Horaires de service — Route #/settings/service-hours
// Configures the start/end times that drive the salle auto-stop logic.
// ═══════════════════════════════════════════

async function renderServiceHoursSettings() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  let config = {};
  try {
    config = await API.getServiceConfig();
  } catch (e) { /* default to empty */ }

  app.innerHTML = `
    <div class="page-container" style="max-width:680px;margin:0 auto;padding:24px var(--space-4)">
      <div class="page-header">
        <h1>Horaires de service</h1>
        <p class="text-secondary" style="margin-top:4px">Définissez les plages horaires de votre service. La salle s'ajuste automatiquement.</p>
      </div>

      <form id="svc-hours-form" style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:24px;margin-top:24px;display:flex;flex-direction:column;gap:18px">
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <label style="flex:1;min-width:180px">
            <span style="display:block;font-size:14px;color:var(--text-secondary);margin-bottom:6px">Heure de début</span>
            <input type="time" id="svc-hours-start" class="form-control" value="${config.service_start || '11:30'}" lang="fr" style="font-size:1.25rem;text-align:center">
          </label>
          <label style="flex:1;min-width:180px">
            <span style="display:block;font-size:14px;color:var(--text-secondary);margin-bottom:6px">Heure de fin</span>
            <input type="time" id="svc-hours-end" class="form-control" value="${config.service_end || '14:30'}" lang="fr" style="font-size:1.25rem;text-align:center">
          </label>
        </div>

        <p style="font-size:13px;color:var(--text-tertiary);margin:0;line-height:1.5">
          La salle se met automatiquement en veille à l'heure de fin lorsqu'il ne reste plus de commande active.
          Pour un service du soir, vous pouvez utiliser une heure de fin après minuit (par ex. <code>02:00</code>).
        </p>

        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
          <a href="#/service" class="btn btn-secondary" style="text-decoration:none">Retour à la salle</a>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('svc-hours-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const service_start = document.getElementById('svc-hours-start').value;
    const service_end = document.getElementById('svc-hours-end').value;
    if (!service_start || !service_end) {
      showToast('Renseignez les deux horaires', 'error');
      return;
    }
    try {
      await API.updateServiceConfig({ service_start, service_end });
      showToast('Horaires enregistrés', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
