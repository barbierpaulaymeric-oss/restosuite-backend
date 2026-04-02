// ═══════════════════════════════════════════
// RestoSuite AI — API Client
// ═══════════════════════════════════════════

const API = {
  base: window.location.origin + '/api',

  async request(path, options = {}) {
    const url = this.base + path;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };

    // Inject account_id header for trial middleware
    const account = typeof getAccount === 'function' ? getAccount() : null;
    if (account && account.id) {
      config.headers['X-Account-Id'] = String(account.id);
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
    const res = await fetch(url, config);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      // Handle trial expired specifically
      if (err.code === 'TRIAL_EXPIRED') {
        showToast('Passez en Pro pour continuer à utiliser RestoSuite', 'error');
        throw new Error(err.error);
      }
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

  // Accounts
  getAccounts() {
    return this.request('/accounts');
  },
  createAccount(data) {
    return this.request('/accounts', { method: 'POST', body: data });
  },
  loginAccount(id, pin) {
    return this.request('/accounts/login', { method: 'POST', body: { id, pin } });
  },
  updateAccount(id, data) {
    return this.request(`/accounts/${id}`, { method: 'PUT', body: data });
  },
  deleteAccount(id, callerId) {
    return this.request(`/accounts/${id}?caller_id=${callerId}`, { method: 'DELETE' });
  },

  // ─── HACCP ───
  // Zones
  getHACCPZones() { return this.request('/haccp/zones'); },
  createHACCPZone(data) { return this.request('/haccp/zones', { method: 'POST', body: data }); },
  updateHACCPZone(id, data) { return this.request(`/haccp/zones/${id}`, { method: 'PUT', body: data }); },
  deleteHACCPZone(id) { return this.request(`/haccp/zones/${id}`, { method: 'DELETE' }); },

  // Temperature logs
  getTemperatures(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/haccp/temperatures${qs ? '?' + qs : ''}`);
  },
  recordTemperature(data) { return this.request('/haccp/temperatures', { method: 'POST', body: data }); },
  getTemperaturesToday() { return this.request('/haccp/temperatures/today'); },
  getTemperatureAlerts() { return this.request('/haccp/temperatures/alerts'); },

  // Cleaning
  getCleaningTasks() { return this.request('/haccp/cleaning'); },
  createCleaningTask(data) { return this.request('/haccp/cleaning', { method: 'POST', body: data }); },
  updateCleaningTask(id, data) { return this.request(`/haccp/cleaning/${id}`, { method: 'PUT', body: data }); },
  deleteCleaningTask(id) { return this.request(`/haccp/cleaning/${id}`, { method: 'DELETE' }); },
  markCleaningDone(id, data) { return this.request(`/haccp/cleaning/${id}/done`, { method: 'POST', body: data }); },
  getCleaningToday() { return this.request('/haccp/cleaning/today'); },

  // Traceability
  getTraceability(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/haccp/traceability${qs ? '?' + qs : ''}`);
  },
  createTraceability(data) { return this.request('/haccp/traceability', { method: 'POST', body: data }); },
  getDLCAlerts() { return this.request('/haccp/traceability/dlc-alerts'); },

  // HACCP PDF exports — returns blob URL
  async getHACCPExportUrl(type, from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const url = `${this.base}/haccp/export/${type}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erreur export PDF');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // ─── Stock ───
  getStock(q) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.request(`/stock${qs}`);
  },
  getStockAlerts() { return this.request('/stock/alerts'); },
  postReception(data) { return this.request('/stock/reception', { method: 'POST', body: data }); },
  postStockLoss(data) { return this.request('/stock/loss', { method: 'POST', body: data }); },
  postStockAdjustment(data) { return this.request('/stock/adjustment', { method: 'POST', body: data }); },
  postStockInventory(data) { return this.request('/stock/inventory', { method: 'POST', body: data }); },
  getStockMovements(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/stock/movements${qs ? '?' + qs : ''}`);
  },
  async getStockExportUrl(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const url = `${this.base}/stock/export/pdf?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erreur export PDF');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  setStockMin(ingredientId, minQuantity) {
    return this.request(`/stock/${ingredientId}/min`, { method: 'PUT', body: { min_quantity: minQuantity } });
  },

  // ─── Supplier Portal (restaurant side) ───
  inviteSupplier(data) {
    return this.request('/supplier-portal/invite', { method: 'POST', body: data });
  },
  getSupplierAccounts() {
    return this.request('/supplier-portal/accounts');
  },
  revokeSupplierAccess(id) {
    return this.request(`/supplier-portal/accounts/${id}`, { method: 'DELETE' });
  },
  getSupplierNotifications() {
    return this.request('/supplier-portal/notifications');
  },
  getSupplierNotificationsUnread() {
    return this.request('/supplier-portal/notifications/unread-count');
  },
  markNotificationRead(id) {
    return this.request(`/supplier-portal/notifications/${id}/read`, { method: 'PUT' });
  },
  markAllNotificationsRead() {
    return this.request('/supplier-portal/notifications/read-all', { method: 'PUT' });
  },

  // ─── Supplier Portal (supplier side) ───
  supplierLogin(pin) {
    return this.request('/supplier-portal/login-by-name', { method: 'POST', body: { pin } });
  },
  supplierRequest(path, options = {}) {
    const token = getSupplierToken();
    if (!token) throw new Error('Non connecté');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'X-Supplier-Token': token,
      },
      ...options,
    };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
    return fetch(this.base + '/supplier-portal' + path, config).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        if (r.status === 401) {
          clearSupplierSession();
          location.reload();
        }
        throw new Error(err.error || 'Erreur serveur');
      }
      return r.json();
    });
  },
  getSupplierCatalog() {
    return this.supplierRequest('/catalog');
  },
  addSupplierProduct(data) {
    return this.supplierRequest('/catalog', { method: 'POST', body: data });
  },
  updateSupplierProduct(id, data) {
    return this.supplierRequest(`/catalog/${id}`, { method: 'PUT', body: data });
  },
  deleteSupplierProduct(id) {
    return this.supplierRequest(`/catalog/${id}`, { method: 'DELETE' });
  },
  toggleSupplierProductAvailability(id, available) {
    return this.supplierRequest(`/catalog/${id}/availability`, { method: 'PUT', body: { available } });
  },
  getSupplierHistory() {
    return this.supplierRequest('/history');
  },

  // ─── Analytics ───
  getAnalyticsKPIs() { return this.request('/analytics/kpis'); },
  getAnalyticsFoodCost() { return this.request('/analytics/food-cost'); },
  getAnalyticsStock() { return this.request('/analytics/stock'); },
  getAnalyticsPrices() { return this.request('/analytics/prices'); },
  getAnalyticsHACCP() { return this.request('/analytics/haccp'); },
  getAnalyticsInsights(refresh = false) {
    return this.request(`/analytics/ai-insights${refresh ? '?refresh=true' : ''}`);
  },

  // ─── Orders ───
  getOrders(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/orders${qs}`);
  },
  getOrder(id) { return this.request(`/orders/${id}`); },
  createOrder(data) { return this.request('/orders', { method: 'POST', body: data }); },
  updateOrder(id, data) { return this.request(`/orders/${id}`, { method: 'PUT', body: data }); },
  updateOrderItem(orderId, itemId, data) {
    return this.request(`/orders/${orderId}/items/${itemId}`, { method: 'PUT', body: data });
  },
  sendOrder(id) { return this.request(`/orders/${id}/send`, { method: 'POST' }); },
  cancelOrder(id) { return this.request(`/orders/${id}`, { method: 'DELETE' }); },

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

// ─── Supplier session helpers ───
function getSupplierToken() {
  return sessionStorage.getItem('restosuite_supplier_token');
}
function getSupplierSession() {
  try {
    const stored = sessionStorage.getItem('restosuite_supplier_session');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}
function setSupplierSession(data) {
  sessionStorage.setItem('restosuite_supplier_token', data.token);
  sessionStorage.setItem('restosuite_supplier_session', JSON.stringify(data));
}
function clearSupplierSession() {
  sessionStorage.removeItem('restosuite_supplier_token');
  sessionStorage.removeItem('restosuite_supplier_session');
}
