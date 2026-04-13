// ═══════════════════════════════════════════
// RestoSuite — Plans & Pricing
// Route: #/settings/plans
// ═══════════════════════════════════════════

async function renderPlans(highlightPlan) {
  const app = document.getElementById('app');
  const account = getAccount();
  if (!account || account.role !== 'gerant') {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="lock"></i></div>
        <p>Accès réservé au gérant</p>
        <a href="#/" class="btn btn-primary">Retour</a>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  app.innerHTML = `
    <div class="view-header">
      <h1><i data-lucide="layers" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Plans & Tarifs</h1>
      <p class="text-secondary">Choisissez le plan adapté à votre restaurant</p>
    </div>
    <div class="plans-loading">
      <div class="spinner"></div>
    </div>`;
  if (window.lucide) lucide.createIcons();

  try {
    const [{ items: plans }, { plan: currentPlan }] = await Promise.all([
      API.getPlans(),
      API.getCurrentPlan(),
    ]);

    const target = highlightPlan || currentPlan;

    const PLAN_ORDER = ['discovery', 'essential', 'professional', 'premium', 'enterprise'];

    function planRank(p) { return PLAN_ORDER.indexOf(p); }

    function renderFeature(f) {
      const isSectionTitle = f.startsWith('Tout ');
      return `<li class="plan-feature${isSectionTitle ? ' plan-feature--section' : ''}">
        ${isSectionTitle ? '' : '<i data-lucide="check" style="width:14px;height:14px;flex-shrink:0;color:var(--color-success)"></i>'}
        <span>${escapeHtml(f)}</span>
      </li>`;
    }

    const cardsHtml = plans.map(plan => {
      const isCurrent = plan.id === currentPlan;
      const isHighlighted = plan.id === target;
      const isDowngrade = planRank(plan.id) < planRank(currentPlan);
      const isEnterprise = plan.id === 'enterprise';

      let btnHtml;
      if (isCurrent) {
        btnHtml = `<button class="btn btn-secondary btn-sm" disabled>Plan actuel</button>`;
      } else if (isEnterprise) {
        btnHtml = `<a href="mailto:contact@restosuite.fr?subject=Plan Enterprise" class="btn btn-outline btn-sm">Nous contacter</a>`;
      } else {
        const btnClass = isDowngrade ? 'btn-outline' : 'btn-primary';
        const label = isDowngrade ? 'Passer à ce plan' : `Choisir ${escapeHtml(plan.name)}`;
        btnHtml = `<button class="btn ${btnClass} btn-sm plan-upgrade-btn" data-plan="${escapeHtml(plan.id)}">${label}</button>`;
      }

      return `
        <div class="plan-card${isCurrent ? ' plan-card--current' : ''}${isHighlighted && !isCurrent ? ' plan-card--highlighted' : ''}">
          ${isCurrent ? '<div class="plan-card__current-badge">Plan actuel</div>' : ''}
          ${plan.badge && !isCurrent ? `<div class="plan-card__badge">${escapeHtml(plan.badge)}</div>` : ''}
          <div class="plan-card__header">
            <h2 class="plan-card__name">${escapeHtml(plan.name)}</h2>
            <div class="plan-card__price">${escapeHtml(plan.label)}</div>
            <p class="plan-card__desc">${escapeHtml(plan.description)}</p>
          </div>
          <ul class="plan-features">
            ${plan.features.map(renderFeature).join('')}
          </ul>
          <div class="plan-card__footer">
            ${btnHtml}
          </div>
        </div>`;
    }).join('');

    app.innerHTML = `
      <div class="view-header">
        <h1><i data-lucide="layers" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Plans & Tarifs</h1>
        <p class="text-secondary">Choisissez le plan adapté à votre restaurant</p>
      </div>

      ${highlightPlan && highlightPlan !== currentPlan ? `
        <div class="plans-upgrade-notice">
          <i data-lucide="lock" style="width:16px;height:16px"></i>
          Cette fonctionnalité nécessite le plan <strong>${escapeHtml(highlightPlan)}</strong> ou supérieur.
          Votre plan actuel : <strong>${escapeHtml(currentPlan)}</strong>.
        </div>` : ''}

      <div class="plans-grid">
        ${cardsHtml}
      </div>

      <p class="plans-note text-secondary" style="text-align:center;margin-top:24px;font-size:0.85rem">
        Les changements de plan sont instantanés. Pas de paiement requis en phase bêta.
      </p>`;

    if (window.lucide) lucide.createIcons();

    // Bind upgrade buttons
    app.querySelectorAll('.plan-upgrade-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const plan = btn.dataset.plan;
        btn.disabled = true;
        btn.textContent = 'Activation…';
        try {
          await API.upgradePlan(plan);
          // Update cached plan state
          _currentPlan = plan;
          showToast(`Plan ${plan} activé avec succès`, 'success');
          // Re-render with new current plan
          renderPlans();
        } catch (e) {
          showToast(e.message || 'Erreur lors du changement de plan', 'error');
          btn.disabled = false;
          btn.textContent = 'Réessayer';
        }
      });
    });
  } catch (e) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="wifi-off"></i></div>
        <p>Impossible de charger les plans</p>
        <button class="btn btn-primary" onclick="renderPlans()">Réessayer</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
}
