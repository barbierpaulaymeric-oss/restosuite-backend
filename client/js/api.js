// ═══════════════════════════════════════════
// RestoSuite AI — API Client
// ═══════════════════════════════════════════

const API = {
  base: '/api',

  async request(path, options = {}) {
    const url = this.base + path;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
    const res = await fetch(url, config);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.details || 'Erreur serveur');
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return res.json();
    }
    return res.text();
  },

  // Ingredients
  getIngredients(q) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.request(`/ingredients${qs}`);
  },
  createIngredient(data) {
    return this.request('/ingredients', { method: 'POST', body: data });
  },
  updateIngredient(id, data) {
    return this.request(`/ingredients/${id}`, { method: 'PUT', body: data });
  },
  deleteIngredient(id) {
    return this.request(`/ingredients/${id}`, { method: 'DELETE' });
  },
  getIngredientPrices(id) {
    return this.request(`/ingredients/${id}/prices`);
  },

  // Suppliers
  getSuppliers() {
    return this.request('/suppliers');
  },
  createSupplier(data) {
    return this.request('/suppliers', { method: 'POST', body: data });
  },
  updateSupplier(id, data) {
    return this.request(`/suppliers/${id}`, { method: 'PUT', body: data });
  },
  getSupplierPrices(id) {
    return this.request(`/suppliers/${id}/prices`);
  },

  // Prices
  setPrice(data) {
    return this.request('/prices', { method: 'POST', body: data });
  },

  // Recipes
  getRecipes() {
    return this.request('/recipes');
  },
  getRecipe(id) {
    return this.request(`/recipes/${id}`);
  },
  createRecipe(data) {
    return this.request('/recipes', { method: 'POST', body: data });
  },
  updateRecipe(id, data) {
    return this.request(`/recipes/${id}`, { method: 'PUT', body: data });
  },
  deleteRecipe(id) {
    return this.request(`/recipes/${id}`, { method: 'DELETE' });
  },
  getRecipePdf(id) {
    return this.request(`/recipes/${id}/pdf`);
  },

  // AI
  parseVoice(text) {
    return this.request('/ai/parse-voice', { method: 'POST', body: { text } });
  },
  suggestSuppliers(ingredientIds) {
    return this.request('/ai/suggest-suppliers', { method: 'POST', body: { ingredient_ids: ingredientIds } });
  },
};

// ─── Toast utility ───
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Format helpers ───
function formatCurrency(val) {
  if (val == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);
}

function formatPercent(val) {
  if (val == null) return '—';
  return val.toFixed(1) + '%';
}

function getMarginClass(foodCostPercent) {
  if (foodCostPercent == null) return '';
  if (foodCostPercent < 30) return 'margin-excellent';
  if (foodCostPercent <= 35) return 'margin-good';
  return 'margin-attention';
}

function getMarginLabel(foodCostPercent) {
  if (foodCostPercent == null) return '';
  if (foodCostPercent < 30) return 'Excellent';
  if (foodCostPercent <= 35) return 'Correct';
  return 'Attention';
}

function renderStars(rating, interactive = false, onChange = null) {
  let html = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    html += `<span class="star" data-value="${i}" ${interactive ? 'style="cursor:pointer"' : ''}>${filled ? '★' : '☆'}</span>`;
  }
  html += '</span>';
  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
