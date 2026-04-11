// ═══════════════════════════════════════════
// Bilan Carbone — Empreinte environnementale
// ═══════════════════════════════════════════

async function renderCarbon() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="leaf" style="width:28px;height:28px;color:#16A34A"></i>
        Bilan Carbone
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Estimez l'empreinte environnementale de votre carte (ADEME)</p>
    </div>

    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4)">
      <button class="btn btn-primary carbon-tab-btn active" data-tab="recipes" onclick="switchCarbonTab('recipes')">Par recette</button>
      <button class="btn btn-secondary carbon-tab-btn" data-tab="global" onclick="switchCarbonTab('global')">Bilan global</button>
    </div>

    <div id="carbon-content">
      <div style="text-align:center;padding:var(--space-6)">
        <div class="loading-spinner"></div>
        <p class="text-secondary" style="margin-top:var(--space-2)">Calcul en cours…</p>
      </div>
    </div>

    <style>
      .carbon-tab-btn.active { background:var(--color-accent);color:white }
      .carbon-rating { display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;font-weight:700;font-size:var(--text-base);color:white }
      .carbon-rating-A { background:#16A34A }
      .carbon-rating-B { background:#65A30D }
      .carbon-rating-C { background:#CA8A04 }
      .carbon-rating-D { background:#EA580C }
      .carbon-rating-E { background:#DC2626 }
      .carbon-bar { height:8px;border-radius:4px;transition:width 0.5s }
    </style>
  `;
  if (window.lucide) lucide.createIcons();

  await loadCarbonRecipes();
}

let _carbonRecipes = null;
let _carbonGlobal = null;

function switchCarbonTab(tab) {
  document.querySelectorAll('.carbon-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.className = b.classList.contains('active') ? 'btn btn-primary carbon-tab-btn active' : 'btn btn-secondary carbon-tab-btn';
  });
  if (tab === 'recipes') loadCarbonRecipes();
  else loadCarbonGlobal();
}

async function loadCarbonRecipes() {
  const content = document.getElementById('carbon-content');
  try {
    if (!_carbonRecipes) {
      _carbonRecipes = await API.request('/carbon/recipes');
    }
    renderCarbonRecipes(_carbonRecipes);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}

async function loadCarbonGlobal() {
  const content = document.getElementById('carbon-content');
  content.innerHTML = '<div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>';
  try {
    if (!_carbonGlobal) {
      _carbonGlobal = await API.request('/carbon/global?days=30');
    }
    renderCarbonGlobal(_carbonGlobal);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}

function renderCarbonRecipes(data) {
  const content = document.getElementById('carbon-content');
  const s = data.summary;

  content.innerHTML = `
    <!-- Rating Distribution -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-2);margin-bottom:var(--space-4)">
      ${['A','B','C','D','E'].map(r => `
        <div class="card" style="text-align:center;padding:var(--space-3)">
          <div class="carbon-rating carbon-rating-${r}" style="margin:0 auto var(--space-1)">${r}</div>
          <div style="font-size:var(--text-xl);font-weight:700">${s.rating_distribution[r]}</div>
          <div class="text-secondary" style="font-size:10px">${r === 'A' ? '< 0.5 kg' : r === 'B' ? '< 1 kg' : r === 'C' ? '< 2 kg' : r === 'D' ? '< 4 kg' : '≥ 4 kg'}</div>
        </div>
      `).join('')}
    </div>

    <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-4);text-align:center">
      <span class="text-secondary">Émission moyenne par portion :</span>
      <span style="font-size:var(--text-xl);font-weight:700;margin-left:8px">${s.avg_co2_per_portion.toFixed(2)} kg CO₂e</span>
    </div>

    <!-- Recipe List -->
    <div style="display:flex;flex-direction:column;gap:var(--space-2)">
      ${data.recipes.map(r => `
        <div class="card" style="padding:var(--space-3)">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div class="carbon-rating carbon-rating-${r.rating}">${r.rating}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:var(--space-2)">
                <a href="#/recipes/${r.id}" style="font-weight:600;text-decoration:none;color:inherit">${escapeHtml(r.name)}</a>
                <span class="text-secondary text-sm">${escapeHtml(r.category)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:var(--space-3);margin-top:4px">
                <span class="text-secondary text-sm">${r.co2_per_portion.toFixed(2)} kg CO₂e / portion</span>
                <span class="text-secondary text-sm">${r.total_co2_kg.toFixed(2)} kg total</span>
              </div>
              ${r.breakdown.length > 0 ? `
              <div style="margin-top:8px">
                <div style="display:flex;gap:2px;height:6px;border-radius:3px;overflow:hidden">
                  ${r.breakdown.slice(0, 5).map(b => {
                    const pct = r.total_co2_kg > 0 ? (b.co2_kg / r.total_co2_kg) * 100 : 0;
                    const color = b.factor >= 10 ? '#DC2626' : b.factor >= 5 ? '#EA580C' : b.factor >= 2 ? '#CA8A04' : '#16A34A';
                    return `<div style="width:${Math.max(pct, 2)}%;background:${color}" title="${b.ingredient}: ${b.co2_kg.toFixed(3)} kg CO₂e"></div>`;
                  }).join('')}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;font-size:10px;color:var(--text-tertiary)">
                  ${r.breakdown.slice(0, 3).map(b => `${b.ingredient} (${(r.total_co2_kg > 0 ? (b.co2_kg / r.total_co2_kg * 100) : 0).toFixed(0)}%)`).join(' · ')}
                </div>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCarbonGlobal(data) {
  const content = document.getElementById('carbon-content');
  const maxCat = data.categories.length > 0 ? data.categories[0].co2_kg : 1;

  content.innerHTML = `
    <!-- Global KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-4);text-align:center;border-left:4px solid #16A34A">
        <div style="font-size:1.5rem">🌍</div>
        <div style="font-size:var(--text-2xl);font-weight:700">${data.total_co2_kg.toFixed(0)}</div>
        <div class="text-secondary text-sm">kg CO₂e total (${data.period_days}j)</div>
      </div>
      <div class="card" style="padding:var(--space-4);text-align:center;border-left:4px solid #065F46">
        <div style="font-size:1.5rem">📅</div>
        <div style="font-size:var(--text-2xl);font-weight:700">${data.daily_avg_co2.toFixed(1)}</div>
        <div class="text-secondary text-sm">kg CO₂e / jour</div>
      </div>
    </div>

    <!-- Equivalents -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Équivalences</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3)">
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span style="font-size:1.5rem">🚗</span>
          <div>
            <div style="font-weight:600">${data.equivalents.car_km.toLocaleString('fr-FR')} km</div>
            <div class="text-secondary text-sm">en voiture</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span style="font-size:1.5rem">🌳</span>
          <div>
            <div style="font-weight:600">${data.equivalents.tree_days.toLocaleString('fr-FR')} jours-arbre</div>
            <div class="text-secondary text-sm">pour compenser</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span style="font-size:1.5rem">✈️</span>
          <div>
            <div style="font-weight:600">${data.equivalents.flights_paris_marseille} vols</div>
            <div class="text-secondary text-sm">Paris → Marseille</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Categories Breakdown -->
    <div class="card" style="padding:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Répartition par catégorie</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        ${data.categories.map(c => `
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-weight:500">${escapeHtml(c.name)}</span>
              <span style="font-weight:600">${c.co2_kg.toFixed(1)} kg CO₂e <span class="text-secondary text-sm">(${c.pct}%)</span></span>
            </div>
            <div style="width:100%;background:var(--bg-sunken);border-radius:4px;height:8px;overflow:hidden">
              <div class="carbon-bar" style="width:${(c.co2_kg / maxCat * 100).toFixed(1)}%;background:${c.pct > 40 ? '#DC2626' : c.pct > 20 ? '#EA580C' : c.pct > 10 ? '#CA8A04' : '#16A34A'}"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card" style="padding:var(--space-3);margin-top:var(--space-4);background:rgba(22,163,74,0.05);border-color:rgba(22,163,74,0.2)">
      <p class="text-secondary text-sm" style="margin:0">
        💡 <strong>Conseils :</strong> Réduisez l'empreinte carbone en privilégiant les protéines végétales,
        en limitant le boeuf/agneau, en choisissant des produits de saison et locaux, et en réduisant le gaspillage alimentaire.
      </p>
    </div>
  `;
}
