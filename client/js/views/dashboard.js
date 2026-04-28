// ═══════════════════════════════════════════
// Dashboard — Fiches Techniques (with recipe type filter)
// ═══════════════════════════════════════════

async function renderOnboardingChecklist() {
  const container = document.getElementById('dashboard-onboarding');
  if (!container) return;
  if (localStorage.getItem('hideOnboarding') === '1') return;
  try {
    const data = await API.getOnboardingChecklist();
    if (!data || data.progress >= 1) { container.innerHTML = ''; return; }

    const pct = Math.round(data.progress * 100);
    container.innerHTML = `
      <section role="region" aria-labelledby="onboarding-checklist-heading" style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
          <h3 id="onboarding-checklist-heading" style="margin:0;font-size:var(--text-base)">Premiers pas avec RestoSuite</h3>
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-accent)" aria-label="Progression : ${pct} pour cent">${pct}%</span>
            <button id="hide-onboarding-btn" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:var(--text-sm);padding:2px 6px;border-radius:var(--radius-sm)" title="Masquer" aria-label="Masquer la checklist d'intégration">Masquer</button>
          </div>
        </div>
        <div role="progressbar" aria-label="Progression d'intégration" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" style="height:6px;background:var(--bg-sunken);border-radius:var(--radius-full);margin-bottom:var(--space-3);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--color-accent);border-radius:var(--radius-full);transition:width 0.6s ease"></div>
        </div>
        <ul role="list" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--space-2)">
          ${data.steps.map(step => `
            <li role="listitem">
              <a ${step.done ? '' : `href="${step.link}"`} class="onboarding-step${step.done ? ' done' : ''}" style="${step.done ? 'pointer-events:none' : ''}" ${step.done ? 'aria-label="Étape complétée : ' + escapeHtml(step.label) + '" aria-disabled="true"' : 'aria-label="Étape à compléter : ' + escapeHtml(step.label) + '"'}>
                <span class="onboarding-step__check" aria-hidden="true">
                  ${step.done
                    ? '<i data-lucide="check-circle-2" style="color:var(--color-success);width:20px;height:20px;flex-shrink:0"></i>'
                    : '<i data-lucide="circle" style="color:var(--text-tertiary);width:20px;height:20px;flex-shrink:0"></i>'
                  }
                </span>
                <span class="onboarding-step__label">${escapeHtml(step.label)}</span>
                ${!step.done ? '<i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary);margin-left:auto;flex-shrink:0" aria-hidden="true"></i>' : ''}
              </a>
            </li>
          `).join('')}
        </ul>
      </section>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    document.getElementById('hide-onboarding-btn').addEventListener('click', () => {
      localStorage.setItem('hideOnboarding', '1');
      container.innerHTML = '';
    });
  } catch (e) {
    if (container) container.innerHTML = '';
  }
}

// ─── Nav orientation guide ───
function renderNavGuide() {
  const container = document.getElementById('dashboard-nav-guide');
  if (!container) return;
  const FLAG = 'restosuite_nav_guide_v1_dismissed';
  if (localStorage.getItem(FLAG)) return;

  container.innerHTML = `
    <div role="note" aria-label="Guide de navigation" style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
      <h4 style="margin:0 0 var(--space-3) 0;font-size:var(--text-sm);font-weight:700;display:flex;align-items:center;gap:var(--space-2)">
        <i data-lucide="map" style="width:16px;height:16px;color:var(--color-accent)" aria-hidden="true"></i>
        Comment naviguer dans RestoSuite
      </h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
        <div style="display:flex;gap:var(--space-2);align-items:flex-start">
          <i data-lucide="utensils" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0;margin-top:2px" aria-hidden="true"></i>
          <div><strong style="font-size:var(--text-sm)">Cuisine</strong><p style="margin:2px 0 0;font-size:var(--text-xs);color:var(--text-secondary)">Recettes, ingrédients, stock et réceptions</p></div>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:flex-start">
          <i data-lucide="clipboard-pen" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0;margin-top:2px" aria-hidden="true"></i>
          <div><strong style="font-size:var(--text-sm)">Opérations</strong><p style="margin:2px 0 0;font-size:var(--text-xs);color:var(--text-secondary)">Fournisseurs, livraisons et service en salle</p></div>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:flex-start">
          <i data-lucide="shield-check" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0;margin-top:2px" aria-hidden="true"></i>
          <div><strong style="font-size:var(--text-sm)">HACCP</strong><p style="margin:2px 0 0;font-size:var(--text-xs);color:var(--text-secondary)">Conformité, traçabilité et hygiène</p></div>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:flex-start">
          <i data-lucide="bar-chart-3" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0;margin-top:2px" aria-hidden="true"></i>
          <div><strong style="font-size:var(--text-sm)">Pilotage</strong><p style="margin:2px 0 0;font-size:var(--text-xs);color:var(--text-secondary)">Stats, food cost, menu engineering</p></div>
        </div>
      </div>
      <div style="text-align:right">
        <button id="dismiss-nav-guide" class="btn btn-secondary" style="font-size:var(--text-sm);padding:6px 16px" aria-label="Fermer le guide de navigation">J'ai compris</button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [container] });
  document.getElementById('dismiss-nav-guide')?.addEventListener('click', () => {
    localStorage.setItem(FLAG, '1');
    container.innerHTML = '';
  });
}

async function renderDashboard() {
  const app = document.getElementById('app');
  const perms = getPermissions();
  const account = getAccount();
  const greeting = getGreeting(_dashboardDisplayName(account));
  const todayDate = formatFrenchDate(new Date());

  app.innerHTML = `
    <header id="dashboard-greeting" role="banner" style="margin-bottom:var(--space-4)">
      <div style="padding:var(--space-4);background:var(--color-accent-light);border-radius:var(--radius-lg);border-left:4px solid var(--color-accent)">
        <h2 style="margin:0 0 2px 0;color:var(--text-primary);font-size:var(--text-xl)">${greeting}</h2>
        <p style="margin:0;font-size:var(--text-sm);color:var(--text-secondary)"><time datetime="${new Date().toISOString().slice(0, 10)}">${todayDate}</time></p>
      </div>
    </header>

    <div id="dashboard-nav-guide"></div>
    <div id="dashboard-onboarding"></div>

    <a href="#/haccp/ma-journee" style="display:block;text-decoration:none;margin-bottom:var(--space-4)" aria-label="Ma journée HACCP">
      <div style="background:var(--color-accent);border-radius:var(--radius-lg);padding:var(--space-4);display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);transition:opacity 0.15s" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <i data-lucide="clipboard-check" style="width:28px;height:28px;color:white;flex-shrink:0"></i>
          <div>
            <div style="font-weight:700;color:white;font-size:var(--text-base)">Ma journée HACCP</div>
            <div style="color:rgba(255,255,255,0.85);font-size:var(--text-sm)">Températures, nettoyage, réceptions du jour</div>
          </div>
        </div>
        <i data-lucide="chevron-right" style="width:20px;height:20px;color:white;flex-shrink:0"></i>
      </div>
    </a>

    <div id="dashboard-summary" role="region" aria-label="Résumé du jour" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)"></div>

    <div id="dashboard-alerts" role="region" aria-live="polite" aria-label="Alertes du jour"></div>
    <div id="ai-suggestions-container" role="region" aria-label="Suggestions IA"></div>
    <div id="daily-tip-container" role="region" aria-label="Astuce du jour"></div>

    <div class="page-header">
      <h1>Fiches Techniques</h1>
      ${perms.edit_recipes ? `<a href="#/new" class="btn btn-primary" aria-label="Créer une nouvelle fiche technique"><i data-lucide="plus" style="width:18px;height:18px" aria-hidden="true"></i> Nouvelle fiche</a>` : ''}
    </div>
    <div class="search-bar" role="search">
      <label for="recipe-search" class="visually-hidden">Rechercher une fiche</label>
      <span class="search-icon" aria-hidden="true"><i data-lucide="search"></i></span>
      <input type="search" id="recipe-search" placeholder="Rechercher une fiche..." autocomplete="off" aria-label="Rechercher une fiche">
    </div>
    <div class="recipe-type-filters" role="tablist" aria-label="Filtrer par type de fiche" style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto">
      <button class="haccp-subnav__link active" role="tab" aria-selected="true" data-type="">Tous</button>
      <button class="haccp-subnav__link" role="tab" aria-selected="false" data-type="plat">🍽️ Plats</button>
      <button class="haccp-subnav__link" role="tab" aria-selected="false" data-type="sous_recette">📋 Sous-recettes</button>
      <button class="haccp-subnav__link" role="tab" aria-selected="false" data-type="base">🫕 Bases</button>
    </div>
    <div id="recipe-list" role="region" aria-live="polite" aria-label="Liste des fiches techniques">
      <div class="skeleton skeleton-card" aria-hidden="true"></div>
      <div class="skeleton skeleton-card" aria-hidden="true"></div>
      <div class="skeleton skeleton-card" aria-hidden="true"></div>
      <div class="skeleton skeleton-card" aria-hidden="true"></div>
    </div>
  `;
  lucide.createIcons();

  let recipes = [];
  try {
    const response = await API.getRecipes();
    recipes = response.recipes || [];
  } catch (e) {
    showToast('Erreur de chargement', 'error');
  }

  // Render summary section
  renderDailySummary(recipes, perms);

  const listEl = document.getElementById('recipe-list');
  const searchInput = document.getElementById('recipe-search');
  let currentTypeFilter = '';

  function renderList(filter = '', typeFilter = '') {
    let filtered = recipes;

    if (typeFilter) {
      filtered = filtered.filter(r => (r.recipe_type || 'plat') === typeFilter);
    }

    if (filter) {
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(filter.toLowerCase()) ||
        (r.category || '').toLowerCase().includes(filter.toLowerCase())
      );
    }

    if (filtered.length === 0) {
      listEl.innerHTML = filter || typeFilter ? `
        <div class="empty-state" role="status">
          <div class="empty-icon" aria-hidden="true"><i data-lucide="clipboard-list"></i></div>
          <p>Aucun résultat</p>
        </div>
      ` : `
        <div class="empty-state" role="status">
          <div class="empty-icon" aria-hidden="true"><i data-lucide="mic"></i></div>
          <h3>Créez votre première fiche technique</h3>
          <p>Dictez votre recette, l'IA fait le reste — coûts, portions, procédure.</p>
          ${perms.edit_recipes ? '<a href="#/new" class="btn btn-primary" aria-label="Créer une nouvelle fiche technique">Nouvelle fiche</a>' : ''}
        </div>
      `;
      lucide.createIcons();
      return;
    }

    const p = perms;
    listEl.innerHTML = filtered.map(r => {
      const marginClass = getMarginClass(r.food_cost_percent);
      const costBorderClass = !p.view_costs || r.food_cost_percent == null ? '' :
        r.food_cost_percent < 30 ? 'card--cost-good' :
        r.food_cost_percent <= 35 ? 'card--cost-warning' : 'card--cost-danger';

      const recipeType = r.recipe_type || 'plat';
      const typeBadge = recipeType === 'sous_recette' ? '<span class="recipe-type-badge recipe-type--sub">📋</span>' :
        recipeType === 'base' ? '<span class="recipe-type-badge recipe-type--base">🫕</span>' :
        '<span class="recipe-type-badge recipe-type--plat">🍽️</span>';

      return `
        <div class="card ${costBorderClass}" role="button" tabindex="0" aria-label="Ouvrir la fiche ${escapeHtml(r.name)}" onclick="location.hash='#/recipe/${r.id}'" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();location.hash='#/recipe/${r.id}';}">
          <div class="card-header">
            <span class="card-title">${typeBadge} ${escapeHtml(r.name)}</span>
            ${r.category ? `<span class="card-category">${escapeHtml(r.category)}</span>` : ''}
          </div>
          <div class="card-stats">
            <div>
              <span class="stat-value">${r.portions || 1}</span>
              <span class="stat-label">Portions</span>
            </div>
            ${p.view_costs ? `
            <div>
              <span class="stat-value">${formatCurrency(r.cost_per_portion)}</span>
              <span class="stat-label">Coût matière</span>
            </div>
            <div>
              <span class="stat-value">${formatCurrency(r.selling_price)}</span>
              <span class="stat-label">Prix de vente</span>
            </div>
            <div>
              <span class="stat-value"><span class="margin-badge ${marginClass}">${formatPercent(r.food_cost_percent)}</span></span>
              <span class="stat-label">Food cost</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  renderList();

  searchInput.addEventListener('input', (e) => {
    renderList(e.target.value, currentTypeFilter);
  });

  // Type filter buttons
  document.querySelectorAll('.recipe-type-filters button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.recipe-type-filters button').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentTypeFilter = btn.dataset.type;
      renderList(searchInput.value, currentTypeFilter);
    });
  });

  // Nav orientation guide (dismissible, shown once per major version)
  renderNavGuide();

  // Onboarding checklist (shown until all 4 steps complete)
  renderOnboardingChecklist();

  // AI Suggestions card
  loadAISuggestions();

  // Fetch daily alerts
  try {
    const alertData = await API.request('/alerts/daily-summary');
    const alertsDiv = document.getElementById('dashboard-alerts');
    if (!alertsDiv) return;
    let html = '';
    if (alertData.summary.critical > 0) {
      const details = [];
      if (alertData.dlc_alerts.filter(a => a.days_remaining <= 0).length > 0)
        details.push(`${alertData.dlc_alerts.filter(a => a.days_remaining <= 0).length} DLC expirée(s)`);
      if (alertData.temp_alerts.length > 0)
        details.push(`${alertData.temp_alerts.length} alerte(s) température`);
      html += `<a href="#/haccp" role="alert" aria-label="${alertData.summary.critical} alertes critiques : ${details.join(', ')}" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-danger);color:white;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          <span aria-hidden="true">🚨</span> <strong>${alertData.summary.critical} alerte(s) critique(s)</strong> — ${details.join(', ')}
        </div></a>`;
    }
    if (alertData.summary.warnings > 0) {
      const details = [];
      if (alertData.dlc_alerts.filter(a => a.days_remaining > 0).length > 0)
        details.push(`${alertData.dlc_alerts.filter(a => a.days_remaining > 0).length} DLC proche(s)`);
      if (alertData.low_stock.length > 0)
        details.push(`${alertData.low_stock.length} stock(s) bas`);
      html += `<a href="#/stock" aria-label="${alertData.summary.warnings} avertissements : ${details.join(', ')}" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-warning);color:#000;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          <span aria-hidden="true">⚠️</span> <strong>${alertData.summary.warnings} avertissement(s)</strong> — ${details.join(', ')}
        </div></a>`;
    }
    if (alertData.summary.pending > 0) {
      html += `<a href="#/deliveries" aria-label="${alertData.summary.pending} livraisons en attente" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-info);color:white;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          <span aria-hidden="true">📦</span> <strong>${alertData.summary.pending} livraison(s) en attente</strong>
        </div></a>`;
    }
    if (html) alertsDiv.innerHTML = html;
  } catch (e) {
    // Silently fail — alerts are non-blocking
  }
}

