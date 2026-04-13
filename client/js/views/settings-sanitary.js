// ═══════════════════════════════════════════
// Agrément sanitaire — Route #/settings/sanitary-approval
// ═══════════════════════════════════════════

async function renderSanitaryApproval() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const settings = await API.request('/sanitary');

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="badge-check" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Agrément sanitaire</h1>
        </div>

        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:24px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">
            <strong>Règlement CE 853/2004</strong> — Les établissements manipulant des denrées d'origine animale à des fins commerciales doivent disposer d'un <strong>agrément sanitaire</strong> ou d'une dérogation accordée par la DDPP (Direction Départementale de la Protection des Populations). Pour les restaurants classiques, une simple déclaration d'activité suffit.
          </span>
        </div>

        <div style="max-width:680px">
          <form id="sanitary-form" style="display:flex;flex-direction:column;gap:18px">

            <div style="border:1px solid var(--color-border,#e0e0e0);border-radius:8px;padding:20px">
              <div class="section-title" style="margin-top:0;margin-bottom:16px">Type d'établissement</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div class="form-group">
                  <label class="form-label">Type d'activité</label>
                  <select name="activity_type" class="form-control">
                    <option value="restaurant" ${(!settings || settings.activity_type === 'restaurant') ? 'selected' : ''}>Restaurant</option>
                    <option value="traiteur" ${settings && settings.activity_type === 'traiteur' ? 'selected' : ''}>Traiteur</option>
                    <option value="fabrication" ${settings && settings.activity_type === 'fabrication' ? 'selected' : ''}>Fabrication</option>
                    <option value="entreposage" ${settings && settings.activity_type === 'entreposage' ? 'selected' : ''}>Entreposage</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Type d'autorisation</label>
                  <select name="sanitary_approval_type" class="form-control">
                    <option value="déclaration" ${(!settings || settings.sanitary_approval_type === 'déclaration') ? 'selected' : ''}>Déclaration d'activité</option>
                    <option value="dérogation" ${settings && settings.sanitary_approval_type === 'dérogation' ? 'selected' : ''}>Dérogation à l'agrément</option>
                    <option value="agrément" ${settings && settings.sanitary_approval_type === 'agrément' ? 'selected' : ''}>Agrément sanitaire CE</option>
                  </select>
                  <small class="text-secondary" style="font-size:11px;margin-top:4px;display:block">La majorité des restaurants travaillent sous dérogation. L'agrément CE est requis pour une activité de traiteur/fabrication significative.</small>
                </div>
              </div>
            </div>

            <div style="border:1px solid var(--color-border,#e0e0e0);border-radius:8px;padding:20px">
              <div class="section-title" style="margin-top:0;margin-bottom:16px">Numéro et date d'agrément</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div class="form-group">
                  <label class="form-label">Numéro d'agrément / déclaration</label>
                  <input type="text" name="sanitary_approval_number" class="form-control" value="${escapeHtml(settings ? settings.sanitary_approval_number || '' : '')}" placeholder="Ex: FR 75 001 01 CE">
                  <small class="text-secondary" style="font-size:11px;margin-top:4px;display:block">Pour les restaurants : numéro de déclaration DDPP ou numéro CE si agréés.</small>
                </div>
                <div class="form-group">
                  <label class="form-label">Date d'obtention</label>
                  <input type="date" name="sanitary_approval_date" class="form-control" value="${settings ? settings.sanitary_approval_date || '' : ''}">
                </div>
              </div>
            </div>

            <div style="border:1px solid var(--color-border,#e0e0e0);border-radius:8px;padding:20px">
              <div class="section-title" style="margin-top:0;margin-bottom:16px">Service vétérinaire compétent</div>
              <div class="form-group">
                <label class="form-label">DDPP / Service vétérinaire</label>
                <input type="text" name="dd_pp_office" class="form-control" value="${escapeHtml(settings ? settings.dd_pp_office || '' : '')}" placeholder="Ex: DDPP de Paris — 94 avenue Ledru-Rollin, 75012 Paris">
                <small class="text-secondary" style="font-size:11px;margin-top:4px;display:block">La DDPP (Direction Départementale de la Protection des Populations) est l'autorité compétente pour les agréments sanitaires.</small>
              </div>
              <div class="form-group" style="margin-top:12px">
                <label class="form-label">Notes / Observations</label>
                <textarea name="notes" class="form-control" rows="3" placeholder="Conditions particulières, restrictions, renouvellements prévus...">${escapeHtml(settings ? settings.notes || '' : '')}</textarea>
              </div>
            </div>

            <div style="padding:16px;background:var(--color-bg-secondary,#f8f9fa);border-radius:8px;display:flex;align-items:flex-start;gap:10px">
              <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#e67e22;flex-shrink:0;margin-top:1px"></i>
              <div class="text-sm">
                <strong>Rappels réglementaires :</strong>
                <ul style="margin:6px 0 0;padding-left:18px">
                  <li>Tout établissement remettant des denrées au public doit faire une <strong>déclaration d'activité</strong> auprès de la DDPP (arrêté du 8 juin 2006).</li>
                  <li>La dérogation à l'agrément est accordée aux établissements dont la production reste <strong>majoritairement locale</strong> (remise directe au consommateur final).</li>
                  <li>L'agrément CE est obligatoire pour la <strong>fourniture à d'autres établissements</strong> (grossiste, restauration collective, etc.).</li>
                </ul>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px">
              <button type="button" class="btn btn-secondary" onclick="renderSanitaryApproval()">Annuler</button>
              <button type="submit" class="btn btn-primary">
                <i data-lucide="save" style="width:16px;height:16px"></i> Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('sanitary-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        activity_type: fd.get('activity_type'),
        sanitary_approval_type: fd.get('sanitary_approval_type'),
        sanitary_approval_number: fd.get('sanitary_approval_number'),
        sanitary_approval_date: fd.get('sanitary_approval_date') || null,
        dd_pp_office: fd.get('dd_pp_office'),
        notes: fd.get('notes'),
      };
      try {
        await API.request('/sanitary', { method: 'PUT', body: data });
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#27ae60;color:white;padding:12px 20px;border-radius:6px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2)';
        toast.textContent = '✓ Paramètres sanitaires enregistrés';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
      } catch (err) {
        alert('Erreur : ' + err.message);
      }
    });

  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
