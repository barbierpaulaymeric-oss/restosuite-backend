// ═══════════════════════════════════════════
// Dashboard — Fiches Techniques (with recipe type filter)
// ═══════════════════════════════════════════

async function renderOnboardingChecklist() {
  const container = document.getElementById('dashboard-onboarding');
  if (!container) return;
  try {
    const data = await API.getOnboardingChecklist();
    if (!data || data.progress >= 1) { container.innerHTML = ''; return; }

    const pct = Math.round(data.progress * 100);
    container.innerHTML = `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
          <h3 style="margin:0;font-size:var(--text-base)">🚀 Prise en main</h3>
          <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-accent)">${pct}%</span>
        </div>
        <div style="height:6px;background:var(--bg-sunken);border-radius:var(--radius-full);margin-bottom:var(--space-3);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--color-accent);border-radius:var(--radius-full);transition:width 0.6s ease"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${data.steps.map(step => `
            <a ${step.done ? '' : `href="${step.route}"`} class="onboarding-step${step.done ? ' done' : ''}" style="${step.done ? 'pointer-events:none' : ''}">
              <span class="onboarding-step__check">
                ${step.done
                  ? '<i data-lucide="check-circle-2" style="color:var(--color-success);width:20px;height:20px;flex-shrink:0"></i>'
                  : '<i data-lucide="circle" style="color:var(--text-tertiary);width:20px;height:20px;flex-shrink:0"></i>'
                }
              </span>
              <span class="onboarding-step__label">${escapeHtml(step.label)}</span>
              ${!step.done ? '<i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary);margin-left:auto;flex-shrink:0"></i>' : ''}
            </a>
          `).join('')}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  } catch (e) {
    if (container) container.innerHTML = '';
  }
}

async function renderDashboard() {
  const app = document.getElementById('app');
  const perms = getPermissions();
  const account = getAccount();
  const greeting = getGreeting(account ? account.name : 'Chef');
  const todayDate = formatFrenchDate(new Date());

  app.innerHTML = `
    <div id="dashboard-greeting" style="margin-bottom:var(--space-4)">
      <div style="padding:var(--space-4);background:var(--color-accent-light);border-radius:var(--radius-lg);border-left:4px solid var(--color-accent)">
        <h2 style="margin:0 0 2px 0;color:var(--text-primary);font-size:var(--text-xl)">${greeting}</h2>
        <p style="margin:0;font-size:var(--text-sm);color:var(--text-secondary)">${todayDate}</p>
      </div>
    </div>

    <div id="dashboard-onboarding"></div>
    <div id="dashboard-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)"></div>

    <div id="dashboard-alerts"></div>
    <div id="ai-suggestions-container"></div>
    <div id="daily-tip-container"></div>

    <div class="page-header">
      <h1>Fiches Techniques</h1>
      ${perms.edit_recipes ? `<a href="#/new" class="btn btn-primary"><i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle fiche</a>` : ''}
    </div>
    <div class="search-bar">
      <span class="search-icon"><i data-lucide="search"></i></span>
      <input type="text" id="recipe-search" placeholder="Rechercher une fiche..." autocomplete="off">
    </div>
    <div class="recipe-type-filters" style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto">
      <button class="haccp-subnav__link active" data-type="">Tous</button>
      <button class="haccp-subnav__link" data-type="plat">🍽️ Plats</button>
      <button class="haccp-subnav__link" data-type="sous_recette">📋 Sous-recettes</button>
      <button class="haccp-subnav__link" data-type="base">🫕 Bases</button>
    </div>
    <div id="recipe-list">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
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
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="clipboard-list"></i></div>
          <p>Aucun résultat</p>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">🎤</div>
          <h3>Créez votre première fiche technique</h3>
          <p>Dictez votre recette, l'IA fait le reste — coûts, portions, procédure.</p>
          ${perms.edit_recipes ? '<a href="#/new" class="btn btn-primary">Nouvelle fiche</a>' : ''}
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
        <div class="card ${costBorderClass}" onclick="location.hash='#/recipe/${r.id}'">
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
      document.querySelectorAll('.recipe-type-filters button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTypeFilter = btn.dataset.type;
      renderList(searchInput.value, currentTypeFilter);
    });
  });

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
      html += `<a href="#/haccp" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-danger);color:white;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          🚨 <strong>${alertData.summary.critical} alerte(s) critique(s)</strong> — ${details.join(', ')}
        </div></a>`;
    }
    if (alertData.summary.warnings > 0) {
      const details = [];
      if (alertData.dlc_alerts.filter(a => a.days_remaining > 0).length > 0)
        details.push(`${alertData.dlc_alerts.filter(a => a.days_remaining > 0).length} DLC proche(s)`);
      if (alertData.low_stock.length > 0)
        details.push(`${alertData.low_stock.length} stock(s) bas`);
      html += `<a href="#/stock" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-warning);color:#000;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          ⚠️ <strong>${alertData.summary.warnings} avertissement(s)</strong> — ${details.join(', ')}
        </div></a>`;
    }
    if (alertData.summary.pending > 0) {
      html += `<a href="#/deliveries" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-info);color:white;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          📦 <strong>${alertData.summary.pending} livraison(s) en attente</strong>
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
async function loadAISuggestions() {
  const container = document.getElementById('ai-suggestions-container');
  if (!container) return;

  // Check cache first (24h TTL)
  const cacheKey = 'restosuite_suggestions_cache';
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        renderAISuggestions(container, data);
        return;
      }
    } catch (e) { /* invalid cache */ }
  }

  // Show loading state
  container.innerHTML = `
    <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3 style="margin:0">💡 Suggestions IA</h3>
      </div>
      <p class="text-secondary text-sm" style="text-align:center;padding:var(--space-4)">Analyse en cours…</p>
    </div>
  `;

  try {
    const data = await API.request('/ai/menu-suggestions');
    if (data.error) throw new Error(data.error);
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    renderAISuggestions(container, data);
  } catch (e) {
    container.innerHTML = '';
  }
}

function renderAISuggestions(container, data) {
  const topItems = data.top_profitable || data.top_margin || [];
  const improveItems = data.to_improve || [];
  const daily = data.daily_special || null;

  if (topItems.length === 0 && improveItems.length === 0 && !daily) {
    container.innerHTML = '';
    return;
  }

  let topHtml = '';
  if (topItems.length > 0) {
    topHtml = `
      <div style="margin-bottom:var(--space-3)">
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-success)">🟢 Plats les plus rentables</h4>
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
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-danger)">🔴 À améliorer</h4>
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
  if (daily && daily.name) {
    dailyHtml = `
      <div>
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-accent)">⭐ Suggestion plat du jour</h4>
        <div style="background:rgba(232,114,42,0.1);border-radius:var(--radius-md);padding:var(--space-3)">
          <strong>${escapeHtml(daily.name)}</strong>
          <p class="text-secondary" style="font-size:12px;margin-top:4px">${escapeHtml(daily.description || daily.reason || '')}</p>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3 style="margin:0">💡 Suggestions IA</h3>
        <button class="btn btn-secondary btn-sm" onclick="refreshAISuggestions()" title="Rafraîchir" style="padding:4px 8px">🔄</button>
      </div>
      ${topHtml}${improveHtml}${dailyHtml}
    </div>
  `;
}

async function refreshAISuggestions() {
  localStorage.removeItem('restosuite_suggestions_cache');
  await loadAISuggestions();
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
    <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--space-3);text-align:center">
      <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${recipes.length}</div>
      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Fiches techniques</div>
    </div>
  `;

  if (perms.view_costs && recipes.length > 0) {
    const totalCost = recipes.reduce((sum, r) => sum + (r.total_cost || 0), 0);
    html += `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-success)">${formatCurrency(totalCost)}</div>
        <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Coût total matière</div>
      </div>
    `;
  }

  // Daily tip
  const dailyTip = getDailyTip();
  const tipEl = document.getElementById('daily-tip-container');
  if (tipEl) {
    tipEl.innerHTML = `
      <div style="background:linear-gradient(135deg, var(--color-accent-light), var(--bg-elevated));border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
        <div style="display:flex;gap:var(--space-3);align-items:flex-start">
          <span style="font-size:24px">💡</span>
          <div>
            <h3 style="margin:0 0 4px 0;font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">Conseil du jour</h3>
            <p style="margin:0;font-size:var(--text-sm);color:var(--text-secondary)">${dailyTip}</p>
          </div>
        </div>
      </div>
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
