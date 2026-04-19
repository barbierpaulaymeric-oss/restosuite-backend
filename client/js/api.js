// ═══════════════════════════════════════════
// RestoSuite — API Client
// ═══════════════════════════════════════════

// ─── CSRF token — held in memory only (never in localStorage/sessionStorage) ───
// Populated from the `csrf_token` field of login/register/pin-login responses.
// Sent as `X-CSRF-Token` on every mutating request so the server can match it
// against the JWT's `csrf` claim (see server/lib/csrf.js).
let __csrfToken = null;
function setCsrfToken(t) { __csrfToken = t || null; }
function getCsrfToken() { return __csrfToken; }

const API = {
  base: window.location.origin + '/api',

  async request(path, options = {}) {
    const url = this.base + path;
    const config = {
      // Send the HttpOnly `jwt` cookie on every request. CORS is configured to
      // allow credentials from the same origin + the production allowlist.
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
    // Make sure header object is always present even if options overrode it.
    config.headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    config.credentials = 'include';

    // CSRF: required on mutating requests when auth comes from the cookie.
    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && __csrfToken) {
      config.headers['X-CSRF-Token'] = __csrfToken;
    }

    // Legacy: some existing sessions may still have a Bearer token in
    // localStorage (pre-cookie rollout). Keep sending it as a fallback so the
    // user isn't logged out mid-session. Both transports are accepted by
    // requireAuth; cookie takes precedence when both are present.
    const legacyToken = localStorage.getItem('restosuite_token');
    if (legacyToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = 'Bearer ' + legacyToken;
    }

    // Inject account_id header for trial middleware (legacy compat)
    const account = typeof getAccount === 'function' ? getAccount() : null;
    if (account && account.id) {
      config.headers['X-Account-Id'] = String(account.id);
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
    const res = await fetch(url, config);
    if (res.status === 401) {
      // Check if this is a login attempt (smart-login, login, register) — if so,
      // don't redirect, just throw with the server's error message so the login
      // form can display it.
      const isLoginAttempt = path.includes('/auth/smart-login') || path.includes('/auth/login') || path.includes('/auth/register') || path.includes('/auth/staff-login') || path.includes('/auth/pin-login') || path.includes('/auth/staff-pin');
      if (isLoginAttempt) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Email ou mot de passe incorrect');
      }
      // JWT expired or invalid — force re-login
      localStorage.removeItem('restosuite_token');
      localStorage.removeItem('restosuite_account');
      __csrfToken = null;
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
        window.location.reload();
      }
      throw new Error('Session expirée. Reconnectez-vous.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      // Handle trial expired specifically
      if (err.code === 'TRIAL_EXPIRED') {
        showToast('Passez en Pro pour continuer à utiliser RestoSuite', 'error');
        throw new Error(err.error);
      }
      // Generate descriptive error message based on HTTP status
      let errorMessage = err.error || err.details || 'Erreur serveur';
      if (res.status === 403) {
        errorMessage = 'Accès non autorisé.';
      } else if (res.status === 404) {
        errorMessage = 'Ressource non trouvée.';
      } else if (res.status === 429) {
        errorMessage = 'Trop de requêtes. Réessayez dans quelques minutes.';
      } else if (res.status >= 500) {
        errorMessage = 'Erreur serveur. Réessayez ou contactez le support.';
      }
      throw new Error(errorMessage);
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
  deleteSupplier(id) {
    return this.request(`/suppliers/${id}`, { method: 'DELETE' });
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
  getRecipeAvailability() {
    return this.request('/recipes/availability');
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

  // Auth — each login response carries `csrf_token`; stash it in memory so
  // subsequent mutating requests can echo it in X-CSRF-Token.
  async register(data) {
    const r = await this.request('/auth/register', { method: 'POST', body: data });
    if (r && r.csrf_token) setCsrfToken(r.csrf_token);
    return r;
  },
  async login(data) {
    const r = await this.request('/auth/login', { method: 'POST', body: data });
    if (r && r.csrf_token) setCsrfToken(r.csrf_token);
    return r;
  },
  // Unified Restaurant login (2026-04-19 UX fix). Returns either
  //   { mode: 'owner',  token, csrf_token, account, restaurant } — direct gerant login
  //   { mode: 'staff',  restaurant_id, restaurant_name, members } — continue to PIN picker
  async smartLogin(email, password) {
    const r = await this.request('/auth/smart-login', { method: 'POST', body: { email, password } });
    if (r && r.csrf_token) setCsrfToken(r.csrf_token);
    return r;
  },
  async pinLogin(data) {
    const r = await this.request('/auth/pin-login', { method: 'POST', body: data });
    if (r && r.csrf_token) setCsrfToken(r.csrf_token);
    return r;
  },
  getMe() {
    return this.request('/auth/me');
  },

  // Staff Auth
  staffLogin(password) {
    return this.request('/auth/staff-login', { method: 'POST', body: { password } });
  },
  async staffPinLogin(account_id, pin, is_creation = false) {
    const r = await this.request('/auth/staff-pin', { method: 'POST', body: { account_id, pin, is_creation } });
    if (r && r.csrf_token) setCsrfToken(r.csrf_token);
    return r;
  },
  setStaffPassword(password) {
    return this.request('/auth/staff-password', { method: 'PUT', body: { password } });
  },

  // Onboarding
  getOnboardingStatus() {
    return this.request('/onboarding/status');
  },
  saveOnboardingStep(step, data) {
    return this.request(`/onboarding/step/${step}`, { method: 'PUT', body: data });
  },
  getOnboardingChecklist() {
    return this.request('/onboarding/checklist');
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
  resetMemberPin(id, callerId) {
    return this.request(`/accounts/${id}/reset-pin`, { method: 'PUT', body: { caller_id: callerId } });
  },
  deleteSelfAccount(confirmation) {
    return this.request('/accounts/self', { method: 'DELETE', body: { confirmation } });
  },
  // setStaffPassword is defined in Staff Auth section above

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

  // Cooling
  getCoolingLogs(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/haccp/cooling${qs ? '?' + qs : ''}`);
  },
  createCoolingLog(data) { return this.request('/haccp/cooling', { method: 'POST', body: data }); },
  updateCoolingLog(id, data) { return this.request(`/haccp/cooling/${id}`, { method: 'PUT', body: data }); },

  // Reheating
  getReheatingLogs(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/haccp/reheating${qs ? '?' + qs : ''}`);
  },
  createReheatingLog(data) { return this.request('/haccp/reheating', { method: 'POST', body: data }); },
  updateReheatingLog(id, data) { return this.request(`/haccp/reheating/${id}`, { method: 'PUT', body: data }); },

  // Cooking Records (CCP2)
  getCookingRecords(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/haccp/cooking${qs ? '?' + qs : ''}`);
  },
  getCookingStats(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/haccp/cooking/stats${qs ? '?' + qs : ''}`);
  },
  getCookingNonCompliant() { return this.request('/haccp/cooking/non-compliant'); },
  createCookingRecord(data) { return this.request('/haccp/cooking', { method: 'POST', body: data }); },
  updateCookingRecord(id, data) { return this.request(`/haccp/cooking/${id}`, { method: 'PUT', body: data }); },
  deleteCookingRecord(id) { return this.request(`/haccp/cooking/${id}`, { method: 'DELETE' }); },

  // Fryers
  getFryers() { return this.request('/haccp/fryers'); },
  createFryer(data) { return this.request('/haccp/fryers', { method: 'POST', body: data }); },
  getFryerChecks(fryerId) { return this.request(`/haccp/fryers/${fryerId}/checks`); },
  createFryerCheck(fryerId, data) { return this.request(`/haccp/fryers/${fryerId}/checks`, { method: 'POST', body: data }); },

  // Thermometers & Calibrations (DDPP — étalonnage)
  getThermometers() { return this.request('/haccp/thermometers'); },
  getThermometer(id) { return this.request(`/haccp/thermometers/${id}`); },
  createThermometer(data) { return this.request('/haccp/thermometers', { method: 'POST', body: data }); },
  updateThermometer(id, data) { return this.request(`/haccp/thermometers/${id}`, { method: 'PUT', body: data }); },
  deleteThermometer(id) { return this.request(`/haccp/thermometers/${id}`, { method: 'DELETE' }); },
  getThermometerAlerts() { return this.request('/haccp/thermometers/alerts'); },
  getCalibrations(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/haccp/calibrations${qs ? '?' + qs : ''}`);
  },
  getCalibration(id) { return this.request(`/haccp/calibrations/${id}`); },
  createCalibration(data) { return this.request('/haccp/calibrations', { method: 'POST', body: data }); },
  updateCalibration(id, data) { return this.request(`/haccp/calibrations/${id}`, { method: 'PUT', body: data }); },
  deleteCalibration(id) { return this.request(`/haccp/calibrations/${id}`, { method: 'DELETE' }); },

  // Non-conformités
  getNonConformities(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/haccp/non-conformities${qs}`);
  },
  createNonConformity(data) { return this.request('/haccp/non-conformities', { method: 'POST', body: data }); },
  updateNonConformity(id, data) { return this.request(`/haccp/non-conformities/${id}`, { method: 'PUT', body: data }); },

  // Allergens INCO
  getAllergenMenuDisplay() { return this.request('/allergens/menu-display'); },

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

  // ─── HACCP Plan formalisé ───
  getHACCPHazards() { return this.request('/haccp-plan/hazards'); },
  createHACCPHazard(data) { return this.request('/haccp-plan/hazards', { method: 'POST', body: data }); },
  updateHACCPHazard(id, data) { return this.request(`/haccp-plan/hazards/${id}`, { method: 'PUT', body: data }); },
  deleteHACCPHazard(id) { return this.request(`/haccp-plan/hazards/${id}`, { method: 'DELETE' }); },
  getHACCPCCPs() { return this.request('/haccp-plan/ccps'); },
  saveHACCPCCP(data) { return this.request('/haccp-plan/ccps', { method: 'POST', body: data }); },
  deleteHACCPCCP(id) { return this.request(`/haccp-plan/ccps/${id}`, { method: 'DELETE' }); },
  getHACCPDecisionTree(hazardId) { return this.request(`/haccp-plan/decision-tree/${hazardId}`); },
  saveHACCPDecisionTree(hazardId, data) { return this.request(`/haccp-plan/decision-tree/${hazardId}`, { method: 'POST', body: data }); },
  getHACCPPlanSummary() { return this.request('/haccp-plan/summary'); },

  // ─── Recall Procedures (Retrait/Rappel) ───
  getRecallProcedures() { return this.request('/recall'); },
  getActiveRecallProcedures() { return this.request('/recall/active'); },
  createRecallProcedure(data) { return this.request('/recall', { method: 'POST', body: data }); },
  updateRecallProcedure(id, data) { return this.request(`/recall/${id}`, { method: 'PUT', body: data }); },
  deleteRecallProcedure(id) { return this.request(`/recall/${id}`, { method: 'DELETE' }); },

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
  supplierCompanyLogin(email, password) {
    return this.request('/supplier-portal/quick-login', { method: 'POST', body: { email, password } });
  },
  supplierMemberPin(supplier_id, account_id, pin) {
    return this.request('/supplier-portal/member-pin', { method: 'POST', body: { supplier_id, account_id, pin } });
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

  // ─── Supplier Delivery Notes (supplier side) ───
  createSupplierDeliveryNote(data) {
    return this.supplierRequest('/delivery-notes', { method: 'POST', body: data });
  },
  getSupplierDeliveryNotes() {
    return this.supplierRequest('/delivery-notes');
  },
  getSupplierDeliveryNote(id) {
    return this.supplierRequest(`/delivery-notes/${id}`);
  },

  // ─── Supplier Purchase Orders (supplier side — read-only) ───
  getSupplierOrders() {
    return this.supplierRequest('/orders');
  },
  getSupplierOrder(id) {
    return this.supplierRequest(`/orders/${id}`);
  },

  // ─── Deliveries (restaurant side) ───
  getDeliveries(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/deliveries${qs}`);
  },
  getDelivery(id) {
    return this.request(`/deliveries/${id}`);
  },
  receiveDelivery(id, data) {
    return this.request(`/deliveries/${id}/receive`, { method: 'PUT', body: data });
  },
  getDlcAlerts() {
    return this.request('/deliveries/dlc-alerts');
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
  closeOrder(id) { return this.request(`/orders/${id}/close`, { method: 'POST' }); },
  cancelOrder(id) { return this.request(`/orders/${id}`, { method: 'DELETE' }); },

  // ─── Purchase Orders ───
  getPurchaseOrders(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/purchase-orders${qs}`);
  },
  getPurchaseOrder(id) { return this.request(`/purchase-orders/${id}`); },
  createPurchaseOrder(data) { return this.request('/purchase-orders', { method: 'POST', body: data }); },
  updatePurchaseOrder(id, data) { return this.request(`/purchase-orders/${id}`, { method: 'PUT', body: data }); },
  receivePurchaseOrder(id, data) { return this.request(`/purchase-orders/${id}/receive`, { method: 'POST', body: data }); },
  deletePurchaseOrder(id) { return this.request(`/purchase-orders/${id}`, { method: 'DELETE' }); },
  getPurchaseOrderSuggestions() { return this.request('/purchase-orders/suggest'); },
  getPurchaseOrderAnalytics(period) {
    const qs = period ? `?period=${period}` : '';
    return this.request(`/purchase-orders/analytics${qs}`);
  },
  clonePurchaseOrder(id) { return this.request(`/purchase-orders/${id}/clone`, { method: 'POST' }); },

  // ─── Service Mode ───
  getServiceConfig() { return this.request('/service/config'); },
  updateServiceConfig(data) { return this.request('/service/config', { method: 'PUT', body: data }); },
  startService() { return this.request('/service/start', { method: 'POST' }); },
  stopService() { return this.request('/service/stop', { method: 'POST' }); },
  getActiveService() { return this.request('/service/active'); },
  getServiceRecap(id) { return this.request(`/service/recap/${id}`); },

  // ─── Variance ───
  getVarianceAnalysis(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params}` : '';
    return this.request(`/variance/analysis${qs}`);
  },
  getVarianceSummary() { return this.request('/variance/summary'); },
  getVarianceTopLosses(days) { return this.request(`/variance/top-losses${days ? '?days=' + days : ''}`); },
  getVarianceTrends(days) { return this.request(`/variance/trends${days ? '?days=' + days : ''}`); },

  // ─── Allergens ───
  getAllergens() { return this.request('/allergens'); },
  getRecipeAllergens(recipeId) { return this.request(`/allergens/recipes/${recipeId}`); },
  updateIngredientAllergens(id, allergenCodes) {
    return this.request(`/ingredients/${id}/allergens`, { method: 'PUT', body: { allergen_codes: allergenCodes } });
  },

  // ─── Carbon ───
  getCarbonRecipes() { return this.request('/carbon/recipes'); },
  getCarbonGlobal(days) {
    const qs = days ? `?days=${days}` : '';
    return this.request(`/carbon/global${qs}`);
  },
  getCarbonTargets() { return this.request('/carbon/targets'); },
  saveCarbonTarget(data) { return this.request('/carbon/targets', { method: 'POST', body: data }); },

  // ─── Multi-Site ───
  getSites() { return this.request('/sites'); },
  getSite(id) { return this.request(`/sites/${id}`); },
  createSite(data) { return this.request('/sites', { method: 'POST', body: data }); },
  updateSite(id, data) { return this.request(`/sites/${id}`, { method: 'PUT', body: data }); },
  deleteSite(id) { return this.request(`/sites/${id}`, { method: 'DELETE' }); },
  compareSites(days) {
    const qs = days ? `?days=${days}` : '';
    return this.request(`/sites/compare/all${qs}`);
  },

  // ─── Deliveries (extra) ───
  createDelivery(data) { return this.request('/deliveries', { method: 'POST', body: data }); },

  // ─── Alerts ───
  getAlertsDailySummary() { return this.request('/alerts/daily-summary'); },

  // ─── Predictions ───
  getDemandPredictions(refresh) {
    const qs = refresh ? '?refresh=true' : '';
    return this.request(`/predictions/demand${qs}`);
  },
  savePredictionAccuracy(data) { return this.request('/predictions/accuracy', { method: 'POST', body: data }); },
  getPredictionAccuracy(days) {
    const qs = days ? `?days=${days}` : '';
    return this.request(`/predictions/accuracy${qs}`);
  },

  // ─── Health History ───
  saveHealthScore(score) { return this.request('/health/score', { method: 'POST', body: { score } }); },
  getHealthHistory(days) {
    const qs = days ? `?days=${days}` : '';
    return this.request(`/health/history${qs}`);
  },

  // AI
  parseVoice(text) {
    return this.request('/ai/parse-voice', { method: 'POST', body: { text } });
  },
  suggestSuppliers(ingredientIds) {
    return this.request('/ai/suggest-suppliers', { method: 'POST', body: { ingredient_ids: ingredientIds } });
  },
  async scanMercuriale(file) {
    const formData = new FormData();
    formData.append('mercuriale', file);
    // Multipart upload — cookie is sent via credentials:'include'. Add CSRF and
    // the legacy Bearer fallback (in case the session predates the cookie rollout).
    const headers = {};
    if (__csrfToken) headers['X-CSRF-Token'] = __csrfToken;
    const legacyToken = localStorage.getItem('restosuite_token');
    if (legacyToken) headers['Authorization'] = 'Bearer ' + legacyToken;
    const res = await fetch(this.base + '/ai/scan-mercuriale', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erreur scan');
    }
    return res.json();
  },
  importMercuriale(data) {
    return this.request('/ai/import-mercuriale', { method: 'POST', body: data });
  },

  // Plans & Pricing
  getPlans() { return this.request('/plans'); },
  getCurrentPlan() { return this.request('/plans/current'); },
  upgradePlan(plan) { return this.request('/plans/upgrade', { method: 'POST', body: { plan } }); },

  // PMS Export
  getPMSExport(period = '3m') { return this.request(`/pms/export?period=${period}`); },
};

// ─── Toast utility ───
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
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
  if (foodCostPercent === 0) return 'margin-undefined';
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
  if (str == null) return '';
  // Escape both double AND single quotes so the helper is safe inside attribute
  // contexts delimited by either (e.g., onclick='...'). See feedback_escape_at_helper.md.
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
