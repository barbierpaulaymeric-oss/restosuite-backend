// ═══════════════════════════════════════════
// Recipe Detail — Fiche Technique
// ═══════════════════════════════════════════

async function renderRecipeDetail(id) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  let recipe;
  try {
    recipe = await API.getRecipe(id);
  } catch (e) {
    app.innerHTML = '<div class="empty-state"><p>Fiche introuvable</p><a href="#/" class="btn btn-secondary">← Retour</a></div>';
    return;
  }

  const marginClass = getMarginClass(recipe.food_cost_percent);

  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/" style="color:var(--text-muted);text-decoration:none;font-size:0.85rem">← Fiches techniques</a>
        <h1 style="margin-top:4px">${escapeHtml(recipe.name)}</h1>
        ${recipe.category ? `<span class="card-category" style="margin-top:4px;display:inline-block">${escapeHtml(recipe.category)}</span>` : ''}
      </div>
    </div>

    <div class="recipe-summary">
      <div class="summary-card">
        <div class="summary-value">${recipe.portions || 1}</div>
        <div class="summary-label">Portions</div>
      </div>
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.total_cost)}</div>
        <div class="summary-label">Coût total</div>
      </div>
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.cost_per_portion)}</div>
        <div class="summary-label">Coût / portion</div>
      </div>
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.selling_price)}</div>
        <div class="summary-label">Prix de vente</div>
      </div>
      <div class="summary-card">
        <div class="summary-value"><span class="margin-badge ${marginClass}">${formatPercent(recipe.food_cost_percent)}</span></div>
        <div class="summary-label">Food cost</div>
      </div>
      ${recipe.margin != null ? `
      <div class="summary-card">
        <div class="summary-value mono text-success">${formatCurrency(recipe.margin)}</div>
        <div class="summary-label">Marge</div>
      </div>` : ''}
    </div>

    ${recipe.prep_time_min || recipe.cooking_time_min ? `
    <div style="display:flex;gap:16px;color:var(--text-secondary);font-size:0.85rem;margin-bottom:16px">
      ${recipe.prep_time_min ? `<span>⏱️ Préparation : ${recipe.prep_time_min} min</span>` : ''}
      ${recipe.cooking_time_min ? `<span>🔥 Cuisson : ${recipe.cooking_time_min} min</span>` : ''}
    </div>` : ''}

    <div class="section-title">Ingrédients</div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Ingrédient</th>
            <th style="text-align:right">Brut</th>
            <th style="text-align:right">Net</th>
            <th style="text-align:right">Perte</th>
            <th style="text-align:right">Coût</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${recipe.ingredients.map(ing => {
            const waste = ing.custom_waste_percent ?? ing.default_waste_percent ?? 0;
            return `
            <tr>
              <td>${escapeHtml(ing.ingredient_name)}</td>
              <td class="mono" style="text-align:right">${ing.gross_quantity}${ing.unit}</td>
              <td class="mono" style="text-align:right">${(ing.net_quantity || ing.gross_quantity).toFixed(1)}${ing.unit}</td>
              <td class="mono" style="text-align:right">${waste}%</td>
              <td class="mono" style="text-align:right">${formatCurrency(ing.cost)}</td>
              <td class="text-muted" style="font-size:0.8rem;font-style:italic">${escapeHtml(ing.notes)}</td>
            </tr>`;
          }).join('')}
          <tr style="border-top:2px solid var(--border);font-weight:700">
            <td colspan="4">TOTAL</td>
            <td class="mono" style="text-align:right">${formatCurrency(recipe.total_cost)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    ${recipe.steps.length > 0 ? `
    <div class="section-title">Procédure</div>
    <ol class="steps-list">
      ${recipe.steps.map(s => `<li><span>${escapeHtml(s.instruction)}</span></li>`).join('')}
    </ol>` : ''}

    ${recipe.notes ? `
    <div class="section-title">Notes</div>
    <p style="color:var(--text-secondary);font-size:0.9rem">${escapeHtml(recipe.notes)}</p>` : ''}

    <div class="actions-row">
      <a href="#/edit/${recipe.id}" class="btn btn-primary">✏️ Modifier</a>
      <button class="btn btn-secondary" onclick="exportRecipe(${recipe.id})">📄 Exporter</button>
      <button class="btn btn-danger" onclick="deleteRecipe(${recipe.id})">🗑️ Supprimer</button>
    </div>
  `;
}

async function deleteRecipe(id) {
  if (!confirm('Supprimer cette fiche technique ?')) return;
  try {
    await API.deleteRecipe(id);
    showToast('Fiche supprimée', 'success');
    location.hash = '#/';
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function exportRecipe(id) {
  try {
    const text = await API.getRecipePdf(id);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiche-technique-${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export téléchargé', 'success');
  } catch (e) {
    showToast('Erreur export', 'error');
  }
}
