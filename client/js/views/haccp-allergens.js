// ═══════════════════════════════════════════
// HACCP Allergènes INCO — Route #/haccp/allergens
// Règlement (UE) n°1169/2011 — 14 allergènes majeurs
// ═══════════════════════════════════════════

// Codes MUST match the server's INCO_ALLERGENS in server/routes/allergens.js
// (French codes: gluten, crustaces, oeufs, poissons, arachides, soja, lait,
// fruits_coque, celeri, moutarde, sesame, sulfites, lupin, mollusques).
const ALLERGEN_LABELS = {
  gluten:       { label: 'Gluten',         icon: '🌾' },
  crustaces:    { label: 'Crustacés',      icon: '🦀' },
  oeufs:        { label: 'Œufs',           icon: '🥚' },
  poissons:     { label: 'Poissons',       icon: '🐟' },
  arachides:    { label: 'Arachides',      icon: '🥜' },
  soja:         { label: 'Soja',           icon: '🫘' },
  lait:         { label: 'Lait',           icon: '🥛' },
  fruits_coque: { label: 'Fruits à coque', icon: '🌰' },
  celeri:       { label: 'Céleri',         icon: '🌿' },
  moutarde:     { label: 'Moutarde',       icon: '🟡' },
  sesame:       { label: 'Sésame',         icon: '⚪' },
  sulfites:     { label: 'Sulfites',       icon: '🍷' },
  lupin:        { label: 'Lupin',          icon: '🌸' },
  mollusques:   { label: 'Mollusques',     icon: '🐚' },
};

async function renderHACCPAllergens() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.getAllergenMenuDisplay();
    const byCategory = {};
    items.forEach(recipe => {
      const cat = recipe.category || 'Sans catégorie';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(recipe);
    });

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="alert-triangle" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Allergènes — Affichage INCO</h1>
          <button class="btn btn-secondary" onclick="window.print()">
            <i data-lucide="printer" style="width:18px;height:18px"></i> Imprimer
          </button>
        </div>
        ${haccpBreadcrumb('tracabilite')}
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">Règlement INCO (UE) n°1169/2011 — Les 14 allergènes majeurs doivent être portés à la connaissance des consommateurs. Peut être affiché en salle ou remis sur demande.</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;padding:12px;background:var(--color-bg-secondary,#f8f9fa);border-radius:8px">
          ${Object.entries(ALLERGEN_LABELS).map(([k, v]) => `
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--text-sm);padding:4px 8px;background:white;border-radius:4px;border:1px solid var(--color-border,#e0e0e0)">
              ${v.icon} <strong>${v.label}</strong>
            </span>
          `).join('')}
        </div>
        ${Object.entries(byCategory).map(([category, recipes]) => `
          <div style="margin-bottom:24px">
            <div class="section-title">${escapeHtml(category)}</div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="min-width:180px">Plat</th>
                    ${Object.entries(ALLERGEN_LABELS).map(([k, v]) => `<th style="text-align:center;min-width:44px" title="${v.label}">${v.icon}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${recipes.map(recipe => `
                    <tr>
                      <td style="font-weight:500">${escapeHtml(recipe.name)}</td>
                      ${Object.keys(ALLERGEN_LABELS).map(k => `
                        <td style="text-align:center">${recipe.allergen_codes.includes(k) ? '<span style="color:var(--color-danger,#dc3545);font-size:16px;font-weight:700">●</span>' : ''}</td>
                      `).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
        ${items.length === 0 ? '<div class="empty-state"><p>Aucune recette avec allergènes. Renseignez les allergènes dans les fiches ingrédients.</p></div>' : ''}
        <p class="text-secondary text-sm" style="margin-top:16px">* Généré depuis les fiches recettes. Vérifiez que tous les ingrédients sont correctement renseignés.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