// ═══════════════════════════════════════════
// AI Suggestions Card
// ═══════════════════════════════════════════
const AI_SUGGESTIONS_CACHE_KEY = 'restosuite_suggestions_cache';
const AI_SUGGESTIONS_TTL = 12 * 60 * 60 * 1000; // 12h

async function loadAISuggestions(forceRefresh = false) {
  const container = document.getElementById('ai-suggestions-container');
  if (!container) return;

  // Check cache first unless force-refresh
  if (!forceRefresh) {
    const cached = localStorage.getItem(AI_SUGGESTIONS_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < AI_SUGGESTIONS_TTL) {
          renderAISuggestions(container, data);
          return;
        }
      } catch (e) { /* invalid cache, refetch */ }
    }
  }

  // Show loading state
  container.innerHTML = `
    <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3 style="margin:0"><i data-lucide="lightbulb" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Suggestions IA</h3>
      </div>
      <p class="text-secondary text-sm" role="status" aria-live="polite" style="text-align:center;padding:var(--space-4)">Analyse en cours…</p>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [container] });

  try {
    const data = await API.request('/ai/menu-suggestions');
    if (data.error) throw new Error(data.error);
    if (!data.fallback) {
      localStorage.setItem(AI_SUGGESTIONS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    }
    renderAISuggestions(container, data);
  } catch (e) {
    // Show a minimal error state rather than hiding the section entirely
    container.innerHTML = `
      <section role="region" aria-labelledby="ai-suggestions-heading" style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
          <h3 id="ai-suggestions-heading" style="margin:0"><i data-lucide="lightbulb" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Suggestions IA</h3>
          <button id="btn-refresh-ai" class="btn btn-ghost btn-sm" aria-label="Réessayer les suggestions IA" style="font-size:var(--text-xs)">
            <i data-lucide="refresh-cw" style="width:14px;height:14px" aria-hidden="true"></i> Réessayer
          </button>
        </div>
        <p class="text-secondary text-sm" style="text-align:center;padding:var(--space-2)">Suggestions temporairement indisponibles.</p>
      </section>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    document.getElementById('btn-refresh-ai')?.addEventListener('click', () => {
      localStorage.removeItem(AI_SUGGESTIONS_CACHE_KEY);
      loadAISuggestions(true);
    });
  }
}

function renderAISuggestions(container, data) {
  const topItems = data.top_profitable || data.top_margin || [];
  const improveItems = data.to_improve || [];
  const daily = data.daily_special || null;

  // Show fallback message when no AI data (missing recipe costs etc.)
  if (data.fallback && data.message && topItems.length === 0 && improveItems.length === 0 && !daily) {
    container.innerHTML = `
      <section role="region" aria-labelledby="ai-suggestions-heading" style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
          <h3 id="ai-suggestions-heading" style="margin:0"><i data-lucide="lightbulb" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Suggestions IA</h3>
          <button id="btn-refresh-ai" class="btn btn-ghost btn-sm" aria-label="Actualiser les suggestions IA" style="font-size:var(--text-xs)">
            <i data-lucide="refresh-cw" style="width:14px;height:14px" aria-hidden="true"></i> Actualiser
          </button>
        </div>
        <div style="background:var(--bg-sunken);border-radius:var(--radius-md);padding:var(--space-3);font-size:var(--text-sm);color:var(--text-secondary)">
          <i data-lucide="info" style="width:16px;height:16px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>${escapeHtml(data.message)}
        </div>
      </section>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    document.getElementById('btn-refresh-ai')?.addEventListener('click', () => {
      localStorage.removeItem(AI_SUGGESTIONS_CACHE_KEY);
      loadAISuggestions(true);
    });
    return;
  }

  if (topItems.length === 0 && improveItems.length === 0 && !daily) {
    container.innerHTML = '';
    return;
  }

  let topHtml = '';
  if (topItems.length > 0) {
    topHtml = `
      <div style="margin-bottom:var(--space-3)">
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-success)"><span aria-hidden="true">🟢</span> Plats les plus rentables</h4>
        ${topItems.map(item => `
          <div style="padding:6px 0;border-bottom:1px solid var(--color-border)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(item.name)}</span>
              <span class="badge badge--success" style="font-size:11px">${item.food_cost_pct != null ? item.food_cost_pct : (item.food_cost_percent != null ? item.food_cost_percent : '?')}%</span>
            </div>
            <p class="text-secondary" style="font-size:12px;margin-top:2px">${escapeHtml(item.reason || '')}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  let improveHtml = '';
  if (improveItems.length > 0) {
    improveHtml = `
      <div style="margin-bottom:var(--space-3)">
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-danger)"><span aria-hidden="true">🔴</span> À améliorer</h4>
        ${improveItems.map(item => `
          <div style="padding:6px 0;border-bottom:1px solid var(--color-border)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(item.name)}</span>
              <span class="badge badge--danger" style="font-size:11px">${item.food_cost_pct != null ? item.food_cost_pct : (item.food_cost_percent != null ? item.food_cost_percent : '?')}%</span>
            </div>
            <p class="text-secondary" style="font-size:12px;margin-top:2px">${escapeHtml(item.suggestion || '')}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  let dailyHtml = '';
  if (daily && daily.name && daily.name !== 'Suggestion non disponible') {
    dailyHtml = `
      <div>
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-accent)"><span aria-hidden="true">⭐</span> Suggestion plat du jour</h4>
        <div style="background:rgba(196,90,24,0.08);border-radius:var(--radius-md);padding:var(--space-3);border-left:3px solid var(--color-accent)">
          <strong style="font-size:var(--text-base)">${escapeHtml(daily.name)}</strong>
          <p class="text-secondary" style="font-size:12px;margin-top:4px">${escapeHtml(daily.description || daily.reason || '')}</p>
          ${daily.key_ingredients && daily.key_ingredients.length > 0 ? `
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
              ${daily.key_ingredients.map(ing => `<span style="font-size:11px;background:var(--bg-sunken);padding:2px 6px;border-radius:var(--radius-full);color:var(--text-secondary)">${escapeHtml(ing)}</span>`).join('')}
            </div>` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <section role="region" aria-labelledby="ai-suggestions-heading" style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3 id="ai-suggestions-heading" style="margin:0"><i data-lucide="lightbulb" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Suggestions IA</h3>
        <button id="btn-refresh-ai" class="btn btn-ghost btn-sm" aria-label="Actualiser les suggestions IA" style="font-size:var(--text-xs)" title="Actualiser (cache 12h)">
          <i data-lucide="refresh-cw" style="width:14px;height:14px" aria-hidden="true"></i>
        </button>
      </div>
      ${topHtml}${improveHtml}${dailyHtml}
    </section>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [container] });
  document.getElementById('btn-refresh-ai')?.addEventListener('click', () => {
    localStorage.removeItem(AI_SUGGESTIONS_CACHE_KEY);
    loadAISuggestions(true);
  });
}

// ═══════════════════════════════════════════
// Daily Summary & Tips
// ═══════════════════════════════════════════

function getGreeting(name) {
  const hour = new Date().getHours();
  if (hour < 12) return `Bonjour ${name} 👋`;
  if (hour < 17) return `Bon après-midi ${name} ☀️`;
  return `Bonsoir ${name} 🌙`;
}

// Resolve the best display name we have. Older login flows wrote partial
// account shapes that lacked `name` (only first_name/last_name) — without a
// fallback chain the greeting collapses to "Bonjour Chef" on every return-nav
// for those sessions. If everything is missing we kick off /auth/me to
// repopulate localStorage and patch the rendered greeting in place.
function _dashboardDisplayName(account) {
  if (!account) return 'Chef';
  if (account.name) return account.name;
  const composite = [account.first_name, account.last_name].filter(Boolean).join(' ').trim();
  if (composite) return composite;
  // Stale localStorage — refresh in the background and update the H2 once we
  // have a real name. Same pattern as feedback_role_check_refresh_localstorage.
  if (typeof API !== 'undefined' && typeof API.getMe === 'function') {
    API.getMe().then(result => {
      const fresh = result && result.account;
      if (!fresh) return;
      try { localStorage.setItem('restosuite_account', JSON.stringify(fresh)); } catch {}
      const fresher = fresh.name
        || [fresh.first_name, fresh.last_name].filter(Boolean).join(' ').trim();
      if (!fresher) return;
      const headerH2 = document.querySelector('#dashboard-greeting h2');
      if (headerH2) headerH2.textContent = getGreeting(fresher);
    }).catch(() => { /* leave the 'Chef' fallback in place */ });
  }
  return 'Chef';
}

function formatFrenchDate(date) {
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthName} ${year}`;
}

function renderDailySummary(recipes, perms) {
  const summaryEl = document.getElementById('dashboard-summary');
  if (!summaryEl) return;

  let html = `
    <a href="#/recipes" role="group" aria-label="Nombre de fiches techniques — voir la liste" style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--space-3);text-align:center;text-decoration:none;display:block;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s" onmouseover="this.style.borderColor='var(--color-accent)';this.style.boxShadow='0 0 0 2px var(--color-accent-light)'" onmouseout="this.style.borderColor='';this.style.boxShadow=''">
      <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${recipes.length}</div>
      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Fiches techniques</div>
    </a>
  `;

  if (perms.view_costs && recipes.length > 0) {
    const totalCost = recipes.reduce((sum, r) => sum + (r.total_cost || 0), 0);
    html += `
      <a href="#/analytics" role="group" aria-label="Coût total matière — voir l'analyse" style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--space-3);text-align:center;text-decoration:none;display:block;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s" onmouseover="this.style.borderColor='var(--color-success)';this.style.boxShadow='0 0 0 2px rgba(var(--color-success-rgb,34,197,94),0.15)'" onmouseout="this.style.borderColor='';this.style.boxShadow=''">
        <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-success)">${formatCurrency(totalCost)}</div>
        <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Coût total matière</div>
      </a>
    `;
  }

  // Daily tip
  const dailyTip = getDailyTip();
  const tipEl = document.getElementById('daily-tip-container');
  if (tipEl) {
    tipEl.innerHTML = `
      <aside role="complementary" aria-labelledby="daily-tip-heading" style="background:linear-gradient(135deg, var(--color-accent-light), var(--bg-elevated));border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
        <div style="display:flex;gap:var(--space-3);align-items:flex-start">
          <span style="font-size:24px" aria-hidden="true">💡</span>
          <div>
            <h3 id="daily-tip-heading" style="margin:0 0 4px 0;font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">Conseil du jour</h3>
            <p style="margin:0;font-size:var(--text-sm);color:var(--text-secondary)">${dailyTip}</p>
          </div>
        </div>
      </aside>
    `;
  }

  summaryEl.innerHTML = html;
}

function getDailyTip() {
  const tips = [
    'Vérifiez vos fiches techniques une fois par mois pour ajuster les coûts selon la mercuriale.',
    'Un food cost entre 25-30% est la cible idéale pour les restaurants. Trop élevé ? Révisez vos recettes.',
    'Utilisez les sous-recettes pour factoriser les préparations communes et simplifier votre gestion.',
    'La HACCP n\'est pas juste une conformité : c\'est la base de la confiance clients et de la qualité.',
    'Scannez vos factures avec le scanner de résumé pour indexer automatiquement vos achats dans la mercuriale.',
    'Les pertes matière varient par saison. Adjustez-les dans vos fiches pour plus de précision.',
    'Analysez vos marges par catégorie (plat, entrée, dessert) pour trouver vos meilleurs vendeurs.',
    'La mercuriale vous donne les prix du marché en temps réel. Utilisez-la pour négocier avec vos fournisseurs.',
    'Créez des fiches de bases (sauces, bouillons) réutilisables plutôt que de les reduplifier dans chaque recette.',
    'Les alertes DLC vous avertissent avant la date d\'expiration. Travaillez avec vos stocks pour zéro gaspillage.',
    'Documentez vos procédures de nettoyage dans HACCP pour garantir l\'hygiène et former votre équipe.',
    'Les codes QR facilitent la traçabilité. Imprimez-les pour vos ingrédients critiques (allergènes, origines).',
    'Le travail en équipe est plus simple si tout le monde utilise RestoSuite. Importez vos collègues !',
    'Mettez à jour vos portions quand vous changerez de fournisseur, c\'est plus rapide que de recréer une fiche.',
    'Les KPIs : food cost, marge brute, volume vendus. Suivez-les chaque semaine pour piloter votre resto.',
    'Une recette complète inclut les temps de préparation et cuisson. Mettez à jour pour l\'optimisation du planning.',
    'Les ingrédients génériques sont moins chers. Demandez à votre fournisseur une alternative premium/économique.',
    'Exploitez les pics de saison : artichauts en printemps, champignons en automne, fraises en été.',
    'Le gaspillage coûte. Diminuez les pertes matière en optimisant vos découpes et portions.',
    'Testez vos recettes à l\'échelle avant de les lancer. RestoSuite vous aide à scaler les portions facilement.'
  ];

  const day = new Date().getDate();
  return tips[day % tips.length];
}
