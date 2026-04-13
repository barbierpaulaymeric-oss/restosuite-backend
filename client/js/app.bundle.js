var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
const API = {
  base: window.location.origin + "/api",
  async request(path, options = {}) {
    const url = this.base + path;
    const config = __spreadValues({
      headers: { "Content-Type": "application/json" }
    }, options);
    const token = localStorage.getItem("restosuite_token");
    if (token) {
      config.headers["Authorization"] = "Bearer " + token;
    }
    const account = typeof getAccount === "function" ? getAccount() : null;
    if (account && account.id) {
      config.headers["X-Account-Id"] = String(account.id);
    }
    if (config.body && typeof config.body === "object") {
      config.body = JSON.stringify(config.body);
    }
    const res = await fetch(url, config);
    if (res.status === 401) {
      localStorage.removeItem("restosuite_token");
      localStorage.removeItem("restosuite_account");
      if (window.location.hash !== "#/login") {
        window.location.hash = "#/login";
        window.location.reload();
      }
      throw new Error("Session expir\xE9e. Reconnectez-vous.");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      if (err.code === "TRIAL_EXPIRED") {
        showToast("Passez en Pro pour continuer \xE0 utiliser RestoSuite", "error");
        throw new Error(err.error);
      }
      let errorMessage = err.error || err.details || "Erreur serveur";
      if (res.status === 403) {
        errorMessage = "Acc\xE8s non autoris\xE9.";
      } else if (res.status === 404) {
        errorMessage = "Ressource non trouv\xE9e.";
      } else if (res.status === 429) {
        errorMessage = "Trop de requ\xEAtes. R\xE9essayez dans quelques minutes.";
      } else if (res.status >= 500) {
        errorMessage = "Erreur serveur. R\xE9essayez ou contactez le support.";
      }
      throw new Error(errorMessage);
    }
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  },
  // Ingredients
  getIngredients(q) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.request(`/ingredients${qs}`);
  },
  createIngredient(data) {
    return this.request("/ingredients", { method: "POST", body: data });
  },
  updateIngredient(id, data) {
    return this.request(`/ingredients/${id}`, { method: "PUT", body: data });
  },
  deleteIngredient(id) {
    return this.request(`/ingredients/${id}`, { method: "DELETE" });
  },
  getIngredientPrices(id) {
    return this.request(`/ingredients/${id}/prices`);
  },
  // Suppliers
  getSuppliers() {
    return this.request("/suppliers");
  },
  createSupplier(data) {
    return this.request("/suppliers", { method: "POST", body: data });
  },
  updateSupplier(id, data) {
    return this.request(`/suppliers/${id}`, { method: "PUT", body: data });
  },
  deleteSupplier(id) {
    return this.request(`/suppliers/${id}`, { method: "DELETE" });
  },
  getSupplierPrices(id) {
    return this.request(`/suppliers/${id}/prices`);
  },
  // Prices
  setPrice(data) {
    return this.request("/prices", { method: "POST", body: data });
  },
  // Recipes
  getRecipes() {
    return this.request("/recipes");
  },
  getRecipeAvailability() {
    return this.request("/recipes/availability");
  },
  getRecipe(id) {
    return this.request(`/recipes/${id}`);
  },
  createRecipe(data) {
    return this.request("/recipes", { method: "POST", body: data });
  },
  updateRecipe(id, data) {
    return this.request(`/recipes/${id}`, { method: "PUT", body: data });
  },
  deleteRecipe(id) {
    return this.request(`/recipes/${id}`, { method: "DELETE" });
  },
  getRecipePdf(id) {
    return this.request(`/recipes/${id}/pdf`);
  },
  // Auth
  register(data) {
    return this.request("/auth/register", { method: "POST", body: data });
  },
  login(data) {
    return this.request("/auth/login", { method: "POST", body: data });
  },
  pinLogin(data) {
    return this.request("/auth/pin-login", { method: "POST", body: data });
  },
  getMe() {
    return this.request("/auth/me");
  },
  // Staff Auth
  staffLogin(password) {
    return this.request("/auth/staff-login", { method: "POST", body: { password } });
  },
  staffPinLogin(account_id, pin, is_creation = false) {
    return this.request("/auth/staff-pin", { method: "POST", body: { account_id, pin, is_creation } });
  },
  setStaffPassword(password) {
    return this.request("/auth/staff-password", { method: "PUT", body: { password } });
  },
  // Onboarding
  getOnboardingStatus() {
    return this.request("/onboarding/status");
  },
  saveOnboardingStep(step, data) {
    return this.request(`/onboarding/step/${step}`, { method: "PUT", body: data });
  },
  getOnboardingChecklist() {
    return this.request("/onboarding/checklist");
  },
  // Accounts
  getAccounts() {
    return this.request("/accounts");
  },
  createAccount(data) {
    return this.request("/accounts", { method: "POST", body: data });
  },
  loginAccount(id, pin) {
    return this.request("/accounts/login", { method: "POST", body: { id, pin } });
  },
  updateAccount(id, data) {
    return this.request(`/accounts/${id}`, { method: "PUT", body: data });
  },
  deleteAccount(id, callerId) {
    return this.request(`/accounts/${id}?caller_id=${callerId}`, { method: "DELETE" });
  },
  resetMemberPin(id, callerId) {
    return this.request(`/accounts/${id}/reset-pin`, { method: "PUT", body: { caller_id: callerId } });
  },
  deleteSelfAccount(confirmation) {
    return this.request("/accounts/self", { method: "DELETE", body: { confirmation } });
  },
  // setStaffPassword is defined in Staff Auth section above
  // ─── HACCP ───
  // Zones
  getHACCPZones() {
    return this.request("/haccp/zones");
  },
  createHACCPZone(data) {
    return this.request("/haccp/zones", { method: "POST", body: data });
  },
  updateHACCPZone(id, data) {
    return this.request(`/haccp/zones/${id}`, { method: "PUT", body: data });
  },
  deleteHACCPZone(id) {
    return this.request(`/haccp/zones/${id}`, { method: "DELETE" });
  },
  // Temperature logs
  getTemperatures(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/haccp/temperatures${qs ? "?" + qs : ""}`);
  },
  recordTemperature(data) {
    return this.request("/haccp/temperatures", { method: "POST", body: data });
  },
  getTemperaturesToday() {
    return this.request("/haccp/temperatures/today");
  },
  getTemperatureAlerts() {
    return this.request("/haccp/temperatures/alerts");
  },
  // Cleaning
  getCleaningTasks() {
    return this.request("/haccp/cleaning");
  },
  createCleaningTask(data) {
    return this.request("/haccp/cleaning", { method: "POST", body: data });
  },
  updateCleaningTask(id, data) {
    return this.request(`/haccp/cleaning/${id}`, { method: "PUT", body: data });
  },
  deleteCleaningTask(id) {
    return this.request(`/haccp/cleaning/${id}`, { method: "DELETE" });
  },
  markCleaningDone(id, data) {
    return this.request(`/haccp/cleaning/${id}/done`, { method: "POST", body: data });
  },
  getCleaningToday() {
    return this.request("/haccp/cleaning/today");
  },
  // Traceability
  getTraceability(params) {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return this.request(`/haccp/traceability${qs ? "?" + qs : ""}`);
  },
  createTraceability(data) {
    return this.request("/haccp/traceability", { method: "POST", body: data });
  },
  getDLCAlerts() {
    return this.request("/haccp/traceability/dlc-alerts");
  },
  // Cooling
  getCoolingLogs(params) {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return this.request(`/haccp/cooling${qs ? "?" + qs : ""}`);
  },
  createCoolingLog(data) {
    return this.request("/haccp/cooling", { method: "POST", body: data });
  },
  updateCoolingLog(id, data) {
    return this.request(`/haccp/cooling/${id}`, { method: "PUT", body: data });
  },
  // Reheating
  getReheatingLogs(params) {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return this.request(`/haccp/reheating${qs ? "?" + qs : ""}`);
  },
  createReheatingLog(data) {
    return this.request("/haccp/reheating", { method: "POST", body: data });
  },
  updateReheatingLog(id, data) {
    return this.request(`/haccp/reheating/${id}`, { method: "PUT", body: data });
  },
  // Fryers
  getFryers() {
    return this.request("/haccp/fryers");
  },
  createFryer(data) {
    return this.request("/haccp/fryers", { method: "POST", body: data });
  },
  getFryerChecks(fryerId) {
    return this.request(`/haccp/fryers/${fryerId}/checks`);
  },
  createFryerCheck(fryerId, data) {
    return this.request(`/haccp/fryers/${fryerId}/checks`, { method: "POST", body: data });
  },
  // Non-conformités
  getNonConformities(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/haccp/non-conformities${qs}`);
  },
  createNonConformity(data) {
    return this.request("/haccp/non-conformities", { method: "POST", body: data });
  },
  updateNonConformity(id, data) {
    return this.request(`/haccp/non-conformities/${id}`, { method: "PUT", body: data });
  },
  // Allergens INCO
  getAllergenMenuDisplay() {
    return this.request("/allergens/menu-display");
  },
  // HACCP PDF exports — returns blob URL
  async getHACCPExportUrl(type, from, to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const url = `${this.base}/haccp/export/${type}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erreur export PDF");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  // ─── Stock ───
  getStock(q) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.request(`/stock${qs}`);
  },
  getStockAlerts() {
    return this.request("/stock/alerts");
  },
  postReception(data) {
    return this.request("/stock/reception", { method: "POST", body: data });
  },
  postStockLoss(data) {
    return this.request("/stock/loss", { method: "POST", body: data });
  },
  postStockAdjustment(data) {
    return this.request("/stock/adjustment", { method: "POST", body: data });
  },
  postStockInventory(data) {
    return this.request("/stock/inventory", { method: "POST", body: data });
  },
  getStockMovements(params) {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return this.request(`/stock/movements${qs ? "?" + qs : ""}`);
  },
  async getStockExportUrl(from, to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const url = `${this.base}/stock/export/pdf?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erreur export PDF");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  setStockMin(ingredientId, minQuantity) {
    return this.request(`/stock/${ingredientId}/min`, { method: "PUT", body: { min_quantity: minQuantity } });
  },
  // ─── Supplier Portal (restaurant side) ───
  inviteSupplier(data) {
    return this.request("/supplier-portal/invite", { method: "POST", body: data });
  },
  getSupplierAccounts() {
    return this.request("/supplier-portal/accounts");
  },
  revokeSupplierAccess(id) {
    return this.request(`/supplier-portal/accounts/${id}`, { method: "DELETE" });
  },
  getSupplierNotifications() {
    return this.request("/supplier-portal/notifications");
  },
  getSupplierNotificationsUnread() {
    return this.request("/supplier-portal/notifications/unread-count");
  },
  markNotificationRead(id) {
    return this.request(`/supplier-portal/notifications/${id}/read`, { method: "PUT" });
  },
  markAllNotificationsRead() {
    return this.request("/supplier-portal/notifications/read-all", { method: "PUT" });
  },
  // ─── Supplier Portal (supplier side) ───
  supplierCompanyLogin(email, password) {
    return this.request("/supplier-portal/quick-login", { method: "POST", body: { email, password } });
  },
  supplierMemberPin(supplier_id, account_id, pin) {
    return this.request("/supplier-portal/member-pin", { method: "POST", body: { supplier_id, account_id, pin } });
  },
  supplierRequest(path, options = {}) {
    const token = getSupplierToken();
    if (!token) throw new Error("Non connect\xE9");
    const config = __spreadValues({
      headers: {
        "Content-Type": "application/json",
        "X-Supplier-Token": token
      }
    }, options);
    if (config.body && typeof config.body === "object") {
      config.body = JSON.stringify(config.body);
    }
    return fetch(this.base + "/supplier-portal" + path, config).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        if (r.status === 401) {
          clearSupplierSession();
          location.reload();
        }
        throw new Error(err.error || "Erreur serveur");
      }
      return r.json();
    });
  },
  getSupplierCatalog() {
    return this.supplierRequest("/catalog");
  },
  addSupplierProduct(data) {
    return this.supplierRequest("/catalog", { method: "POST", body: data });
  },
  updateSupplierProduct(id, data) {
    return this.supplierRequest(`/catalog/${id}`, { method: "PUT", body: data });
  },
  deleteSupplierProduct(id) {
    return this.supplierRequest(`/catalog/${id}`, { method: "DELETE" });
  },
  toggleSupplierProductAvailability(id, available) {
    return this.supplierRequest(`/catalog/${id}/availability`, { method: "PUT", body: { available } });
  },
  getSupplierHistory() {
    return this.supplierRequest("/history");
  },
  // ─── Supplier Delivery Notes (supplier side) ───
  createSupplierDeliveryNote(data) {
    return this.supplierRequest("/delivery-notes", { method: "POST", body: data });
  },
  getSupplierDeliveryNotes() {
    return this.supplierRequest("/delivery-notes");
  },
  getSupplierDeliveryNote(id) {
    return this.supplierRequest(`/delivery-notes/${id}`);
  },
  // ─── Deliveries (restaurant side) ───
  getDeliveries(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/deliveries${qs}`);
  },
  getDelivery(id) {
    return this.request(`/deliveries/${id}`);
  },
  receiveDelivery(id, data) {
    return this.request(`/deliveries/${id}/receive`, { method: "PUT", body: data });
  },
  getDlcAlerts() {
    return this.request("/deliveries/dlc-alerts");
  },
  // ─── Analytics ───
  getAnalyticsKPIs() {
    return this.request("/analytics/kpis");
  },
  getAnalyticsFoodCost() {
    return this.request("/analytics/food-cost");
  },
  getAnalyticsStock() {
    return this.request("/analytics/stock");
  },
  getAnalyticsPrices() {
    return this.request("/analytics/prices");
  },
  getAnalyticsHACCP() {
    return this.request("/analytics/haccp");
  },
  getAnalyticsInsights(refresh = false) {
    return this.request(`/analytics/ai-insights${refresh ? "?refresh=true" : ""}`);
  },
  // ─── Orders ───
  getOrders(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/orders${qs}`);
  },
  getOrder(id) {
    return this.request(`/orders/${id}`);
  },
  createOrder(data) {
    return this.request("/orders", { method: "POST", body: data });
  },
  updateOrder(id, data) {
    return this.request(`/orders/${id}`, { method: "PUT", body: data });
  },
  updateOrderItem(orderId, itemId, data) {
    return this.request(`/orders/${orderId}/items/${itemId}`, { method: "PUT", body: data });
  },
  sendOrder(id) {
    return this.request(`/orders/${id}/send`, { method: "POST" });
  },
  closeOrder(id) {
    return this.request(`/orders/${id}/close`, { method: "POST" });
  },
  cancelOrder(id) {
    return this.request(`/orders/${id}`, { method: "DELETE" });
  },
  // ─── Purchase Orders ───
  getPurchaseOrders(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/purchase-orders${qs}`);
  },
  getPurchaseOrder(id) {
    return this.request(`/purchase-orders/${id}`);
  },
  createPurchaseOrder(data) {
    return this.request("/purchase-orders", { method: "POST", body: data });
  },
  updatePurchaseOrder(id, data) {
    return this.request(`/purchase-orders/${id}`, { method: "PUT", body: data });
  },
  receivePurchaseOrder(id, data) {
    return this.request(`/purchase-orders/${id}/receive`, { method: "POST", body: data });
  },
  deletePurchaseOrder(id) {
    return this.request(`/purchase-orders/${id}`, { method: "DELETE" });
  },
  getPurchaseOrderSuggestions() {
    return this.request("/purchase-orders/suggest");
  },
  getPurchaseOrderAnalytics(period) {
    const qs = period ? `?period=${period}` : "";
    return this.request(`/purchase-orders/analytics${qs}`);
  },
  clonePurchaseOrder(id) {
    return this.request(`/purchase-orders/${id}/clone`, { method: "POST" });
  },
  // ─── Service Mode ───
  getServiceConfig() {
    return this.request("/service/config");
  },
  updateServiceConfig(data) {
    return this.request("/service/config", { method: "PUT", body: data });
  },
  startService() {
    return this.request("/service/start", { method: "POST" });
  },
  stopService() {
    return this.request("/service/stop", { method: "POST" });
  },
  getActiveService() {
    return this.request("/service/active");
  },
  getServiceRecap(id) {
    return this.request(`/service/recap/${id}`);
  },
  // ─── Variance ───
  getVarianceAnalysis(from, to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString() ? `?${params}` : "";
    return this.request(`/variance/analysis${qs}`);
  },
  getVarianceSummary() {
    return this.request("/variance/summary");
  },
  getVarianceTopLosses(days) {
    return this.request(`/variance/top-losses${days ? "?days=" + days : ""}`);
  },
  getVarianceTrends(days) {
    return this.request(`/variance/trends${days ? "?days=" + days : ""}`);
  },
  // ─── Allergens ───
  getAllergens() {
    return this.request("/allergens");
  },
  getRecipeAllergens(recipeId) {
    return this.request(`/allergens/recipes/${recipeId}`);
  },
  updateIngredientAllergens(id, allergenCodes) {
    return this.request(`/ingredients/${id}/allergens`, { method: "PUT", body: { allergen_codes: allergenCodes } });
  },
  // ─── Carbon ───
  getCarbonRecipes() {
    return this.request("/carbon/recipes");
  },
  getCarbonGlobal(days) {
    const qs = days ? `?days=${days}` : "";
    return this.request(`/carbon/global${qs}`);
  },
  getCarbonTargets() {
    return this.request("/carbon/targets");
  },
  saveCarbonTarget(data) {
    return this.request("/carbon/targets", { method: "POST", body: data });
  },
  // ─── Multi-Site ───
  getSites() {
    return this.request("/sites");
  },
  getSite(id) {
    return this.request(`/sites/${id}`);
  },
  createSite(data) {
    return this.request("/sites", { method: "POST", body: data });
  },
  updateSite(id, data) {
    return this.request(`/sites/${id}`, { method: "PUT", body: data });
  },
  deleteSite(id) {
    return this.request(`/sites/${id}`, { method: "DELETE" });
  },
  compareSites(days) {
    const qs = days ? `?days=${days}` : "";
    return this.request(`/sites/compare/all${qs}`);
  },
  // ─── Deliveries (extra) ───
  createDelivery(data) {
    return this.request("/deliveries", { method: "POST", body: data });
  },
  // ─── Alerts ───
  getAlertsDailySummary() {
    return this.request("/alerts/daily-summary");
  },
  // ─── Predictions ───
  getDemandPredictions(refresh) {
    const qs = refresh ? "?refresh=true" : "";
    return this.request(`/predictions/demand${qs}`);
  },
  savePredictionAccuracy(data) {
    return this.request("/predictions/accuracy", { method: "POST", body: data });
  },
  getPredictionAccuracy(days) {
    const qs = days ? `?days=${days}` : "";
    return this.request(`/predictions/accuracy${qs}`);
  },
  // ─── Health History ───
  saveHealthScore(score) {
    return this.request("/health/score", { method: "POST", body: { score } });
  },
  getHealthHistory(days) {
    const qs = days ? `?days=${days}` : "";
    return this.request(`/health/history${qs}`);
  },
  // AI
  parseVoice(text) {
    return this.request("/ai/parse-voice", { method: "POST", body: { text } });
  },
  suggestSuppliers(ingredientIds) {
    return this.request("/ai/suggest-suppliers", { method: "POST", body: { ingredient_ids: ingredientIds } });
  },
  async scanMercuriale(file) {
    const formData = new FormData();
    formData.append("mercuriale", file);
    const token = localStorage.getItem("restosuite_token");
    const res = await fetch(this.base + "/ai/scan-mercuriale", {
      method: "POST",
      headers: token ? { "Authorization": "Bearer " + token } : {},
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Erreur scan");
    }
    return res.json();
  },
  importMercuriale(data) {
    return this.request("/ai/import-mercuriale", { method: "POST", body: data });
  }
};
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "alert");
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(30px)";
    toast.style.transition = "0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3e3);
}
function formatCurrency(val) {
  if (val == null) return "\u2014";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(val);
}
function formatPercent(val) {
  if (val == null) return "\u2014";
  return val.toFixed(1) + "%";
}
function getMarginClass(foodCostPercent) {
  if (foodCostPercent == null) return "";
  if (foodCostPercent === 0) return "margin-undefined";
  if (foodCostPercent < 30) return "margin-excellent";
  if (foodCostPercent <= 35) return "margin-good";
  return "margin-attention";
}
function getMarginLabel(foodCostPercent) {
  if (foodCostPercent == null) return "";
  if (foodCostPercent < 30) return "Excellent";
  if (foodCostPercent <= 35) return "Correct";
  return "Attention";
}
function renderStars(rating, interactive = false, onChange = null) {
  let html = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    html += `<span class="star" data-value="${i}" ${interactive ? 'style="cursor:pointer"' : ""}>${filled ? "\u2605" : "\u2606"}</span>`;
  }
  html += "</span>";
  return html;
}
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function getSupplierToken() {
  return sessionStorage.getItem("restosuite_supplier_token");
}
function getSupplierSession() {
  try {
    const stored = sessionStorage.getItem("restosuite_supplier_session");
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}
function setSupplierSession(data) {
  sessionStorage.setItem("restosuite_supplier_token", data.token);
  sessionStorage.setItem("restosuite_supplier_session", JSON.stringify(data));
}
function clearSupplierSession() {
  sessionStorage.removeItem("restosuite_supplier_token");
  sessionStorage.removeItem("restosuite_supplier_session");
}
function formatQuantity(qty, unit) {
  if (!qty && qty !== 0) return "\u2014";
  unit = (unit || "").toLowerCase().trim();
  if ((unit === "g" || unit === "gr" || unit === "grammes") && qty >= 1e3) {
    return (qty / 1e3).toFixed(qty % 1e3 === 0 ? 0 : 1) + " kg";
  }
  if (unit === "mg" && qty >= 1e3) {
    return (qty / 1e3).toFixed(1) + " g";
  }
  if ((unit === "ml" || unit === "millilitres") && qty >= 1e3) {
    return (qty / 1e3).toFixed(qty % 1e3 === 0 ? 0 : 1) + " L";
  }
  if ((unit === "cl" || unit === "centilitres") && qty >= 100) {
    return (qty / 100).toFixed(qty % 100 === 0 ? 0 : 1) + " L";
  }
  const rounded = Math.round(qty * 100) / 100;
  const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(rounded < 10 ? 1 : 0);
  return display + " " + unit;
}
function showConfirmModal(title, message, onConfirm, options = {}) {
  const confirmText = options.confirmText || "Confirmer";
  const confirmClass = options.confirmClass || "btn btn-danger";
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay confirm-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "confirm-modal-title");
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px;text-align:center">
      <div style="font-size:2rem;margin-bottom:12px">
        <i data-lucide="alert-triangle" style="width:40px;height:40px;color:var(--color-danger)"></i>
      </div>
      <h3 id="confirm-modal-title" style="margin-bottom:8px">${title}</h3>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:20px">${message}</p>
      <div class="actions-row" style="justify-content:center">
        <button class="${confirmClass}" id="confirm-yes">${confirmText}</button>
        <button class="btn btn-secondary" id="confirm-no">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  const closeModal = () => overlay.remove();
  overlay.querySelector("#confirm-yes").onclick = () => {
    closeModal();
    onConfirm();
  };
  overlay.querySelector("#confirm-no").onclick = closeModal;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  const escHandler = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);
}
function formatDateFR(dateStr) {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateTimeFR(dateStr) {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    const topModal = document.querySelector(".modal-overlay:last-of-type");
    if (topModal) {
      topModal.remove();
    }
  }
}, true);
async function renderOnboardingChecklist() {
  const container = document.getElementById("dashboard-onboarding");
  if (!container) return;
  if (localStorage.getItem("hideOnboarding") === "1") return;
  try {
    const data = await API.getOnboardingChecklist();
    if (!data || data.progress >= 1) {
      container.innerHTML = "";
      return;
    }
    const pct = Math.round(data.progress * 100);
    container.innerHTML = `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
          <h3 style="margin:0;font-size:var(--text-base)">Premiers pas avec RestoSuite</h3>
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-accent)">${pct}%</span>
            <button id="hide-onboarding-btn" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:var(--text-sm);padding:2px 6px;border-radius:var(--radius-sm)" title="Masquer">Masquer</button>
          </div>
        </div>
        <div style="height:6px;background:var(--bg-sunken);border-radius:var(--radius-full);margin-bottom:var(--space-3);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--color-accent);border-radius:var(--radius-full);transition:width 0.6s ease"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${data.steps.map((step) => `
            <a ${step.done ? "" : `href="${step.link}"`} class="onboarding-step${step.done ? " done" : ""}" style="${step.done ? "pointer-events:none" : ""}">
              <span class="onboarding-step__check">
                ${step.done ? '<i data-lucide="check-circle-2" style="color:var(--color-success);width:20px;height:20px;flex-shrink:0"></i>' : '<i data-lucide="circle" style="color:var(--text-tertiary);width:20px;height:20px;flex-shrink:0"></i>'}
              </span>
              <span class="onboarding-step__label">${escapeHtml(step.label)}</span>
              ${!step.done ? '<i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary);margin-left:auto;flex-shrink:0"></i>' : ""}
            </a>
          `).join("")}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    document.getElementById("hide-onboarding-btn").addEventListener("click", () => {
      localStorage.setItem("hideOnboarding", "1");
      container.innerHTML = "";
    });
  } catch (e) {
    if (container) container.innerHTML = "";
  }
}
async function renderDashboard() {
  const app = document.getElementById("app");
  const perms = getPermissions();
  const account = getAccount();
  const greeting = getGreeting(account ? account.name : "Chef");
  const todayDate = formatFrenchDate(/* @__PURE__ */ new Date());
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
      ${perms.edit_recipes ? `<a href="#/new" class="btn btn-primary"><i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle fiche</a>` : ""}
    </div>
    <div class="search-bar">
      <span class="search-icon"><i data-lucide="search"></i></span>
      <input type="text" id="recipe-search" placeholder="Rechercher une fiche..." autocomplete="off">
    </div>
    <div class="recipe-type-filters" style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto">
      <button class="haccp-subnav__link active" data-type="">Tous</button>
      <button class="haccp-subnav__link" data-type="plat">\u{1F37D}\uFE0F Plats</button>
      <button class="haccp-subnav__link" data-type="sous_recette">\u{1F4CB} Sous-recettes</button>
      <button class="haccp-subnav__link" data-type="base">\u{1FAD5} Bases</button>
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
    showToast("Erreur de chargement", "error");
  }
  renderDailySummary(recipes, perms);
  const listEl = document.getElementById("recipe-list");
  const searchInput = document.getElementById("recipe-search");
  let currentTypeFilter = "";
  function renderList(filter = "", typeFilter = "") {
    let filtered2 = recipes;
    if (typeFilter) {
      filtered2 = filtered2.filter((r) => (r.recipe_type || "plat") === typeFilter);
    }
    if (filter) {
      filtered2 = filtered2.filter(
        (r) => r.name.toLowerCase().includes(filter.toLowerCase()) || (r.category || "").toLowerCase().includes(filter.toLowerCase())
      );
    }
    if (filtered2.length === 0) {
      listEl.innerHTML = filter || typeFilter ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="clipboard-list"></i></div>
          <p>Aucun r\xE9sultat</p>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">\u{1F3A4}</div>
          <h3>Cr\xE9ez votre premi\xE8re fiche technique</h3>
          <p>Dictez votre recette, l'IA fait le reste \u2014 co\xFBts, portions, proc\xE9dure.</p>
          ${perms.edit_recipes ? '<a href="#/new" class="btn btn-primary">Nouvelle fiche</a>' : ""}
        </div>
      `;
      lucide.createIcons();
      return;
    }
    const p = perms;
    listEl.innerHTML = filtered2.map((r) => {
      const marginClass = getMarginClass(r.food_cost_percent);
      const costBorderClass = !p.view_costs || r.food_cost_percent == null ? "" : r.food_cost_percent < 30 ? "card--cost-good" : r.food_cost_percent <= 35 ? "card--cost-warning" : "card--cost-danger";
      const recipeType = r.recipe_type || "plat";
      const typeBadge = recipeType === "sous_recette" ? '<span class="recipe-type-badge recipe-type--sub">\u{1F4CB}</span>' : recipeType === "base" ? '<span class="recipe-type-badge recipe-type--base">\u{1FAD5}</span>' : '<span class="recipe-type-badge recipe-type--plat">\u{1F37D}\uFE0F</span>';
      return `
        <div class="card ${costBorderClass}" onclick="location.hash='#/recipe/${r.id}'">
          <div class="card-header">
            <span class="card-title">${typeBadge} ${escapeHtml(r.name)}</span>
            ${r.category ? `<span class="card-category">${escapeHtml(r.category)}</span>` : ""}
          </div>
          <div class="card-stats">
            <div>
              <span class="stat-value">${r.portions || 1}</span>
              <span class="stat-label">Portions</span>
            </div>
            ${p.view_costs ? `
            <div>
              <span class="stat-value">${formatCurrency(r.cost_per_portion)}</span>
              <span class="stat-label">Co\xFBt mati\xE8re</span>
            </div>
            <div>
              <span class="stat-value">${formatCurrency(r.selling_price)}</span>
              <span class="stat-label">Prix de vente</span>
            </div>
            <div>
              <span class="stat-value"><span class="margin-badge ${marginClass}">${formatPercent(r.food_cost_percent)}</span></span>
              <span class="stat-label">Food cost</span>
            </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");
  }
  renderList();
  searchInput.addEventListener("input", (e) => {
    renderList(e.target.value, currentTypeFilter);
  });
  document.querySelectorAll(".recipe-type-filters button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".recipe-type-filters button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTypeFilter = btn.dataset.type;
      renderList(searchInput.value, currentTypeFilter);
    });
  });
  renderOnboardingChecklist();
  loadAISuggestions();
  try {
    const alertData = await API.request("/alerts/daily-summary");
    const alertsDiv = document.getElementById("dashboard-alerts");
    if (!alertsDiv) return;
    let html = "";
    if (alertData.summary.critical > 0) {
      const details = [];
      if (alertData.dlc_alerts.filter((a) => a.days_remaining <= 0).length > 0)
        details.push(`${alertData.dlc_alerts.filter((a) => a.days_remaining <= 0).length} DLC expir\xE9e(s)`);
      if (alertData.temp_alerts.length > 0)
        details.push(`${alertData.temp_alerts.length} alerte(s) temp\xE9rature`);
      html += `<a href="#/haccp" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-danger);color:white;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          \u{1F6A8} <strong>${alertData.summary.critical} alerte(s) critique(s)</strong> \u2014 ${details.join(", ")}
        </div></a>`;
    }
    if (alertData.summary.warnings > 0) {
      const details = [];
      if (alertData.dlc_alerts.filter((a) => a.days_remaining > 0).length > 0)
        details.push(`${alertData.dlc_alerts.filter((a) => a.days_remaining > 0).length} DLC proche(s)`);
      if (alertData.low_stock.length > 0)
        details.push(`${alertData.low_stock.length} stock(s) bas`);
      html += `<a href="#/stock" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-warning);color:#000;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          \u26A0\uFE0F <strong>${alertData.summary.warnings} avertissement(s)</strong> \u2014 ${details.join(", ")}
        </div></a>`;
    }
    if (alertData.summary.pending > 0) {
      html += `<a href="#/deliveries" style="text-decoration:none;display:block;margin-bottom:var(--space-2)">
        <div style="background:var(--color-info);color:white;padding:var(--space-3);border-radius:var(--radius-lg);cursor:pointer">
          \u{1F4E6} <strong>${alertData.summary.pending} livraison(s) en attente</strong>
        </div></a>`;
    }
    if (html) alertsDiv.innerHTML = html;
  } catch (e) {
  }
}
async function loadAISuggestions() {
  const container = document.getElementById("ai-suggestions-container");
  if (!container) return;
  const cacheKey = "restosuite_suggestions_cache";
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1e3) {
        renderAISuggestions(container, data);
        return;
      }
    } catch (e) {
    }
  }
  container.innerHTML = `
    <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3 style="margin:0">\u{1F4A1} Suggestions IA</h3>
      </div>
      <p class="text-secondary text-sm" style="text-align:center;padding:var(--space-4)">Analyse en cours\u2026</p>
    </div>
  `;
  try {
    const data = await API.request("/ai/menu-suggestions");
    if (data.error) throw new Error(data.error);
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    renderAISuggestions(container, data);
  } catch (e) {
    container.innerHTML = "";
  }
}
function renderAISuggestions(container, data) {
  const topItems = data.top_profitable || data.top_margin || [];
  const improveItems = data.to_improve || [];
  const daily = data.daily_special || null;
  if (topItems.length === 0 && improveItems.length === 0 && !daily) {
    container.innerHTML = "";
    return;
  }
  let topHtml = "";
  if (topItems.length > 0) {
    topHtml = `
      <div style="margin-bottom:var(--space-3)">
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-success)">\u{1F7E2} Plats les plus rentables</h4>
        ${topItems.map((item) => `
          <div style="padding:6px 0;border-bottom:1px solid var(--color-border)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(item.name)}</span>
              <span class="badge badge--success" style="font-size:11px">${item.food_cost_pct != null ? item.food_cost_pct : item.food_cost_percent != null ? item.food_cost_percent : "?"}%</span>
            </div>
            <p class="text-secondary" style="font-size:12px;margin-top:2px">${escapeHtml(item.reason || "")}</p>
          </div>
        `).join("")}
      </div>
    `;
  }
  let improveHtml = "";
  if (improveItems.length > 0) {
    improveHtml = `
      <div style="margin-bottom:var(--space-3)">
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-danger)">\u{1F534} \xC0 am\xE9liorer</h4>
        ${improveItems.map((item) => `
          <div style="padding:6px 0;border-bottom:1px solid var(--color-border)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(item.name)}</span>
              <span class="badge badge--danger" style="font-size:11px">${item.food_cost_pct != null ? item.food_cost_pct : item.food_cost_percent != null ? item.food_cost_percent : "?"}%</span>
            </div>
            <p class="text-secondary" style="font-size:12px;margin-top:2px">${escapeHtml(item.suggestion || "")}</p>
          </div>
        `).join("")}
      </div>
    `;
  }
  let dailyHtml = "";
  if (daily && daily.name) {
    dailyHtml = `
      <div>
        <h4 style="margin:0 0 8px 0;font-size:var(--text-sm);color:var(--color-accent)">\u2B50 Suggestion plat du jour</h4>
        <div style="background:rgba(232,114,42,0.1);border-radius:var(--radius-md);padding:var(--space-3)">
          <strong>${escapeHtml(daily.name)}</strong>
          <p class="text-secondary" style="font-size:12px;margin-top:4px">${escapeHtml(daily.description || daily.reason || "")}</p>
        </div>
      </div>
    `;
  }
  container.innerHTML = `
    <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--color-border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3 style="margin:0">\u{1F4A1} Suggestions IA</h3>
        <button class="btn btn-secondary btn-sm" onclick="refreshAISuggestions()" title="Rafra\xEEchir" style="padding:4px 8px">\u{1F504}</button>
      </div>
      ${topHtml}${improveHtml}${dailyHtml}
    </div>
  `;
}
async function refreshAISuggestions() {
  localStorage.removeItem("restosuite_suggestions_cache");
  await loadAISuggestions();
}
function getGreeting(name) {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  if (hour < 12) return `Bonjour ${name} \u{1F44B}`;
  if (hour < 17) return `Bon apr\xE8s-midi ${name} \u2600\uFE0F`;
  return `Bonsoir ${name} \u{1F319}`;
}
function formatFrenchDate(date) {
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const months = ["janvier", "f\xE9vrier", "mars", "avril", "mai", "juin", "juillet", "ao\xFBt", "septembre", "octobre", "novembre", "d\xE9cembre"];
  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthName} ${year}`;
}
function renderDailySummary(recipes, perms) {
  const summaryEl = document.getElementById("dashboard-summary");
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
        <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Co\xFBt total mati\xE8re</div>
      </div>
    `;
  }
  const dailyTip = getDailyTip();
  const tipEl = document.getElementById("daily-tip-container");
  if (tipEl) {
    tipEl.innerHTML = `
      <div style="background:linear-gradient(135deg, var(--color-accent-light), var(--bg-elevated));border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
        <div style="display:flex;gap:var(--space-3);align-items:flex-start">
          <span style="font-size:24px">\u{1F4A1}</span>
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
    "V\xE9rifiez vos fiches techniques une fois par mois pour ajuster les co\xFBts selon la mercuriale.",
    "Un food cost entre 25-30% est la cible id\xE9ale pour les restaurants. Trop \xE9lev\xE9 ? R\xE9visez vos recettes.",
    "Utilisez les sous-recettes pour factoriser les pr\xE9parations communes et simplifier votre gestion.",
    "La HACCP n'est pas juste une conformit\xE9 : c'est la base de la confiance clients et de la qualit\xE9.",
    "Scannez vos factures avec le scanner de r\xE9sum\xE9 pour indexer automatiquement vos achats dans la mercuriale.",
    "Les pertes mati\xE8re varient par saison. Adjustez-les dans vos fiches pour plus de pr\xE9cision.",
    "Analysez vos marges par cat\xE9gorie (plat, entr\xE9e, dessert) pour trouver vos meilleurs vendeurs.",
    "La mercuriale vous donne les prix du march\xE9 en temps r\xE9el. Utilisez-la pour n\xE9gocier avec vos fournisseurs.",
    "Cr\xE9ez des fiches de bases (sauces, bouillons) r\xE9utilisables plut\xF4t que de les reduplifier dans chaque recette.",
    "Les alertes DLC vous avertissent avant la date d'expiration. Travaillez avec vos stocks pour z\xE9ro gaspillage.",
    "Documentez vos proc\xE9dures de nettoyage dans HACCP pour garantir l'hygi\xE8ne et former votre \xE9quipe.",
    "Les codes QR facilitent la tra\xE7abilit\xE9. Imprimez-les pour vos ingr\xE9dients critiques (allerg\xE8nes, origines).",
    "Le travail en \xE9quipe est plus simple si tout le monde utilise RestoSuite. Importez vos coll\xE8gues !",
    "Mettez \xE0 jour vos portions quand vous changerez de fournisseur, c'est plus rapide que de recr\xE9er une fiche.",
    "Les KPIs : food cost, marge brute, volume vendus. Suivez-les chaque semaine pour piloter votre resto.",
    "Une recette compl\xE8te inclut les temps de pr\xE9paration et cuisson. Mettez \xE0 jour pour l'optimisation du planning.",
    "Les ingr\xE9dients g\xE9n\xE9riques sont moins chers. Demandez \xE0 votre fournisseur une alternative premium/\xE9conomique.",
    "Exploitez les pics de saison : artichauts en printemps, champignons en automne, fraises en \xE9t\xE9.",
    "Le gaspillage co\xFBte. Diminuez les pertes mati\xE8re en optimisant vos d\xE9coupes et portions.",
    "Testez vos recettes \xE0 l'\xE9chelle avant de les lancer. RestoSuite vous aide \xE0 scaler les portions facilement."
  ];
  const day = (/* @__PURE__ */ new Date()).getDate();
  return tips[day % tips.length];
}
async function renderRecipeDetail(id) {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const perms = getPermissions();
  let recipe;
  try {
    recipe = await API.getRecipe(id);
  } catch (e) {
    app.innerHTML = '<div class="empty-state"><p>Fiche introuvable</p><a href="#/" class="btn btn-secondary">\u2190 Retour</a></div>';
    return;
  }
  const marginClass = getMarginClass(recipe.food_cost_percent);
  const recipeType = recipe.recipe_type || "plat";
  const typeBadge = getRecipeTypeBadge(recipeType);
  const hasSubRecipes = recipe.ingredients.some((i) => i.is_sub_recipe);
  app.innerHTML = `
    <nav aria-label="Breadcrumb" class="breadcrumb">
      <a href="#/">Fiches</a>
      <span class="breadcrumb-sep">\u203A</span>
      <span class="breadcrumb-current">${escapeHtml(recipe.name)}</span>
    </nav>
    <div class="page-header">
      <div>
        <a href="#/" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Fiches techniques</a>
        <h1 style="margin-top:4px">${typeBadge} ${escapeHtml(recipe.name)}</h1>
        ${recipe.category ? `<span class="card-category" style="margin-top:4px;display:inline-block">${escapeHtml(recipe.category)}</span>` : ""}
      </div>
    </div>

    <div class="recipe-summary">
      <div class="summary-card">
        <div class="summary-value">${recipe.portions || 1}</div>
        <div class="summary-label">Portions</div>
      </div>
      ${perms.view_costs ? `
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.total_cost)}</div>
        <div class="summary-label">Co\xFBt total</div>
      </div>
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.cost_per_portion)}</div>
        <div class="summary-label">Co\xFBt / portion</div>
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
      </div>` : ""}
      ` : ""}
    </div>

    ${perms.view_costs && recipe.missing_price_count > 0 ? `
    <div class="alert alert-warning" style="display:flex;align-items:center;gap:var(--space-3);background:var(--color-warning-light,#fff8e1);border:1px solid var(--color-warning,#f59e0b);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3)">
      <i data-lucide="alert-triangle" style="width:18px;height:18px;color:var(--color-warning,#f59e0b);flex-shrink:0"></i>
      <span style="font-size:var(--text-sm)">
        <strong>${recipe.missing_price_count} ingr\xE9dient${recipe.missing_price_count > 1 ? "s" : ""} sans prix</strong> \u2014 co\xFBt estim\xE9 incomplet.
        <a href="#/ingredients" style="color:inherit;text-decoration:underline;margin-left:4px">Renseigner les prix \u2192</a>
      </span>
    </div>` : ""}

    ${recipe.prep_time_min || recipe.cooking_time_min ? `
    <div class="recipe-meta">
      ${recipe.prep_time_min ? `<span><i data-lucide="clock" style="width:16px;height:16px"></i> Pr\xE9paration : ${recipe.prep_time_min} min</span>` : ""}
      ${recipe.cooking_time_min ? `<span><i data-lucide="flame" style="width:16px;height:16px"></i> Cuisson : ${recipe.cooking_time_min} min</span>` : ""}
    </div>` : ""}

    <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);flex-wrap:wrap">
      <div class="section-title" style="margin:0">Ingr\xE9dients</div>
      <div style="display:flex;align-items:center;gap:var(--space-2);background:var(--bg-sunken);padding:4px 12px;border-radius:var(--radius-md)">
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:16px;min-width:28px" onclick="scaleRecipe(${recipe.id}, -1)">\u2212</button>
        <span style="font-weight:600;min-width:40px;text-align:center" id="scale-display">${recipe.portions || 1} p.</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:16px;min-width:28px" onclick="scaleRecipe(${recipe.id}, 1)">+</button>
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:var(--text-xs)" onclick="resetRecipeScale(${recipe.id})" title="R\xE9initialiser">\u21BA</button>
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Ingr\xE9dient</th>
            <th class="numeric">Brut</th>
            <th class="numeric">Net</th>
            <th class="numeric">Perte</th>
            ${perms.view_costs ? `<th class="numeric">Co\xFBt</th>` : ""}
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${renderMergedIngredientRows(recipe.ingredients, perms, 0)}
          ${perms.view_costs ? `
          <tr class="total-row">
            <td colspan="4" style="font-weight:600">TOTAL</td>
            <td class="mono" style="font-weight:600" data-base-total="${recipe.total_cost}">${formatCurrency(recipe.total_cost)}</td>
            <td></td>
          </tr>` : ""}
        </tbody>
      </table>
    </div>

    ${recipe.steps.length > 0 ? `
    <div class="section-title">Proc\xE9dure</div>
    <ol class="steps-list">
      ${recipe.steps.map((s) => `<li><span>${escapeHtml(s.instruction)}</span></li>`).join("")}
    </ol>` : ""}

    ${recipe.notes ? `
    <div class="section-title">Notes</div>
    <p style="color:var(--text-secondary);font-size:var(--text-sm)">${escapeHtml(recipe.notes)}</p>` : ""}

    <div id="recipe-allergens-section"></div>

    <div class="actions-row">
      ${perms.view_costs ? `<button class="btn btn-secondary" onclick="openPriceSimulator(${recipe.id}, ${recipe.cost_per_portion}, ${recipe.selling_price})"><i data-lucide="sliders" style="width:18px;height:18px"></i> Simuler</button>` : ""}
      ${perms.edit_recipes ? `<a href="#/edit/${recipe.id}" class="btn btn-primary"><i data-lucide="pencil" style="width:18px;height:18px"></i> Modifier</a>` : ""}
      ${perms.export_pdf ? `<button class="btn btn-secondary" onclick="exportRecipe(${recipe.id})"><i data-lucide="download" style="width:18px;height:18px"></i> Exporter</button>` : ""}
      <button class="btn btn-secondary" onclick="printAllergenSheet(${recipe.id}, '${escapeHtml(recipe.name).replace(/'/g, "\\'")}')"><i data-lucide="printer" style="width:18px;height:18px"></i> Fiche allerg\xE8nes</button>
      ${perms.edit_recipes ? `<button class="btn btn-danger" onclick="deleteRecipe(${recipe.id})"><i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer</button>` : ""}
    </div>
  `;
  lucide.createIcons();
  loadRecipeAllergens(id);
}
async function loadRecipeAllergens(recipeId) {
  try {
    const data = await API.getRecipeAllergens(recipeId);
    const section = document.getElementById("recipe-allergens-section");
    if (!section) return;
    if (data.allergens && data.allergens.length > 0) {
      section.innerHTML = `
        <div class="section-title">Allerg\xE8nes INCO</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
          ${data.allergens.map((a) => `
            <span class="badge" style="font-size:var(--text-sm);padding:6px 12px;background:var(--color-warning-light);border:1px solid var(--color-warning);border-radius:var(--radius-md)">
              ${a.icon} ${escapeHtml(a.name)}
            </span>
          `).join("")}
        </div>
        <p style="margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary)">
          Calcul automatique \xE0 partir des ingr\xE9dients de la recette
        </p>
      `;
    } else {
      section.innerHTML = `
        <div class="section-title">Allerg\xE8nes INCO</div>
        <p style="font-size:var(--text-sm);color:var(--text-tertiary)">Aucun allerg\xE8ne d\xE9tect\xE9 dans cette recette</p>
      `;
    }
  } catch (e) {
  }
}
function renderMergedIngredientRows(ingredients, perms, depth) {
  return ingredients.map((ing) => {
    var _a, _b;
    const pad = depth * 24;
    if (ing.is_sub_recipe) {
      let html = `
        <tr style="background:${depth === 0 ? "var(--color-accent-light)" : "var(--bg-sunken)"}">
          <td style="padding-left:${pad + 12}px">\u{1F4CB} <strong>${escapeHtml(ing.sub_recipe_name || "Sous-recette")}</strong>
            <span style="font-size:var(--text-xs);color:var(--text-tertiary);margin-left:4px">(\xD7${ing.gross_quantity} portion${ing.gross_quantity !== 1 ? "s" : ""})</span>
          </td>
          <td class="mono">\u2014</td>
          <td class="mono">\u2014</td>
          <td class="mono">\u2014</td>
          ${perms.view_costs ? `<td class="mono">${formatCurrency(ing.cost)}</td>` : ""}
          <td style="font-size:var(--text-sm);color:var(--text-tertiary);font-style:italic">${escapeHtml(ing.notes || "")}</td>
        </tr>`;
      if (ing.sub_recipe && ing.sub_recipe.ingredients && ing.sub_recipe.ingredients.length > 0) {
        html += renderMergedIngredientRows(ing.sub_recipe.ingredients, perms, depth + 1);
      }
      return html;
    }
    const waste = (_b = (_a = ing.custom_waste_percent) != null ? _a : ing.default_waste_percent) != null ? _b : 0;
    const missingPriceTag = perms.view_costs && ing.missing_price ? `<span title="Prix manquant" style="display:inline-block;background:var(--color-warning,#f59e0b);color:#fff;font-size:10px;font-weight:700;border-radius:3px;padding:1px 5px;margin-left:6px;vertical-align:middle">?</span>` : "";
    return `
      <tr${depth > 0 ? ' style="color:var(--text-secondary)"' : ""}>
        <td style="padding-left:${pad + 12}px">${depth > 0 ? '<span style="color:var(--text-tertiary);margin-right:4px">\u2514</span>' : ""}${escapeHtml(ing.ingredient_name)}${missingPriceTag}</td>
        <td class="mono" data-base-qty="${ing.gross_quantity}" data-unit="${ing.unit || ""}">${formatQuantity(ing.gross_quantity, ing.unit)}</td>
        <td class="mono" data-base-qty="${ing.net_quantity || ing.gross_quantity}" data-unit="${ing.unit || ""}">${formatQuantity(ing.net_quantity || ing.gross_quantity, ing.unit)}</td>
        <td class="mono">${waste}%</td>
        ${perms.view_costs ? `<td class="mono">${ing.missing_price ? '<span style="color:var(--color-warning,#f59e0b)" title="Prix manquant">\u2014</span>' : formatCurrency(ing.cost)}</td>` : ""}
        <td style="font-size:var(--text-sm);color:var(--text-tertiary);font-style:italic">${escapeHtml(ing.notes || "")}</td>
      </tr>`;
  }).join("");
}
function renderIngredientTree(ingredients, perms, indent = 0) {
  return ingredients.map((ing) => {
    const prefix = indent > 0 ? "\u2502   ".repeat(indent - 1) + "\u251C\u2500\u2500 " : "";
    if (ing.is_sub_recipe && ing.sub_recipe) {
      const subRecipe = ing.sub_recipe;
      let html = `<div class="tree-line" style="padding-left:${indent * 20}px">
        <span class="tree-icon">\u{1F4CB}</span>
        <span class="tree-name">${escapeHtml(ing.sub_recipe_name)}</span>
        <span class="tree-qty mono">\xD7 ${ing.gross_quantity} portion${ing.gross_quantity !== 1 ? "s" : ""}</span>
        ${perms.view_costs ? `<span class="tree-cost mono">\u2014 ${formatCurrency(ing.cost)}</span>` : ""}
      </div>`;
      if (subRecipe.ingredients && subRecipe.ingredients.length > 0) {
        html += renderIngredientTree(subRecipe.ingredients, perms, indent + 1);
      }
      return html;
    } else {
      return `<div class="tree-line" style="padding-left:${indent * 20}px">
        <span class="tree-name">${escapeHtml(ing.ingredient_name || "")}</span>
        <span class="tree-qty mono">\xD7 ${formatQuantity(ing.gross_quantity, ing.unit)}</span>
        ${perms.view_costs ? `<span class="tree-cost mono">\u2014 ${formatCurrency(ing.cost)}</span>` : ""}
      </div>`;
    }
  }).join("");
}
function getRecipeTypeBadge(type) {
  switch (type) {
    case "sous_recette":
      return '<span class="recipe-type-badge recipe-type--sub">\u{1F4CB} Sous-recette</span>';
    case "base":
      return '<span class="recipe-type-badge recipe-type--base">\u{1FAD5} Base</span>';
    default:
      return "";
  }
}
function deleteRecipe(id) {
  showConfirmModal("Supprimer cette fiche technique ?", "Cette action supprimera d\xE9finitivement la recette et tous ses ingr\xE9dients associ\xE9s.", async () => {
    try {
      await API.deleteRecipe(id);
      showToast("Fiche supprim\xE9e", "success");
      location.hash = "#/";
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  });
}
async function printAllergenSheet(recipeId, recipeName) {
  try {
    const data = await API.getRecipeAllergens(recipeId);
    const allergens = data.allergens || [];
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR");
    const allergensHtml = allergens.length > 0 ? allergens.map((a) => `
          <div class="allergen-item">
            <span class="allergen-icon">${a.icon}</span>
            <div>
              <strong>${a.name}</strong>
              <small>${a.description || ""}</small>
            </div>
          </div>`).join("") : '<p class="none">Aucun allerg\xE8ne d\xE9tect\xE9 dans cette recette.</p>';
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche allerg\xE8nes \u2014 ${recipeName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
    .inco-badge { display: inline-block; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 4px 12px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
    .allergen-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 8px; background: #fffbf0; }
    .allergen-icon { font-size: 28px; line-height: 1; }
    .allergen-item strong { display: block; font-size: 15px; }
    .allergen-item small { color: #555; font-size: 12px; }
    .none { color: #666; font-style: italic; padding: 16px; background: #f5f5f5; border-radius: 8px; }
    .footer { margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>\u{1F37D}\uFE0F ${recipeName}</h1>
  <p class="subtitle">Fiche allerg\xE8nes \u2014 Imprim\xE9e le ${today}</p>
  <div class="inco-badge">\u{1F4CB} R\xE8glement INCO (UE) \u2014 14 allerg\xE8nes r\xE9glementaires</div>
  <div>${allergensHtml}</div>
  <div class="footer">G\xE9n\xE9r\xE9 par RestoSuite \xB7 Conformit\xE9 r\xE8glement (UE) n\xB01169/2011 (INCO) \xB7 ${allergens.length} allerg\xE8ne(s) pr\xE9sent(s)</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
    win.document.close();
  } catch (e) {
    showToast("Erreur chargement allerg\xE8nes", "error");
  }
}
async function exportRecipe(id) {
  try {
    const text = await API.getRecipePdf(id);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fiche-technique-${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export t\xE9l\xE9charg\xE9", "success");
  } catch (e) {
    showToast("Erreur export", "error");
  }
}
function openPriceSimulator(recipeId, costPerPortion, initialSellingPrice) {
  const backdrop = document.createElement("div");
  backdrop.className = "simulator-backdrop";
  backdrop.onclick = closePriceSimulator;
  const modal = document.createElement("div");
  modal.className = "simulator-modal";
  modal.onclick = (e) => e.stopPropagation();
  let currentSellingPrice = initialSellingPrice || costPerPortion * 2;
  function updateSimulation() {
    const foodCostPercent = costPerPortion / currentSellingPrice * 100;
    const margin = currentSellingPrice - costPerPortion;
    const marginPercent = margin / currentSellingPrice * 100;
    let zoneClass = "zone-green";
    let zoneLabel = "\u2713 Bon (25-30%)";
    if (foodCostPercent < 25) {
      zoneClass = "zone-excellent";
      zoneLabel = "\u2B50 Excellent (< 25%)";
    } else if (foodCostPercent <= 30) {
      zoneClass = "zone-green";
      zoneLabel = "\u2713 Bon (25-30%)";
    } else if (foodCostPercent <= 35) {
      zoneClass = "zone-yellow";
      zoneLabel = "\u26A0 Acceptable (30-35%)";
    } else {
      zoneClass = "zone-red";
      zoneLabel = "\u26A0\uFE0F \xC0 revoir (> 35%)";
    }
    const gaugePercent = Math.min(foodCostPercent, 100);
    modal.innerHTML = `
      <div style="padding:var(--space-4);border-bottom:1px solid var(--border-light)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h2 style="margin:0;font-size:var(--text-lg)">Simulateur de prix</h2>
          <button onclick="closePriceSimulator()" style="background:none;border:none;color:var(--text-secondary);font-size:20px;cursor:pointer">\u2715</button>
        </div>
      </div>

      <div style="padding:var(--space-4);overflow-y:auto;max-height:calc(70vh - 200px)">
        <div style="margin-bottom:var(--space-5)">
          <label style="display:block;font-weight:600;margin-bottom:var(--space-2);color:var(--text-primary)">
            Prix de vente
            <span style="float:right;font-weight:700;color:var(--color-accent);font-size:var(--text-lg)">${formatCurrency(currentSellingPrice)}</span>
          </label>
          <input
            type="range"
            id="price-slider"
            min="${costPerPortion * 1.2}"
            max="${costPerPortion * 5}"
            step="0.05"
            value="${currentSellingPrice}"
            style="width:100%;height:6px;border-radius:3px;background:linear-gradient(to right,var(--color-danger),var(--color-warning),var(--color-success));outline:none;-webkit-appearance:none;appearance:none"
          >
          <div style="display:flex;justify-content:space-between;margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary)">
            <span>${formatCurrency(costPerPortion * 1.2)} (min)</span>
            <span>${formatCurrency(costPerPortion * 5)} (max)</span>
          </div>
        </div>

        <div style="background:var(--color-surface);border-radius:var(--radius-md);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--border-light)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">Co\xFBt mati\xE8re</div>
              <div style="font-weight:600;font-size:var(--text-lg);color:var(--text-primary)">${formatCurrency(costPerPortion)}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">Marge</div>
              <div style="font-weight:600;font-size:var(--text-lg);color:var(--color-success)">${formatCurrency(margin)}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">% Co\xFBt mati\xE8re</div>
              <div style="font-weight:700;font-size:var(--text-lg);color:var(--color-warning)">${formatPercent(foodCostPercent)}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">% Marge</div>
              <div style="font-weight:700;font-size:var(--text-lg);color:var(--color-success)">${formatPercent(marginPercent)}</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom:var(--space-4)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:var(--text-primary)">Zone</div>
          <div style="background:${getZoneColor(zoneClass)};border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-3);text-align:center;font-weight:600;color:white">${zoneLabel}</div>

          <div style="background:var(--bg-sunken);border-radius:var(--radius-md);overflow:hidden;height:12px">
            <div style="height:100%;width:${gaugePercent}%;background:${getGaugeColor(foodCostPercent)};transition:width 0.2s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:var(--text-xs);color:var(--text-tertiary)">
            <span>0%</span>
            <span>25%</span>
            <span>30%</span>
            <span>35%</span>
            <span>100%</span>
          </div>
        </div>

        <div style="background:var(--color-info);color:white;border-radius:var(--radius-md);padding:var(--space-3);font-size:var(--text-sm)">
          <strong>Point d'\xE9quilibre :</strong> Vous devez vendre au minimum <strong>${formatCurrency(costPerPortion)}</strong> pour couvrir les co\xFBts.
        </div>
      </div>
    `;
    document.getElementById("price-slider").addEventListener("input", (e) => {
      currentSellingPrice = parseFloat(e.target.value);
      updateSimulation();
    });
  }
  updateSimulation();
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}
function closePriceSimulator() {
  const backdrop = document.querySelector(".simulator-backdrop");
  const modal = document.querySelector(".simulator-modal");
  if (backdrop) backdrop.remove();
  if (modal) modal.remove();
}
function getGaugeColor(percent) {
  if (percent < 25) return "var(--color-success)";
  if (percent <= 30) return "var(--color-success)";
  if (percent <= 35) return "var(--color-warning)";
  return "var(--color-danger)";
}
function getZoneColor(zoneClass) {
  switch (zoneClass) {
    case "zone-excellent":
      return "#2D8B55";
    case "zone-green":
      return "#2D8B55";
    case "zone-yellow":
      return "#E5A100";
    case "zone-red":
      return "#D93025";
    default:
      return "#2D8B55";
  }
}
let _currentScale = {};
function scaleRecipe(recipeId, delta) {
  if (!_currentScale[recipeId]) _currentScale[recipeId] = { original: 0, current: 0 };
  const s = _currentScale[recipeId];
  if (s.original === 0) {
    const display = document.getElementById("scale-display");
    s.original = parseInt(display == null ? void 0 : display.textContent) || 1;
    s.current = s.original;
  }
  s.current = Math.max(1, s.current + delta);
  const multiplier = s.current / s.original;
  document.getElementById("scale-display").textContent = `${s.current} p.`;
  document.querySelectorAll("[data-base-qty]").forEach((cell) => {
    const baseQty = parseFloat(cell.dataset.baseQty);
    const unit = cell.dataset.unit || "";
    cell.textContent = formatQuantity(baseQty * multiplier, unit);
  });
  const totalCell = document.querySelector("[data-base-total]");
  if (totalCell) {
    const baseTotal = parseFloat(totalCell.dataset.baseTotal);
    totalCell.textContent = formatCurrency(baseTotal * multiplier);
  }
}
function resetRecipeScale(recipeId) {
  if (_currentScale[recipeId]) {
    _currentScale[recipeId].current = _currentScale[recipeId].original;
  }
  renderRecipeDetail(recipeId);
}
let formIngredients = [];
let formSubRecipes = [];
let formSteps = [];
let allIngredients = [];
let allRecipesForSub = [];
let _draftAutoSaveTimer = null;
const DRAFT_KEY = "restosuite_recipe_draft";
async function renderRecipeForm(editId) {
  var _a, _b, _c;
  const perms = getPermissions();
  if (!perms.edit_recipes) {
    location.hash = "#/";
    return;
  }
  const app = document.getElementById("app");
  const isEdit = !!editId;
  let recipe = null;
  if (isEdit) {
    app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      recipe = await API.getRecipe(editId);
    } catch (e) {
      app.innerHTML = '<div class="empty-state"><p>Fiche introuvable</p></div>';
      return;
    }
  }
  try {
    const response = await API.getIngredients();
    allIngredients = response.ingredients || [];
  } catch (e) {
    allIngredients = [];
  }
  try {
    const allRecipes = await API.getRecipes();
    allRecipesForSub = allRecipes.filter(
      (r) => (r.recipe_type === "sous_recette" || r.recipe_type === "base") && (!editId || r.id !== editId)
    );
  } catch (e) {
    allRecipesForSub = [];
  }
  formIngredients = [];
  formSubRecipes = [];
  if (recipe) {
    for (const ing of recipe.ingredients) {
      if (ing.is_sub_recipe || ing.sub_recipe_id) {
        formSubRecipes.push({
          sub_recipe_id: ing.sub_recipe_id,
          name: ing.sub_recipe_name || ((_a = ing.sub_recipe) == null ? void 0 : _a.name) || `Recette #${ing.sub_recipe_id}`,
          quantity: ing.gross_quantity,
          cost: ing.cost || 0
        });
      } else {
        formIngredients.push({
          name: ing.ingredient_name,
          ingredient_id: ing.ingredient_id,
          gross_quantity: ing.gross_quantity,
          net_quantity: ing.net_quantity,
          unit: ing.unit,
          waste_percent: (_c = (_b = ing.custom_waste_percent) != null ? _b : ing.default_waste_percent) != null ? _c : 0,
          notes: ing.notes || ""
        });
      }
    }
  }
  formSteps = recipe ? recipe.steps.map((s) => s.instruction) : [];
  const recipeType = (recipe == null ? void 0 : recipe.recipe_type) || "plat";
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour</a>
        <h1 style="margin-top:4px">${isEdit ? "Modifier la fiche" : "Nouvelle fiche technique"}</h1>
      </div>
    </div>

    ${!isEdit ? `
    <div class="mic-container">
      <button class="mic-btn" id="mic-btn" onclick="toggleMic()">
        <i data-lucide="mic"></i>
      </button>
      <div class="mic-status" id="mic-status">Appuyez pour dicter votre recette</div>
    </div>
    ` : ""}

    <div id="recipe-form-content">
      <div class="form-row">
        <div class="form-group">
          <label>Nom du plat</label>
          <input type="text" class="form-control" id="f-name" value="${escapeHtml((recipe == null ? void 0 : recipe.name) || "")}" placeholder="Tartare de b\u0153uf...">
        </div>
        <div class="form-group">
          <label>Cat\xE9gorie</label>
          <select class="form-control" id="f-category">
            <option value="">\u2014</option>
            ${["entr\xE9e", "plat", "dessert", "boisson", "amuse-bouche", "accompagnement", "sauce", "base"].map(
    (c) => `<option value="${c}" ${(recipe == null ? void 0 : recipe.category) === c ? "selected" : ""}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
  ).join("")}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Type de recette</label>
          <select class="form-control" id="f-recipe-type" onchange="onRecipeTypeChange()">
            <option value="plat" ${recipeType === "plat" ? "selected" : ""}>\u{1F37D}\uFE0F Plat final</option>
            <option value="sous_recette" ${recipeType === "sous_recette" ? "selected" : ""}>\u{1F4CB} Sous-recette</option>
            <option value="base" ${recipeType === "base" ? "selected" : ""}>\u{1FAD5} Base / Fond</option>
          </select>
        </div>
        <div class="form-group" id="f-price-group" style="${recipeType === "plat" ? "" : "display:none"}">
          <label>Prix de vente TTC (\u20AC)</label>
          <input type="number" class="form-control" id="f-price" value="${(recipe == null ? void 0 : recipe.selling_price) || ""}" step="0.5" min="0" oninput="updateLiveMargin()">
        </div>
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label>Portions</label>
          <input type="number" class="form-control" id="f-portions" value="${(recipe == null ? void 0 : recipe.portions) || 1}" min="1">
        </div>
        <div class="form-group">
          <label>Pr\xE9paration (min)</label>
          <input type="number" class="form-control" id="f-prep" value="${(recipe == null ? void 0 : recipe.prep_time_min) || ""}" min="0">
        </div>
        <div class="form-group">
          <label>Cuisson (min)</label>
          <input type="number" class="form-control" id="f-cooking" value="${(recipe == null ? void 0 : recipe.cooking_time_min) || ""}" min="0">
        </div>
      </div>

      <div class="section-title">Ingr\xE9dients</div>
      <div id="ing-list"></div>
      <div style="display:flex;gap:8px;align-items:end;margin-top:8px;flex-wrap:wrap">
        <div class="autocomplete-wrapper" style="flex:1;min-width:150px">
          <input type="text" class="form-control" id="add-ing-name" placeholder="Nom de l'ingr\xE9dient" autocomplete="off">
          <div class="autocomplete-list hidden" id="ing-autocomplete"></div>
        </div>
        <input type="number" class="form-control" id="add-ing-qty" placeholder="Qt\xE9" style="width:80px" step="any">
        <select class="form-control" id="add-ing-unit" style="width:80px">
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="cl">cl</option>
          <option value="l">l</option>
          <option value="pi\xE8ce">pi\xE8ce</option>
          <option value="botte">botte</option>
        </select>
        <input type="number" class="form-control" id="add-ing-waste" placeholder="Perte%" style="width:80px" step="any" min="0" max="100">
        <input type="text" class="form-control" id="add-ing-notes" placeholder="Notes" style="width:120px">
        <button class="btn btn-primary btn-sm" onclick="addIngredientLine()"><i data-lucide="plus" style="width:16px;height:16px"></i></button>
      </div>

      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Sous-recettes</span>
      </div>
      <div id="sub-recipe-list"></div>
      <div style="display:flex;gap:8px;align-items:end;margin-top:8px;flex-wrap:wrap">
        <select class="form-control" id="add-sub-recipe" style="flex:1;min-width:180px">
          <option value="">\u2014 Choisir une sous-recette \u2014</option>
          ${allRecipesForSub.map((r) => `<option value="${r.id}">${r.recipe_type === "base" ? "\u{1FAD5}" : "\u{1F4CB}"} ${escapeHtml(r.name)}</option>`).join("")}
        </select>
        <input type="number" class="form-control" id="add-sub-qty" placeholder="Portions" style="width:100px" step="any" min="0.1" value="1">
        <button class="btn btn-primary btn-sm" onclick="addSubRecipeLine()"><i data-lucide="plus" style="width:16px;height:16px"></i></button>
      </div>
      ${allRecipesForSub.length === 0 ? `<p class="text-muted" style="font-size:var(--text-xs);margin-top:4px">Aucune sous-recette disponible. Cr\xE9ez d'abord des fiches de type "Sous-recette" ou "Base".</p>` : ""}

      <div class="section-title">Proc\xE9dure</div>
      <div id="steps-list"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="text" class="form-control" id="add-step" placeholder="Nouvelle \xE9tape..." style="flex:1">
        <button class="btn btn-primary btn-sm" onclick="addStepLine()"><i data-lucide="plus" style="width:16px;height:16px"></i></button>
      </div>

      <div class="section-title">Tarification</div>
      <div class="form-row">
        <div class="form-group" id="f-price-section">
          <label>Food Cost</label>
          <div id="live-margin" style="padding:12px 16px;font-family:var(--font-mono);font-size:var(--text-lg);font-weight:700;color:var(--text-secondary)">\u2014</div>
        </div>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="f-notes" rows="2">${escapeHtml((recipe == null ? void 0 : recipe.notes) || "")}</textarea>
      </div>

      <div class="actions-row">
        <button class="btn btn-primary" onclick="saveRecipe(${editId || "null"})">
          <i data-lucide="${isEdit ? "save" : "check"}" style="width:18px;height:18px"></i>
          ${isEdit ? "Enregistrer" : "Cr\xE9er la fiche"}
        </button>
        <a href="#/" class="btn btn-secondary">Annuler</a>
      </div>
    </div>
  `;
  lucide.createIcons();
  renderIngredientLines();
  renderSubRecipeLines();
  renderStepLines();
  updateLiveMargin();
  setupIngredientAutocomplete();
  document.getElementById("add-step").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addStepLine();
    }
  });
  if (!isEdit) {
    _startDraftAutoSave();
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        const age = Date.now() - (draft.savedAt || 0);
        if (age < 864e5) {
          const draftBanner = document.createElement("div");
          draftBanner.className = "draft-restore-banner";
          draftBanner.innerHTML = `
            <span>\u{1F4DD} Un brouillon a \xE9t\xE9 sauvegard\xE9. Reprendre ?</span>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" id="draft-restore">Reprendre</button>
              <button class="btn btn-secondary btn-sm" id="draft-discard">Ignorer</button>
            </div>
          `;
          const formContent = document.getElementById("recipe-form-content");
          formContent.parentNode.insertBefore(draftBanner, formContent);
          document.getElementById("draft-restore").addEventListener("click", () => {
            _restoreDraft(draft);
            draftBanner.remove();
            showToast("Brouillon restaur\xE9", "success");
          });
          document.getElementById("draft-discard").addEventListener("click", () => {
            _clearDraft();
            draftBanner.remove();
          });
        } else {
          _clearDraft();
        }
      }
    } catch (e) {
    }
  }
}
function onRecipeTypeChange() {
  const type = document.getElementById("f-recipe-type").value;
  const priceGroup = document.getElementById("f-price-group");
  if (priceGroup) {
    priceGroup.style.display = type === "plat" ? "" : "none";
  }
}
function renderIngredientLines() {
  const el = document.getElementById("ing-list");
  if (!el) return;
  if (formIngredients.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);padding:8px 0">Aucun ingr\xE9dient ajout\xE9</p>';
    return;
  }
  el.innerHTML = formIngredients.map((ing, i) => {
    const net = ing.waste_percent > 0 ? (ing.gross_quantity * (1 - ing.waste_percent / 100)).toFixed(1) : ing.gross_quantity;
    return `
      <div class="ing-line">
        <span class="ing-name">${escapeHtml(ing.name)} ${ing.notes ? `<span class="ing-notes">(${escapeHtml(ing.notes)})</span>` : ""}</span>
        <span class="ing-qty">${ing.gross_quantity}${ing.unit}</span>
        <span class="ing-qty text-muted">\u2192 ${net}${ing.unit}</span>
        <span class="text-muted" style="font-size:var(--text-sm);font-family:var(--font-mono)">${ing.waste_percent}%</span>
        <span class="ing-remove" role="button" aria-label="Retirer l'ingr\xE9dient" onclick="removeIngredient(${i})"><i data-lucide="x" style="width:16px;height:16px"></i></span>
      </div>
    `;
  }).join("");
  lucide.createIcons();
  updateLiveMargin();
}
function renderSubRecipeLines() {
  const el = document.getElementById("sub-recipe-list");
  if (!el) return;
  if (formSubRecipes.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);padding:8px 0">Aucune sous-recette ajout\xE9e</p>';
    return;
  }
  el.innerHTML = formSubRecipes.map((sr, i) => `
    <div class="ing-line">
      <span class="ing-name">\u{1F4CB} ${escapeHtml(sr.name)}</span>
      <span class="ing-qty">${sr.quantity} portion${sr.quantity !== 1 ? "s" : ""}</span>
      <span class="ing-qty text-muted">${sr.cost > 0 ? formatCurrency(sr.cost) : ""}</span>
      <span class="ing-remove" role="button" aria-label="Retirer la sous-recette" onclick="removeSubRecipe(${i})"><i data-lucide="x" style="width:16px;height:16px"></i></span>
    </div>
  `).join("");
  lucide.createIcons();
}
function addSubRecipeLine() {
  const select = document.getElementById("add-sub-recipe");
  const qtyInput = document.getElementById("add-sub-qty");
  const recipeId = parseInt(select.value);
  const qty = parseFloat(qtyInput.value) || 1;
  if (!recipeId) {
    showToast("S\xE9lectionnez une sous-recette", "error");
    return;
  }
  if (formSubRecipes.some((sr) => sr.sub_recipe_id === recipeId)) {
    showToast("Cette sous-recette est d\xE9j\xE0 ajout\xE9e", "error");
    return;
  }
  const recipe = allRecipesForSub.find((r) => r.id === recipeId);
  formSubRecipes.push({
    sub_recipe_id: recipeId,
    name: recipe ? recipe.name : `#${recipeId}`,
    quantity: qty,
    cost: recipe ? (recipe.cost_per_portion || 0) * qty : 0
  });
  select.value = "";
  qtyInput.value = "1";
  renderSubRecipeLines();
}
function removeSubRecipe(i) {
  formSubRecipes.splice(i, 1);
  renderSubRecipeLines();
}
function renderStepLines() {
  const el = document.getElementById("steps-list");
  if (!el) return;
  if (formSteps.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);padding:8px 0">Aucune \xE9tape ajout\xE9e</p>';
    return;
  }
  el.innerHTML = `<ol class="steps-list">${formSteps.map(
    (s, i) => `<li><span style="flex:1">${escapeHtml(s)}</span><span class="ing-remove" role="button" aria-label="Retirer l'\xE9tape" onclick="removeStep(${i})"><i data-lucide="x" style="width:14px;height:14px"></i></span></li>`
  ).join("")}</ol>`;
  lucide.createIcons();
}
function addIngredientLine() {
  const name = document.getElementById("add-ing-name").value.trim();
  const qty = parseFloat(document.getElementById("add-ing-qty").value);
  const unit = document.getElementById("add-ing-unit").value;
  const waste = parseFloat(document.getElementById("add-ing-waste").value) || 0;
  const notes = document.getElementById("add-ing-notes").value.trim();
  if (!name || !qty) {
    showToast("Nom et quantit\xE9 requis", "error");
    return;
  }
  const existing = allIngredients.find((i) => i.name === name.toLowerCase());
  formIngredients.push({
    name: name.toLowerCase(),
    ingredient_id: (existing == null ? void 0 : existing.id) || null,
    gross_quantity: qty,
    net_quantity: qty * (1 - waste / 100),
    unit,
    waste_percent: waste || (existing == null ? void 0 : existing.waste_percent) || 0,
    notes
  });
  document.getElementById("add-ing-name").value = "";
  document.getElementById("add-ing-qty").value = "";
  document.getElementById("add-ing-waste").value = "";
  document.getElementById("add-ing-notes").value = "";
  document.getElementById("add-ing-name").focus();
  renderIngredientLines();
}
function removeIngredient(i) {
  formIngredients.splice(i, 1);
  renderIngredientLines();
}
function addStepLine() {
  const input = document.getElementById("add-step");
  const text = input.value.trim();
  if (!text) return;
  formSteps.push(text);
  input.value = "";
  input.focus();
  renderStepLines();
}
function removeStep(i) {
  formSteps.splice(i, 1);
  renderStepLines();
}
function updateLiveMargin() {
  const el = document.getElementById("live-margin");
  const priceInput = document.getElementById("f-price");
  if (!el || !priceInput) return;
  const price = parseFloat(priceInput.value) || 0;
  if (price <= 0) {
    el.innerHTML = "\u2014";
    el.style.color = "var(--text-secondary)";
    return;
  }
  el.innerHTML = `<span class="text-accent">Prix : ${formatCurrency(price)}</span>`;
}
function setupIngredientAutocomplete() {
  const input = document.getElementById("add-ing-name");
  const list = document.getElementById("ing-autocomplete");
  if (!input || !list) return;
  let highlighted = -1;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) {
      list.classList.add("hidden");
      return;
    }
    const matches = allIngredients.filter((i) => i.name.includes(q)).slice(0, 8);
    if (matches.length === 0) {
      list.classList.add("hidden");
      return;
    }
    highlighted = -1;
    list.innerHTML = matches.map(
      (m, i) => `<div class="autocomplete-item" data-index="${i}" data-name="${escapeHtml(m.name)}" data-waste="${m.waste_percent}" data-unit="${m.default_unit}">${escapeHtml(m.name)}</div>`
    ).join("");
    list.classList.remove("hidden");
    list.querySelectorAll(".autocomplete-item").forEach((item) => {
      item.addEventListener("click", () => {
        input.value = item.dataset.name;
        document.getElementById("add-ing-waste").value = item.dataset.waste || "";
        document.getElementById("add-ing-unit").value = item.dataset.unit || "g";
        list.classList.add("hidden");
        document.getElementById("add-ing-qty").focus();
      });
    });
  });
  input.addEventListener("keydown", (e) => {
    const items = list.querySelectorAll(".autocomplete-item");
    if (list.classList.contains("hidden") || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      items[highlighted].click();
      return;
    } else return;
    items.forEach((it, i) => it.classList.toggle("highlighted", i === highlighted));
  });
  input.addEventListener("blur", () => {
    setTimeout(() => list.classList.add("hidden"), 200);
  });
}
let recognition = null;
let isRecording = false;
function toggleMic() {
  if (isRecording) {
    stopMic();
  } else {
    startMic();
  }
}
function startMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("Reconnaissance vocale non support\xE9e", "error");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = false;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;
  const btn = document.getElementById("mic-btn");
  const status = document.getElementById("mic-status");
  recognition.onstart = () => {
    isRecording = true;
    btn.classList.add("recording");
    status.textContent = "\xC9coute en cours\u2026 Parlez naturellement";
    status.className = "mic-status recording";
  };
  recognition.onresult = async (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + " ";
    }
    transcript = transcript.trim();
    stopMic();
    status.textContent = "Analyse en cours\u2026";
    status.className = "mic-status processing";
    try {
      const parsed = await API.parseVoice(transcript);
      let statusMsg = "Fiche analys\xE9e ! V\xE9rifiez et ajustez ci-dessous.";
      if (parsed.estimated_total_cost > 0) {
        statusMsg += ` Food cost estim\xE9 : ${parsed.estimated_total_cost.toFixed(2)}\u20AC`;
        if (parsed.estimated_cost_per_portion > 0) {
          statusMsg += ` (${parsed.estimated_cost_per_portion.toFixed(2)}\u20AC/portion)`;
        }
      }
      status.textContent = statusMsg;
      status.className = "mic-status success";
      populateFromAI(parsed);
    } catch (e) {
      status.textContent = "Erreur : " + e.message;
      status.className = "mic-status";
      showToast("Erreur IA : " + e.message, "error");
    }
  };
  recognition.onerror = (event) => {
    stopMic();
    const status2 = document.getElementById("mic-status");
    if (event.error === "no-speech") {
      status2.textContent = "Aucune parole d\xE9tect\xE9e. R\xE9essayez.";
    } else {
      status2.textContent = "Erreur : " + event.error;
    }
    status2.className = "mic-status";
  };
  recognition.onend = () => {
    if (isRecording) {
      isRecording = false;
      btn.classList.remove("recording");
    }
  };
  recognition.start();
}
function stopMic() {
  if (recognition) {
    isRecording = false;
    recognition.stop();
    const btn = document.getElementById("mic-btn");
    if (btn) btn.classList.remove("recording");
  }
}
function populateFromAI(parsed) {
  if (parsed.name) document.getElementById("f-name").value = parsed.name;
  if (parsed.category) document.getElementById("f-category").value = parsed.category;
  if (parsed.portions) document.getElementById("f-portions").value = parsed.portions;
  if (parsed.prep_time_min) document.getElementById("f-prep").value = parsed.prep_time_min;
  if (parsed.cooking_time_min) document.getElementById("f-cooking").value = parsed.cooking_time_min;
  if (parsed.ingredients && parsed.ingredients.length > 0) {
    formIngredients = parsed.ingredients.map((ing) => ({
      name: (ing.matched_name || ing.name || "").toLowerCase(),
      ingredient_id: ing.ingredient_id || null,
      gross_quantity: ing.gross_quantity || 0,
      net_quantity: ing.net_quantity || null,
      unit: ing.unit || "g",
      waste_percent: ing.waste_percent || 0,
      notes: ing.notes || ""
    }));
    renderIngredientLines();
  }
  if (parsed.steps && parsed.steps.length > 0) {
    formSteps = parsed.steps;
    renderStepLines();
  }
}
function _collectDraftData() {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  return {
    name: ((_a = document.getElementById("f-name")) == null ? void 0 : _a.value) || "",
    category: ((_b = document.getElementById("f-category")) == null ? void 0 : _b.value) || "",
    recipe_type: ((_c = document.getElementById("f-recipe-type")) == null ? void 0 : _c.value) || "plat",
    portions: ((_d = document.getElementById("f-portions")) == null ? void 0 : _d.value) || "1",
    prep_time_min: ((_e = document.getElementById("f-prep")) == null ? void 0 : _e.value) || "",
    cooking_time_min: ((_f = document.getElementById("f-cooking")) == null ? void 0 : _f.value) || "",
    selling_price: ((_g = document.getElementById("f-price")) == null ? void 0 : _g.value) || "",
    notes: ((_h = document.getElementById("f-notes")) == null ? void 0 : _h.value) || "",
    ingredients: formIngredients,
    subRecipes: formSubRecipes,
    steps: formSteps,
    savedAt: Date.now()
  };
}
function _saveDraft() {
  try {
    const data = _collectDraftData();
    if (data.name || formIngredients.length || formSteps.length) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    }
  } catch (e) {
  }
}
function _clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  if (_draftAutoSaveTimer) {
    clearInterval(_draftAutoSaveTimer);
    _draftAutoSaveTimer = null;
  }
}
function _startDraftAutoSave() {
  if (_draftAutoSaveTimer) clearInterval(_draftAutoSaveTimer);
  _draftAutoSaveTimer = setInterval(_saveDraft, 3e4);
}
function _restoreDraft(draft) {
  if (draft.name) document.getElementById("f-name").value = draft.name;
  if (draft.category) document.getElementById("f-category").value = draft.category;
  if (draft.recipe_type) {
    document.getElementById("f-recipe-type").value = draft.recipe_type;
    onRecipeTypeChange();
  }
  if (draft.portions) document.getElementById("f-portions").value = draft.portions;
  if (draft.prep_time_min) document.getElementById("f-prep").value = draft.prep_time_min;
  if (draft.cooking_time_min) document.getElementById("f-cooking").value = draft.cooking_time_min;
  if (draft.selling_price) document.getElementById("f-price").value = draft.selling_price;
  if (draft.notes) document.getElementById("f-notes").value = draft.notes;
  if (draft.ingredients) {
    formIngredients = draft.ingredients;
    renderIngredientLines();
  }
  if (draft.subRecipes) {
    formSubRecipes = draft.subRecipes;
    renderSubRecipeLines();
  }
  if (draft.steps) {
    formSteps = draft.steps;
    renderStepLines();
  }
  updateLiveMargin();
}
async function saveRecipe(editId) {
  const name = document.getElementById("f-name").value.trim();
  if (!name) {
    showToast("Nom du plat requis", "error");
    return;
  }
  const recipeType = document.getElementById("f-recipe-type").value;
  const allIngs = formIngredients.map((ing) => ({
    name: ing.name,
    ingredient_id: ing.ingredient_id,
    gross_quantity: ing.gross_quantity,
    net_quantity: ing.net_quantity,
    unit: ing.unit,
    waste_percent: ing.waste_percent,
    custom_waste_percent: ing.waste_percent,
    notes: ing.notes
  }));
  for (const sr of formSubRecipes) {
    allIngs.push({
      sub_recipe_id: sr.sub_recipe_id,
      gross_quantity: sr.quantity,
      unit: "portion"
    });
  }
  const data = {
    name,
    category: document.getElementById("f-category").value || null,
    portions: parseInt(document.getElementById("f-portions").value) || 1,
    prep_time_min: parseInt(document.getElementById("f-prep").value) || null,
    cooking_time_min: parseInt(document.getElementById("f-cooking").value) || null,
    selling_price: recipeType === "plat" ? parseFloat(document.getElementById("f-price").value) || null : null,
    notes: document.getElementById("f-notes").value.trim() || null,
    recipe_type: recipeType,
    ingredients: allIngs,
    steps: formSteps
  };
  try {
    let result;
    if (editId) {
      result = await API.updateRecipe(editId, data);
      showToast("Fiche mise \xE0 jour", "success");
    } else {
      result = await API.createRecipe(data);
      showToast("Fiche cr\xE9\xE9e !", "success");
    }
    _clearDraft();
    location.hash = `#/recipe/${result.id}`;
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function renderIngredients() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <h1>Ingr\xE9dients</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary role-gerant-only" onclick="showCSVImportModal()"><i data-lucide="upload" style="width:16px;height:16px"></i> Importer</button>
        <a href="/api/ingredients/export-csv" class="btn btn-secondary role-gerant-only" download="ingredients.csv"><i data-lucide="download" style="width:16px;height:16px"></i> Exporter</a>
        <button class="btn btn-primary role-gerant-only" onclick="showIngredientModal()"><i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter</button>
      </div>
    </div>
    <div class="search-bar">
      <span class="search-icon"><i data-lucide="search"></i></span>
      <input type="text" id="ing-search" placeholder="Rechercher un ingr\xE9dient..." autocomplete="off">
    </div>
    <div id="ing-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();
  let ingredients = [];
  try {
    const response = await API.getIngredients();
    ingredients = response.ingredients || [];
  } catch (e) {
    showToast("Erreur", "error");
  }
  const listEl = document.getElementById("ing-list");
  const searchInput = document.getElementById("ing-search");
  function renderList(filter = "") {
    const filtered2 = filter ? ingredients.filter((i) => i.name.includes(filter.toLowerCase()) || (i.category || "").includes(filter.toLowerCase())) : ingredients;
    if (filtered2.length === 0) {
      listEl.innerHTML = filter ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="package"></i></div>
          <p>Aucun r\xE9sultat</p>
        </div>` : `
        <div class="empty-state">
          <div class="empty-icon">\u{1F955}</div>
          <h3>Aucun ingr\xE9dient</h3>
          <p>Ajoutez vos premiers ingr\xE9dients pour calculer vos co\xFBts.</p>
        </div>`;
      lucide.createIcons();
      return;
    }
    const isGerant = getRole() === "gerant";
    listEl.innerHTML = filtered2.map((ing) => `
      <div class="card" ${isGerant ? `onclick="showIngredientDetail(${ing.id})"` : ""}>
        <div class="card-header">
          <span class="card-title" style="text-transform:capitalize">${escapeHtml(ing.name)}</span>
          ${ing.category ? `<span class="card-category">${escapeHtml(ing.category)}</span>` : ""}
        </div>
        <div class="card-stats">
          <div>
            <span class="stat-value">${ing.waste_percent}%</span>
            <span class="stat-label">Perte</span>
          </div>
          <div>
            <span class="stat-value">${ing.default_unit}</span>
            <span class="stat-label">Unit\xE9</span>
          </div>
          <div>
            <span class="stat-value">${ing.price_per_unit > 0 ? ing.price_per_unit.toFixed(2) + "\u20AC" : "\u2014"}</span>
            <span class="stat-label">${ing.price_per_unit > 0 ? "/" + (ing.price_unit || "kg") : "Prix"}</span>
          </div>
          ${ing.allergens ? `<div>
            <span class="stat-value" style="font-size:var(--text-xs)">${escapeHtml(ing.allergens)}</span>
            <span class="stat-label">Allerg\xE8nes INCO</span>
          </div>` : ""}
        </div>
      </div>
    `).join("");
  }
  renderList();
  searchInput.addEventListener("input", (e) => renderList(e.target.value));
}
function showIngredientModal(ingredient = null) {
  const isEdit = !!ingredient;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? "Modifier l'ingr\xE9dient" : "Nouvel ingr\xE9dient"}</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-ing-name" value="${escapeHtml((ingredient == null ? void 0 : ingredient.name) || "")}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cat\xE9gorie</label>
          <select class="form-control" id="m-ing-cat">
            <option value="">\u2014</option>
            ${["viande", "poisson", "l\xE9gume", "f\xE9culent", "produit laitier", "\xE9pice", "condiment", "autre"].map(
    (c) => `<option value="${c}" ${(ingredient == null ? void 0 : ingredient.category) === c ? "selected" : ""}>${c}</option>`
  ).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Unit\xE9 par d\xE9faut</label>
          <select class="form-control" id="m-ing-unit">
            ${["g", "kg", "cl", "l", "pi\xE8ce", "botte"].map(
    (u) => `<option value="${u}" ${(ingredient == null ? void 0 : ingredient.default_unit) === u ? "selected" : ""}>${u}</option>`
  ).join("")}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Perte (%)</label>
          <input type="number" class="form-control" id="m-ing-waste" value="${(ingredient == null ? void 0 : ingredient.waste_percent) || 0}" min="0" max="100" step="0.5">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Allerg\xE8nes INCO</label>
          <div id="m-ing-allergens-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-top:4px">
            ${getAllergenCheckboxes((ingredient == null ? void 0 : ingredient.allergens) || "")}
          </div>
          <input type="hidden" id="m-ing-allergens" value="${escapeHtml((ingredient == null ? void 0 : ingredient.allergens) || "")}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix unitaire (\u20AC)</label>
          <input type="number" class="form-control" id="m-ing-price" value="${(ingredient == null ? void 0 : ingredient.price_per_unit) || ""}" min="0" step="0.1" placeholder="ex: 4.50\u20AC/kg">
        </div>
        <div class="form-group">
          <label>Unit\xE9 de prix</label>
          <select class="form-control" id="m-ing-price-unit">
            ${["kg", "l", "pi\xE8ce", "botte"].map(
    (u) => `<option value="${u}" ${((ingredient == null ? void 0 : ingredient.price_unit) || "kg") === u ? "selected" : ""}>${u}</option>`
  ).join("")}
          </select>
        </div>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-ing-save">
          <i data-lucide="${isEdit ? "save" : "plus"}" style="width:18px;height:18px"></i>
          ${isEdit ? "Enregistrer" : "Cr\xE9er"}
        </button>
        <button class="btn btn-secondary" id="m-ing-cancel">Annuler</button>
        ${isEdit ? '<button class="btn btn-danger" id="m-ing-delete"><i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer</button>' : ""}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  overlay.querySelector("#m-ing-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#m-ing-save").onclick = async () => {
    const data = {
      name: document.getElementById("m-ing-name").value.trim(),
      category: document.getElementById("m-ing-cat").value || null,
      default_unit: document.getElementById("m-ing-unit").value,
      waste_percent: parseFloat(document.getElementById("m-ing-waste").value) || 0,
      allergens: getSelectedAllergens() || null,
      price_per_unit: parseFloat(document.getElementById("m-ing-price").value) || 0,
      price_unit: document.getElementById("m-ing-price-unit").value || "kg"
    };
    if (!data.name) {
      showToast("Nom requis", "error");
      return;
    }
    try {
      if (isEdit) {
        await API.updateIngredient(ingredient.id, data);
        showToast("Ingr\xE9dient mis \xE0 jour", "success");
      } else {
        await API.createIngredient(data);
        showToast("Ingr\xE9dient cr\xE9\xE9", "success");
      }
      overlay.remove();
      renderIngredients();
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  if (isEdit) {
    overlay.querySelector("#m-ing-delete").onclick = () => {
      showConfirmModal("Supprimer cet ingr\xE9dient ?", "Cette action est irr\xE9versible. Les fiches techniques utilisant cet ingr\xE9dient seront affect\xE9es.", async () => {
        try {
          await API.deleteIngredient(ingredient.id);
          showToast("Ingr\xE9dient supprim\xE9", "success");
          overlay.remove();
          renderIngredients();
        } catch (e) {
          showToast(e.message, "error");
        }
      });
    };
  }
}
function showCSVImportModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <h2>\u{1F4E5} Importer des ingr\xE9dients (CSV)</h2>
      <p class="text-muted" style="font-size:var(--text-sm);margin-bottom:12px">Format attendu : <code>nom;cat\xE9gorie;unit\xE9;prix_unitaire;pourcentage_perte</code><br>S\xE9parateur : <code>;</code> ou <code>,</code></p>
      <div class="form-group">
        <input type="file" id="csv-file-input" accept=".csv,.txt" class="form-control">
      </div>
      <div id="csv-preview" style="display:none">
        <h3 style="font-size:var(--text-sm);margin-bottom:8px">Aper\xE7u (5 premi\xE8res lignes)</h3>
        <div id="csv-preview-content"></div>
      </div>
      <div class="actions-row" style="margin-top:16px">
        <button class="btn btn-primary" id="csv-confirm-btn" disabled>Confirmer l'import</button>
        <button class="btn btn-secondary" id="csv-cancel-btn">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  let parsedRows = [];
  overlay.querySelector("#csv-cancel-btn").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#csv-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const delimiter = lines[0].includes(";") ? ";" : ",";
      let startIdx = 0;
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes("nom") || firstLine.includes("name")) startIdx = 1;
      parsedRows = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map((s) => s.trim());
        if (parts.length >= 1 && parts[0]) {
          parsedRows.push({
            name: parts[0],
            category: parts[1] || null,
            default_unit: parts[2] || "g",
            price_per_unit: parseFloat(parts[3]) || 0,
            waste_percent: parseFloat(parts[4]) || 0
          });
        }
      }
      const preview = overlay.querySelector("#csv-preview");
      const content = overlay.querySelector("#csv-preview-content");
      if (parsedRows.length === 0) {
        content.innerHTML = '<p class="text-muted">Aucune ligne valide d\xE9tect\xE9e.</p>';
        preview.style.display = "block";
        return;
      }
      const previewRows = parsedRows.slice(0, 5);
      content.innerHTML = `
        <table class="csv-preview-table">
          <thead><tr><th>Nom</th><th>Cat\xE9gorie</th><th>Unit\xE9</th><th>Prix unitaire</th><th>Perte %</th></tr></thead>
          <tbody>${previewRows.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.category || "\u2014")}</td>
              <td>${r.default_unit}</td>
              <td>${r.price_per_unit}</td>
              <td>${r.waste_percent}%</td>
            </tr>
          `).join("")}</tbody>
        </table>
        <p class="text-muted" style="font-size:var(--text-xs)">${parsedRows.length} ingr\xE9dient(s) d\xE9tect\xE9(s)</p>
      `;
      preview.style.display = "block";
      overlay.querySelector("#csv-confirm-btn").disabled = false;
    };
    reader.readAsText(file);
  });
  overlay.querySelector("#csv-confirm-btn").addEventListener("click", async () => {
    if (parsedRows.length === 0) return;
    const btn = overlay.querySelector("#csv-confirm-btn");
    btn.disabled = true;
    btn.textContent = "Import en cours\u2026";
    let success = 0, errors = 0;
    for (const row of parsedRows) {
      try {
        await API.createIngredient({
          name: row.name,
          category: row.category,
          default_unit: row.default_unit,
          waste_percent: row.waste_percent,
          price_per_unit: row.price_per_unit
        });
        success++;
      } catch (e) {
        errors++;
      }
    }
    overlay.remove();
    showToast(`${success} ingr\xE9dient(s) import\xE9(s)${errors > 0 ? `, ${errors} erreur(s)` : ""}`, errors > 0 ? "info" : "success");
    renderIngredients();
  });
}
async function showIngredientDetail(id) {
  let ingredients;
  try {
    const response = await API.getIngredients();
    ingredients = response.ingredients || [];
  } catch (e) {
    return;
  }
  const ing = ingredients.find((i) => i.id === id);
  if (!ing) return;
  showIngredientModal(ing);
}
const INCO_ALLERGENS = [
  { code: "gluten", name: "Gluten", icon: "\u{1F33E}" },
  { code: "crustaces", name: "Crustaces", icon: "\u{1F990}" },
  { code: "oeufs", name: "Oeufs", icon: "\u{1F95A}" },
  { code: "poissons", name: "Poissons", icon: "\u{1F41F}" },
  { code: "arachides", name: "Arachides", icon: "\u{1F95C}" },
  { code: "soja", name: "Soja", icon: "\u{1FAD8}" },
  { code: "lait", name: "Lait", icon: "\u{1F95B}" },
  { code: "fruits_coque", name: "Fruits a coque", icon: "\u{1F330}" },
  { code: "celeri", name: "Celeri", icon: "\u{1F96C}" },
  { code: "moutarde", name: "Moutarde", icon: "\u{1F7E1}" },
  { code: "sesame", name: "Sesame", icon: "\u26AA" },
  { code: "sulfites", name: "Sulfites", icon: "\u{1F377}" },
  { code: "lupin", name: "Lupin", icon: "\u{1F33F}" },
  { code: "mollusques", name: "Mollusques", icon: "\u{1F9AA}" }
];
function getAllergenCheckboxes(currentValue) {
  const current = (currentValue || "").toLowerCase();
  return INCO_ALLERGENS.map((a) => {
    const checked = current.includes(a.name.toLowerCase()) || current.includes(a.code) ? "checked" : "";
    return `<label style="display:flex;align-items:center;gap:4px;font-size:var(--text-sm);cursor:pointer;padding:4px 6px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-color)">
      <input type="checkbox" class="allergen-cb" value="${a.code}" data-name="${a.name}" ${checked} style="margin:0">
      <span>${a.icon} ${a.name}</span>
    </label>`;
  }).join("");
}
function getSelectedAllergens() {
  const checked = document.querySelectorAll(".allergen-cb:checked");
  if (checked.length === 0) return null;
  return Array.from(checked).map((cb) => cb.dataset.name).join(", ");
}
async function renderStockDashboard() {
  const app = document.getElementById("app");
  const account = getAccount();
  const isGerant = account && account.role === "gerant";
  app.innerHTML = `
    <div class="view-header">
      <h1>\u{1F4E6} Stock</h1>
      <p class="text-secondary">Vue d'ensemble du stock actuel</p>
    </div>
    <div id="delivery-pending-banner" style="margin-bottom:var(--space-4)"></div>
    <div class="stock-actions" style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap">
      <a href="#/deliveries" class="btn btn-primary btn-lg" id="btn-deliveries-link" style="flex:1;min-width:180px;text-decoration:none;text-align:center">
        \u{1F69A} Livraisons
      </a>
      <a href="#/stock/reception" class="btn btn-accent btn-lg" style="flex:1;min-width:180px;text-decoration:none;text-align:center">
        \u{1F4E5} R\xE9ception
      </a>
      <a href="#/scan-invoice" class="btn btn-secondary" style="flex:1;min-width:160px;text-decoration:none;text-align:center">
        \u{1F4F7} Scanner facture
      </a>
      ${isGerant ? `
      <button class="btn btn-secondary" id="stock-inventory-btn" style="flex:1;min-width:140px">
        \u{1F4CB} Inventaire
      </button>
      ` : ""}
      <a href="#/stock/movements" class="btn btn-secondary" style="min-width:120px;text-decoration:none;text-align:center">
        \u{1F4CA} Historique
      </a>
      ${isGerant ? `
      <a href="#/stock/variance" class="btn btn-secondary" style="min-width:140px;text-decoration:none;text-align:center">
        \u{1F4C9} \xC9carts
      </a>
      ` : ""}
    </div>
    <div class="search-bar" style="margin-bottom:var(--space-5)">
      <input type="text" id="stock-search" placeholder="Rechercher un ingr\xE9dient..." class="input" style="width:100%">
    </div>
    <div id="stock-alerts-section"></div>
    <div id="stock-content">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  let searchTimeout;
  const searchInput = document.getElementById("stock-search");
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadStock(searchInput.value), 300);
  });
  if (isGerant) {
    const invBtn = document.getElementById("stock-inventory-btn");
    if (invBtn) invBtn.addEventListener("click", () => showInventoryModal());
  }
  await loadStock();
  try {
    const pending = await API.getDeliveries("pending");
    const btn = document.getElementById("btn-deliveries-link");
    if (btn && pending.length > 0) {
      btn.innerHTML = `\u{1F69A} Livraisons <span style="background:var(--color-danger);color:white;border-radius:50%;padding:2px 7px;font-size:var(--text-xs);margin-left:6px">${pending.length}</span>`;
    }
  } catch (e) {
  }
}
async function loadStock(query) {
  try {
    const [stockData, alerts] = await Promise.all([
      API.getStock(query),
      API.getStockAlerts()
    ]);
    const stock = stockData.items || stockData;
    const productCount = stockData.product_count;
    const alertsSection = document.getElementById("stock-alerts-section");
    if (alerts.length > 0 && !query) {
      alertsSection.innerHTML = `
        <div class="stock-alert-banner" style="background:var(--color-danger-light);border:1px solid var(--color-danger);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
          <h3 style="color:var(--color-danger);margin-bottom:var(--space-2)">\u26A0\uFE0F ${alerts.length} alerte${alerts.length > 1 ? "s" : ""} stock bas</h3>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
            ${alerts.map((a) => `
              <span class="badge badge--danger" style="font-size:var(--text-sm)">
                ${escapeHtml(a.ingredient_name)} : ${formatQuantity(a.quantity, a.unit)} (min: ${formatQuantity(a.min_quantity, a.unit)})
              </span>
            `).join("")}
          </div>
        </div>
      `;
    } else {
      alertsSection.innerHTML = "";
    }
    const categories = {};
    for (const item of stock) {
      const cat = item.category || "Autres";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }
    const categoryIcons = {
      "Viandes": "\u{1F969}",
      "Poissons": "\u{1F41F}",
      "L\xE9gumes": "\u{1F96C}",
      "Fruits": "\u{1F34E}",
      "Produits laitiers": "\u{1F9C0}",
      "\xC9pices": "\u{1F336}\uFE0F",
      "F\xE9culents": "\u{1F33E}",
      "Mati\xE8res grasses": "\u{1F9C8}",
      "Sucres": "\u{1F36F}",
      "Boissons": "\u{1F377}",
      "Autres": "\u{1F4E6}"
    };
    const content = document.getElementById("stock-content");
    const headerP = document.querySelector(".view-header .text-secondary");
    if (headerP && productCount != null) {
      headerP.textContent = `${productCount} produit${productCount !== 1 ? "s" : ""} en stock`;
    }
    if (stock.length === 0) {
      content.innerHTML = query ? `
        <div class="empty-state">
          <div class="empty-icon">\u{1F4E6}</div>
          <p>Aucun r\xE9sultat</p>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">\u{1F4E6}</div>
          <h3>Votre stock est vide</h3>
          <p>Enregistrez votre premi\xE8re r\xE9ception pour commencer le suivi.</p>
          <a href="#/stock/reception" class="btn btn-primary">R\xE9ception marchandise</a>
        </div>
      `;
      return;
    }
    content.innerHTML = Object.entries(categories).map(([cat, items]) => `
      <div class="stock-category" style="margin-bottom:var(--space-6)">
        <h2 style="margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)">
          <span>${categoryIcons[cat] || "\u{1F4E6}"}</span> ${escapeHtml(cat)}
          <span class="text-secondary text-sm" style="font-weight:400">(${items.length})</span>
        </h2>
        <div class="stock-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">
          ${items.map((item) => renderStockCard(item)).join("")}
        </div>
      </div>
    `).join("");
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    document.getElementById("stock-content").innerHTML = `
      <div class="empty-state" style="text-align:center;padding:var(--space-8)">
        <p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}
function renderStockCard(item) {
  const isAlert = item.is_alert;
  const pct = item.min_quantity > 0 ? Math.min(100, item.quantity / item.min_quantity * 100) : 100;
  const barColor = pct <= 25 ? "var(--color-danger)" : pct <= 50 ? "var(--color-warning)" : "var(--color-success)";
  return `
    <div class="card stock-card" style="padding:var(--space-4);border:1px solid ${isAlert ? "var(--color-danger)" : "var(--border-default)"};border-radius:var(--radius-lg);background:var(--bg-elevated);${isAlert ? "box-shadow:0 0 12px rgba(217,48,37,0.15)" : ""}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-2)">
        <h3 style="font-size:var(--text-base);font-weight:600">${escapeHtml(item.ingredient_name)}</h3>
        ${isAlert ? '<span class="badge badge--danger" style="font-size:var(--text-xs)">Stock bas</span>' : ""}
      </div>
      <div style="display:flex;align-items:baseline;gap:var(--space-2);margin-bottom:var(--space-3)">
        <span class="data-value" style="font-size:var(--text-xl);font-weight:700;color:${isAlert ? "var(--color-danger)" : "var(--text-primary)"}">${formatQuantity(item.quantity, item.unit)}</span>
      </div>
      ${item.min_quantity > 0 ? `
      <div style="margin-bottom:var(--space-2)">
        <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">
          <span>Seuil min : ${formatQuantity(item.min_quantity, item.unit)}</span>
          <span>${Math.round(pct)}%</span>
        </div>
        <div style="height:4px;background:var(--bg-sunken);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100, pct)}%;background:${barColor};border-radius:2px;transition:width 0.3s"></div>
        </div>
      </div>
      ` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--text-xs);color:var(--text-tertiary)">
        <span>M\xE0j : ${item.last_updated ? new Date(item.last_updated).toLocaleDateString("fr-FR") : "\u2014"}</span>
        ${item.supplier_name ? `<span style="color:#8899aa;font-size:12px">${escapeHtml(item.supplier_name)}</span>` : ""}
      </div>
    </div>
  `;
}
async function showInventoryModal() {
  const account = getAccount();
  let ingredients;
  try {
    const response = await API.getIngredients();
    ingredients = response.ingredients || [];
  } catch (e) {
    showToast("Erreur chargement ingr\xE9dients", "error");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:var(--z-modal-backdrop);display:flex;align-items:center;justify-content:center;padding:var(--space-4)";
  overlay.innerHTML = `
    <div class="modal" style="background:var(--bg-elevated);border-radius:var(--radius-xl);padding:var(--space-6);max-width:500px;width:100%;max-height:80vh;overflow-y:auto">
      <h2 style="margin-bottom:var(--space-4)">\u{1F4CB} Inventaire</h2>
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Ingr\xE9dient</label>
        <select id="inv-ingredient" class="input">
          <option value="">\u2014 S\xE9lectionner \u2014</option>
          ${ingredients.map((i) => `<option value="${i.id}" data-unit="${escapeHtml(i.default_unit || "kg")}">${escapeHtml(i.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Quantit\xE9 r\xE9elle</label>
        <div style="display:flex;gap:var(--space-2)">
          <input type="number" id="inv-qty" class="input" step="0.01" min="0" placeholder="0" style="flex:1">
          <input type="text" id="inv-unit" class="input" value="kg" style="width:80px" readonly>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
        <button class="btn btn-secondary" id="inv-cancel">Annuler</button>
        <button class="btn btn-primary" id="inv-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const ingredientSelect = overlay.querySelector("#inv-ingredient");
  const unitInput = overlay.querySelector("#inv-unit");
  ingredientSelect.addEventListener("change", () => {
    const opt = ingredientSelect.options[ingredientSelect.selectedIndex];
    unitInput.value = opt.dataset.unit || "kg";
  });
  overlay.querySelector("#inv-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#inv-save").addEventListener("click", async () => {
    const ingredientId = Number(ingredientSelect.value);
    const qty = parseFloat(overlay.querySelector("#inv-qty").value);
    const unit = unitInput.value;
    if (!ingredientId || isNaN(qty)) {
      showToast("Veuillez remplir tous les champs", "error");
      return;
    }
    try {
      await API.postStockInventory({
        ingredient_id: ingredientId,
        new_quantity: qty,
        unit,
        recorded_by: account ? account.id : null
      });
      showToast("Inventaire enregistr\xE9", "success");
      overlay.remove();
      await loadStock();
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}
async function renderStockReception() {
  const app = document.getElementById("app");
  const account = getAccount();
  let suppliers = [], ingredients = [];
  try {
    const results = await Promise.all([
      API.getSuppliers(),
      API.getIngredients()
    ]);
    suppliers = results[0];
    const ingredientsResponse = results[1];
    ingredients = ingredientsResponse.ingredients || [];
  } catch (e) {
    app.innerHTML = `<div class="empty-state"><p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p></div>`;
    return;
  }
  app.innerHTML = `
    <nav aria-label="Breadcrumb" class="breadcrumb">
      <a href="#/stock">Stock</a>
      <span class="breadcrumb-sep">\u203A</span>
      <span class="breadcrumb-current">R\xE9ception</span>
    </nav>
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <a href="#/stock" style="color:var(--text-secondary);text-decoration:none;font-size:1.5rem">\u2190</a>
        <div>
          <h1>\u{1F4E5} R\xE9ception marchandise</h1>
          <p class="text-secondary">Enregistrez la r\xE9ception d'une commande</p>
        </div>
      </div>
    </div>

    <div class="reception-form" style="margin-bottom:var(--space-5)">
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Fournisseur</label>
        <select id="rec-supplier" class="input">
          <option value="">\u2014 S\xE9lectionner un fournisseur \u2014</option>
          ${suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
        </select>
      </div>

      <div id="reception-lines">
        <!-- Lines will be added here -->
      </div>

      <button class="btn btn-secondary" id="add-line-btn" style="width:100%;margin-bottom:var(--space-5)">
        + Ajouter un produit
      </button>

      <button class="btn btn-accent btn-lg" id="validate-reception-btn" style="width:100%" disabled>
        \u2705 Valider la r\xE9ception
      </button>
    </div>
  `;
  const linesContainer = document.getElementById("reception-lines");
  let lineCount = 0;
  function addLine() {
    lineCount++;
    const lineEl = document.createElement("div");
    lineEl.className = "reception-line";
    lineEl.dataset.lineId = lineCount;
    lineEl.style.cssText = "background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3);position:relative";
    lineEl.innerHTML = `
      <button class="remove-line-btn" style="position:absolute;top:var(--space-2);right:var(--space-2);background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:1.2rem;padding:var(--space-1)" title="Supprimer">\u2715</button>
      <div style="font-weight:600;margin-bottom:var(--space-3);color:var(--text-secondary);font-size:var(--text-sm)">Produit #${lineCount}</div>
      <div class="form-group" style="margin-bottom:var(--space-3)">
        <label class="form-label">Ingr\xE9dient *</label>
        <div style="position:relative">
          <input type="text" class="input line-ingredient-search" placeholder="Rechercher un ingr\xE9dient..." autocomplete="off">
          <input type="hidden" class="line-ingredient-id">
          <div class="autocomplete-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-md);max-height:200px;overflow-y:auto;z-index:10"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 80px;gap:var(--space-2);margin-bottom:var(--space-3)">
        <div class="form-group">
          <label class="form-label">Quantit\xE9 *</label>
          <input type="number" class="input line-qty" step="0.01" min="0.01" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Unit\xE9</label>
          <input type="text" class="input line-unit" value="kg">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:var(--space-3)">
        <div class="form-group">
          <label class="form-label">Prix unitaire (\u20AC)</label>
          <input type="number" class="input line-price" step="0.01" min="0" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">N\xB0 de lot</label>
          <input type="text" class="input line-batch" placeholder="Optionnel">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:var(--space-3)">
        <div class="form-group">
          <label class="form-label">DLC</label>
          <input type="date" class="input line-dlc">
        </div>
        <div class="form-group">
          <label class="form-label">T\xB0 r\xE9ception (\xB0C)</label>
          <input type="number" class="input line-temp" step="0.1" placeholder="Ex: 3.5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" class="input line-notes" placeholder="Remarques \xE9ventuelles">
      </div>
    `;
    linesContainer.appendChild(lineEl);
    lineEl.querySelector(".remove-line-btn").addEventListener("click", () => {
      lineEl.remove();
      updateValidateBtn();
    });
    const searchInput = lineEl.querySelector(".line-ingredient-search");
    const hiddenId = lineEl.querySelector(".line-ingredient-id");
    const dropdown = lineEl.querySelector(".autocomplete-dropdown");
    const unitInput = lineEl.querySelector(".line-unit");
    let acTimeout;
    searchInput.addEventListener("input", () => {
      clearTimeout(acTimeout);
      const val = searchInput.value.trim().toLowerCase();
      if (val.length < 1) {
        dropdown.style.display = "none";
        return;
      }
      acTimeout = setTimeout(() => {
        const matches = ingredients.filter((i) => i.name.toLowerCase().includes(val)).slice(0, 10);
        if (matches.length === 0) {
          dropdown.style.display = "none";
          return;
        }
        dropdown.innerHTML = matches.map((m) => `
          <div class="ac-option" data-id="${m.id}" data-name="${escapeHtml(m.name)}" data-unit="${m.default_unit || "kg"}"
               style="padding:var(--space-2) var(--space-3);cursor:pointer;border-bottom:1px solid var(--border-light);font-size:var(--text-sm)">
            ${escapeHtml(m.name)} <span style="color:var(--text-tertiary)">(${m.category || "\u2014"})</span>
          </div>
        `).join("");
        dropdown.style.display = "block";
        dropdown.querySelectorAll(".ac-option").forEach((opt) => {
          opt.addEventListener("click", () => {
            searchInput.value = opt.dataset.name;
            hiddenId.value = opt.dataset.id;
            unitInput.value = opt.dataset.unit;
            dropdown.style.display = "none";
            updateValidateBtn();
          });
        });
      }, 150);
    });
    searchInput.addEventListener("blur", () => {
      setTimeout(() => {
        dropdown.style.display = "none";
      }, 200);
    });
    lineEl.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", updateValidateBtn);
    });
    updateValidateBtn();
    searchInput.focus();
  }
  function updateValidateBtn() {
    const lines = linesContainer.querySelectorAll(".reception-line");
    const btn = document.getElementById("validate-reception-btn");
    let valid = lines.length > 0;
    lines.forEach((line) => {
      const ingId = line.querySelector(".line-ingredient-id").value;
      const qty = parseFloat(line.querySelector(".line-qty").value);
      if (!ingId || isNaN(qty) || qty <= 0) valid = false;
    });
    btn.disabled = !valid;
    btn.textContent = lines.length > 0 ? `\u2705 Valider la r\xE9ception (${lines.length} produit${lines.length > 1 ? "s" : ""})` : "\u2705 Valider la r\xE9ception";
  }
  document.getElementById("add-line-btn").addEventListener("click", addLine);
  document.getElementById("validate-reception-btn").addEventListener("click", async () => {
    const btn = document.getElementById("validate-reception-btn");
    const supplierId = document.getElementById("rec-supplier").value || null;
    const lineEls = linesContainer.querySelectorAll(".reception-line");
    const lines = [];
    lineEls.forEach((el) => {
      lines.push({
        ingredient_id: Number(el.querySelector(".line-ingredient-id").value),
        quantity: parseFloat(el.querySelector(".line-qty").value),
        unit: el.querySelector(".line-unit").value || "kg",
        unit_price: parseFloat(el.querySelector(".line-price").value) || null,
        supplier_id: supplierId ? Number(supplierId) : null,
        batch_number: el.querySelector(".line-batch").value || null,
        dlc: el.querySelector(".line-dlc").value || null,
        temperature: parseFloat(el.querySelector(".line-temp").value) || null,
        notes: el.querySelector(".line-notes").value || null
      });
    });
    btn.disabled = true;
    btn.textContent = "Enregistrement...";
    try {
      await API.postReception({
        lines,
        recorded_by: account ? account.id : null
      });
      showToast(`\u2705 R\xE9ception enregistr\xE9e (${lines.length} produit${lines.length > 1 ? "s" : ""})`, "success");
      location.hash = "#/stock";
    } catch (e) {
      showToast(e.message, "error");
      btn.disabled = false;
      updateValidateBtn();
    }
  });
  addLine();
}
async function renderStockMovements() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <a href="#/stock" style="color:var(--text-secondary);text-decoration:none;font-size:1.5rem">\u2190</a>
        <div>
          <h1>\u{1F4CA} Mouvements de stock</h1>
          <p class="text-secondary">Historique des entr\xE9es et sorties</p>
        </div>
      </div>
    </div>

    <div class="movements-filters" style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap">
      <select id="mv-type-filter" class="input" style="min-width:140px">
        <option value="">Tous les types</option>
        <option value="reception">\u{1F4E5} R\xE9ception</option>
        <option value="consumption">\u{1F4E4} Consommation</option>
        <option value="loss">\u274C Perte</option>
        <option value="adjustment">\u{1F504} Ajustement</option>
        <option value="inventory">\u{1F4CB} Inventaire</option>
      </select>
      <input type="date" id="mv-from" class="input" lang="fr" style="min-width:140px">
      <input type="date" id="mv-to" class="input" lang="fr" style="min-width:140px">
      <button class="btn btn-secondary" id="mv-export-btn">\u{1F4C4} Export PDF</button>
    </div>

    <div id="movements-content">
      <div class="loading-spinner" style="text-align:center;padding:var(--space-8)">Chargement...</div>
    </div>
  `;
  const now = /* @__PURE__ */ new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
  document.getElementById("mv-from").value = thirtyDaysAgo.toISOString().slice(0, 10);
  document.getElementById("mv-to").value = now.toISOString().slice(0, 10);
  const loadMovements = async () => {
    const type = document.getElementById("mv-type-filter").value;
    const from = document.getElementById("mv-from").value;
    const to = document.getElementById("mv-to").value;
    const params = {};
    if (type) params.type = type;
    if (from) params.from = from;
    if (to) params.to = to;
    try {
      const movements = await API.getStockMovements(params);
      renderMovementsList(movements);
    } catch (e) {
      document.getElementById("movements-content").innerHTML = `
        <div class="empty-state"><p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p></div>
      `;
    }
  };
  document.getElementById("mv-type-filter").addEventListener("change", loadMovements);
  document.getElementById("mv-from").addEventListener("change", loadMovements);
  document.getElementById("mv-to").addEventListener("change", loadMovements);
  document.getElementById("mv-export-btn").addEventListener("click", async () => {
    const from = document.getElementById("mv-from").value;
    const to = document.getElementById("mv-to").value;
    try {
      const url = await API.getStockExportUrl(from, to);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock-mouvements-${from || "all"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF export\xE9", "success");
    } catch (e) {
      showToast("Erreur export PDF", "error");
    }
  });
  await loadMovements();
}
function renderMovementsList(movements) {
  const content = document.getElementById("movements-content");
  if (movements.length === 0) {
    content.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:var(--space-10)">
        <div style="font-size:3rem;margin-bottom:var(--space-4)">\u{1F4CA}</div>
        <p class="text-secondary">Aucun mouvement trouv\xE9</p>
      </div>
    `;
    return;
  }
  const typeConfig = {
    reception: { icon: "\u{1F4E5}", label: "R\xE9ception", color: "var(--color-success)" },
    consumption: { icon: "\u{1F4E4}", label: "Consommation", color: "var(--color-warning)" },
    loss: { icon: "\u274C", label: "Perte", color: "var(--color-danger)" },
    adjustment: { icon: "\u{1F504}", label: "Ajustement", color: "var(--color-info)" },
    inventory: { icon: "\u{1F4CB}", label: "Inventaire", color: "var(--text-secondary)" }
  };
  const grouped = {};
  for (const mv of movements) {
    const date = new Date(mv.recorded_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(mv);
  }
  content.innerHTML = Object.entries(grouped).map(([date, items]) => `
    <div class="movements-day" style="margin-bottom:var(--space-5)">
      <h3 style="margin-bottom:var(--space-3);color:var(--text-secondary);font-size:var(--text-sm);text-transform:capitalize">${date}</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${items.map((mv) => {
    const cfg = typeConfig[mv.movement_type] || { icon: "\u2753", label: mv.movement_type, color: "var(--text-secondary)" };
    const time = new Date(mv.recorded_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const sign = mv.movement_type === "reception" ? "+" : mv.movement_type === "loss" ? "-" : "";
    return `
            <div class="movement-item" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-light)">
              <div style="font-size:1.5rem;flex-shrink:0">${cfg.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                  <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(mv.ingredient_name)}</span>
                  <span class="data-value" style="font-weight:600;color:${cfg.color}">${sign}${mv.quantity} ${mv.unit}</span>
                </div>
                <div style="display:flex;gap:var(--space-3);font-size:var(--text-xs);color:var(--text-tertiary);flex-wrap:wrap">
                  <span>${cfg.label}</span>
                  <span>${time}</span>
                  ${mv.supplier_name ? `<span>Fourn: ${escapeHtml(mv.supplier_name)}</span>` : ""}
                  ${mv.batch_number ? `<span>Lot: ${mv.batch_number}</span>` : ""}
                  ${mv.unit_price != null ? `<span>${mv.unit_price.toFixed(2)}\u20AC/u</span>` : ""}
                  ${mv.recorded_by_name ? `<span>Par: ${escapeHtml(mv.recorded_by_name)}</span>` : ""}
                </div>
                ${mv.reason ? `<div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px;font-style:italic">${escapeHtml(mv.reason)}</div>` : ""}
              </div>
            </div>
          `;
  }).join("")}
      </div>
    </div>
  `).join("");
}
async function renderStockVariance() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <a href="#/stock" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-2);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour stock
      </a>
      <h1>Analyse des \xE9carts</h1>
      <p class="text-secondary">Consommation th\xE9orique vs r\xE9elle</p>
    </div>
    <div class="variance-controls" style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="margin:0">
        <label class="form-label" style="font-size:var(--text-xs)">Du</label>
        <input type="date" id="var-from" class="input" style="width:160px">
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label" style="font-size:var(--text-xs)">Au</label>
        <input type="date" id="var-to" class="input" style="width:160px">
      </div>
      <button class="btn btn-primary" id="var-refresh">Analyser</button>
    </div>
    <div id="var-summary" style="margin-bottom:var(--space-5)"></div>
    <div id="var-content">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  const now = /* @__PURE__ */ new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  document.getElementById("var-from").value = weekAgo.toISOString().split("T")[0];
  document.getElementById("var-to").value = now.toISOString().split("T")[0];
  document.getElementById("var-refresh").addEventListener("click", loadVariance);
  await loadVariance();
}
async function loadVariance() {
  const from = document.getElementById("var-from").value;
  const to = document.getElementById("var-to").value;
  const summaryEl = document.getElementById("var-summary");
  const contentEl = document.getElementById("var-content");
  contentEl.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
  try {
    const data = await API.getVarianceAnalysis(from, to);
    const healthColor = data.total_variance_value > 0 ? "var(--color-danger)" : "var(--color-success)";
    const healthIcon = data.critical_count > 0 ? "!!" : data.warning_count > 0 ? "!" : "OK";
    summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-3)">
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:${healthColor}">
            ${data.total_variance_value > 0 ? "+" : ""}${formatCurrency(data.total_variance_value)}
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">\xC9cart total (valeur)</div>
        </div>
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700">${data.total_items}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Ingr\xE9dients analys\xE9s</div>
        </div>
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-danger)">${data.critical_count}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Critiques (>15%)</div>
        </div>
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-warning)">${data.warning_count}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Alertes (>5%)</div>
        </div>
      </div>
    `;
    if (data.items.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--space-8)">
          <div class="empty-icon" style="font-size:48px;margin-bottom:var(--space-3)">--</div>
          <h3>Aucun \xE9cart d\xE9tect\xE9</h3>
          <p style="color:var(--text-secondary)">Pas de mouvements ou de ventes sur cette p\xE9riode.</p>
        </div>
      `;
      return;
    }
    contentEl.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Ingr\xE9dient</th>
              <th class="numeric">Th\xE9orique</th>
              <th class="numeric">R\xE9el</th>
              <th class="numeric">\xC9cart</th>
              <th class="numeric">\xC9cart %</th>
              <th class="numeric">Valeur</th>
              <th class="numeric">Pertes</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item) => {
      const statusBadge = item.status === "critical" ? '<span class="badge badge--danger">Critique</span>' : item.status === "warning" ? '<span class="badge badge--warning">Alerte</span>' : '<span class="badge badge--success">OK</span>';
      const varColor = item.variance_qty > 0 ? "var(--color-danger)" : item.variance_qty < 0 ? "var(--color-success)" : "inherit";
      return `
                <tr>
                  <td style="font-weight:500">${escapeHtml(item.ingredient_name)}</td>
                  <td class="numeric mono">${formatQuantity(item.theoretical_qty, item.unit)}</td>
                  <td class="numeric mono">${formatQuantity(item.actual_qty, item.unit)}</td>
                  <td class="numeric mono" style="color:${varColor};font-weight:600">
                    ${item.variance_qty > 0 ? "+" : ""}${formatQuantity(item.variance_qty, item.unit)}
                  </td>
                  <td class="numeric mono" style="color:${varColor}">
                    ${item.variance_pct > 0 ? "+" : ""}${item.variance_pct.toFixed(1)}%
                  </td>
                  <td class="numeric mono" style="color:${varColor};font-weight:600">
                    ${item.variance_value > 0 ? "+" : ""}${formatCurrency(item.variance_value)}
                  </td>
                  <td class="numeric mono">${item.losses > 0 ? formatQuantity(item.losses, item.unit) : "--"}</td>
                  <td>${statusBadge}</td>
                </tr>
              `;
    }).join("")}
          </tbody>
        </table>
      </div>
      <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md);font-size:var(--text-sm);color:var(--text-tertiary)">
        <strong>Lecture :</strong> Un \xE9cart positif = surconsommation r\xE9elle par rapport au th\xE9orique (pertes, vol, surdosage).
        Un \xE9cart n\xE9gatif = consommation inf\xE9rieure au pr\xE9vu (sous-dosage ou stock non mis \xE0 jour).
      </div>
    `;
  } catch (e) {
    summaryEl.innerHTML = "";
    contentEl.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:var(--space-8)">
        <p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}
async function renderSuppliers() {
  const app = document.getElementById("app");
  const isGerant = getRole() === "gerant";
  app.innerHTML = `
    <div class="page-header">
      <h1>Fournisseurs</h1>
      <div style="display:flex;gap:var(--space-2)">
        <a href="#/orders" class="btn btn-secondary">
          <i data-lucide="clipboard-pen" style="width:18px;height:18px"></i> <span class="btn-label-desktop">Commandes</span>
        </a>
        ${isGerant ? `<button class="btn btn-secondary" onclick="location.hash='#/supplier-portal'" id="btn-portal">
          <i data-lucide="link" style="width:18px;height:18px"></i> <span class="btn-label-desktop">Portail</span>
          <span class="portal-badge" id="portal-badge" style="display:none"></span>
        </button>` : ""}
        <button class="btn btn-primary" onclick="showSupplierModal()"><i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter</button>
      </div>
    </div>
    <div id="supplier-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();
  let suppliers = [];
  try {
    suppliers = await API.getSuppliers();
  } catch (e) {
    showToast("Erreur", "error");
  }
  const listEl = document.getElementById("supplier-list");
  if (suppliers.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="truck"></i></div>
        <p>Aucun fournisseur enregistr\xE9</p>
        <button class="btn btn-primary" onclick="showSupplierModal()"><i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter un fournisseur</button>
      </div>`;
    lucide.createIcons();
    return;
  }
  if (isGerant) {
    API.getSupplierNotificationsUnread().then(({ count }) => {
      const badge = document.getElementById("portal-badge");
      if (badge && count > 0) {
        badge.textContent = count;
        badge.style.display = "inline-flex";
      }
    }).catch(() => {
    });
  }
  listEl.innerHTML = suppliers.map((s) => `
    <div class="card" onclick="showSupplierDetail(${s.id})">
      <div class="card-header">
        <span class="card-title">${escapeHtml(s.name)}</span>
        <span>${renderStars(s.quality_rating)}</span>
      </div>
      <div class="card-stats">
        ${s.phone ? `<div><span class="stat-value">${escapeHtml(s.phone)}</span><span class="stat-label">T\xE9l\xE9phone</span></div>` : ""}
        ${s.email ? `<div><span class="stat-value" style="font-size:var(--text-sm)">${escapeHtml(s.email)}</span><span class="stat-label">Email</span></div>` : ""}
        ${s.contact ? `<div><span class="stat-value">${escapeHtml(s.contact)}</span><span class="stat-label">Contact</span></div>` : ""}
      </div>
      ${s.quality_notes ? `<p style="font-size:var(--text-sm);color:var(--text-tertiary);margin-top:var(--space-2);font-style:italic">${escapeHtml(s.quality_notes)}</p>` : ""}
    </div>
  `).join("");
}
function showSupplierModal(supplier = null) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const isEdit = !!supplier;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-sup-name" value="${escapeHtml((supplier == null ? void 0 : supplier.name) || "")}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Contact</label>
          <input type="text" class="form-control" id="m-sup-contact" value="${escapeHtml((supplier == null ? void 0 : supplier.contact) || "")}">
        </div>
        <div class="form-group">
          <label>T\xE9l\xE9phone</label>
          <input type="tel" class="form-control" id="m-sup-phone" value="${escapeHtml((supplier == null ? void 0 : supplier.phone) || "")}">
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" class="form-control" id="m-sup-email" value="${escapeHtml((supplier == null ? void 0 : supplier.email) || "")}">
      </div>
      <div class="form-group">
        <label>Qualit\xE9 (1-5)</label>
        <div id="m-sup-stars" class="stars" style="font-size:1.8rem;cursor:pointer">
          ${[1, 2, 3, 4, 5].map((i) => `<span class="star" data-value="${i}">${i <= ((supplier == null ? void 0 : supplier.quality_rating) || 3) ? "\u2605" : "\u2606"}</span>`).join("")}
        </div>
        <input type="hidden" id="m-sup-rating" value="${(supplier == null ? void 0 : supplier.quality_rating) || 3}">
      </div>
      <div class="form-group">
        <label>Notes qualit\xE9</label>
        <textarea class="form-control" id="m-sup-notes" rows="2">${escapeHtml((supplier == null ? void 0 : supplier.quality_notes) || "")}</textarea>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-sup-save">
          <i data-lucide="${isEdit ? "save" : "plus"}" style="width:18px;height:18px"></i>
          ${isEdit ? "Enregistrer" : "Cr\xE9er"}
        </button>
        <button class="btn btn-secondary" id="m-sup-cancel">Annuler</button>
        ${isEdit ? '<button class="btn btn-danger" id="m-sup-delete"><i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer</button>' : ""}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  const starsEl = overlay.querySelector("#m-sup-stars");
  const ratingInput = overlay.querySelector("#m-sup-rating");
  starsEl.querySelectorAll(".star").forEach((star) => {
    star.addEventListener("click", () => {
      const val = parseInt(star.dataset.value);
      ratingInput.value = val;
      starsEl.querySelectorAll(".star").forEach((s, i) => {
        s.textContent = i < val ? "\u2605" : "\u2606";
      });
    });
  });
  overlay.querySelector("#m-sup-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#m-sup-save").onclick = async () => {
    const data = {
      name: document.getElementById("m-sup-name").value.trim(),
      contact: document.getElementById("m-sup-contact").value.trim() || null,
      phone: document.getElementById("m-sup-phone").value.trim() || null,
      email: document.getElementById("m-sup-email").value.trim() || null,
      quality_rating: parseInt(document.getElementById("m-sup-rating").value) || 3,
      quality_notes: document.getElementById("m-sup-notes").value.trim() || null
    };
    if (!data.name) {
      showToast("Nom requis", "error");
      return;
    }
    try {
      if (isEdit) {
        await API.updateSupplier(supplier.id, data);
        showToast("Fournisseur mis \xE0 jour", "success");
      } else {
        await API.createSupplier(data);
        showToast("Fournisseur cr\xE9\xE9", "success");
      }
      overlay.remove();
      renderSuppliers();
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  if (isEdit) {
    overlay.querySelector("#m-sup-delete").onclick = () => {
      showConfirmModal("Supprimer ce fournisseur ?", "Cette action est irr\xE9versible.", async () => {
        try {
          await API.deleteSupplier(supplier.id);
          showToast("Fournisseur supprim\xE9", "success");
          overlay.remove();
          renderSuppliers();
        } catch (e) {
          showToast(e.message, "error");
        }
      });
    };
  }
}
async function showSupplierDetail(id) {
  let suppliers;
  try {
    suppliers = await API.getSuppliers();
  } catch (e) {
    return;
  }
  const sup = suppliers.find((s) => s.id === id);
  if (!sup) return;
  showSupplierModal(sup);
}
const HACCP_SUBNAV_FULL = `
  <div class="haccp-subnav">
    <a href="#/haccp" class="haccp-subnav__link" id="haccp-nav-dashboard">Dashboard</a>
    <a href="#/haccp/temperatures" class="haccp-subnav__link">Temp\xE9ratures</a>
    <a href="#/haccp/cleaning" class="haccp-subnav__link">Nettoyage</a>
    <a href="#/haccp/traceability" class="haccp-subnav__link">Tra\xE7abilit\xE9</a>
    <a href="#/haccp/cooling" class="haccp-subnav__link">Refroidissement</a>
    <a href="#/haccp/reheating" class="haccp-subnav__link">Remise en T\xB0</a>
    <a href="#/haccp/fryers" class="haccp-subnav__link">Friteuses</a>
    <a href="#/haccp/non-conformities" class="haccp-subnav__link">Non-conf.</a>
    <a href="#/haccp/allergens" class="haccp-subnav__link">Allerg\xE8nes</a>
  </div>
`;
async function renderHACCPDashboard() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [tempData, cleaningData, receptions, dlcAlerts] = await Promise.all([
      API.getTemperaturesToday(),
      API.getCleaningToday(),
      API.getTraceability(),
      API.getDLCAlerts()
    ]);
    const account = getAccount();
    const isGerant = account && account.role === "gerant";
    const lastReceptions = receptions.slice(0, 5);
    app.innerHTML = `
      <div class="haccp-dashboard">
        <div class="page-header">
          <h1><i data-lucide="shield-check" style="width:28px;height:28px;vertical-align:middle;color:var(--color-accent)"></i> HACCP</h1>
        </div>

        <!-- HACCP Sub-navigation -->
        ${HACCP_SUBNAV_FULL.replace('id="haccp-nav-dashboard"', 'id="haccp-nav-dashboard" style="font-weight:700"')}

        <!-- SECTION: Temp\xE9ratures du jour -->
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>\u{1F321}\uFE0F Temp\xE9ratures du jour</span>
          <a href="#/haccp/temperatures" class="btn btn-ghost btn-sm">Historique \u2192</a>
        </div>

        <div class="haccp-temp-grid">
          ${tempData.map((zone) => {
      const statusClass = zone.status === "alert" ? "haccp-zone--alert" : zone.status === "missing" ? "haccp-zone--missing" : zone.needs_recording ? "haccp-zone--warning" : "haccp-zone--ok";
      const lastTemp = zone.last_log ? zone.last_log.temperature.toFixed(1) : "\u2014";
      const lastTime = zone.last_log ? new Date(zone.last_log.recorded_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Aucun relev\xE9";
      const typeIcons = { fridge: "\u2744\uFE0F", freezer: "\u{1F9CA}", cold_room: "\u{1F3D4}\uFE0F" };
      return `
              <div class="haccp-zone-card ${statusClass}">
                <div class="haccp-zone-card__header">
                  <span class="haccp-zone-card__icon">${typeIcons[zone.type] || "\u{1F321}\uFE0F"}</span>
                  <span class="haccp-zone-card__name">${escapeHtml(zone.name)}</span>
                  <span class="haccp-zone-card__status">
                    ${zone.status === "alert" ? "\u26A0\uFE0F ALERTE" : zone.status === "missing" ? "\u23F0 Manquant" : zone.needs_recording ? "\u23F0 >4h" : "\u2705 OK"}
                  </span>
                </div>
                <div class="haccp-zone-card__temp">
                  <span class="haccp-zone-card__value">${lastTemp}\xB0C</span>
                  <span class="haccp-zone-card__range">${zone.min_temp}\xB0 / ${zone.max_temp}\xB0</span>
                </div>
                <div class="haccp-zone-card__time">${lastTime}</div>
                <button class="btn btn-primary haccp-record-btn" data-zone-id="${zone.id}" data-zone-name="${escapeHtml(zone.name)}" data-min="${zone.min_temp}" data-max="${zone.max_temp}">
                  <i data-lucide="thermometer" style="width:18px;height:18px"></i> Relever
                </button>
              </div>
            `;
    }).join("")}
        </div>

        <!-- SECTION: Nettoyage du jour -->
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>\u{1F9F9} Nettoyage du jour \u2014 ${cleaningData.done}/${cleaningData.total} effectu\xE9es</span>
          <a href="#/haccp/cleaning" class="btn btn-ghost btn-sm">G\xE9rer \u2192</a>
        </div>

        <div class="haccp-cleaning-progress">
          <div class="haccp-cleaning-progress__bar">
            <div class="haccp-cleaning-progress__fill" style="width:${cleaningData.total > 0 ? cleaningData.done / cleaningData.total * 100 : 0}%"></div>
          </div>
        </div>

        <div class="haccp-cleaning-list">
          ${cleaningData.tasks.map((task) => `
            <div class="haccp-cleaning-item ${task.done_today ? "haccp-cleaning-item--done" : ""}">
              <button class="haccp-cleaning-check ${task.done_today ? "checked" : ""}" 
                      data-task-id="${task.id}" ${task.done_today ? "disabled" : ""}>
                ${task.done_today ? "\u2713" : ""}
              </button>
              <div class="haccp-cleaning-item__info">
                <span class="haccp-cleaning-item__name">${escapeHtml(task.name)}</span>
                <span class="haccp-cleaning-item__zone">${escapeHtml(task.zone)} \xB7 ${task.frequency === "daily" ? "Quotidien" : task.frequency === "weekly" ? "Hebdo" : "Mensuel"}</span>
              </div>
              ${task.done_today ? `<span class="haccp-cleaning-item__done-by">${escapeHtml(task.done_by || "")} ${new Date(task.done_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}
            </div>
          `).join("")}
          ${cleaningData.tasks.length === 0 ? `<p class="text-secondary" style="padding:var(--space-4)">Aucune t\xE2che pr\xE9vue aujourd'hui</p>` : ""}
        </div>

        <!-- SECTION: Derni\xE8res r\xE9ceptions -->
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>\u{1F4E6} Derni\xE8res r\xE9ceptions</span>
          <a href="#/haccp/traceability" class="btn btn-ghost btn-sm">Voir tout \u2192</a>
        </div>

        <div class="haccp-receptions-list">
          ${lastReceptions.map((rec) => {
      const dlcDays = rec.dlc ? Math.ceil((new Date(rec.dlc) - /* @__PURE__ */ new Date()) / (1e3 * 60 * 60 * 24)) : null;
      const dlcClass = dlcDays !== null && dlcDays <= 3 ? "haccp-dlc--warning" : "";
      const dlcExpired = dlcDays !== null && dlcDays < 0;
      return `
              <div class="haccp-reception-card">
                <div class="haccp-reception-card__main">
                  <span class="haccp-reception-card__product">${escapeHtml(rec.product_name)}</span>
                  <span class="haccp-reception-card__supplier">${escapeHtml(rec.supplier || "\u2014")}</span>
                </div>
                <div class="haccp-reception-card__meta">
                  ${rec.dlc ? `<span class="badge ${dlcExpired ? "badge--danger" : dlcClass ? "badge--warning" : "badge--success"}">${dlcExpired ? "DLC d\xE9pass\xE9e" : dlcDays <= 3 ? `DLC J-${dlcDays}` : `DLC ${new Date(rec.dlc).toLocaleDateString("fr-FR")}`}</span>` : ""}
                  <span class="text-secondary text-sm">${new Date(rec.received_at).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            `;
    }).join("")}
          ${lastReceptions.length === 0 ? '<p class="text-secondary" style="padding:var(--space-4)">Aucune r\xE9ception enregistr\xE9e</p>' : ""}
        </div>

        ${dlcAlerts.length > 0 ? `
        <div class="haccp-dlc-alert-banner">
          <i data-lucide="alert-triangle" style="width:20px;height:20px"></i>
          <span><strong>${dlcAlerts.length} produit(s)</strong> proche(s) de la DLC ou d\xE9pass\xE9(s)</span>
        </div>
        ` : ""}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupDashboardEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur de chargement HACCP : ${escapeHtml(err.message)}</p></div>`;
  }
}
function setupDashboardEvents() {
  document.querySelectorAll(".haccp-record-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      showTemperatureModal(
        Number(btn.dataset.zoneId),
        btn.dataset.zoneName,
        Number(btn.dataset.min),
        Number(btn.dataset.max)
      );
    });
  });
  document.querySelectorAll(".haccp-cleaning-check:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = Number(btn.dataset.taskId);
      const account = getAccount();
      try {
        await API.markCleaningDone(taskId, { completed_by: account ? account.id : null });
        showToast("T\xE2che valid\xE9e \u2713", "success");
        renderHACCPDashboard();
      } catch (err) {
        showToast("Erreur : " + err.message, "error");
      }
    });
  });
}
function showTemperatureModal(zoneId, zoneName, minTemp, maxTemp) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>\u{1F321}\uFE0F Relev\xE9 \u2014 ${escapeHtml(zoneName)}</h2>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-4)">Plage normale : ${minTemp}\xB0C \xE0 ${maxTemp}\xB0C</p>
      <div class="form-group">
        <label>Temp\xE9rature (\xB0C)</label>
        <input type="number" step="0.1" class="form-control haccp-temp-input" id="modal-temp" 
               placeholder="ex: 3.5" inputmode="decimal" autofocus
               style="font-size:var(--text-2xl);text-align:center;font-family:var(--font-mono)">
      </div>
      <div class="form-group">
        <label>Notes (optionnel)</label>
        <input type="text" class="form-control" id="modal-notes" placeholder="ex: porte rest\xE9e ouverte">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="modal-cancel">Annuler</button>
        <button class="btn btn-primary" id="modal-save" style="min-width:140px">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  const tempInput = document.getElementById("modal-temp");
  tempInput.focus();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("modal-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("modal-save").addEventListener("click", async () => {
    const temperature = parseFloat(tempInput.value);
    if (isNaN(temperature)) {
      tempInput.classList.add("form-control--error");
      return;
    }
    const notes = document.getElementById("modal-notes").value.trim();
    try {
      await API.recordTemperature({
        zone_id: zoneId,
        temperature,
        notes: notes || null,
        recorded_by: account ? account.id : null
      });
      overlay.remove();
      const isAlert = temperature < minTemp || temperature > maxTemp;
      showToast(isAlert ? `\u26A0\uFE0F ALERTE : ${temperature}\xB0C hors norme !` : `\u2705 ${temperature}\xB0C enregistr\xE9`, isAlert ? "error" : "success");
      renderHACCPDashboard();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
  tempInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("modal-save").click();
  });
}
async function renderHACCPTemperatures() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [zones, logs] = await Promise.all([
      API.getHACCPZones(),
      API.getTemperatures({})
    ]);
    const account = getAccount();
    const isGerant = account && account.role === "gerant";
    app.innerHTML = `
      <div class="haccp-page">
        <nav aria-label="Breadcrumb" class="breadcrumb">
          <a href="#/haccp">HACCP</a>
          <span class="breadcrumb-sep">\u203A</span>
          <span class="breadcrumb-current">Temp\xE9ratures</span>
        </nav>
        <div class="page-header">
          <h1>\u{1F321}\uFE0F Temp\xE9ratures</h1>
          <button class="btn btn-primary" id="btn-new-temp">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau relev\xE9
          </button>
        </div>

        ${HACCP_SUBNAV_FULL}

        <!-- Filters -->
        <div class="haccp-filters">
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <select class="form-control" id="filter-zone" style="min-height:40px">
              <option value="">Toutes les zones</option>
              ${zones.map((z) => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join("")}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <input type="date" class="form-control" id="filter-date" lang="fr" style="min-height:40px">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-filter">Filtrer</button>
        </div>

        <!-- Zone management (g\xE9rant only) -->
        ${isGerant ? `
        <details class="haccp-zones-manager">
          <summary class="btn btn-ghost btn-sm">\u2699\uFE0F G\xE9rer les zones</summary>
          <div class="haccp-zones-list" style="margin-top:var(--space-3)">
            ${zones.map((z) => `
              <div class="haccp-zone-manage-row">
                <span>${escapeHtml(z.name)} (${z.min_temp}\xB0 / ${z.max_temp}\xB0)</span>
                <div class="gap-8" style="display:flex">
                  <button class="btn btn-ghost btn-sm btn-edit-zone" data-id="${z.id}" data-name="${escapeHtml(z.name)}" data-type="${z.type}" data-min="${z.min_temp}" data-max="${z.max_temp}">\u270F\uFE0F</button>
                  <button class="btn btn-ghost btn-sm btn-delete-zone" aria-label="Supprimer la zone" data-id="${z.id}" data-name="${escapeHtml(z.name)}">\u{1F5D1}\uFE0F</button>
                </div>
              </div>
            `).join("")}
            <button class="btn btn-secondary btn-sm" id="btn-add-zone" style="margin-top:var(--space-2)">
              <i data-lucide="plus" style="width:16px;height:16px"></i> Ajouter une zone
            </button>
          </div>
        </details>
        ` : ""}

        <!-- Export -->
        <div class="haccp-export-bar">
          <label class="text-secondary text-sm">Export PDF :</label>
          <input type="date" class="form-control" id="export-from" lang="fr" style="min-height:36px;width:auto">
          <span class="text-secondary">\u2192</span>
          <input type="date" class="form-control" id="export-to" lang="fr" style="min-height:36px;width:auto">
          <button class="btn btn-secondary btn-sm" id="btn-export-temp">\u{1F4C4} Exporter</button>
        </div>

        <!-- Table -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date / Heure</th>
                <th>Zone</th>
                <th>Temp \xB0C</th>
                <th>Plage</th>
                <th>Statut</th>
                <th>Relev\xE9 par</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody id="temp-table-body">
              ${renderTempRows(logs)}
            </tbody>
          </table>
        </div>
        ${logs.length === 0 ? '<div class="empty-state"><p>Aucun relev\xE9 enregistr\xE9</p></div>' : ""}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupTemperatureEvents(zones);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
function renderTempRows(logs) {
  return logs.map((log) => {
    const date = new Date(log.recorded_at);
    const isAlert = log.is_alert;
    return `
      <tr class="${isAlert ? "haccp-row-alert" : ""}">
        <td>${date.toLocaleDateString("fr-FR")} ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
        <td>${escapeHtml(log.zone_name)}</td>
        <td class="mono" style="font-weight:600;color:${isAlert ? "var(--color-danger)" : "var(--color-success)"}">${log.temperature.toFixed(1)}\xB0C</td>
        <td class="mono text-secondary">${log.min_temp}\xB0 / ${log.max_temp}\xB0</td>
        <td>${isAlert ? '<span class="badge badge--danger">\u26A0 ALERTE</span>' : '<span class="badge badge--success">\u2713 OK</span>'}</td>
        <td>${escapeHtml(log.recorded_by_name || "\u2014")}</td>
        <td class="text-secondary">${escapeHtml(log.notes || "")}</td>
      </tr>
    `;
  }).join("");
}
function setupTemperatureEvents(zones) {
  var _a, _b, _c, _d;
  (_a = document.getElementById("btn-new-temp")) == null ? void 0 : _a.addEventListener("click", () => {
    showNewTempModal(zones);
  });
  (_b = document.getElementById("btn-filter")) == null ? void 0 : _b.addEventListener("click", async () => {
    const zone_id = document.getElementById("filter-zone").value;
    const date = document.getElementById("filter-date").value;
    const params = {};
    if (zone_id) params.zone_id = zone_id;
    if (date) params.date = date;
    const logs = await API.getTemperatures(params);
    document.getElementById("temp-table-body").innerHTML = renderTempRows(logs);
  });
  (_c = document.getElementById("btn-export-temp")) == null ? void 0 : _c.addEventListener("click", async () => {
    const from = document.getElementById("export-from").value;
    const to = document.getElementById("export-to").value;
    try {
      const url = await API.getHACCPExportUrl("temperatures", from, to);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haccp-temperatures-${from || "all"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF export\xE9 \u2713", "success");
    } catch (err) {
      showToast("Erreur export : " + err.message, "error");
    }
  });
  document.querySelectorAll(".btn-edit-zone").forEach((btn) => {
    btn.addEventListener("click", () => showZoneModal(btn.dataset));
  });
  document.querySelectorAll(".btn-delete-zone").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const zoneName = btn.dataset.name;
      showConfirmModal("Supprimer la zone", `\xCAtes-vous s\xFBr de vouloir supprimer la zone "${zoneName}" et tous ses relev\xE9s ?`, async () => {
        try {
          await API.deleteHACCPZone(Number(btn.dataset.id));
          showToast("Zone supprim\xE9e", "success");
          renderHACCPTemperatures();
        } catch (err) {
          showToast("Erreur : " + err.message, "error");
        }
      }, { confirmText: "Supprimer", confirmClass: "btn btn-danger" });
      return;
    });
  });
  (_d = document.getElementById("btn-add-zone")) == null ? void 0 : _d.addEventListener("click", () => showZoneModal(null));
}
function showNewTempModal(zones) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>\u{1F321}\uFE0F Nouveau relev\xE9</h2>
      <div class="form-group">
        <label>Zone</label>
        <select class="form-control" id="modal-zone">
          ${zones.map((z) => `<option value="${z.id}" data-min="${z.min_temp}" data-max="${z.max_temp}">${escapeHtml(z.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Temp\xE9rature (\xB0C)</label>
        <input type="number" step="0.1" class="form-control" id="modal-temp" placeholder="ex: 3.5" inputmode="decimal"
               style="font-size:var(--text-2xl);text-align:center;font-family:var(--font-mono)">
      </div>
      <div class="form-group">
        <label>Notes (optionnel)</label>
        <input type="text" class="form-control" id="modal-notes" placeholder="ex: porte rest\xE9e ouverte">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="modal-cancel">Annuler</button>
        <button class="btn btn-primary" id="modal-save" style="min-width:140px">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("modal-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("modal-save").addEventListener("click", async () => {
    const zoneId = Number(document.getElementById("modal-zone").value);
    const temperature = parseFloat(document.getElementById("modal-temp").value);
    if (isNaN(temperature)) {
      document.getElementById("modal-temp").classList.add("form-control--error");
      return;
    }
    const notes = document.getElementById("modal-notes").value.trim();
    try {
      await API.recordTemperature({
        zone_id: zoneId,
        temperature,
        notes: notes || null,
        recorded_by: account ? account.id : null
      });
      overlay.remove();
      showToast("Relev\xE9 enregistr\xE9 \u2713", "success");
      renderHACCPTemperatures();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
function showZoneModal(data) {
  const isEdit = !!data && data.id;
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? "\u270F\uFE0F Modifier la zone" : "\u2795 Nouvelle zone"}</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="zone-name" value="${isEdit ? escapeHtml(data.name) : ""}" placeholder="ex: Frigo 3">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select class="form-control" id="zone-type">
          <option value="fridge" ${isEdit && data.type === "fridge" ? "selected" : ""}>Frigo</option>
          <option value="freezer" ${isEdit && data.type === "freezer" ? "selected" : ""}>Cong\xE9lateur</option>
          <option value="cold_room" ${isEdit && data.type === "cold_room" ? "selected" : ""}>Chambre froide</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Temp min (\xB0C)</label>
          <input type="number" step="0.5" class="form-control" id="zone-min" value="${isEdit ? data.min : "0"}">
        </div>
        <div class="form-group">
          <label>Temp max (\xB0C)</label>
          <input type="number" step="0.5" class="form-control" id="zone-max" value="${isEdit ? data.max : "4"}">
        </div>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="zone-cancel">Annuler</button>
        <button class="btn btn-primary" id="zone-save">${isEdit ? "Modifier" : "Cr\xE9er"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("zone-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("zone-save").addEventListener("click", async () => {
    const payload = {
      name: document.getElementById("zone-name").value.trim(),
      type: document.getElementById("zone-type").value,
      min_temp: parseFloat(document.getElementById("zone-min").value),
      max_temp: parseFloat(document.getElementById("zone-max").value)
    };
    if (!payload.name) {
      showToast("Le nom est requis", "error");
      return;
    }
    try {
      if (isEdit) {
        await API.updateHACCPZone(Number(data.id), payload);
      } else {
        await API.createHACCPZone(payload);
      }
      overlay.remove();
      showToast(isEdit ? "Zone modifi\xE9e \u2713" : "Zone cr\xE9\xE9e \u2713", "success");
      renderHACCPTemperatures();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
async function renderHACCPCleaning() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [tasks, todayData] = await Promise.all([
      API.getCleaningTasks(),
      API.getCleaningToday()
    ]);
    const account = getAccount();
    const isGerant = account && account.role === "gerant";
    const freqLabels = { daily: "Quotidien", weekly: "Hebdomadaire", monthly: "Mensuel" };
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>\u{1F9F9} Plan de nettoyage</h1>
          ${isGerant ? `
          <button class="btn btn-primary" id="btn-add-task">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter
          </button>
          ` : ""}
        </div>

        ${HACCP_SUBNAV_FULL}

        <!-- Today's status -->
        <div class="haccp-cleaning-today-box">
          <h3>Aujourd'hui \u2014 ${todayData.done}/${todayData.total} effectu\xE9es</h3>
          <div class="haccp-cleaning-progress">
            <div class="haccp-cleaning-progress__bar">
              <div class="haccp-cleaning-progress__fill" style="width:${todayData.total > 0 ? todayData.done / todayData.total * 100 : 0}%"></div>
            </div>
          </div>
          <div class="haccp-cleaning-list" style="margin-top:var(--space-3)">
            ${todayData.tasks.map((task) => `
              <div class="haccp-cleaning-item ${task.done_today ? "haccp-cleaning-item--done" : ""}">
                <button class="haccp-cleaning-check ${task.done_today ? "checked" : ""}" 
                        data-task-id="${task.id}" ${task.done_today ? "disabled" : ""}>
                  ${task.done_today ? "\u2713" : ""}
                </button>
                <div class="haccp-cleaning-item__info">
                  <span class="haccp-cleaning-item__name">${escapeHtml(task.name)}</span>
                  <span class="haccp-cleaning-item__zone">${escapeHtml(task.zone)} \xB7 ${task.product ? escapeHtml(task.product) : ""}</span>
                </div>
                ${task.done_today ? `<span class="haccp-cleaning-item__done-by">${escapeHtml(task.done_by || "")} ${new Date(task.done_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Export -->
        <div class="haccp-export-bar">
          <label class="text-secondary text-sm">Export PDF :</label>
          <input type="date" class="form-control" id="export-from" lang="fr" style="min-height:36px;width:auto">
          <span class="text-secondary">\u2192</span>
          <input type="date" class="form-control" id="export-to" lang="fr" style="min-height:36px;width:auto">
          <button class="btn btn-secondary btn-sm" id="btn-export-cleaning">\u{1F4C4} Exporter</button>
        </div>

        <!-- All tasks -->
        <div class="section-title">Toutes les t\xE2ches</div>
        <div class="haccp-tasks-grid">
          ${tasks.map((task) => `
            <div class="card" style="cursor:default;border-left-color:${task.frequency === "daily" ? "var(--color-accent)" : task.frequency === "weekly" ? "var(--color-info)" : "var(--color-warning)"}">
              <div class="card-header">
                <span class="card-title">${escapeHtml(task.name)}</span>
                <span class="card-category">${freqLabels[task.frequency] || task.frequency}</span>
              </div>
              <p class="text-secondary text-sm">\u{1F4CD} ${escapeHtml(task.zone)}</p>
              ${task.product ? `<p class="text-secondary text-sm">\u{1F9F4} ${escapeHtml(task.product)}</p>` : ""}
              ${task.method ? `<p class="text-secondary text-sm" style="font-style:italic">\u{1F4CB} ${escapeHtml(task.method)}</p>` : ""}
              ${isGerant ? `
              <div class="actions-row" style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-light)">
                <button class="btn btn-ghost btn-sm btn-edit-task" data-id="${task.id}">\u270F\uFE0F Modifier</button>
                <button class="btn btn-ghost btn-sm btn-delete-task" data-id="${task.id}" data-name="${escapeHtml(task.name)}">\u{1F5D1}\uFE0F Supprimer</button>
              </div>
              ` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupCleaningEvents(tasks);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
function setupCleaningEvents(tasks) {
  var _a, _b;
  document.querySelectorAll(".haccp-cleaning-check:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = Number(btn.dataset.taskId);
      const account = getAccount();
      try {
        await API.markCleaningDone(taskId, { completed_by: account ? account.id : null });
        showToast("T\xE2che valid\xE9e \u2713", "success");
        renderHACCPCleaning();
      } catch (err) {
        showToast("Erreur : " + err.message, "error");
      }
    });
  });
  (_a = document.getElementById("btn-add-task")) == null ? void 0 : _a.addEventListener("click", () => showCleaningTaskModal(null));
  document.querySelectorAll(".btn-edit-task").forEach((btn) => {
    btn.addEventListener("click", () => {
      const task = tasks.find((t) => t.id === Number(btn.dataset.id));
      if (task) showCleaningTaskModal(task);
    });
  });
  document.querySelectorAll(".btn-delete-task").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskName = btn.dataset.name;
      showConfirmModal("Supprimer la t\xE2che", `\xCAtes-vous s\xFBr de vouloir supprimer la t\xE2che "${taskName}" ?`, async () => {
        try {
          await API.deleteCleaningTask(Number(btn.dataset.id));
          showToast("T\xE2che supprim\xE9e", "success");
          renderHACCPCleaning();
        } catch (err) {
          showToast("Erreur : " + err.message, "error");
        }
      }, { confirmText: "Supprimer", confirmClass: "btn btn-danger" });
      return;
    });
  });
  (_b = document.getElementById("btn-export-cleaning")) == null ? void 0 : _b.addEventListener("click", async () => {
    const from = document.getElementById("export-from").value;
    const to = document.getElementById("export-to").value;
    try {
      const url = await API.getHACCPExportUrl("cleaning", from, to);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haccp-nettoyage-${from || "all"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF export\xE9 \u2713", "success");
    } catch (err) {
      showToast("Erreur export : " + err.message, "error");
    }
  });
}
function showCleaningTaskModal(task) {
  const isEdit = !!task;
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? "\u270F\uFE0F Modifier la t\xE2che" : "\u2795 Nouvelle t\xE2che"}</h2>
      <div class="form-group">
        <label>Nom de la t\xE2che</label>
        <input type="text" class="form-control" id="task-name" value="${isEdit ? escapeHtml(task.name) : ""}" placeholder="ex: Nettoyage plan de travail">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Zone</label>
          <input type="text" class="form-control" id="task-zone" value="${isEdit ? escapeHtml(task.zone) : ""}" placeholder="ex: Cuisine">
        </div>
        <div class="form-group">
          <label>Fr\xE9quence</label>
          <select class="form-control" id="task-frequency">
            <option value="daily" ${isEdit && task.frequency === "daily" ? "selected" : ""}>Quotidien</option>
            <option value="weekly" ${isEdit && task.frequency === "weekly" ? "selected" : ""}>Hebdomadaire</option>
            <option value="monthly" ${isEdit && task.frequency === "monthly" ? "selected" : ""}>Mensuel</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Produit</label>
        <input type="text" class="form-control" id="task-product" value="${isEdit && task.product ? escapeHtml(task.product) : ""}" placeholder="ex: D\xE9graissant + d\xE9sinfectant">
      </div>
      <div class="form-group">
        <label>M\xE9thode</label>
        <textarea class="form-control" id="task-method" rows="2" placeholder="ex: Nettoyer, rincer, d\xE9sinfecter">${isEdit && task.method ? escapeHtml(task.method) : ""}</textarea>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="task-cancel">Annuler</button>
        <button class="btn btn-primary" id="task-save">${isEdit ? "Modifier" : "Cr\xE9er"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("task-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("task-save").addEventListener("click", async () => {
    const payload = {
      name: document.getElementById("task-name").value.trim(),
      zone: document.getElementById("task-zone").value.trim(),
      frequency: document.getElementById("task-frequency").value,
      product: document.getElementById("task-product").value.trim() || null,
      method: document.getElementById("task-method").value.trim() || null
    };
    if (!payload.name || !payload.zone) {
      showToast("Le nom et la zone sont requis", "error");
      return;
    }
    try {
      if (isEdit) {
        await API.updateCleaningTask(task.id, payload);
      } else {
        await API.createCleaningTask(payload);
      }
      overlay.remove();
      showToast(isEdit ? "T\xE2che modifi\xE9e \u2713" : "T\xE2che cr\xE9\xE9e \u2713", "success");
      renderHACCPCleaning();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
async function renderHACCPTraceability() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [logs, dlcAlerts] = await Promise.all([
      API.getTraceability(),
      API.getDLCAlerts()
    ]);
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>\u{1F4E6} Tra\xE7abilit\xE9</h1>
          <button class="btn btn-primary" id="btn-new-reception">
            <i data-lucide="plus" style="width:18px;height:18px"></i> R\xE9ception
          </button>
        </div>

        ${HACCP_SUBNAV_FULL}

        ${dlcAlerts.length > 0 ? `
        <div class="haccp-dlc-alert-banner">
          <i data-lucide="alert-triangle" style="width:20px;height:20px"></i>
          <div>
            <strong>${dlcAlerts.length} produit(s) proche(s) de la DLC</strong>
            <div class="haccp-dlc-alert-list">
              ${dlcAlerts.map((a) => {
      const days = Math.ceil(a.days_until_dlc);
      return `<span class="haccp-dlc-alert-item">${escapeHtml(a.product_name)} \u2014 ${days < 0 ? "DLC d\xE9pass\xE9e" : `J-${days}`}</span>`;
    }).join("")}
            </div>
          </div>
        </div>
        ` : ""}

        <!-- Filters -->
        <div class="haccp-filters">
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <input type="date" class="form-control" id="filter-date" lang="fr" style="min-height:40px" placeholder="Date">
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <input type="text" class="form-control" id="filter-supplier" style="min-height:40px" placeholder="Fournisseur">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-filter">Filtrer</button>
        </div>

        <!-- Export -->
        <div class="haccp-export-bar">
          <label class="text-secondary text-sm">Export PDF :</label>
          <input type="date" class="form-control" id="export-from" lang="fr" style="min-height:36px;width:auto">
          <span class="text-secondary">\u2192</span>
          <input type="date" class="form-control" id="export-to" lang="fr" style="min-height:36px;width:auto">
          <button class="btn btn-secondary btn-sm" id="btn-export-trace">\u{1F4C4} Exporter</button>
        </div>

        <!-- Table -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Produit</th>
                <th>Fournisseur</th>
                <th>N\xB0 Lot</th>
                <th>DLC</th>
                <th>T\xB0 R\xE9c.</th>
                <th>Quantit\xE9</th>
                <th>Re\xE7u par</th>
              </tr>
            </thead>
            <tbody id="trace-table-body">
              ${renderTraceRows(logs)}
            </tbody>
          </table>
        </div>
        ${logs.length === 0 ? '<div class="empty-state"><p>Aucune r\xE9ception enregistr\xE9e</p></div>' : ""}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupTraceEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
function renderTraceRows(logs) {
  return logs.map((log) => {
    const date = new Date(log.received_at);
    const dlcDays = log.dlc ? Math.ceil((new Date(log.dlc) - /* @__PURE__ */ new Date()) / (1e3 * 60 * 60 * 24)) : null;
    const dlcClass = dlcDays !== null && dlcDays <= 3 ? dlcDays < 0 ? "text-danger" : "text-warning" : "";
    return `
      <tr>
        <td>${date.toLocaleDateString("fr-FR")}</td>
        <td style="font-weight:500">${escapeHtml(log.product_name)}</td>
        <td>${escapeHtml(log.supplier || "\u2014")}</td>
        <td class="mono">${escapeHtml(log.batch_number || "\u2014")}</td>
        <td class="${dlcClass}" style="font-weight:${dlcDays !== null && dlcDays <= 3 ? "600" : "400"}">
          ${log.dlc ? new Date(log.dlc).toLocaleDateString("fr-FR") : "\u2014"}
          ${dlcDays !== null && dlcDays <= 3 && dlcDays >= 0 ? ` <span class="badge badge--warning">J-${dlcDays}</span>` : ""}
          ${dlcDays !== null && dlcDays < 0 ? ' <span class="badge badge--danger">D\xE9pass\xE9e</span>' : ""}
        </td>
        <td class="mono">${log.temperature_at_reception != null ? log.temperature_at_reception + "\xB0C" : "\u2014"}</td>
        <td class="mono">${log.quantity != null ? `${log.quantity} ${log.unit || ""}` : "\u2014"}</td>
        <td>${escapeHtml(log.received_by_name || "\u2014")}</td>
      </tr>
    `;
  }).join("");
}
function setupTraceEvents() {
  var _a, _b, _c;
  (_a = document.getElementById("btn-new-reception")) == null ? void 0 : _a.addEventListener("click", () => showReceptionModal());
  (_b = document.getElementById("btn-filter")) == null ? void 0 : _b.addEventListener("click", async () => {
    const date = document.getElementById("filter-date").value;
    const supplier = document.getElementById("filter-supplier").value.trim();
    const params = {};
    if (date) params.date = date;
    if (supplier) params.supplier = supplier;
    const logs = await API.getTraceability(Object.keys(params).length ? params : null);
    document.getElementById("trace-table-body").innerHTML = renderTraceRows(logs);
  });
  (_c = document.getElementById("btn-export-trace")) == null ? void 0 : _c.addEventListener("click", async () => {
    const from = document.getElementById("export-from").value;
    const to = document.getElementById("export-to").value;
    try {
      const url = await API.getHACCPExportUrl("traceability", from, to);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haccp-tracabilite-${from || "all"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF export\xE9 \u2713", "success");
    } catch (err) {
      showToast("Erreur export : " + err.message, "error");
    }
  });
}
function showReceptionModal() {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h2>\u{1F4E6} R\xE9ception marchandise</h2>
      <div class="form-group">
        <label>Produit *</label>
        <input type="text" class="form-control" id="rec-product" placeholder="ex: Filet de b\u0153uf" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fournisseur</label>
          <input type="text" class="form-control" id="rec-supplier" placeholder="ex: Metro">
        </div>
        <div class="form-group">
          <label>N\xB0 de lot</label>
          <input type="text" class="form-control" id="rec-batch" placeholder="ex: LOT2024-001">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>DLC</label>
          <input type="date" class="form-control" id="rec-dlc" lang="fr">
        </div>
        <div class="form-group">
          <label>T\xB0 \xE0 r\xE9ception (\xB0C)</label>
          <input type="number" step="0.1" class="form-control" id="rec-temp" placeholder="ex: 3.5" inputmode="decimal">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Quantit\xE9</label>
          <input type="number" step="0.01" class="form-control" id="rec-qty" placeholder="ex: 5" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Unit\xE9</label>
          <select class="form-control" id="rec-unit">
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="l">l</option>
            <option value="pi\xE8ce">pi\xE8ce</option>
            <option value="botte">botte</option>
            <option value="carton">carton</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="rec-notes" placeholder="ex: Emballage l\xE9g\xE8rement ab\xEEm\xE9">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="rec-cancel">Annuler</button>
        <button class="btn btn-primary" id="rec-save" style="min-width:160px">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("rec-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("rec-save").addEventListener("click", async () => {
    const product_name = document.getElementById("rec-product").value.trim();
    if (!product_name) {
      document.getElementById("rec-product").classList.add("form-control--error");
      return;
    }
    const payload = {
      product_name,
      supplier: document.getElementById("rec-supplier").value.trim() || null,
      batch_number: document.getElementById("rec-batch").value.trim() || null,
      dlc: document.getElementById("rec-dlc").value || null,
      temperature_at_reception: document.getElementById("rec-temp").value ? parseFloat(document.getElementById("rec-temp").value) : null,
      quantity: document.getElementById("rec-qty").value ? parseFloat(document.getElementById("rec-qty").value) : null,
      unit: document.getElementById("rec-unit").value,
      received_by: account ? account.id : null,
      notes: document.getElementById("rec-notes").value.trim() || null
    };
    try {
      await API.createTraceability(payload);
      overlay.remove();
      showToast("R\xE9ception enregistr\xE9e \u2713", "success");
      renderHACCPTraceability();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
async function renderHACCPCooling() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.getCoolingLogs({ limit: 100 });
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>\u2744\uFE0F Refroidissements rapides</h1>
          <button class="btn btn-primary" id="btn-new-cooling">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">R\xE9glementation : passage de <strong>+63\xB0C \xE0 +10\xB0C en moins de 2h</strong>.</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>D\xE9but</th>
                <th>T\xB0 initiale</th>
                <th>Passage 63\xB0C</th>
                <th>Passage 10\xB0C</th>
                <th>Dur\xE9e 63\u219210\xB0C</th>
                <th>Conformit\xE9</th>
                <th>Op\xE9rateur</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="cooling-table-body">
              ${renderCoolingRows(items)}
            </tbody>
          </table>
        </div>
        ${items.length === 0 ? '<div class="empty-state"><p>Aucun enregistrement</p></div>' : ""}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupCoolingEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
function renderCoolingRows(items) {
  return items.map((item) => {
    const startDate = new Date(item.start_time).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    const time63 = item.time_at_63c ? new Date(item.time_at_63c).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "\u2014";
    const time10 = item.time_at_10c ? new Date(item.time_at_10c).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "\u2014";
    let durationStr = "\u2014";
    if (item.time_at_63c && item.time_at_10c) {
      const mins = Math.round((new Date(item.time_at_10c) - new Date(item.time_at_63c)) / 6e4);
      durationStr = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
    }
    const complianceHtml = item.is_compliant === null ? '<span class="badge">En cours</span>' : item.is_compliant ? '<span class="badge badge--success">\u2713 Conforme</span>' : '<span class="badge badge--danger">\u2717 Non conforme</span>';
    const needsUpdate = item.is_compliant === null;
    return `
      <tr>
        <td style="font-weight:500">${escapeHtml(item.product_name)}</td>
        <td class="mono text-sm">${startDate}</td>
        <td class="mono">${item.temp_start}\xB0C</td>
        <td class="mono">${time63}</td>
        <td class="mono">${time10}</td>
        <td class="mono">${durationStr}</td>
        <td>${complianceHtml}</td>
        <td>${escapeHtml(item.recorded_by_name || "\u2014")}</td>
        <td>${needsUpdate ? `<button class="btn btn-secondary btn-sm" data-id="${item.id}" data-product="${escapeHtml(item.product_name)}" data-action="update-cooling">Compl\xE9ter</button>` : ""}</td>
      </tr>
    `;
  }).join("");
}
function setupCoolingEvents() {
  var _a;
  (_a = document.getElementById("btn-new-cooling")) == null ? void 0 : _a.addEventListener("click", () => showCoolingModal());
  document.querySelectorAll('[data-action="update-cooling"]').forEach((btn) => {
    btn.addEventListener("click", () => showCoolingUpdateModal(Number(btn.dataset.id), btn.dataset.product));
  });
}
function showCoolingModal() {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <h2>\u2744\uFE0F Nouveau refroidissement</h2>
      <p class="text-secondary text-sm" style="margin-bottom:16px">Enregistrez le d\xE9but. Compl\xE9tez les temps de passage ult\xE9rieurement.</p>
      <div class="form-group">
        <label>Produit *</label>
        <input type="text" class="form-control" id="cool-product" placeholder="ex: Blanquette de veau" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Heure d\xE9but *</label>
          <input type="datetime-local" class="form-control" id="cool-start" value="${now}">
        </div>
        <div class="form-group">
          <label>T\xB0 initiale (\xB0C) *</label>
          <input type="number" step="0.1" class="form-control" id="cool-temp" placeholder="ex: 85" inputmode="decimal">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="cool-notes" placeholder="ex: Cellule de refroidissement n\xB01">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="cool-cancel">Annuler</button>
        <button class="btn btn-primary" id="cool-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("cool-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("cool-save").addEventListener("click", async () => {
    const product_name = document.getElementById("cool-product").value.trim();
    const temp_start = parseFloat(document.getElementById("cool-temp").value);
    if (!product_name) {
      document.getElementById("cool-product").classList.add("form-control--error");
      return;
    }
    if (isNaN(temp_start)) {
      document.getElementById("cool-temp").classList.add("form-control--error");
      return;
    }
    try {
      await API.createCoolingLog({
        product_name,
        start_time: new Date(document.getElementById("cool-start").value).toISOString(),
        temp_start,
        notes: document.getElementById("cool-notes").value.trim() || null,
        recorded_by: account ? account.id : null
      });
      overlay.remove();
      showToast("Refroidissement enregistr\xE9 \u2713", "success");
      renderHACCPCooling();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
function showCoolingUpdateModal(id, productName) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h2>\u2744\uFE0F Compl\xE9ter \u2014 ${escapeHtml(productName)}</h2>
      <div class="form-group">
        <label>Heure passage 63\xB0C \u2193</label>
        <input type="datetime-local" class="form-control" id="cool-u-63c" value="${now}">
      </div>
      <div class="form-group">
        <label>Heure passage 10\xB0C \u2193</label>
        <input type="datetime-local" class="form-control" id="cool-u-10c" value="${now}">
        <p class="text-secondary text-sm">Objectif : moins de 2h entre 63\xB0C et 10\xB0C</p>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="cool-u-notes">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="cool-u-cancel">Annuler</button>
        <button class="btn btn-primary" id="cool-u-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("cool-u-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("cool-u-save").addEventListener("click", async () => {
    const t63 = document.getElementById("cool-u-63c").value;
    const t10 = document.getElementById("cool-u-10c").value;
    try {
      await API.updateCoolingLog(id, {
        time_at_63c: t63 ? new Date(t63).toISOString() : null,
        time_at_10c: t10 ? new Date(t10).toISOString() : null,
        notes: document.getElementById("cool-u-notes").value.trim() || null
      });
      overlay.remove();
      if (t63 && t10) {
        const mins = Math.round((new Date(t10) - new Date(t63)) / 6e4);
        showToast(mins <= 120 ? `\u2705 Conforme \u2014 ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}` : `\u26A0\uFE0F Non conforme \u2014 ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")} > 2h`, mins <= 120 ? "success" : "error");
      }
      renderHACCPCooling();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
async function renderHACCPReheating() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.getReheatingLogs({ limit: 100 });
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>\u{1F525} Remises en temp\xE9rature</h1>
          <button class="btn btn-primary" id="btn-new-reheat">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">R\xE9glementation : atteindre <strong>+63\xB0C en moins de 1h</strong> depuis la mise en chauffe.</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>D\xE9but</th>
                <th>T\xB0 initiale</th>
                <th>Atteinte 63\xB0C</th>
                <th>Dur\xE9e</th>
                <th>Conformit\xE9</th>
                <th>Op\xE9rateur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderReheatingRows(items)}</tbody>
          </table>
        </div>
        ${items.length === 0 ? '<div class="empty-state"><p>Aucun enregistrement</p></div>' : ""}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupReheatingEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
function renderReheatingRows(items) {
  return items.map((item) => {
    const startDate = new Date(item.start_time).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    const time63 = item.time_at_63c ? new Date(item.time_at_63c).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "\u2014";
    let durationStr = "\u2014";
    if (item.time_at_63c) {
      const mins = Math.round((new Date(item.time_at_63c) - new Date(item.start_time)) / 6e4);
      durationStr = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
    }
    const complianceHtml = item.is_compliant === null ? '<span class="badge">En cours</span>' : item.is_compliant ? '<span class="badge badge--success">\u2713 Conforme</span>' : '<span class="badge badge--danger">\u2717 Non conforme</span>';
    return `
      <tr>
        <td style="font-weight:500">${escapeHtml(item.product_name)}</td>
        <td class="mono text-sm">${startDate}</td>
        <td class="mono">${item.temp_start}\xB0C</td>
        <td class="mono">${time63}</td>
        <td class="mono">${durationStr}</td>
        <td>${complianceHtml}</td>
        <td>${escapeHtml(item.recorded_by_name || "\u2014")}</td>
        <td>${item.is_compliant === null ? `<button class="btn btn-secondary btn-sm" data-id="${item.id}" data-product="${escapeHtml(item.product_name)}" data-action="update-reheat">Compl\xE9ter</button>` : ""}</td>
      </tr>
    `;
  }).join("");
}
function setupReheatingEvents() {
  var _a;
  (_a = document.getElementById("btn-new-reheat")) == null ? void 0 : _a.addEventListener("click", () => showReheatingModal());
  document.querySelectorAll('[data-action="update-reheat"]').forEach((btn) => {
    btn.addEventListener("click", () => showReheatingUpdateModal(Number(btn.dataset.id), btn.dataset.product));
  });
}
function showReheatingModal() {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <h2>\u{1F525} Nouvelle remise en temp\xE9rature</h2>
      <p class="text-secondary text-sm" style="margin-bottom:16px">Compl\xE9tez quand +63\xB0C est atteint.</p>
      <div class="form-group">
        <label>Produit *</label>
        <input type="text" class="form-control" id="reheat-product" placeholder="ex: B\u0153uf bourguignon" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Heure d\xE9but *</label>
          <input type="datetime-local" class="form-control" id="reheat-start" value="${now}">
        </div>
        <div class="form-group">
          <label>T\xB0 initiale (\xB0C) *</label>
          <input type="number" step="0.1" class="form-control" id="reheat-temp" placeholder="ex: 4" inputmode="decimal">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="reheat-notes" placeholder="ex: Bain-marie">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="reheat-cancel">Annuler</button>
        <button class="btn btn-primary" id="reheat-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("reheat-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("reheat-save").addEventListener("click", async () => {
    const product_name = document.getElementById("reheat-product").value.trim();
    const temp_start = parseFloat(document.getElementById("reheat-temp").value);
    if (!product_name) {
      document.getElementById("reheat-product").classList.add("form-control--error");
      return;
    }
    if (isNaN(temp_start)) {
      document.getElementById("reheat-temp").classList.add("form-control--error");
      return;
    }
    try {
      await API.createReheatingLog({
        product_name,
        start_time: new Date(document.getElementById("reheat-start").value).toISOString(),
        temp_start,
        notes: document.getElementById("reheat-notes").value.trim() || null,
        recorded_by: account ? account.id : null
      });
      overlay.remove();
      showToast("Remise en temp\xE9rature enregistr\xE9e \u2713", "success");
      renderHACCPReheating();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
function showReheatingUpdateModal(id, productName) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <h2>\u{1F525} Compl\xE9ter \u2014 ${escapeHtml(productName)}</h2>
      <div class="form-group">
        <label>Heure atteinte 63\xB0C *</label>
        <input type="datetime-local" class="form-control" id="reheat-u-63c" value="${now}">
        <p class="text-secondary text-sm">Objectif : moins de 1h depuis le d\xE9but</p>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="reheat-u-notes">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="reheat-u-cancel">Annuler</button>
        <button class="btn btn-primary" id="reheat-u-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("reheat-u-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("reheat-u-save").addEventListener("click", async () => {
    const t63 = document.getElementById("reheat-u-63c").value;
    try {
      await API.updateReheatingLog(id, {
        time_at_63c: t63 ? new Date(t63).toISOString() : null,
        notes: document.getElementById("reheat-u-notes").value.trim() || null
      });
      overlay.remove();
      showToast("Remise en temp\xE9rature compl\xE9t\xE9e \u2713", "success");
      renderHACCPReheating();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
const FRYER_ACTION_LABELS = {
  mise_en_service: "\u{1F527} Mise en service",
  controle_polaire: "\u{1F9EA} Contr\xF4le polaire",
  filtrage: "\u{1F53D} Filtrage",
  changement: "\u{1F504} Changement huile"
};
async function renderHACCPFryers() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items: fryers } = await API.getFryers();
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>\u{1F35F} Huiles de friture</h1>
          <button class="btn btn-primary" id="btn-new-fryer">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter friteuse
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">Seuil l\xE9gal : <strong>25% de compos\xE9s polaires</strong>. Au-del\xE0, changement obligatoire.</span>
        </div>
        <div id="fryers-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
          ${fryers.length === 0 ? '<p class="text-secondary" style="grid-column:1/-1;padding:16px">Aucune friteuse enregistr\xE9e. Ajoutez-en une pour commencer.</p>' : fryers.map((f) => renderFryerCard(f)).join("")}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupFryerEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
function renderFryerCard(fryer) {
  const lastPolar = fryer.last_check && fryer.last_check.action_type === "controle_polaire" ? fryer.last_check : null;
  const polar = lastPolar ? lastPolar.polar_value : null;
  const polarClass = polar !== null ? polar >= 25 ? "color:var(--color-danger,#dc3545);" : polar >= 20 ? "color:var(--color-warning,#ffc107);" : "color:var(--color-success,#28a745);" : "";
  const serviceDate = fryer.service_start ? new Date(fryer.service_start.action_date).toLocaleDateString("fr-FR") : "Non renseign\xE9";
  const lastFilterDate = fryer.last_filter ? new Date(fryer.last_filter.action_date).toLocaleDateString("fr-FR") : "\u2014";
  const lastChangeDate = fryer.last_change ? new Date(fryer.last_change.action_date).toLocaleDateString("fr-FR") : "\u2014";
  return `
    <div class="card" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:var(--text-lg)">${escapeHtml(fryer.name)}</h3>
        ${polar !== null && polar >= 25 ? '<span class="badge badge--danger">Huile \xE0 changer !</span>' : ""}
        ${polar !== null && polar >= 20 && polar < 25 ? '<span class="badge badge--warning">Surveiller</span>' : ""}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div><div class="text-secondary text-sm">Mise en service</div><div class="mono text-sm">${serviceDate}</div></div>
        <div><div class="text-secondary text-sm">Compos\xE9s polaires</div><div class="mono" style="font-size:var(--text-xl);font-weight:700;${polarClass}">${polar !== null ? polar + "%" : "\u2014"}</div></div>
        <div><div class="text-secondary text-sm">Dernier filtrage</div><div class="mono text-sm">${lastFilterDate}</div></div>
        <div><div class="text-secondary text-sm">Dernier changement</div><div class="mono text-sm">${lastChangeDate}</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-check" data-type="controle_polaire">\u{1F9EA} Polaire</button>
        <button class="btn btn-secondary btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-check" data-type="filtrage">\u{1F53D} Filtrage</button>
        <button class="btn btn-secondary btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-check" data-type="changement">\u{1F504} Changement</button>
        <button class="btn btn-ghost btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-history">\u{1F4CB} Historique</button>
      </div>
    </div>
  `;
}
function setupFryerEvents() {
  var _a;
  (_a = document.getElementById("btn-new-fryer")) == null ? void 0 : _a.addEventListener("click", () => showNewFryerModal());
  document.querySelectorAll('[data-action="fryer-check"]').forEach((btn) => {
    btn.addEventListener("click", () => showFryerCheckModal(Number(btn.dataset.fryerId), btn.dataset.fryerName, btn.dataset.type));
  });
  document.querySelectorAll('[data-action="fryer-history"]').forEach((btn) => {
    btn.addEventListener("click", () => showFryerHistoryModal(Number(btn.dataset.fryerId), btn.dataset.fryerName));
  });
}
function showNewFryerModal() {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h2>\u{1F35F} Ajouter une friteuse</h2>
      <div class="form-group">
        <label>Nom *</label>
        <input type="text" class="form-control" id="fryer-name-input" placeholder="ex: Friteuse 1, Grande friteuse" autofocus>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="fryer-cancel">Annuler</button>
        <button class="btn btn-primary" id="fryer-save">Ajouter</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("fryer-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("fryer-save").addEventListener("click", async () => {
    const name = document.getElementById("fryer-name-input").value.trim();
    if (!name) {
      document.getElementById("fryer-name-input").classList.add("form-control--error");
      return;
    }
    try {
      const account = getAccount();
      const { id } = await API.createFryer({ name });
      await API.createFryerCheck(id, { action_type: "mise_en_service", recorded_by: account ? account.id : null });
      overlay.remove();
      showToast("Friteuse ajout\xE9e \u2713", "success");
      renderHACCPFryers();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
function showFryerCheckModal(fryerId, fryerName, actionType) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
  const isPolar = actionType === "controle_polaire";
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <h2>${FRYER_ACTION_LABELS[actionType]} \u2014 ${escapeHtml(fryerName)}</h2>
      <div class="form-group">
        <label>Date et heure</label>
        <input type="datetime-local" class="form-control" id="fryer-check-date" value="${now}">
      </div>
      ${isPolar ? `
      <div class="form-group">
        <label>Valeur (% compos\xE9s polaires) *</label>
        <input type="number" step="0.1" min="0" max="100" class="form-control" id="fryer-polar-val"
               placeholder="ex: 18.5" inputmode="decimal" autofocus
               style="font-size:var(--text-2xl);text-align:center;font-family:var(--font-mono)">
        <p class="text-secondary text-sm">Seuil l\xE9gal : 25%</p>
      </div>
      ` : ""}
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="fryer-check-notes" placeholder="Observations">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="fryer-check-cancel">Annuler</button>
        <button class="btn btn-primary" id="fryer-check-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("fryer-check-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("fryer-check-save").addEventListener("click", async () => {
    const polar_value = isPolar ? parseFloat(document.getElementById("fryer-polar-val").value) : null;
    if (isPolar && isNaN(polar_value)) {
      document.getElementById("fryer-polar-val").classList.add("form-control--error");
      return;
    }
    try {
      await API.createFryerCheck(fryerId, {
        action_type: actionType,
        action_date: new Date(document.getElementById("fryer-check-date").value).toISOString(),
        polar_value: isPolar ? polar_value : null,
        notes: document.getElementById("fryer-check-notes").value.trim() || null,
        recorded_by: account ? account.id : null
      });
      overlay.remove();
      if (isPolar && polar_value >= 25) {
        showToast(`\u26A0\uFE0F ${polar_value}% \u2014 Seuil d\xE9pass\xE9 ! Changement obligatoire`, "error");
      } else {
        showToast(`${FRYER_ACTION_LABELS[actionType]} enregistr\xE9 \u2713`, "success");
      }
      renderHACCPFryers();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
async function showFryerHistoryModal(fryerId, fryerName) {
  try {
    const { items } = await API.getFryerChecks(fryerId);
    const existing = document.querySelector(".modal-overlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" style="max-width:600px">
        <h2>\u{1F4CB} Historique \u2014 ${escapeHtml(fryerName)}</h2>
        <div class="table-container" style="max-height:400px;overflow-y:auto">
          <table>
            <thead><tr><th>Date</th><th>Action</th><th>Polaire</th><th>Notes</th><th>Op\xE9rateur</th></tr></thead>
            <tbody>
              ${items.map((c) => `
                <tr>
                  <td class="mono text-sm">${new Date(c.action_date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>${escapeHtml(FRYER_ACTION_LABELS[c.action_type] || c.action_type)}</td>
                  <td class="mono ${c.polar_value !== null && c.polar_value >= 25 ? "text-danger" : ""}">${c.polar_value !== null ? c.polar_value + "%" : "\u2014"}</td>
                  <td class="text-secondary text-sm">${escapeHtml(c.notes || "\u2014")}</td>
                  <td>${escapeHtml(c.recorded_by_name || "\u2014")}</td>
                </tr>
              `).join("")}
              ${items.length === 0 ? '<tr><td colspan="5" class="text-secondary" style="text-align:center">Aucun enregistrement</td></tr>' : ""}
            </tbody>
          </table>
        </div>
        <div style="text-align:right;margin-top:16px">
          <button class="btn btn-secondary" id="fryer-hist-close">Fermer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.getElementById("fryer-hist-close").addEventListener("click", () => overlay.remove());
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}
const NC_CATEGORIES = {
  temperature: "\u{1F321}\uFE0F Temp\xE9rature",
  dlc: "\u{1F4C5} DLC/DLUO",
  hygiene: "\u{1F9F9} Hygi\xE8ne",
  reception: "\u{1F4E6} R\xE9ception",
  equipement: "\u2699\uFE0F \xC9quipement",
  allergen: "\u26A0\uFE0F Allerg\xE8ne",
  autre: "\u{1F4CB} Autre"
};
const NC_SEVERITIES = {
  mineure: { label: "Mineure", class: "badge--info" },
  majeure: { label: "Majeure", class: "badge--warning" },
  critique: { label: "Critique", class: "badge--danger" }
};
async function renderHACCPNonConformities() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [openData, closedData] = await Promise.all([
      API.getNonConformities("ouvert"),
      API.getNonConformities("resolu")
    ]);
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>\u26A0\uFE0F Non-conformit\xE9s</h1>
          <button class="btn btn-primary" id="btn-new-nc">
            <i data-lucide="plus" style="width:18px;height:18px"></i> D\xE9clarer
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        ${openData.items.length > 0 ? `
        <div class="section-title" style="display:flex;align-items:center;gap:8px">
          <span>\u{1F534} En cours (${openData.items.length})</span>
        </div>
        <div>
          ${openData.items.map((nc) => renderNCCard(nc, false)).join("")}
        </div>
        ` : '<div style="background:#d4edda;border:1px solid #28a745;border-radius:8px;padding:12px 16px;margin-bottom:16px">\u2705 Aucune non-conformit\xE9 ouverte</div>'}

        ${closedData.items.length > 0 ? `
        <div class="section-title" style="margin-top:24px">\u2705 R\xE9solues (${closedData.items.length})</div>
        <div>
          ${closedData.items.slice(0, 10).map((nc) => renderNCCard(nc, true)).join("")}
        </div>
        ` : ""}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupNCEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
function renderNCCard(nc, resolved) {
  const sev = NC_SEVERITIES[nc.severity] || NC_SEVERITIES.mineure;
  const cat = NC_CATEGORIES[nc.category] || nc.category;
  const detectedDate = new Date(nc.detected_at).toLocaleDateString("fr-FR");
  const borderColor = nc.severity === "critique" ? "var(--color-danger,#dc3545)" : nc.severity === "majeure" ? "var(--color-warning,#ffc107)" : "var(--color-info,#3b9ede)";
  return `
    <div class="card" style="padding:16px;margin-bottom:12px;border-left:4px solid ${borderColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="badge ${sev.class}">${sev.label}</span>
            <span class="text-secondary text-sm">${cat}</span>
            <span class="text-secondary text-sm">\xB7 ${detectedDate}</span>
          </div>
          <div style="font-weight:600;margin-bottom:4px">${escapeHtml(nc.title)}</div>
          ${nc.description ? `<div class="text-secondary text-sm" style="margin-bottom:8px">${escapeHtml(nc.description)}</div>` : ""}
          ${nc.corrective_action ? `<div style="background:var(--color-bg-secondary,#f8f9fa);border-radius:4px;padding:8px 12px;margin-top:8px;font-size:var(--text-sm)"><strong>Action corrective :</strong> ${escapeHtml(nc.corrective_action)}</div>` : ""}
          ${resolved && nc.resolved_at ? `<div class="text-secondary text-sm" style="margin-top:4px">R\xE9solu le ${new Date(nc.resolved_at).toLocaleDateString("fr-FR")} par ${escapeHtml(nc.resolved_by_name || "\u2014")}</div>` : ""}
        </div>
        ${!resolved ? `<button class="btn btn-secondary btn-sm" data-nc-id="${nc.id}" data-nc-title="${escapeHtml(nc.title)}" data-action="nc-resolve">R\xE9soudre</button>` : ""}
      </div>
    </div>
  `;
}
function setupNCEvents() {
  var _a;
  (_a = document.getElementById("btn-new-nc")) == null ? void 0 : _a.addEventListener("click", () => showNCModal());
  document.querySelectorAll('[data-action="nc-resolve"]').forEach((btn) => {
    btn.addEventListener("click", () => showNCResolveModal(Number(btn.dataset.ncId), btn.dataset.ncTitle));
  });
}
function showNCModal() {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <h2>\u26A0\uFE0F D\xE9clarer une non-conformit\xE9</h2>
      <div class="form-group">
        <label>Titre *</label>
        <input type="text" class="form-control" id="nc-title" placeholder="ex: Temp\xE9rature frigo hors norme" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cat\xE9gorie</label>
          <select class="form-control" id="nc-category">
            ${Object.entries(NC_CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>S\xE9v\xE9rit\xE9</label>
          <select class="form-control" id="nc-severity">
            ${Object.entries(NC_SEVERITIES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-control" id="nc-description" rows="3" placeholder="D\xE9crivez la non-conformit\xE9..."></textarea>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="nc-cancel">Annuler</button>
        <button class="btn btn-primary" id="nc-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> D\xE9clarer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("nc-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("nc-save").addEventListener("click", async () => {
    const title = document.getElementById("nc-title").value.trim();
    if (!title) {
      document.getElementById("nc-title").classList.add("form-control--error");
      return;
    }
    try {
      await API.createNonConformity({
        title,
        description: document.getElementById("nc-description").value.trim() || null,
        category: document.getElementById("nc-category").value,
        severity: document.getElementById("nc-severity").value,
        detected_by: account ? account.id : null
      });
      overlay.remove();
      showToast("Non-conformit\xE9 d\xE9clar\xE9e \u2713", "success");
      renderHACCPNonConformities();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
function showNCResolveModal(id, title) {
  const existing = document.querySelector(".modal-overlay");
  if (existing) existing.remove();
  const account = getAccount();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h2>\u2705 R\xE9soudre \u2014 ${escapeHtml(title)}</h2>
      <div class="form-group">
        <label>Action corrective *</label>
        <textarea class="form-control" id="nc-corrective" rows="4" placeholder="D\xE9crivez l'action corrective mise en place..." autofocus></textarea>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="nc-r-cancel">Annuler</button>
        <button class="btn btn-primary" id="nc-r-save" style="background:var(--color-success,#28a745)">
          <i data-lucide="check-circle" style="width:18px;height:18px"></i> Marquer r\xE9solue
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("nc-r-cancel").addEventListener("click", () => overlay.remove());
  document.getElementById("nc-r-save").addEventListener("click", async () => {
    const corrective_action = document.getElementById("nc-corrective").value.trim();
    if (!corrective_action) {
      document.getElementById("nc-corrective").classList.add("form-control--error");
      return;
    }
    try {
      await API.updateNonConformity(id, {
        corrective_action,
        status: "resolu",
        resolved_by: account ? account.id : null
      });
      overlay.remove();
      showToast("Non-conformit\xE9 r\xE9solue \u2713", "success");
      renderHACCPNonConformities();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}
const ALLERGEN_LABELS = {
  gluten: { label: "Gluten", icon: "\u{1F33E}" },
  crustaceans: { label: "Crustac\xE9s", icon: "\u{1F980}" },
  eggs: { label: "\u0152ufs", icon: "\u{1F95A}" },
  fish: { label: "Poissons", icon: "\u{1F41F}" },
  peanuts: { label: "Arachides", icon: "\u{1F95C}" },
  soybeans: { label: "Soja", icon: "\u{1FAD8}" },
  milk: { label: "Lait", icon: "\u{1F95B}" },
  nuts: { label: "Fruits \xE0 coque", icon: "\u{1F330}" },
  celery: { label: "C\xE9leri", icon: "\u{1F33F}" },
  mustard: { label: "Moutarde", icon: "\u{1F7E1}" },
  sesame: { label: "S\xE9same", icon: "\u26AA" },
  sulphites: { label: "Sulfites", icon: "\u{1F377}" },
  lupin: { label: "Lupin", icon: "\u{1F338}" },
  molluscs: { label: "Mollusques", icon: "\u{1F41A}" }
};
async function renderHACCPAllergens() {
  const app = document.getElementById("app");
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.getAllergenMenuDisplay();
    const byCategory = {};
    items.forEach((recipe) => {
      const cat = recipe.category || "Sans cat\xE9gorie";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(recipe);
    });
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>\u26A0\uFE0F Allerg\xE8nes \u2014 Affichage INCO</h1>
          <button class="btn btn-secondary" onclick="window.print()">
            <i data-lucide="printer" style="width:18px;height:18px"></i> Imprimer
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">R\xE8glement INCO (UE) n\xB01169/2011 \u2014 Les 14 allerg\xE8nes majeurs doivent \xEAtre port\xE9s \xE0 la connaissance des consommateurs. Peut \xEAtre affich\xE9 en salle ou remis sur demande.</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;padding:12px;background:var(--color-bg-secondary,#f8f9fa);border-radius:8px">
          ${Object.entries(ALLERGEN_LABELS).map(([k, v]) => `
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--text-sm);padding:4px 8px;background:white;border-radius:4px;border:1px solid var(--color-border,#e0e0e0)">
              ${v.icon} <strong>${v.label}</strong>
            </span>
          `).join("")}
        </div>
        ${Object.entries(byCategory).map(([category, recipes]) => `
          <div style="margin-bottom:24px">
            <div class="section-title">${escapeHtml(category)}</div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="min-width:180px">Plat</th>
                    ${Object.entries(ALLERGEN_LABELS).map(([k, v]) => `<th style="text-align:center;min-width:44px" title="${v.label}">${v.icon}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${recipes.map((recipe) => `
                    <tr>
                      <td style="font-weight:500">${escapeHtml(recipe.name)}</td>
                      ${Object.keys(ALLERGEN_LABELS).map((k) => `
                        <td style="text-align:center">${recipe.allergen_codes.includes(k) ? '<span style="color:var(--color-danger,#dc3545);font-size:16px;font-weight:700">\u25CF</span>' : ""}</td>
                      `).join("")}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `).join("")}
        ${items.length === 0 ? '<div class="empty-state"><p>Aucune recette avec allerg\xE8nes. Renseignez les allerg\xE8nes dans les fiches ingr\xE9dients.</p></div>' : ""}
        <p class="text-secondary text-sm" style="margin-top:16px">* G\xE9n\xE9r\xE9 depuis les fiches recettes. V\xE9rifiez que tous les ingr\xE9dients sont correctement renseign\xE9s.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}
async function renderOrdersDashboard() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <h1>Commandes fournisseurs</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" id="btn-po-analytics"><i data-lucide="bar-chart-3" style="width:16px;height:16px"></i> Statistiques</button>
        <button class="btn btn-secondary" id="btn-suggest-orders"><i data-lucide="lightbulb" style="width:16px;height:16px"></i> Suggestions</button>
        <a href="#/orders/new" class="btn btn-primary"><i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle commande</a>
      </div>
    </div>
    <div class="orders-subnav" style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto">
      <button class="haccp-subnav__link active" data-filter="">Toutes</button>
      <button class="haccp-subnav__link" data-filter="brouillon">Brouillon</button>
      <button class="haccp-subnav__link" data-filter="envoy\xE9e">Envoy\xE9es</button>
      <button class="haccp-subnav__link" data-filter="confirm\xE9e">Confirm\xE9es</button>
      <button class="haccp-subnav__link" data-filter="r\xE9ceptionn\xE9e">R\xE9ceptionn\xE9es</button>
      <button class="haccp-subnav__link" data-filter="annul\xE9e">Annul\xE9es</button>
    </div>
    <div id="orders-grid"><div class="loading"><div class="spinner"></div></div></div>
    <div id="suggest-modal" class="hidden"></div>
  `;
  lucide.createIcons();
  let allOrders = [];
  try {
    allOrders = await API.getPurchaseOrders();
  } catch (e) {
    showToast("Erreur chargement commandes", "error");
  }
  const gridEl = document.getElementById("orders-grid");
  function renderOrders(filterStatus) {
    const orders = filterStatus ? allOrders.filter((o) => o.status === filterStatus) : allOrders;
    if (orders.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">\u{1F4E6}</div>
          <h3>Aucune commande</h3>
          <p>Cr\xE9ez une nouvelle commande fournisseur pour commencer.</p>
          <a href="#/orders/new" class="btn btn-primary">Nouvelle commande</a>
        </div>
      `;
      return;
    }
    gridEl.innerHTML = `<div class="orders-table-grid">${orders.map((order) => {
      const statusBadgeClass = getPOStatusBadgeClass(order.status);
      const statusLabel = getPOStatusLabel(order.status);
      const elapsed = getElapsedTime(order.created_at);
      const itemCount = (order.items || []).length;
      const totalAmount = (order.items || []).reduce((sum, item) => sum + (item.unit_price * item.quantity || 0), 0);
      let actionButtons = "";
      if (order.status === "brouillon") {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="sendPurchaseOrder(${order.id})">Envoyer</button>
          <button class="btn btn-sm btn-secondary" onclick="editPurchaseOrder(${order.id})"><i data-lucide="edit" style="width:14px;height:14px"></i></button>
          <button class="btn btn-sm btn-danger" aria-label="Supprimer" onclick="deletePurchaseOrderFromDash(${order.id})"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
        `;
      } else if (order.status === "envoy\xE9e") {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="confirmPurchaseOrder(${order.id})">Confirmer</button>
          <button class="btn btn-sm btn-danger" aria-label="Annuler" onclick="cancelPurchaseOrderFromDash(${order.id})"><i data-lucide="x" style="width:14px;height:14px"></i></button>
        `;
      } else if (order.status === "confirm\xE9e") {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="receivePurchaseOrderFromDash(${order.id})">R\xE9ceptionner</button>
        `;
      }
      return `
        <div class="order-card" style="cursor:pointer" onclick="location.hash='#/orders/${order.id}'">
          <div class="order-card__header">
            <span class="order-card__table" style="font-weight:600">${escapeHtml(order.reference)}</span>
            <span class="order-card__timer">${elapsed}</span>
          </div>
          <div style="margin-bottom:8px">
            <span class="badge badge--info" style="background:#6366f1;color:white">${escapeHtml(order.supplier_name)}</span>
          </div>
          <span class="badge badge--${statusBadgeClass}">${statusLabel}</span>
          <div style="margin-top:8px;font-size:var(--text-sm);color:var(--text-secondary)">
            <div>${itemCount} article${itemCount > 1 ? "s" : ""}</div>
            <div style="font-weight:600;color:var(--text-primary);margin-top:4px">${formatCurrency(totalAmount)}</div>
          </div>
          <div class="order-card__actions" style="margin-top:12px">
            <a href="#/orders/${order.id}" class="btn btn-sm btn-secondary">D\xE9tail</a>
            ${actionButtons}
          </div>
        </div>
      `;
    }).join("")}</div>`;
    lucide.createIcons();
  }
  renderOrders("");
  document.querySelectorAll(".orders-subnav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".orders-subnav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderOrders(btn.dataset.filter);
    });
  });
  document.getElementById("btn-suggest-orders").addEventListener("click", showSuggestionsModal);
  document.getElementById("btn-po-analytics").addEventListener("click", showPOAnalyticsModal);
}
async function showSuggestionsModal() {
  const modalEl = document.getElementById("suggest-modal");
  modalEl.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="max-width:600px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2>Articles \xE0 r\xE9approvisionner</h2>
          <button class="btn btn-sm btn-secondary" onclick="document.getElementById('suggest-modal').innerHTML=''"><i data-lucide="x" style="width:18px;height:18px"></i></button>
        </div>
        <div id="suggest-loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  modalEl.classList.remove("hidden");
  lucide.createIcons();
  try {
    const suggestions = await API.getPurchaseOrderSuggestions();
    const loadingEl = document.getElementById("suggest-loading");
    if (!suggestions || suggestions.length === 0) {
      loadingEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">\u2705</div>
          <p>Tous les stocks sont corrects. Aucun r\xE9approvisionnement n\xE9cessaire.</p>
        </div>
      `;
      return;
    }
    const bySupplier = {};
    for (const item of suggestions) {
      if (!bySupplier[item.supplier_id]) {
        bySupplier[item.supplier_id] = { name: item.supplier_name, items: [] };
      }
      bySupplier[item.supplier_id].items.push(item);
    }
    loadingEl.innerHTML = `
      ${Object.entries(bySupplier).map(([supplierId, group]) => `
        <div style="margin-bottom:20px;border:1px solid var(--border-color);border-radius:6px;padding:12px">
          <h4 style="margin-bottom:12px">${escapeHtml(group.name)}</h4>
          <table style="width:100%;font-size:var(--text-sm);border-collapse:collapse">
            <tbody>
              ${group.items.map((item) => `
                <tr style="border-top:1px solid var(--border-color);padding:8px 0">
                  <td style="padding:8px">${escapeHtml(item.ingredient_name)}</td>
                  <td style="padding:8px;text-align:right">${item.current_quantity} ${escapeHtml(item.unit)} <span style="color:var(--text-secondary)">(min: ${item.min_quantity})</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="createPurchaseOrderFromSuggestions(${supplierId})">Cr\xE9er la commande</button>
        </div>
      `).join("")}
    `;
  } catch (e) {
    document.getElementById("suggest-loading").innerHTML = `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
let _poItems = [];
let _poSelectedSupplierId = null;
async function renderNewOrder() {
  const app = document.getElementById("app");
  _poItems = [];
  _poSelectedSupplierId = null;
  let suppliers = [];
  let ingredients = [];
  try {
    suppliers = await API.getSuppliers();
    const ingredientsResponse = await API.getIngredients();
    ingredients = ingredientsResponse.ingredients || [];
  } catch (e) {
    showToast("Erreur chargement donn\xE9es", "error");
  }
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/orders" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Commandes</a>
        <h1 style="margin-top:4px">Nouvelle commande fournisseur</h1>
      </div>
    </div>

    <div style="max-width:800px">
      <div class="form-group">
        <label>Fournisseur *</label>
        <select class="form-control" id="po-supplier" required>
          <option value="">\u2014 S\xE9lectionner un fournisseur \u2014</option>
          ${suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
        </select>
      </div>

      <div class="section-title">Ingr\xE9dients</div>
      <div id="ingredients-list">
        <input type="text" class="form-control" id="ingredient-search" placeholder="Rechercher un ingr\xE9dient..." style="margin-bottom:12px">
        <div id="ingredients-filtered" style="max-height:300px;overflow-y:auto;border:1px solid var(--border-color);border-radius:4px">
          ${ingredients.map((ing) => `
            <div class="ingredient-item" data-id="${ing.id}" style="padding:8px 12px;border-bottom:1px solid var(--border-color);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
              <span>${escapeHtml(ing.name)}</span>
              <button type="button" class="btn btn-sm btn-primary">+</button>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section-title" style="margin-top:20px">Articles de la commande</div>
      <div id="po-items-table" style="overflow-x:auto">
        <p class="text-muted">Aucun article pour le moment. Ajoutez des ingr\xE9dients ci-dessus.</p>
      </div>

      <div class="section-title" style="margin-top:20px">Total</div>
      <div style="font-size:1.5rem;font-weight:600;color:var(--color-accent);margin-bottom:20px">
        <span id="po-total">${formatCurrency(0)}</span>
      </div>

      <div class="actions-row">
        <button class="btn btn-primary" id="btn-send-po" disabled>
          <i data-lucide="send" style="width:18px;height:18px"></i> Envoyer
        </button>
        <button class="btn btn-secondary" id="btn-save-po" disabled>
          <i data-lucide="save" style="width:18px;height:18px"></i> Sauvegarder en brouillon
        </button>
        <a href="#/orders" class="btn btn-secondary">Annuler</a>
      </div>
    </div>
  `;
  lucide.createIcons();
  const supplierSelect = document.getElementById("po-supplier");
  const ingredientSearch = document.getElementById("ingredient-search");
  const ingredientsFiltered = document.getElementById("ingredients-filtered");
  supplierSelect.addEventListener("change", (e) => {
    _poSelectedSupplierId = e.target.value ? parseInt(e.target.value) : null;
    updatePOItemsDisplay();
  });
  ingredientSearch.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll(".ingredient-item");
    items.forEach((item) => {
      const name = item.textContent.toLowerCase();
      item.style.display = name.includes(query) ? "" : "none";
    });
  });
  ingredientsFiltered.addEventListener("click", (e) => {
    const btn = e.target.closest(".ingredient-item button");
    if (!btn) return;
    const ingredientItem = e.target.closest(".ingredient-item");
    const ingredientId = parseInt(ingredientItem.dataset.id);
    const ingredientName = ingredientItem.textContent.trim();
    const existing = _poItems.find((i) => i.ingredient_id === ingredientId);
    if (existing) {
      existing.quantity++;
    } else {
      _poItems.push({
        ingredient_id: ingredientId,
        name: ingredientName,
        quantity: 1,
        unit: "unit\xE9",
        unit_price: 0
      });
    }
    updatePOItemsDisplay();
  });
  document.getElementById("btn-send-po").addEventListener("click", async () => {
    await submitPurchaseOrder(true);
  });
  document.getElementById("btn-save-po").addEventListener("click", async () => {
    await submitPurchaseOrder(false);
  });
}
function updatePOItemsDisplay() {
  const itemsTableEl = document.getElementById("po-items-table");
  const sendBtn = document.getElementById("btn-send-po");
  const saveBtn = document.getElementById("btn-save-po");
  if (_poItems.length === 0) {
    itemsTableEl.innerHTML = '<p class="text-muted">Aucun article pour le moment. Ajoutez des ingr\xE9dients ci-dessus.</p>';
    if (sendBtn) sendBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    return;
  }
  if (sendBtn) sendBtn.disabled = !_poSelectedSupplierId || _poItems.length === 0;
  if (saveBtn) saveBtn.disabled = !_poSelectedSupplierId || _poItems.length === 0;
  let total = 0;
  itemsTableEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
      <thead>
        <tr style="border-bottom:2px solid var(--border-color)">
          <th style="text-align:left;padding:8px">Article</th>
          <th style="text-align:right;padding:8px">Quantit\xE9</th>
          <th style="text-align:right;padding:8px">Unit\xE9</th>
          <th style="text-align:right;padding:8px">Prix unitaire</th>
          <th style="text-align:right;padding:8px">Total</th>
          <th style="text-align:center;padding:8px">Action</th>
        </tr>
      </thead>
      <tbody>
        ${_poItems.map((item, idx) => {
    const lineTotal = item.quantity * (item.unit_price || 0);
    total += lineTotal;
    return `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:8px">${escapeHtml(item.name)}</td>
              <td style="padding:8px;text-align:right">
                <input type="number" class="form-control" style="max-width:80px" value="${item.quantity}" min="1" onchange="updatePOItemQuantity(${idx}, this.value)">
              </td>
              <td style="padding:8px;text-align:right">
                <input type="text" class="form-control" style="max-width:80px" value="${escapeHtml(item.unit)}" onchange="updatePOItemUnit(${idx}, this.value)">
              </td>
              <td style="padding:8px;text-align:right">
                <input type="number" class="form-control" style="max-width:100px" step="0.01" value="${item.unit_price || ""}" placeholder="0.00" onchange="updatePOItemPrice(${idx}, this.value)">
              </td>
              <td style="padding:8px;text-align:right;font-weight:600">${formatCurrency(lineTotal)}</td>
              <td style="padding:8px;text-align:center">
                <button class="btn btn-sm btn-danger" onclick="removePOItem(${idx})"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
              </td>
            </tr>
          `;
  }).join("")}
      </tbody>
    </table>
  `;
  const totalEl = document.getElementById("po-total");
  if (totalEl) totalEl.textContent = formatCurrency(total);
  lucide.createIcons();
}
function updatePOItemQuantity(idx, value) {
  _poItems[idx].quantity = parseInt(value) || 1;
  updatePOItemsDisplay();
}
function updatePOItemUnit(idx, value) {
  _poItems[idx].unit = value.trim() || "unit\xE9";
  updatePOItemsDisplay();
}
function updatePOItemPrice(idx, value) {
  _poItems[idx].unit_price = parseFloat(value) || 0;
  updatePOItemsDisplay();
}
function removePOItem(idx) {
  _poItems.splice(idx, 1);
  updatePOItemsDisplay();
}
async function submitPurchaseOrder(sendImmediately) {
  if (!_poSelectedSupplierId) {
    showToast("S\xE9lectionnez un fournisseur", "error");
    return;
  }
  if (_poItems.length === 0) {
    showToast("Ajoutez au moins un article", "error");
    return;
  }
  try {
    const po = await API.createPurchaseOrder({
      supplier_id: _poSelectedSupplierId,
      status: sendImmediately ? "envoy\xE9e" : "brouillon",
      items: _poItems.map((i) => ({
        ingredient_id: i.ingredient_id,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price
      }))
    });
    showToast(sendImmediately ? "Commande envoy\xE9e" : "Commande sauvegard\xE9e", "success");
    location.hash = "#/orders";
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function createPurchaseOrderFromSuggestions(supplierId) {
  try {
    const suggestions = await API.getPurchaseOrderSuggestions();
    const supplierSuggestions = suggestions.filter((s) => s.supplier_id == supplierId);
    if (supplierSuggestions.length === 0) {
      showToast("Aucune suggestion pour ce fournisseur", "error");
      return;
    }
    const items = supplierSuggestions.map((s) => ({
      ingredient_id: s.ingredient_id,
      quantity: Math.max(s.min_quantity - s.current_quantity, 1),
      unit: s.unit,
      unit_price: s.supplier_price || 0
    }));
    const po = await API.createPurchaseOrder({
      supplier_id: supplierId,
      status: "brouillon",
      items
    });
    showToast("Commande cr\xE9\xE9e", "success");
    document.getElementById("suggest-modal").innerHTML = "";
    location.hash = "#/orders";
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function editPurchaseOrder(id) {
  try {
    const po = await API.getPurchaseOrder(id);
    if (po.status !== "brouillon") {
      showToast("Seules les brouillons peuvent \xEAtre modifi\xE9s", "error");
      return;
    }
    location.hash = "#/orders/" + id;
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function renderOrderDetail(id) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/orders" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Commandes</a>
        <h1 style="margin-top:4px" id="po-title">Chargement...</h1>
      </div>
    </div>
    <div id="po-detail"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();
  try {
    const po = await API.getPurchaseOrder(id);
    renderPODetail(po);
  } catch (e) {
    document.getElementById("po-detail").innerHTML = `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
function renderPODetail(po) {
  const detailEl = document.getElementById("po-detail");
  const titleEl = document.getElementById("po-title");
  const statusLabel = getPOStatusLabel(po.status);
  const statusBadgeClass = getPOStatusBadgeClass(po.status);
  const totalAmount = (po.items || []).reduce((sum, item) => sum + (item.unit_price * item.quantity || 0), 0);
  titleEl.textContent = po.reference;
  let actionButtons = "";
  if (po.status === "brouillon") {
    actionButtons = `
      <button class="btn btn-primary" onclick="sendPurchaseOrder(${po.id})"><i data-lucide="send" style="width:16px;height:16px"></i> Envoyer</button>
      <button class="btn btn-secondary" onclick="editPurchaseOrder(${po.id})"><i data-lucide="edit" style="width:16px;height:16px"></i> Modifier</button>
      <button class="btn btn-danger" onclick="deletePurchaseOrder(${po.id})"><i data-lucide="trash-2" style="width:16px;height:16px"></i> Supprimer</button>
    `;
  } else if (po.status === "envoy\xE9e") {
    actionButtons = `
      <button class="btn btn-primary" onclick="confirmPurchaseOrder(${po.id})">Confirmer la r\xE9ception</button>
      <button class="btn btn-danger" onclick="cancelPurchaseOrder(${po.id})">Annuler</button>
    `;
  } else if (po.status === "confirm\xE9e") {
    actionButtons = `
      <button class="btn btn-primary" onclick="receivePurchaseOrderFromDash(${po.id})">R\xE9ceptionner</button>
    `;
  }
  detailEl.innerHTML = `
    <div style="max-width:900px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">Fournisseur</div>
          <div style="font-size:1.1rem;font-weight:500">${escapeHtml(po.supplier_name)}</div>
        </div>
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">Statut</div>
          <div><span class="badge badge--${statusBadgeClass}">${statusLabel}</span></div>
        </div>
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">Cr\xE9\xE9e le</div>
          <div>${formatDateFR(po.created_at)}</div>
        </div>
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">R\xE9f\xE9rence</div>
          <div>${escapeHtml(po.reference)}</div>
        </div>
      </div>

      <div class="section-title">Articles</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:var(--text-sm)">
        <thead>
          <tr style="border-bottom:2px solid var(--border-color)">
            <th style="text-align:left;padding:8px">Article</th>
            <th style="text-align:right;padding:8px">Quantit\xE9</th>
            <th style="text-align:right;padding:8px">Unit\xE9</th>
            <th style="text-align:right;padding:8px">Prix unitaire</th>
            <th style="text-align:right;padding:8px">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(po.items || []).map((item) => {
    const lineTotal = item.quantity * (item.unit_price || 0);
    return `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:8px">${escapeHtml(item.ingredient_name)}</td>
                <td style="padding:8px;text-align:right">${item.quantity}</td>
                <td style="padding:8px;text-align:right">${escapeHtml(item.unit || "\u2014")}</td>
                <td style="padding:8px;text-align:right">${formatCurrency(item.unit_price)}</td>
                <td style="padding:8px;text-align:right;font-weight:600">${formatCurrency(lineTotal)}</td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;padding-top:12px;border-top:2px solid var(--border-color)">
        <div style="font-size:1.3rem;font-weight:700">
          Total : <span style="color:var(--color-accent)">${formatCurrency(totalAmount)}</span>
        </div>
      </div>

      <div class="actions-row">
        ${actionButtons}
        <button class="btn btn-secondary" onclick="clonePurchaseOrder(${po.id})"><i data-lucide="copy" style="width:16px;height:16px"></i> Dupliquer</button>
        <a href="#/orders" class="btn btn-secondary">Retour</a>
      </div>
    </div>
  `;
  lucide.createIcons();
}
async function sendPurchaseOrder(id) {
  showConfirmModal("Envoyer la commande", "\xCAtes-vous s\xFBr de vouloir envoyer cette commande au fournisseur ?", async () => {
    try {
      await API.updatePurchaseOrder(id, { status: "envoy\xE9e" });
      showToast("Commande envoy\xE9e", "success");
      location.hash = "#/orders";
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  }, { confirmText: "Envoyer", confirmClass: "btn btn-primary" });
  return;
}
async function confirmPurchaseOrder(id) {
  showConfirmModal("Confirmer la r\xE9ception", "\xCAtes-vous s\xFBr de vouloir confirmer la r\xE9ception de cette commande ?", async () => {
    try {
      await API.updatePurchaseOrder(id, { status: "confirm\xE9e" });
      showToast("Commande confirm\xE9e", "success");
      location.hash = "#/orders";
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  }, { confirmText: "Confirmer", confirmClass: "btn btn-primary" });
  return;
}
async function receivePurchaseOrderFromDash(id) {
  try {
    const po = await API.getPurchaseOrder(id);
    if (po.status !== "confirm\xE9e") {
      showToast("Seules les commandes confirm\xE9es peuvent \xEAtre r\xE9ceptionn\xE9es", "error");
      return;
    }
    const receptionData = {
      items: (po.items || []).map((item) => ({
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
        unit: item.unit,
        batch_number: "",
        dlc: null
      }))
    };
    await API.receivePurchaseOrder(id, receptionData);
    await API.updatePurchaseOrder(id, { status: "r\xE9ceptionn\xE9e" });
    showToast("Commande r\xE9ceptionn\xE9e et stock mis \xE0 jour", "success");
    location.hash = "#/orders";
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function cancelPurchaseOrderFromDash(id) {
  showConfirmModal("Annuler la commande", "\xCAtes-vous s\xFBr de vouloir annuler cette commande ?", async () => {
    try {
      await API.updatePurchaseOrder(id, { status: "annul\xE9e" });
      showToast("Commande annul\xE9e", "success");
      renderOrdersDashboard();
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  }, { confirmText: "Annuler", confirmClass: "btn btn-danger" });
  return;
}
async function deletePurchaseOrderFromDash(id) {
  showConfirmModal("Supprimer la commande", "\xCAtes-vous s\xFBr de vouloir supprimer cette commande ?", async () => {
    try {
      await API.deletePurchaseOrder(id);
      showToast("Commande supprim\xE9e", "success");
      renderOrdersDashboard();
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  }, { confirmText: "Supprimer", confirmClass: "btn btn-danger" });
  return;
}
async function deletePurchaseOrder(id) {
  showConfirmModal("Supprimer la commande", "\xCAtes-vous s\xFBr de vouloir supprimer cette commande ?", async () => {
    try {
      await API.deletePurchaseOrder(id);
      showToast("Commande supprim\xE9e", "success");
      location.hash = "#/orders";
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  }, { confirmText: "Supprimer", confirmClass: "btn btn-danger" });
  return;
}
async function cancelPurchaseOrder(id) {
  showConfirmModal("Annuler la commande", "\xCAtes-vous s\xFBr de vouloir annuler cette commande ?", async () => {
    try {
      await API.updatePurchaseOrder(id, { status: "annul\xE9e" });
      showToast("Commande annul\xE9e", "success");
      location.hash = "#/orders";
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  }, { confirmText: "Annuler", confirmClass: "btn btn-danger" });
  return;
}
function getPOStatusBadgeClass(status) {
  switch (status) {
    case "brouillon":
      return "secondary";
    case "envoy\xE9e":
      return "info";
    case "confirm\xE9e":
      return "warning";
    case "r\xE9ceptionn\xE9e":
      return "success";
    case "annul\xE9e":
      return "danger";
    default:
      return "secondary";
  }
}
function getPOStatusLabel(status) {
  switch (status) {
    case "brouillon":
      return "Brouillon";
    case "envoy\xE9e":
      return "Envoy\xE9e";
    case "confirm\xE9e":
      return "Confirm\xE9e";
    case "r\xE9ceptionn\xE9e":
      return "R\xE9ceptionn\xE9e";
    case "annul\xE9e":
      return "Annul\xE9e";
    default:
      return status;
  }
}
function getOrderStatusClass(status) {
  return getPOStatusBadgeClass(status);
}
function getOrderStatusLabel(status) {
  return getPOStatusLabel(status);
}
function getItemStatusIcon(status) {
  switch (status) {
    case "en_attente":
      return "\u23F3";
    case "en_pr\xE9paration":
      return "\u{1F525}";
    case "pr\xEAt":
      return "\u2705";
    case "servi":
      return "\u{1F37D}\uFE0F";
    case "annul\xE9":
      return "\u274C";
    default:
      return "\u23F3";
  }
}
function getElapsedTime(createdAt) {
  const now = /* @__PURE__ */ new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 6e4);
  if (diffMin < 1) return "\xC0 l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h${mins > 0 ? String(mins).padStart(2, "0") : ""}`;
}
async function clonePurchaseOrder(id) {
  try {
    const cloned = await API.clonePurchaseOrder(id);
    showToast("Commande dupliqu\xE9e \u2014 brouillon cr\xE9\xE9", "success");
    location.hash = `#/orders/${cloned.id}`;
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function showPOAnalyticsModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:700px;max-height:80vh;overflow-y:auto;padding:var(--space-5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
        <h2 style="margin:0">\u{1F4CA} Statistiques d'achat</h2>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
      </div>
      <div id="po-analytics-content"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  try {
    const data = await API.getPurchaseOrderAnalytics(60);
    const el = document.getElementById("po-analytics-content");
    if (!el) return;
    el.innerHTML = `
      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-accent)">${data.overall.total_orders}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Commandes</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-accent)">${formatCurrency(data.overall.total_spent)}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Total achats</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700">${formatCurrency(data.overall.avg_order)}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Panier moyen</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700">${data.overall.avg_lead_time_days ? data.overall.avg_lead_time_days + "j" : "\u2014"}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">D\xE9lai moyen</div>
        </div>
      </div>

      <!-- By supplier -->
      ${data.by_supplier.length > 0 ? `
      <h3 style="font-size:var(--text-sm);margin-bottom:var(--space-2)">D\xE9penses par fournisseur</h3>
      <div style="margin-bottom:var(--space-4)">
        ${data.by_supplier.map((s) => {
      const pct = data.overall.total_spent > 0 ? Math.round(s.total_spent / data.overall.total_spent * 100) : 0;
      return `
            <div style="display:flex;align-items:center;gap:var(--space-2);padding:8px 0;border-bottom:1px solid var(--border-light)">
              <span style="flex:1;font-weight:500;font-size:var(--text-sm)">${escapeHtml(s.supplier_name)}</span>
              <span style="font-size:var(--text-sm);color:var(--text-secondary)">${s.order_count} cmd</span>
              <div style="width:100px;height:8px;background:var(--bg-sunken);border-radius:4px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:var(--color-accent);border-radius:4px"></div>
              </div>
              <span style="font-weight:600;font-size:var(--text-sm);min-width:80px;text-align:right">${formatCurrency(s.total_spent)}</span>
            </div>
          `;
    }).join("")}
      </div>
      ` : ""}

      <!-- Top items -->
      ${data.top_items.length > 0 ? `
      <h3 style="font-size:var(--text-sm);margin-bottom:var(--space-2)">Top articles achet\xE9s</h3>
      <div style="max-height:200px;overflow-y:auto;margin-bottom:var(--space-4)">
        ${data.top_items.slice(0, 10).map((item) => `
          <div style="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:var(--text-sm)">
            <span style="flex:1;font-weight:500">${escapeHtml(item.ingredient_name || "Inconnu")}</span>
            <span style="color:var(--text-secondary);margin-right:12px">${item.total_qty} ${item.unit || ""}</span>
            <span style="font-weight:600">${formatCurrency(item.total_spent)}</span>
          </div>
        `).join("")}
      </div>
      ` : ""}

      <div style="font-size:var(--text-xs);color:var(--text-tertiary);text-align:center;margin-top:var(--space-3)">
        P\xE9riode : ${data.period_days} derniers jours \xB7 ${data.overall.supplier_count} fournisseur(s) actif(s)
      </div>
    `;
  } catch (e) {
    const el = document.getElementById("po-analytics-content");
    if (el) el.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
const SERVICE_POLL_INTERVAL = 8e3;
let _serviceInterval = null;
let _serviceCheckInterval = null;
let _serviceState = {
  selectedTable: null,
  tables: {},
  menu: [],
  allOrders: [],
  account: null,
  mobileTab: "tables",
  serviceActive: false,
  serviceSession: null,
  serviceConfig: null,
  tableList: []
};
async function renderServiceView() {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  _serviceState.account = getAccount();
  app.style.maxWidth = "none";
  app.style.padding = "0";
  if (nav) nav.style.display = "none";
  try {
    const [config, active] = await Promise.all([
      API.getServiceConfig(),
      API.getActiveService()
    ]);
    _serviceState.serviceConfig = config;
    _serviceState.serviceActive = !!active.session;
    _serviceState.serviceSession = active.session;
  } catch (e) {
    _serviceState.serviceConfig = {};
  }
  try {
    const tables = await API.request("/onboarding/status");
    _serviceState.tableList = tables.tables || [];
  } catch (e) {
  }
  const tableCount = _serviceState.tableList.length || 20;
  if (!_serviceState.serviceActive) {
    _svcRenderConfigScreen(app);
  } else {
    _svcRenderServiceUI(app, tableCount);
    await _svcLoadData(tableCount);
    _svcRenderTables(tableCount);
    _svcRenderMenu();
    _svcRenderTracking();
    _svcUpdateServiceMetrics();
  }
  _svcStartPolling(tableCount);
}
function _svcRenderConfigScreen(app) {
  const config = _serviceState.serviceConfig || {};
  app.innerHTML = `
    <div class="svc-config-screen">
      <header class="svc-header">
        <div class="svc-header__left">
          <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height:28px;width:auto">
          <span class="svc-header__title">Mode Service</span>
        </div>
        <div class="svc-header__right">
          <button class="btn btn-secondary btn-sm" onclick="_svcExit()">\u2190 Retour</button>
        </div>
      </header>

      <div style="max-width:480px;margin:60px auto;padding:0 var(--space-4)">
        <div style="text-align:center;margin-bottom:var(--space-8)">
          <div style="font-size:3.5rem;margin-bottom:var(--space-3)">\u{1F37D}\uFE0F</div>
          <h1 style="font-size:var(--text-2xl);margin-bottom:var(--space-2)">Mode Service</h1>
          <p style="color:var(--text-secondary)">Configurez les horaires et lancez le service. L'interface s'adapte automatiquement pour g\xE9rer les commandes en temps r\xE9el.</p>
        </div>

        <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-4)">
          <h3 style="font-size:var(--text-base);margin-bottom:var(--space-4)">Horaires du service</h3>
          <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-3)">
            <div style="flex:1">
              <label style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:4px;display:block">D\xE9but</label>
              <input type="time" class="form-control" id="svc-start-time" value="${config.service_start || "11:30"}" style="font-size:var(--text-lg);text-align:center">
            </div>
            <div style="flex:1">
              <label style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:4px;display:block">Fin</label>
              <input type="time" class="form-control" id="svc-end-time" value="${config.service_end || "14:30"}" style="font-size:var(--text-lg);text-align:center">
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="svc-save-config" style="width:100%">Enregistrer les horaires</button>
        </div>

        <button class="btn btn-primary" id="svc-start-btn" style="width:100%;padding:16px;font-size:var(--text-lg);border-radius:var(--radius-lg)">
          \u{1F680} Lancer le service
        </button>

        <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md)">
          <p style="font-size:var(--text-sm);color:var(--text-secondary);margin:0;line-height:1.6">
            <strong>Pendant le service :</strong> l'interface passe en mode plein \xE9cran avec les bons en temps r\xE9el, le suivi des tables et les m\xE9triques cl\xE9s. Le reste du logiciel reste accessible via le menu rapide.
          </p>
        </div>
      </div>
    </div>
  `;
  document.getElementById("svc-save-config").addEventListener("click", async () => {
    const start = document.getElementById("svc-start-time").value;
    const end = document.getElementById("svc-end-time").value;
    try {
      await API.updateServiceConfig({ service_start: start, service_end: end });
      showToast("Horaires enregistr\xE9s", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  });
  document.getElementById("svc-start-btn").addEventListener("click", async () => {
    const start = document.getElementById("svc-start-time").value;
    const end = document.getElementById("svc-end-time").value;
    try {
      await API.updateServiceConfig({ service_start: start, service_end: end });
      await API.startService();
      _serviceState.serviceActive = true;
      renderServiceView();
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}
function _svcRenderServiceUI(app, tableCount) {
  var _a;
  app.innerHTML = `
    <div class="svc-shell">
      <header class="svc-header">
        <div class="svc-header__left">
          <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height:28px;width:auto">
          <span class="svc-header__title">Service</span>
          <span class="svc-header__user">\u2014 ${escapeHtml(((_a = _serviceState.account) == null ? void 0 : _a.name) || "")}</span>
        </div>
        <div class="svc-header__center" id="svc-metrics-bar">
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-time">--:--</span><span class="svc-metric__label">Dur\xE9e</span></div>
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-orders">0</span><span class="svc-metric__label">Commandes</span></div>
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-pending">0</span><span class="svc-metric__label">En cours</span></div>
          <div class="svc-metric"><span class="svc-metric__val" id="svc-m-avg">0min</span><span class="svc-metric__label">Moy. ticket</span></div>
        </div>
        <div class="svc-header__right">
          <button class="svc-header__btn" id="svc-notif-btn" title="Notifications">\u{1F514} <span class="svc-notif-badge hidden" id="svc-notif-count">0</span></button>
          <button class="svc-header__btn" id="svc-quick-menu" title="Menu rapide">\u2630</button>
          <button class="svc-header__btn svc-header__btn--stop" id="svc-stop-btn" title="Fin du service">\u23F9 Fin</button>
        </div>
      </header>

      <div class="svc-mobile-tabs" id="svc-mobile-tabs">
        <button class="svc-tab active" data-tab="tables">Tables</button>
        <button class="svc-tab" data-tab="order">Commande</button>
        <button class="svc-tab" data-tab="tracking">Suivi</button>
      </div>

      <div class="svc-body">
        <div class="svc-col-left" id="svc-tables-panel">
          <h2 class="svc-section-title">Plan de salle</h2>
          <div class="svc-tables-grid" id="svc-tables-grid"></div>
          <div class="svc-tracking-section" id="svc-tracking-inline"></div>
        </div>
        <div class="svc-col-right" id="svc-order-panel">
          <div class="svc-no-table" id="svc-no-table">
            <div class="svc-no-table__icon">\u{1F37D}\uFE0F</div>
            <p>S\xE9lectionnez une table pour commencer</p>
          </div>
          <div class="svc-order-content hidden" id="svc-order-content">
            <div class="svc-order-header">
              <h2 id="svc-order-title">Table \u2014</h2>
              <button class="btn btn-danger btn-sm" id="svc-close-table-btn" title="Terminer la table">Terminer</button>
            </div>
            <div class="svc-order-cols">
              <div class="svc-menu-panel" id="svc-menu-panel">
                <h3 class="svc-section-subtitle">Menu</h3>
                <div id="svc-menu-list"></div>
              </div>
              <div class="svc-cart-panel" id="svc-cart-panel">
                <h3 class="svc-section-subtitle">Commande en cours</h3>
                <div id="svc-cart-items"></div>
                <div class="svc-cart-notes">
                  <textarea class="form-control svc-notes-input" id="svc-order-notes" rows="2" placeholder="Notes (allergies, demandes sp\xE9ciales...)"></textarea>
                </div>
                <div class="svc-cart-total" id="svc-cart-total">Total : 0,00 \u20AC</div>
                <div class="svc-cart-actions">
                  <button class="btn btn-secondary svc-action-btn" id="svc-save-btn">\u{1F4BE} Sauvegarder</button>
                  <button class="btn btn-primary svc-action-btn" id="svc-send-btn">\u{1F514} Envoyer en cuisine</button>
                </div>
                <div class="svc-table-orders" id="svc-table-orders"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="svc-col-tracking hidden" id="svc-tracking-panel">
          <h2 class="svc-section-title">Suivi des commandes</h2>
          <div id="svc-tracking-list"></div>
        </div>
      </div>
    </div>
  `;
  document.querySelectorAll(".svc-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      _serviceState.mobileTab = tab.dataset.tab;
      document.querySelectorAll(".svc-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      _svcUpdateMobileVisibility();
    });
  });
  document.getElementById("svc-stop-btn").addEventListener("click", _svcStopService);
  document.getElementById("svc-quick-menu").addEventListener("click", () => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "9999";
    overlay.innerHTML = `
      <div class="modal" style="max-width:300px;padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Menu rapide</h3>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          <a href="#/" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">\u{1F4CB} Fiches techniques</a>
          <a href="#/stock" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">\u{1F4E6} Stock</a>
          <a href="#/haccp" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">\u2705 HACCP</a>
          <a href="#/kitchen" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">\u{1F468}\u200D\u{1F373} \xC9cran cuisine</a>
          <a href="#/analytics" class="btn btn-secondary btn-sm" style="text-align:left" onclick="this.closest('.modal-overlay').remove()">\u{1F4CA} Analytics</a>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:var(--space-3)" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  });
  document.getElementById("svc-close-table-btn").addEventListener("click", _svcCloseTable);
  document.getElementById("svc-save-btn").addEventListener("click", () => _svcSaveOrder(false));
  document.getElementById("svc-send-btn").addEventListener("click", () => _svcSaveOrder(true));
}
async function _svcStopService() {
  const activeOrders = _serviceState.allOrders.filter((o) => ["envoy\xE9", "en_cours"].includes(o.status));
  const title = activeOrders.length > 0 ? `Il reste ${activeOrders.length} commande(s) en cours` : "Terminer le service ?";
  const message = activeOrders.length > 0 ? "Voulez-vous vraiment arr\xEAter le service avec des commandes en cours ?" : "Le r\xE9capitulatif du service sera affich\xE9.";
  showConfirmModal(title, message, async () => {
    try {
      const result = await API.stopService();
      _serviceState.serviceActive = false;
      _svcShowRecap(result.recap);
    } catch (e) {
      showToast(e.message, "error");
    }
  }, { confirmText: "Terminer le service", confirmClass: "btn btn-danger" });
}
function _svcShowRecap(recap) {
  const app = document.getElementById("app");
  const duration = recap.started_at && recap.ended_at ? _svcFormatDuration(new Date(recap.ended_at) - new Date(recap.started_at)) : "\u2014";
  app.innerHTML = `
    <div class="svc-config-screen">
      <header class="svc-header">
        <div class="svc-header__left">
          <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height:28px;width:auto">
          <span class="svc-header__title">R\xE9capitulatif du service</span>
        </div>
        <div class="svc-header__right">
          <button class="btn btn-secondary btn-sm" onclick="_svcExit()">\u2190 Retour</button>
        </div>
      </header>

      <div style="max-width:500px;margin:40px auto;padding:0 var(--space-4)">
        <div style="text-align:center;margin-bottom:var(--space-6)">
          <div style="font-size:3rem;margin-bottom:var(--space-2)">\u{1F3C1}</div>
          <h1 style="font-size:var(--text-2xl);margin-bottom:var(--space-1)">Service termin\xE9</h1>
          <p style="color:var(--text-secondary)">${recap.started_at ? new Date(recap.started_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : ""}</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-5)">
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${recap.total_orders || 0}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Commandes</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${recap.total_items || 0}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Plats servis</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${formatCurrency(recap.total_revenue || 0)}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Chiffre d'affaires</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-accent)">${duration}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">Dur\xE9e</div>
          </div>
        </div>

        <div style="background:var(--bg-elevated);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
          <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Performance</h3>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--border-light)">
            <span style="color:var(--text-secondary);font-size:var(--text-sm)">Temps moyen par commande</span>
            <span style="font-weight:600">${recap.avg_ticket_time_min || 0} min</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0">
            <span style="color:var(--text-secondary);font-size:var(--text-sm)">Heure de pointe</span>
            <span style="font-weight:600">${recap.peak_hour ? recap.peak_hour + "h" : "\u2014"}</span>
          </div>
        </div>

        <button class="btn btn-primary" style="width:100%;padding:14px;border-radius:var(--radius-lg)" onclick="_svcExit()">
          Retour \xE0 l'accueil
        </button>
      </div>
    </div>
  `;
}
function _svcFormatDuration(ms) {
  const totalMin = Math.floor(ms / 6e4);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}
function _svcUpdateServiceMetrics() {
  if (!_serviceState.serviceSession) return;
  const started = new Date(_serviceState.serviceSession.started_at);
  const now = /* @__PURE__ */ new Date();
  const elapsed = now - started;
  const el = document.getElementById("svc-m-time");
  if (el) el.textContent = _svcFormatDuration(elapsed);
  const totalOrders = _serviceState.allOrders.filter((o) => o.status !== "annul\xE9").length;
  const pending = _serviceState.allOrders.filter((o) => ["envoy\xE9", "en_cours"].includes(o.status)).length;
  const completed = _serviceState.allOrders.filter((o) => o.status === "termin\xE9");
  const ordersEl = document.getElementById("svc-m-orders");
  const pendingEl = document.getElementById("svc-m-pending");
  const avgEl = document.getElementById("svc-m-avg");
  if (ordersEl) ordersEl.textContent = totalOrders;
  if (pendingEl) {
    pendingEl.textContent = pending;
    pendingEl.style.color = pending > 5 ? "var(--color-danger)" : pending > 2 ? "var(--color-warning)" : "";
  }
  if (avgEl && completed.length > 0) {
    const totalMin = completed.reduce((sum, o) => {
      return sum + (new Date(o.updated_at) - new Date(o.created_at)) / 6e4;
    }, 0);
    avgEl.textContent = Math.round(totalMin / completed.length) + "min";
  }
}
function _svcStartPolling(tableCount) {
  if (_serviceInterval) clearInterval(_serviceInterval);
  _serviceInterval = setInterval(async () => {
    if (!location.hash.startsWith("#/service")) {
      _svcCleanup();
      return;
    }
    if (_serviceState.serviceActive) {
      await _svcRefreshOrders(tableCount);
      _svcUpdateServiceMetrics();
      _svcCheckAutoStop(tableCount);
    }
  }, SERVICE_POLL_INTERVAL);
}
async function _svcCheckAutoStop(tableCount) {
  const config = _serviceState.serviceConfig;
  if (!config || !config.service_end) return;
  const session = _serviceState.serviceSession;
  if (session && session.started_at) {
    const startedAt = new Date(session.started_at);
    const minRuntime = 15 * 60 * 1e3;
    if (Date.now() - startedAt.getTime() < minRuntime) return;
  }
  const now = /* @__PURE__ */ new Date();
  const [endH, endM] = config.service_end.split(":").map(Number);
  const endTime = /* @__PURE__ */ new Date();
  endTime.setHours(endH, endM, 0, 0);
  if (config.service_start) {
    const [startH, startM] = config.service_start.split(":").map(Number);
    if (endH < startH || endH === startH && endM < startM) {
      endTime.setDate(endTime.getDate() + 1);
    }
  }
  if (now > endTime) {
    const activeOrders = _serviceState.allOrders.filter(
      (o) => ["envoy\xE9", "en_cours", "pr\xEAt", "re\xE7u"].includes(o.status)
    );
    if (activeOrders.length === 0) {
      try {
        const result = await API.stopService();
        _serviceState.serviceActive = false;
        _svcShowRecap(result.recap);
      } catch (e) {
      }
    }
  }
}
function _svcCleanup() {
  if (_serviceInterval) {
    clearInterval(_serviceInterval);
    _serviceInterval = null;
  }
  if (_serviceCheckInterval) {
    clearInterval(_serviceCheckInterval);
    _serviceCheckInterval = null;
  }
  const app = document.getElementById("app");
  if (app) {
    app.style.maxWidth = "";
    app.style.padding = "";
  }
  const nav = document.getElementById("nav");
  if (nav) nav.style.display = "";
}
function _svcExit() {
  _svcCleanup();
  location.hash = "#/";
}
async function _svcLoadData(tableCount) {
  try {
    const [recipes, orders] = await Promise.all([
      API.getRecipes(),
      API.getOrders()
    ]);
    const plats = recipes.filter((r) => (r.recipe_type || "plat") === "plat");
    const grouped = {};
    const categoryOrder = ["entr\xE9e", "plat", "dessert", "boisson", "accompagnement"];
    for (const r of plats) {
      const cat = r.category || "Autres";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }
    _serviceState.menu = Object.entries(grouped).sort((a, b) => {
      const ia = categoryOrder.indexOf(a[0]);
      const ib = categoryOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    _serviceState.allOrders = orders;
    _svcBuildTableState(tableCount);
  } catch (e) {
    showToast("Erreur chargement donn\xE9es service", "error");
  }
}
async function _svcRefreshOrders(tableCount) {
  try {
    const prevStates = {};
    for (let t = 1; t <= tableCount; t++) {
      const td = _serviceState.tables[t];
      if (td) prevStates[t] = td.orders.filter((o) => o.status === "pr\xEAt").length;
    }
    _serviceState.allOrders = await API.getOrders();
    _svcBuildTableState(tableCount);
    for (let t = 1; t <= tableCount; t++) {
      const td = _serviceState.tables[t];
      if (td) {
        const readyNow = td.orders.filter((o) => o.status === "pr\xEAt").length;
        if (readyNow > (prevStates[t] || 0)) _svcNotifyReady(t);
      }
    }
    _svcRenderTables(tableCount);
    _svcRenderTracking();
    if (_serviceState.selectedTable) _svcRenderTableOrders();
  } catch (e) {
  }
}
function _svcBuildTableState(tableCount) {
  const tables = {};
  for (let t = 1; t <= tableCount; t++) {
    tables[t] = { orders: [], currentDraft: null };
  }
  for (const order of _serviceState.allOrders) {
    const tn = order.table_number;
    if (tn >= 1 && tn <= tableCount) {
      if (!tables[tn]) tables[tn] = { orders: [], currentDraft: null };
      tables[tn].orders.push(order);
      if (order.status === "en_cours") tables[tn].currentDraft = order;
    }
  }
  const prev = _serviceState.tables;
  for (let t = 1; t <= tableCount; t++) {
    if (prev[t] && prev[t]._localDraft) tables[t]._localDraft = prev[t]._localDraft;
  }
  _serviceState.tables = tables;
}
function _svcNotifyReady(tableNum) {
  showToast(`\u2705 Table ${tableNum} \u2014 Plat(s) pr\xEAt(s) !`, "success");
  if (typeof playKitchenNotificationSound === "function") playKitchenNotificationSound();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  const badge = document.getElementById("svc-notif-count");
  if (badge) {
    const current = parseInt(badge.textContent) || 0;
    badge.textContent = current + 1;
    badge.classList.remove("hidden");
  }
}
function _svcGetTableStatus(tableNum) {
  const td = _serviceState.tables[tableNum];
  if (!td) return "libre";
  const activeOrders = td.orders.filter((o) => !["termin\xE9", "annul\xE9"].includes(o.status));
  if (activeOrders.length === 0 && !td._localDraft) return "libre";
  if (td._localDraft && td._localDraft.length > 0) return "draft";
  if (activeOrders.some((o) => o.status === "en_cours")) return "draft";
  if (activeOrders.some((o) => o.status === "pr\xEAt")) return "ready";
  if (activeOrders.some((o) => {
    const elapsed = (Date.now() - new Date(o.created_at).getTime()) / 6e4;
    return o.status === "envoy\xE9" && elapsed > 20;
  })) return "late";
  if (activeOrders.some((o) => o.status === "envoy\xE9")) return "sent";
  return "libre";
}
function _svcRenderTables(tableCount) {
  var _a;
  const grid = document.getElementById("svc-tables-grid");
  if (!grid) return;
  let html = "";
  for (let t = 1; t <= tableCount; t++) {
    const status = _svcGetTableStatus(t);
    const selected = _serviceState.selectedTable === t ? " svc-table--selected" : "";
    const activeOrders = (((_a = _serviceState.tables[t]) == null ? void 0 : _a.orders) || []).filter((o) => !["termin\xE9", "annul\xE9"].includes(o.status));
    const itemCount = activeOrders.reduce((sum, o) => {
      var _a2;
      return sum + (((_a2 = o.items) == null ? void 0 : _a2.length) || 0);
    }, 0);
    let timerHtml = "";
    if (activeOrders.length > 0) {
      const oldest = activeOrders.reduce((a, b) => new Date(a.created_at) < new Date(b.created_at) ? a : b);
      const elapsed = Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 6e4);
      if (elapsed > 0) {
        const timerColor = elapsed > 20 ? "var(--color-danger)" : elapsed > 10 ? "var(--color-warning)" : "var(--text-tertiary)";
        timerHtml = `<span class="svc-table-timer" style="color:${timerColor}">${elapsed}\u2032</span>`;
      }
    }
    html += `
      <button class="svc-table-btn svc-table--${status}${selected}" data-table="${t}">
        <span class="svc-table-num">${t}</span>
        ${itemCount > 0 ? `<span class="svc-table-count">${itemCount}</span>` : ""}
        ${timerHtml}
        <span class="svc-table-status">${_svcStatusIcon(status)}</span>
      </button>
    `;
  }
  grid.innerHTML = html;
  grid.querySelectorAll(".svc-table-btn").forEach((btn) => {
    btn.addEventListener("click", () => _svcSelectTable(parseInt(btn.dataset.table), tableCount));
  });
}
function _svcStatusIcon(status) {
  switch (status) {
    case "libre":
      return "";
    case "draft":
      return "\u{1F4DD}";
    case "sent":
      return "\u{1F535}";
    case "ready":
      return "\u2705";
    case "late":
      return "\u{1F534}";
    default:
      return "";
  }
}
function _svcSelectTable(tableNum) {
  var _a;
  _serviceState.selectedTable = tableNum;
  const tableCount = Object.keys(_serviceState.tables).length;
  _svcRenderTables(tableCount);
  const noTable = document.getElementById("svc-no-table");
  const content = document.getElementById("svc-order-content");
  if (noTable) noTable.classList.add("hidden");
  if (content) content.classList.remove("hidden");
  document.getElementById("svc-order-title").textContent = `Table ${tableNum}`;
  const td = _serviceState.tables[tableNum];
  if (!td._localDraft) {
    if (td.currentDraft && td.currentDraft.items) {
      td._localDraft = td.currentDraft.items.map((it) => ({
        recipe_id: it.recipe_id,
        name: it.recipe_name,
        price: it.selling_price || 0,
        quantity: it.quantity,
        notes: it.notes || ""
      }));
    } else {
      td._localDraft = [];
    }
  }
  const notesEl = document.getElementById("svc-order-notes");
  if (notesEl) notesEl.value = ((_a = td.currentDraft) == null ? void 0 : _a.notes) || "";
  _svcRenderCart();
  _svcRenderTableOrders();
  if (window.innerWidth < 768) {
    _serviceState.mobileTab = "order";
    document.querySelectorAll(".svc-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "order"));
    _svcUpdateMobileVisibility();
  }
}
function _svcRenderMenu() {
  const el = document.getElementById("svc-menu-list");
  if (!el) return;
  if (_serviceState.menu.length === 0) {
    el.innerHTML = '<p class="text-muted" style="padding:16px">Aucun plat au menu.</p>';
    return;
  }
  const emojis = { "entr\xE9e": "\u{1F957}", "plat": "\u{1F37D}\uFE0F", "dessert": "\u{1F370}", "boisson": "\u{1F942}", "accompagnement": "\u{1F96C}", "Autres": "\u{1F4CB}" };
  let html = "";
  for (const [cat, items] of _serviceState.menu) {
    const emoji = emojis[cat] || "\u{1F4CB}";
    html += `<div class="svc-menu-category"><h4 class="svc-menu-cat-title">${emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</h4><div class="svc-menu-items">`;
    for (const item of items) {
      html += `
        <button class="svc-menu-item" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-price="${item.selling_price || 0}">
          <span class="svc-menu-item__name">${escapeHtml(item.name)}</span>
          <span class="svc-menu-item__price">${item.selling_price ? formatCurrency(item.selling_price) : "\u2014"}</span>
          <span class="svc-menu-item__add">+</span>
        </button>
      `;
    }
    html += "</div></div>";
  }
  el.innerHTML = html;
  el.querySelectorAll(".svc-menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!_serviceState.selectedTable) {
        showToast("S\xE9lectionnez une table", "error");
        return;
      }
      _svcAddItem(parseInt(btn.dataset.id), btn.dataset.name, parseFloat(btn.dataset.price));
    });
  });
}
function _svcAddItem(recipeId, name, price) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft;
  const existing = draft.find((i) => i.recipe_id === recipeId);
  if (existing) {
    existing.quantity++;
  } else {
    draft.push({ recipe_id: recipeId, name, price, quantity: 1, notes: "" });
  }
  _svcRenderCart();
  _svcRenderTables(Object.keys(_serviceState.tables).length);
}
function _svcChangeQty(recipeId, delta) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft;
  const item = draft.find((i) => i.recipe_id === recipeId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) _serviceState.tables[tn]._localDraft = draft.filter((i) => i.recipe_id !== recipeId);
  _svcRenderCart();
  _svcRenderTables(Object.keys(_serviceState.tables).length);
}
function _svcRemoveItem(recipeId) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  _serviceState.tables[tn]._localDraft = _serviceState.tables[tn]._localDraft.filter((i) => i.recipe_id !== recipeId);
  _svcRenderCart();
  _svcRenderTables(Object.keys(_serviceState.tables).length);
}
function _svcRenderCart() {
  const el = document.getElementById("svc-cart-items");
  const totalEl = document.getElementById("svc-cart-total");
  const tn = _serviceState.selectedTable;
  if (!el || !tn) return;
  const draft = _serviceState.tables[tn]._localDraft || [];
  if (draft.length === 0) {
    el.innerHTML = '<p class="text-muted svc-empty-cart">Aucun plat ajout\xE9</p>';
    totalEl.textContent = "Total : 0,00 \u20AC";
    return;
  }
  let total = 0;
  el.innerHTML = draft.map((item) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    return `
      <div class="svc-cart-item">
        <span class="svc-cart-item__qty">${item.quantity}\xD7</span>
        <span class="svc-cart-item__name">${escapeHtml(item.name)}</span>
        <span class="svc-cart-item__price">${formatCurrency(subtotal)}</span>
        <div class="svc-cart-item__actions">
          <button class="svc-qty-btn" onclick="_svcChangeQty(${item.recipe_id}, -1)">\u2212</button>
          <button class="svc-qty-btn" onclick="_svcChangeQty(${item.recipe_id}, 1)">+</button>
          <button class="svc-qty-btn svc-qty-btn--delete" onclick="_svcRemoveItem(${item.recipe_id})">\u{1F5D1}\uFE0F</button>
        </div>
      </div>
    `;
  }).join("");
  totalEl.textContent = `Total : ${formatCurrency(total)}`;
}
async function _svcSaveOrder(sendImmediately) {
  var _a, _b, _c;
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft || [];
  if (draft.length === 0) {
    showToast("Ajoutez au moins un plat", "error");
    return;
  }
  const notes = ((_b = (_a = document.getElementById("svc-order-notes")) == null ? void 0 : _a.value) == null ? void 0 : _b.trim()) || null;
  const td = _serviceState.tables[tn];
  try {
    if (td.currentDraft) await API.cancelOrder(td.currentDraft.id);
    const order = await API.createOrder({
      table_number: tn,
      notes,
      items: draft.map((i) => ({ recipe_id: i.recipe_id, quantity: i.quantity, notes: i.notes || null }))
    });
    if (sendImmediately) {
      const result = await API.sendOrder(order.id);
      if (((_c = result.warnings) == null ? void 0 : _c.length) > 0) showToast(`\u26A0\uFE0F Stock insuffisant pour ${result.warnings.length} ingr\xE9dient(s)`, "info");
      showToast(`Table ${tn} \u2014 Commande envoy\xE9e en cuisine !`, "success");
      _serviceState.tables[tn]._localDraft = [];
    } else {
      showToast(`Table ${tn} \u2014 Commande sauvegard\xE9e`, "success");
      _serviceState.tables[tn]._localDraft = null;
    }
    const tableCount = Object.keys(_serviceState.tables).length;
    await _svcRefreshOrders(tableCount);
    if (_serviceState.selectedTable === tn) _svcSelectTable(tn);
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function _svcCloseTable() {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const td = _serviceState.tables[tn];
  const activeOrders = td.orders.filter((o) => !["termin\xE9", "annul\xE9"].includes(o.status));
  if (activeOrders.length === 0 && (!td._localDraft || td._localDraft.length === 0)) {
    showToast("Cette table est d\xE9j\xE0 libre", "info");
    return;
  }
  showConfirmModal(`Terminer la table ${tn} ?`, `${activeOrders.length} commande(s) seront marqu\xE9es comme termin\xE9es.`, async () => {
    var _a, _b;
    try {
      for (const order of activeOrders) await API.closeOrder(order.id);
      _serviceState.tables[tn]._localDraft = [];
      showToast(`Table ${tn} termin\xE9e`, "success");
      _serviceState.selectedTable = null;
      (_a = document.getElementById("svc-no-table")) == null ? void 0 : _a.classList.remove("hidden");
      (_b = document.getElementById("svc-order-content")) == null ? void 0 : _b.classList.add("hidden");
      await _svcRefreshOrders(Object.keys(_serviceState.tables).length);
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  }, { confirmText: "Terminer", confirmClass: "btn btn-primary" });
}
function _svcRenderTableOrders() {
  const el = document.getElementById("svc-table-orders");
  const tn = _serviceState.selectedTable;
  if (!el || !tn) return;
  const td = _serviceState.tables[tn];
  const sentOrders = td.orders.filter((o) => ["envoy\xE9", "pr\xEAt"].includes(o.status));
  if (sentOrders.length === 0) {
    el.innerHTML = "";
    return;
  }
  let html = '<h4 class="svc-section-subtitle" style="margin-top:16px">Commandes envoy\xE9es</h4>';
  for (const order of sentOrders) {
    const readyCls = order.status === "pr\xEAt" ? "svc-sent-order--ready" : "";
    const badgeCls = order.status === "pr\xEAt" ? "badge-success" : "badge-info";
    const badgeLabel = order.status === "pr\xEAt" ? "\u2705 Pr\xEAt" : "\u23F3 En cuisine";
    html += `<div class="svc-sent-order ${readyCls}">
      <div class="svc-sent-order__header">
        <span class="badge ${badgeCls}">${badgeLabel}</span>
        <span class="svc-sent-order__time">${getElapsedTime(order.created_at)}</span>
      </div>`;
    for (const item of order.items) {
      html += `<div class="svc-sent-item"><span>${item.quantity}\xD7 ${escapeHtml(item.recipe_name)}</span><span class="svc-sent-item__status">${getItemStatusIcon(item.status)}</span></div>`;
    }
    if (order.status === "pr\xEAt") {
      html += `<button class="btn btn-primary btn-sm svc-served-btn" onclick="_svcMarkServed(${order.id})">\u{1F37D}\uFE0F Marquer servi</button>`;
    }
    html += "</div>";
  }
  el.innerHTML = html;
}
async function _svcMarkServed(orderId) {
  try {
    await API.closeOrder(orderId);
    showToast("Commande marqu\xE9e comme servie", "success");
    await _svcRefreshOrders(Object.keys(_serviceState.tables).length);
    if (_serviceState.selectedTable) _svcRenderTableOrders();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
function _svcRenderTracking() {
  const el = document.getElementById("svc-tracking-list");
  const inlineEl = document.getElementById("svc-tracking-inline");
  if (!el) return;
  const activeOrders = _serviceState.allOrders.filter((o) => ["envoy\xE9", "pr\xEAt"].includes(o.status));
  activeOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let html = "";
  if (activeOrders.length === 0) {
    html = '<div class="svc-empty-tracking"><p class="text-muted">Aucune commande en cours</p></div>';
  } else {
    for (const order of activeOrders) {
      const elapsed = getElapsedTime(order.created_at);
      const isReady = order.status === "pr\xEAt";
      const isLate = !isReady && Date.now() - new Date(order.created_at).getTime() > 20 * 6e4;
      const cardCls = isReady ? "svc-track-card--ready" : isLate ? "svc-track-card--late" : "";
      const badgeCls = isReady ? "badge-success" : isLate ? "badge--danger" : "badge-info";
      const badgeTxt = isReady ? "\u2705 Pr\xEAt" : isLate ? "\u26A0\uFE0F En retard" : "\u23F3 En cuisine";
      html += `<div class="svc-track-card ${cardCls}">
        <div class="svc-track-card__header">
          <span class="svc-track-card__table" onclick="_svcSelectTable(${order.table_number})">Table ${order.table_number}</span>
          <span class="svc-track-card__time">${elapsed}</span>
          <span class="badge ${badgeCls}">${badgeTxt}</span>
        </div>
        <div class="svc-track-card__items">`;
      for (const it of order.items) {
        html += `<span class="svc-track-item">${it.quantity}\xD7 ${escapeHtml(it.recipe_name)} ${getItemStatusIcon(it.status)}</span>`;
      }
      html += "</div>";
      if (isReady) html += `<button class="btn btn-primary btn-sm" onclick="_svcMarkServed(${order.id})" style="margin-top:8px">\u{1F37D}\uFE0F Servi</button>`;
      html += "</div>";
    }
  }
  el.innerHTML = html;
  if (inlineEl) {
    inlineEl.innerHTML = activeOrders.length > 0 ? `<h3 class="svc-section-subtitle" style="margin-top:20px">Suivi rapide</h3>${html}` : "";
  }
}
function _svcUpdateMobileVisibility() {
  const tables = document.getElementById("svc-tables-panel");
  const order = document.getElementById("svc-order-panel");
  const tracking = document.getElementById("svc-tracking-panel");
  if (!tables || !order || !tracking) return;
  if (window.innerWidth >= 768) {
    tables.classList.remove("hidden");
    order.classList.remove("hidden");
    tracking.classList.add("hidden");
    return;
  }
  tables.classList.toggle("hidden", _serviceState.mobileTab !== "tables");
  order.classList.toggle("hidden", _serviceState.mobileTab !== "order");
  tracking.classList.toggle("hidden", _serviceState.mobileTab !== "tracking");
}
window.addEventListener("resize", _svcUpdateMobileVisibility);
let kitchenRefreshInterval = null;
let _kitchenPrevOrderIds = null;
async function renderKitchenView() {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  app.style.maxWidth = "none";
  app.style.padding = "0";
  if (nav) nav.style.display = "none";
  app.innerHTML = `
    <div class="kitchen-shell">
      <header class="kitchen-header">
        <div class="kitchen-header__left">
          <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 28px; width: auto;">
          <span class="kitchen-header__title">Cuisine</span>
        </div>
        <div class="kitchen-header__right">
          <span class="kitchen-header__clock" id="kitchen-clock"></span>
          <button class="btn btn-secondary btn-sm" aria-label="Rafra\xEEchir" onclick="renderKitchenView()"><i data-lucide="refresh-cw" style="width:16px;height:16px"></i></button>
          <button class="btn btn-secondary btn-sm" onclick="_kitchenExit()">Quitter</button>
        </div>
      </header>
      <div class="kitchen-body" id="kitchen-tickets">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  if (kitchenRefreshInterval) {
    clearInterval(kitchenRefreshInterval);
    kitchenRefreshInterval = null;
  }
  _kitchenPrevOrderIds = null;
  await loadKitchenTickets();
  _kitchenUpdateClock();
  kitchenRefreshInterval = setInterval(async () => {
    if (location.hash === "#/kitchen") {
      await loadKitchenTickets();
      _kitchenUpdateClock();
    } else {
      clearInterval(kitchenRefreshInterval);
      kitchenRefreshInterval = null;
      app.style.maxWidth = "";
      app.style.padding = "";
      if (nav) nav.style.display = "";
    }
  }, 1e4);
}
function _kitchenUpdateClock() {
  const el = document.getElementById("kitchen-clock");
  if (!el) return;
  const now = /* @__PURE__ */ new Date();
  el.textContent = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function _kitchenExit() {
  if (kitchenRefreshInterval) {
    clearInterval(kitchenRefreshInterval);
    kitchenRefreshInterval = null;
  }
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  if (app) {
    app.style.maxWidth = "";
    app.style.padding = "";
  }
  if (nav) nav.style.display = "";
  location.hash = "#/";
}
async function loadKitchenTickets() {
  let orders = [];
  try {
    orders = await API.getOrders();
    orders = orders.filter((o) => o.status === "envoy\xE9" || o.status === "pr\xEAt");
    orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } catch (e) {
    return;
  }
  const currentIds = new Set(orders.map((o) => o.id));
  if (_kitchenPrevOrderIds !== null) {
    const hasNewOrders = orders.some((o) => !_kitchenPrevOrderIds.has(o.id));
    if (hasNewOrders) {
      _kitchenPlaySound();
    }
  }
  _kitchenPrevOrderIds = currentIds;
  const el = document.getElementById("kitchen-tickets");
  if (!el) return;
  if (orders.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding-top:120px">
        <div class="empty-icon" style="font-size:4rem">\u2705</div>
        <h3>Pas de commande en attente</h3>
        <p>Les nouvelles commandes appara\xEEtront ici automatiquement.</p>
      </div>
    `;
    return;
  }
  el.innerHTML = `<div class="kitchen-grid">${orders.map((order) => {
    const elapsed = _kitchenElapsed(order.created_at);
    const isReady = order.status === "pr\xEAt";
    const isLate = !isReady && Date.now() - new Date(order.created_at).getTime() > 20 * 6e4;
    return `
      <div class="kitchen-ticket ${isReady ? "kitchen-ticket--ready" : ""} ${isLate ? "kitchen-ticket--late" : ""}">
        <div class="kitchen-ticket__header">
          <span class="kitchen-ticket__table">Table ${order.table_number}</span>
          <span class="kitchen-ticket__id">#${order.id}</span>
          <span class="kitchen-ticket__timer ${isLate ? "kitchen-ticket__timer--late" : ""}">${elapsed}</span>
        </div>
        ${order.notes ? `<div class="kitchen-ticket__notes">\u{1F4CC} ${escapeHtml(order.notes)}</div>` : ""}
        <div class="kitchen-ticket__items">
          ${order.items.map((item) => {
      const itemStatusClass = item.status === "pr\xEAt" ? "kitchen-item--ready" : item.status === "en_pr\xE9paration" ? "kitchen-item--cooking" : "";
      return `
              <div class="kitchen-item ${itemStatusClass}">
                <span class="kitchen-item__qty">${item.quantity}\xD7</span>
                <span class="kitchen-item__name">${escapeHtml(item.recipe_name)}</span>
                ${item.notes ? `<span class="kitchen-item__notes">(${escapeHtml(item.notes)})</span>` : ""}
                <div class="kitchen-item__actions">
                  ${item.status === "en_attente" ? `<button class="btn btn-sm btn-secondary" onclick="updateKitchenItem(${order.id}, ${item.id}, 'en_pr\xE9paration')">\u{1F525} Pr\xE9p.</button>` : ""}
                  ${item.status === "en_pr\xE9paration" ? `<button class="btn btn-sm btn-primary" onclick="updateKitchenItem(${order.id}, ${item.id}, 'pr\xEAt')">\u2705 Pr\xEAt</button>` : ""}
                  ${item.status === "pr\xEAt" ? `<span class="badge badge-success">\u2705 Pr\xEAt</span>` : ""}
                </div>
              </div>
            `;
    }).join("")}
        </div>
        ${isReady ? `<div class="kitchen-ticket__footer"><span class="badge badge-success" style="font-size:1rem;padding:6px 12px">\u2705 Tout est pr\xEAt \u2014 En attente service</span></div>` : ""}
      </div>
    `;
  }).join("")}</div>`;
}
async function updateKitchenItem(orderId, itemId, status) {
  try {
    await API.updateOrderItem(orderId, itemId, { status });
    await loadKitchenTickets();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
function _kitchenPlaySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1e3;
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.15);
    }, 200);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) {
  }
}
function playKitchenNotificationSound() {
  _kitchenPlaySound();
}
function _kitchenElapsed(createdAt) {
  const now = /* @__PURE__ */ new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 6e4);
  if (diffMin < 1) return "\xC0 l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h${mins > 0 ? String(mins).padStart(2, "0") : ""}`;
}
async function renderAnalytics() {
  const app = document.getElementById("app");
  const account = getAccount();
  const isGerant = account && account.role === "gerant";
  const perms = account ? typeof account.permissions === "string" ? JSON.parse(account.permissions || "{}") : account.permissions || {} : {};
  const canView = isGerant || perms.view_costs;
  if (!canView) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">\u{1F512}</div>
        <p>Acc\xE8s r\xE9serv\xE9 au g\xE9rant</p>
        <a href="#/" class="btn btn-primary">Retour</a>
      </div>
    `;
    return;
  }
  app.innerHTML = `
    <div class="view-header">
      <h1>\u{1F4CA} Analytics</h1>
      <p class="text-secondary">Vue d'ensemble \xB7 Food cost \xB7 Stock \xB7 HACCP \xB7 IA</p>
    </div>
    <div class="analytics-loading">
      <div class="spinner"></div>
      <p class="text-secondary">Calcul des m\xE9triques\u2026</p>
    </div>
  `;
  try {
    const [kpis, foodCost, stockData, pricesData, haccpData, insightsData] = await Promise.all([
      API.getAnalyticsKPIs(),
      API.getAnalyticsFoodCost(),
      API.getAnalyticsStock(),
      API.getAnalyticsPrices(),
      API.getAnalyticsHACCP(),
      API.getAnalyticsInsights()
    ]);
    renderAnalyticsDashboard(kpis, foodCost, stockData, pricesData, haccpData, insightsData);
  } catch (e) {
    console.error("Analytics error:", e);
    app.innerHTML = `
      <div class="view-header">
        <h1>\u{1F4CA} Analytics</h1>
      </div>
      <div class="empty-state">
        <div class="empty-icon">\u26A0\uFE0F</div>
        <p>Erreur de chargement</p>
        <p class="text-secondary text-sm">${escapeHtml(e.message)}</p>
        <button class="btn btn-primary" onclick="renderAnalytics()">R\xE9essayer</button>
      </div>
    `;
  }
}
function renderAnalyticsDashboard(kpis, foodCost, stockData, pricesData, haccpData, insightsData) {
  const app = document.getElementById("app");
  const haccpTemp = kpis.haccp_compliance_today.temperatures;
  const haccpClean = kpis.haccp_compliance_today.cleaning;
  const haccpPct = haccpTemp.total + haccpClean.total > 0 ? Math.round((haccpTemp.done + haccpClean.done) / (haccpTemp.total + haccpClean.total) * 100) : 100;
  const activeAlerts = kpis.low_stock_count + (haccpData.alerts_count_7d || 0);
  const fcClass = kpis.avg_food_cost_pct < 30 ? "kpi--success" : kpis.avg_food_cost_pct <= 35 ? "kpi--warning" : "kpi--danger";
  app.innerHTML = `
    <div class="view-header">
      <h1>\u{1F4CA} Analytics</h1>
      <p class="text-secondary">Vue d'ensemble de votre \xE9tablissement</p>
    </div>

    <!-- KPIs -->
    <div class="analytics-kpis">
      <div class="kpi-card ${fcClass} anim-fadeIn" style="--delay:0">
        <div class="kpi-icon">\u{1F4CA}</div>
        <div class="kpi-value font-mono">${kpis.avg_food_cost_pct}%</div>
        <div class="kpi-label">Food Cost moyen</div>
        <div class="kpi-detail">${kpis.total_recipes} recettes</div>
      </div>
      <div class="kpi-card anim-fadeIn" style="--delay:1">
        <div class="kpi-icon">\u{1F4B0}</div>
        <div class="kpi-value font-mono">${formatCurrency(kpis.total_stock_value)}</div>
        <div class="kpi-label">Valeur du stock</div>
        <div class="kpi-detail">${kpis.low_stock_count} alerte${kpis.low_stock_count > 1 ? "s" : ""}</div>
      </div>
      <div class="kpi-card ${haccpPct >= 90 ? "kpi--success" : haccpPct >= 70 ? "kpi--warning" : "kpi--danger"} anim-fadeIn" style="--delay:2">
        <div class="kpi-icon">\u{1F321}\uFE0F</div>
        <div class="kpi-value font-mono">${haccpPct}%</div>
        <div class="kpi-label">Conformit\xE9 HACCP</div>
        <div class="kpi-detail">${haccpTemp.done}/${haccpTemp.total} temp \xB7 ${haccpClean.done}/${haccpClean.total} nett.</div>
      </div>
      <div class="kpi-card ${activeAlerts > 0 ? "kpi--danger" : "kpi--success"} anim-fadeIn" style="--delay:3">
        <div class="kpi-icon">\u26A0\uFE0F</div>
        <div class="kpi-value font-mono">${activeAlerts}</div>
        <div class="kpi-label">Alertes actives</div>
        <div class="kpi-detail">${kpis.price_changes_30d} chgmt prix/30j</div>
      </div>
    </div>

    <!-- Section 1: Food Cost -->
    <section class="analytics-section anim-fadeIn" style="--delay:4">
      <h2>\u{1F37D}\uFE0F Food Cost par recette</h2>
      ${foodCost.best_margin ? `
      <div class="analytics-highlights">
        <div class="highlight highlight--success">
          <span class="highlight-label">Meilleure marge</span>
          <span class="highlight-value">${escapeHtml(foodCost.best_margin.name)} \u2014 ${foodCost.best_margin.margin_pct}%</span>
        </div>
        <div class="highlight highlight--danger">
          <span class="highlight-label">Pire marge</span>
          <span class="highlight-value">${escapeHtml(foodCost.worst_margin.name)} \u2014 ${foodCost.worst_margin.margin_pct}%</span>
        </div>
      </div>
      ` : ""}
      <div class="analytics-distribution">
        <span class="dist-chip dist-chip--success">&lt;25% : ${foodCost.distribution.under_25}</span>
        <span class="dist-chip dist-chip--ok">25-30% : ${foodCost.distribution["25_30"]}</span>
        <span class="dist-chip dist-chip--warning">30-35% : ${foodCost.distribution["30_35"]}</span>
        <span class="dist-chip dist-chip--danger">&gt;35% : ${foodCost.distribution.over_35}</span>
      </div>
      <div class="food-cost-table">
        ${foodCost.recipes.length === 0 ? '<p class="text-secondary text-sm">Aucune recette avec prix de vente</p>' : foodCost.recipes.filter((r) => r.food_cost_pct !== null).sort((a, b) => b.food_cost_pct - a.food_cost_pct).map((r) => {
    const barColor = r.food_cost_pct < 25 ? "var(--color-success)" : r.food_cost_pct < 30 ? "#2D8B55" : r.food_cost_pct < 35 ? "var(--color-warning)" : "var(--color-danger)";
    return `
              <div class="fc-row">
                <div class="fc-name">${escapeHtml(r.name)}</div>
                <div class="fc-bar-wrap">
                  <div class="fc-bar" style="width:${Math.min(r.food_cost_pct, 100)}%;background:${barColor}"></div>
                </div>
                <div class="fc-pct font-mono ${r.food_cost_pct > 35 ? "text-danger" : r.food_cost_pct > 30 ? "text-warning" : ""}">${r.food_cost_pct}%</div>
                <div class="fc-cost font-mono">${formatCurrency(r.cost)} \u2192 ${formatCurrency(r.selling_price)}</div>
              </div>`;
  }).join("")}
      </div>
    </section>

    <!-- Section 2: Stock -->
    <section class="analytics-section anim-fadeIn" style="--delay:5">
      <h2>\u{1F4E6} Stock</h2>
      <div class="analytics-row">
        <div class="analytics-col">
          <h3>Valeur par cat\xE9gorie</h3>
          <div class="css-chart-h">
            ${stockData.categories.length === 0 ? '<p class="text-secondary text-sm">Aucune donn\xE9e</p>' : (() => {
    const maxVal = Math.max(...stockData.categories.map((c) => c.value), 1);
    return stockData.categories.map((c) => `
                  <div class="bar-h-row">
                    <span class="bar-h-label">${escapeHtml(c.name)}</span>
                    <div class="bar-h-track">
                      <div class="bar-h-fill" style="width:${c.value / maxVal * 100}%"></div>
                    </div>
                    <span class="bar-h-val font-mono">${formatCurrency(c.value)}</span>
                  </div>
                `).join("");
  })()}
          </div>
        </div>
        <div class="analytics-col">
          <h3>Top 5 consomm\xE9s (30j)</h3>
          ${stockData.top_consumed.length === 0 ? '<p class="text-secondary text-sm">Aucun mouvement</p>' : `<div class="top-consumed-list">${stockData.top_consumed.map((t, i) => `
              <div class="consumed-item">
                <span class="consumed-rank">${i + 1}.</span>
                <span class="consumed-name">${escapeHtml(t.name)}</span>
                <span class="consumed-qty font-mono">${t.quantity}</span>
              </div>
            `).join("")}</div>`}
          ${stockData.alerts.length > 0 ? `
          <h3 style="margin-top:var(--space-4)">\u26A0\uFE0F Alertes stock bas</h3>
          <div class="stock-alerts-list">
            ${stockData.alerts.slice(0, 5).map((a) => `
              <div class="stock-alert-item stock-alert--${a.urgency}">
                <span>${escapeHtml(a.name)}</span>
                <span class="font-mono">${a.current} / ${a.minimum}</span>
              </div>
            `).join("")}
          </div>
          ` : ""}
        </div>
      </div>
      <div class="movements-summary">
        <span class="mvt-chip">\u{1F4E5} ${stockData.movements_summary.receptions} r\xE9ceptions</span>
        <span class="mvt-chip">\u{1F4E4} ${stockData.movements_summary.losses} pertes</span>
        <span class="mvt-chip">\u{1F527} ${stockData.movements_summary.adjustments} ajustements</span>
      </div>
    </section>

    <!-- Section 3: Prix Fournisseurs -->
    <section class="analytics-section anim-fadeIn" style="--delay:6">
      <h2>\u{1F4B2} Prix Fournisseurs</h2>
      <div class="analytics-row">
        <div class="analytics-col">
          <div class="inflation-indicator ${pricesData.inflation_30d > 0 ? "inflation--up" : pricesData.inflation_30d < 0 ? "inflation--down" : ""}">
            <span class="inflation-label">Inflation 30j</span>
            <span class="inflation-value font-mono">${pricesData.inflation_30d > 0 ? "+" : ""}${pricesData.inflation_30d}%</span>
          </div>
          <h3>Changements r\xE9cents</h3>
          ${pricesData.recent_changes.length === 0 ? '<p class="text-secondary text-sm">Aucun changement</p>' : `<div class="price-changes-list">${pricesData.recent_changes.slice(0, 8).map((c) => `
              <div class="price-change-item">
                <div class="pc-product">${escapeHtml(c.product)}</div>
                <div class="pc-supplier text-secondary text-sm">${escapeHtml(c.supplier || "")}</div>
                <div class="pc-change font-mono ${c.change_pct > 0 ? "text-danger" : "text-success"}">
                  ${c.change_pct > 0 ? "\u2191" : "\u2193"} ${Math.abs(c.change_pct)}%
                </div>
              </div>
            `).join("")}</div>`}
        </div>
        <div class="analytics-col">
          <h3>\u{1F4A1} Suggestions d'\xE9conomies</h3>
          ${pricesData.suggestions.length === 0 ? '<p class="text-secondary text-sm">Aucune suggestion</p>' : `<div class="savings-list">${pricesData.suggestions.slice(0, 5).map((s) => `
              <div class="savings-item">
                <div class="savings-product">${escapeHtml(s.product)}</div>
                <div class="savings-detail text-sm">
                  ${escapeHtml(s.current_supplier)} (${formatCurrency(s.current_price)})
                  \u2192 ${escapeHtml(s.cheaper_supplier)} (${formatCurrency(s.cheaper_price)})
                </div>
                <div class="savings-pct font-mono text-success">-${s.savings_pct}%</div>
              </div>
            `).join("")}</div>`}
        </div>
      </div>
    </section>

    <!-- Section 4: HACCP -->
    <section class="analytics-section anim-fadeIn" style="--delay:7">
      <h2>\u{1F6E1}\uFE0F HACCP Compliance</h2>
      <div class="analytics-row">
        <div class="analytics-col">
          <h3>Conformit\xE9 7 jours</h3>
          <div class="compliance-bars">
            <div class="compliance-row">
              <span class="compliance-label">Temp\xE9ratures</span>
              <div class="compliance-track">
                <div class="compliance-fill ${haccpData.temperature_compliance_7d >= 90 ? "fill--success" : haccpData.temperature_compliance_7d >= 70 ? "fill--warning" : "fill--danger"}" style="width:${haccpData.temperature_compliance_7d}%"></div>
              </div>
              <span class="compliance-val font-mono">${haccpData.temperature_compliance_7d}%</span>
            </div>
            <div class="compliance-row">
              <span class="compliance-label">Nettoyage</span>
              <div class="compliance-track">
                <div class="compliance-fill ${haccpData.cleaning_compliance_7d >= 90 ? "fill--success" : haccpData.cleaning_compliance_7d >= 70 ? "fill--warning" : "fill--danger"}" style="width:${haccpData.cleaning_compliance_7d}%"></div>
              </div>
              <span class="compliance-val font-mono">${haccpData.cleaning_compliance_7d}%</span>
            </div>
          </div>
          ${haccpData.alerts_count_7d > 0 ? `<p class="text-danger text-sm" style="margin-top:var(--space-2)">\u26A0\uFE0F ${haccpData.alerts_count_7d} alerte(s) temp\xE9rature sur 7j</p>` : ""}
        </div>
        <div class="analytics-col">
          <h3>7 derniers jours</h3>
          <div class="haccp-mini-chart">
            ${haccpData.daily_scores.slice(-7).map((d) => {
    const score = d.temp_score !== null ? d.temp_score : d.cleaning_score !== null ? d.cleaning_score : 0;
    const avg = [d.temp_score, d.cleaning_score].filter((s) => s !== null);
    const avgScore = avg.length > 0 ? Math.round(avg.reduce((a, b) => a + b, 0) / avg.length) : 0;
    const barClass = avgScore >= 90 ? "bar-v--success" : avgScore >= 70 ? "bar-v--warning" : "bar-v--danger";
    const day = new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" }).substring(0, 3);
    return `
                <div class="bar-v-col">
                  <div class="bar-v-track">
                    <div class="bar-v-fill ${barClass}" style="height:${avgScore}%"></div>
                  </div>
                  <span class="bar-v-label">${day}</span>
                </div>
              `;
  }).join("")}
          </div>
        </div>
      </div>
    </section>

    <!-- Section 5: AI Insights -->
    <section class="analytics-section analytics-section--ai anim-fadeIn" style="--delay:8">
      <div class="ai-section-header">
        <h2>\u{1F9E0} Insights IA</h2>
        <button class="btn btn-secondary btn-sm" id="refresh-insights-btn" onclick="refreshInsights()">
          <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Actualiser
        </button>
      </div>
      ${insightsData.cached_at ? `<p class="text-secondary text-sm" id="insights-timestamp">Derni\xE8re analyse : ${formatTimeAgo(insightsData.cached_at)}</p>` : ""}
      <div class="ai-insights-grid" id="ai-insights-grid">
        ${renderInsightCards(insightsData.insights)}
      </div>
    </section>
  `;
  if (window.lucide) lucide.createIcons();
}
function renderInsightCards(insights) {
  if (!insights || insights.length === 0) {
    return '<p class="text-secondary">Aucun insight disponible</p>';
  }
  return insights.map((insight) => {
    const iconMap = { info: "\u2139\uFE0F", warning: "\u26A0\uFE0F", danger: "\u{1F6A8}" };
    const severityClass = insight.severity || "info";
    return `
      <div class="insight-card insight-card--${severityClass}">
        <div class="insight-icon">${iconMap[severityClass] || "\u2139\uFE0F"}</div>
        <div class="insight-content">
          <span class="insight-type">${escapeHtml(insight.type || "")}</span>
          <p class="insight-message">${escapeHtml(insight.message)}</p>
        </div>
      </div>
    `;
  }).join("");
}
async function refreshInsights() {
  const btn = document.getElementById("refresh-insights-btn");
  const grid = document.getElementById("ai-insights-grid");
  const timestamp = document.getElementById("insights-timestamp");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite"></i> Analyse\u2026';
  }
  try {
    const data = await API.getAnalyticsInsights(true);
    if (grid) grid.innerHTML = renderInsightCards(data.insights);
    if (timestamp) timestamp.textContent = `Derni\xE8re analyse : \xE0 l'instant`;
    showToast("Insights actualis\xE9s", "success");
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Actualiser';
      if (window.lucide) lucide.createIcons();
    }
  }
}
function formatTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 6e4);
  if (minutes < 1) return "\xE0 l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}
async function renderHealthDashboard() {
  const app = document.getElementById("app");
  const perms = getPermissions();
  if (!perms.view_costs) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">\u{1F512}</div>
        <p>Acc\xE8s r\xE9serv\xE9 au g\xE9rant</p>
        <a href="#/" class="btn btn-primary">Retour</a>
      </div>
    `;
    return;
  }
  app.innerHTML = `
    <div class="view-header">
      <a href="#/" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-2);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Accueil
      </a>
      <h1>\u{1F3E5} Sant\xE9 du restaurant</h1>
      <p class="text-secondary">Vue d'ensemble de la performance op\xE9rationnelle</p>
    </div>
    <div id="health-content">
      <div class="skeleton skeleton-card" style="height:120px"></div>
      <div class="skeleton skeleton-card" style="height:200px;margin-top:16px"></div>
      <div class="skeleton skeleton-card" style="height:200px;margin-top:16px"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  try {
    const [kpis, varianceSummary, alerts, haccpData, stockAlerts, availability] = await Promise.all([
      API.getAnalyticsKPIs(),
      API.getVarianceSummary(),
      API.request("/alerts/daily-summary").catch(() => null),
      API.getAnalyticsHACCP().catch(() => null),
      API.getStockAlerts().catch(() => []),
      API.getRecipeAvailability().catch(() => null)
    ]);
    renderHealthContent(kpis, varianceSummary, alerts, haccpData, stockAlerts, availability);
  } catch (e) {
    document.getElementById("health-content").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">\u26A0\uFE0F</div>
        <p>Erreur de chargement</p>
        <p class="text-secondary text-sm">${escapeHtml(e.message)}</p>
        <button class="btn btn-primary" onclick="renderHealthDashboard()">R\xE9essayer</button>
      </div>
    `;
  }
}
function renderHealthContent(kpis, variance, alerts, haccp, stockAlerts, availability) {
  const el = document.getElementById("health-content");
  if (!el) return;
  let healthScore = 100;
  const issues = [];
  if (kpis.avg_food_cost_pct > 35) {
    healthScore -= 20;
    issues.push({ icon: "\u{1F534}", text: `Food cost moyen \xE9lev\xE9 : ${kpis.avg_food_cost_pct.toFixed(1)}% (cible < 30%)`, severity: "critical" });
  } else if (kpis.avg_food_cost_pct > 30) {
    healthScore -= 10;
    issues.push({ icon: "\u{1F7E1}", text: `Food cost moyen acceptable : ${kpis.avg_food_cost_pct.toFixed(1)}% (cible < 30%)`, severity: "warning" });
  }
  if (variance.health === "critical") {
    healthScore -= 20;
    issues.push({ icon: "\u{1F534}", text: `Pertes \xE9lev\xE9es : ratio ${variance.loss_ratio_pct.toFixed(1)}% des achats`, severity: "critical" });
  } else if (variance.health === "warning") {
    healthScore -= 10;
    issues.push({ icon: "\u{1F7E1}", text: `Pertes \xE0 surveiller : ratio ${variance.loss_ratio_pct.toFixed(1)}% des achats`, severity: "warning" });
  }
  if (stockAlerts.length > 5) {
    healthScore -= 15;
    issues.push({ icon: "\u{1F534}", text: `${stockAlerts.length} alertes de stock bas`, severity: "critical" });
  } else if (stockAlerts.length > 0) {
    healthScore -= 5;
    issues.push({ icon: "\u{1F7E1}", text: `${stockAlerts.length} alerte(s) de stock bas`, severity: "warning" });
  }
  if (haccp) {
    const tempCompliance = haccp.temperature_compliance_7d || 100;
    const cleanCompliance = haccp.cleaning_compliance_7d || 100;
    if (tempCompliance < 80 || cleanCompliance < 80) {
      healthScore -= 15;
      issues.push({ icon: "\u{1F534}", text: `HACCP insuffisant : temp\xE9ratures ${tempCompliance}%, nettoyage ${cleanCompliance}%`, severity: "critical" });
    } else if (tempCompliance < 95 || cleanCompliance < 95) {
      healthScore -= 5;
      issues.push({ icon: "\u{1F7E1}", text: `HACCP \xE0 am\xE9liorer : temp\xE9ratures ${tempCompliance}%, nettoyage ${cleanCompliance}%`, severity: "warning" });
    }
  }
  if (alerts && alerts.summary) {
    if (alerts.summary.critical > 0) {
      healthScore -= 10;
      issues.push({ icon: "\u{1F534}", text: `${alerts.summary.critical} alerte(s) critique(s) active(s) (DLC, temp\xE9ratures)`, severity: "critical" });
    }
  }
  if (availability && availability.summary) {
    const unavailable = availability.summary.unavailable || 0;
    if (unavailable > 0) {
      healthScore -= 5;
      issues.push({ icon: "\u{1F7E1}", text: `${unavailable} recette(s) indisponible(s) par manque de stock`, severity: "warning" });
    }
  }
  healthScore = Math.max(0, healthScore);
  const scoreColor = healthScore >= 80 ? "var(--color-success)" : healthScore >= 60 ? "var(--color-warning)" : "var(--color-danger)";
  const scoreLabel = healthScore >= 80 ? "Bon" : healthScore >= 60 ? "\xC0 surveiller" : "Critique";
  const scoreEmoji = healthScore >= 80 ? "\u2705" : healthScore >= 60 ? "\u26A0\uFE0F" : "\u{1F6A8}";
  const criticalIssues = issues.filter((i) => i.severity === "critical");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  el.innerHTML = `
    <!-- Health Score -->
    <div style="background:linear-gradient(135deg, var(--bg-elevated), var(--color-surface));border:2px solid ${scoreColor};border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-5);text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);flex-wrap:wrap">
        <div>
          <div style="font-size:3.5rem;font-weight:800;color:${scoreColor};line-height:1">${healthScore}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:4px">/ 100</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:var(--text-lg);font-weight:600;color:var(--text-primary)">${scoreEmoji} ${scoreLabel}</div>
          <div style="font-size:var(--text-sm);color:var(--text-secondary)">
            ${issues.length === 0 ? "Tout est en ordre, bravo !" : `${criticalIssues.length} probl\xE8me(s), ${warningIssues.length} avertissement(s)`}
          </div>
        </div>
      </div>
      <!-- Score bar -->
      <div style="margin-top:var(--space-3);background:var(--bg-sunken);border-radius:6px;height:10px;overflow:hidden">
        <div style="height:100%;width:${healthScore}%;background:${scoreColor};border-radius:6px;transition:width 0.5s"></div>
      </div>
    </div>

    ${issues.length > 0 ? `
    <!-- Issues -->
    <div style="margin-bottom:var(--space-5)">
      <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Points d'attention</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${issues.map((i) => `
          <div style="padding:var(--space-3);background:${i.severity === "critical" ? "rgba(217,48,37,0.08)" : "rgba(229,161,0,0.08)"};border-radius:var(--radius-md);border-left:3px solid ${i.severity === "critical" ? "var(--color-danger)" : "var(--color-warning)"}">
            <span style="font-size:var(--text-sm)">${i.icon} ${i.text}</span>
          </div>
        `).join("")}
      </div>
    </div>
    ` : ""}

    <!-- KPI Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);margin-bottom:var(--space-5)">
      ${_healthKpiCard(
    "Food cost moyen",
    `${kpis.avg_food_cost_pct.toFixed(1)}%`,
    kpis.avg_food_cost_pct < 30 ? "var(--color-success)" : kpis.avg_food_cost_pct <= 35 ? "var(--color-warning)" : "var(--color-danger)",
    "Cible : < 30%"
  )}
      ${_healthKpiCard("Fiches techniques", kpis.total_recipes, "var(--color-accent)", "")}
      ${_healthKpiCard("Valeur stock", formatCurrency(kpis.stock_value), "var(--color-info)", "")}
      ${_healthKpiCard(
    "Stock bas",
    kpis.low_stock_count,
    kpis.low_stock_count > 5 ? "var(--color-danger)" : kpis.low_stock_count > 0 ? "var(--color-warning)" : "var(--color-success)",
    kpis.low_stock_count === 0 ? "Tout est OK" : "\xC0 r\xE9approvisionner"
  )}
      ${_healthKpiCard(
    "Pertes (30j)",
    formatCurrency(variance.total_loss_value),
    variance.health === "critical" ? "var(--color-danger)" : variance.health === "warning" ? "var(--color-warning)" : "var(--color-success)",
    `${variance.loss_ratio_pct.toFixed(1)}% des achats`
  )}
      ${_healthKpiCard("Achats (30j)", formatCurrency(variance.total_purchase_value), "var(--text-primary)", "")}
    </div>

    <!-- Sections Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-4);margin-bottom:var(--space-5)">
      <!-- HACCP Compliance -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">\u{1F6E1}\uFE0F Conformit\xE9 HACCP</h3>
        ${haccp ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <div style="text-align:center">
              <div style="font-size:var(--text-2xl);font-weight:700;color:${_complianceColor(haccp.temperature_compliance_7d)}">${haccp.temperature_compliance_7d || 0}%</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Temp\xE9ratures (7j)</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-2xl);font-weight:700;color:${_complianceColor(haccp.cleaning_compliance_7d)}">${haccp.cleaning_compliance_7d || 0}%</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Nettoyage (7j)</div>
            </div>
          </div>
          ${haccp.alerts_count_7d > 0 ? `<div style="margin-top:var(--space-3);padding:var(--space-2);background:rgba(217,48,37,0.08);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-danger)">\u26A0\uFE0F ${haccp.alerts_count_7d} alerte(s) sur 7 jours</div>` : ""}
        ` : '<p class="text-secondary text-sm">Donn\xE9es HACCP non disponibles</p>'}
        <a href="#/haccp" style="display:block;text-align:center;margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-accent)">Voir le d\xE9tail \u2192</a>
      </div>

      <!-- Stock Health -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">\u{1F4E6} \xC9tat des stocks</h3>
        ${stockAlerts.length > 0 ? `
          <div style="max-height:180px;overflow-y:auto">
            ${stockAlerts.slice(0, 8).map((a) => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:var(--text-sm)">
                <span style="font-weight:500">${escapeHtml(a.ingredient_name || a.name || `#${a.ingredient_id}`)}</span>
                <span style="color:var(--color-danger);font-weight:600">${a.quantity != null ? formatQuantity(a.quantity, a.unit) : "\u2014"}</span>
              </div>
            `).join("")}
            ${stockAlerts.length > 8 ? `<div style="font-size:var(--text-xs);color:var(--text-tertiary);padding-top:8px">+${stockAlerts.length - 8} autre(s)\u2026</div>` : ""}
          </div>
        ` : '<div style="text-align:center;padding:var(--space-4);color:var(--color-success);font-weight:600">\u2705 Tous les stocks sont OK</div>'}
        <a href="#/stock" style="display:block;text-align:center;margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-accent)">G\xE9rer le stock \u2192</a>
      </div>

      <!-- Recipe Availability -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">\u{1F37D}\uFE0F Disponibilit\xE9 des plats</h3>
        ${availability && availability.summary ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);text-align:center;margin-bottom:var(--space-3)">
            <div>
              <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-success)">${availability.summary.available || 0}</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Disponibles</div>
            </div>
            <div>
              <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-warning)">${availability.summary.low || 0}</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Stock faible</div>
            </div>
            <div>
              <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-danger)">${availability.summary.unavailable || 0}</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Indisponibles</div>
            </div>
          </div>
          ${availability.items && availability.items.filter((i) => i.available_portions === 0).length > 0 ? `
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">
              <strong>Indisponibles :</strong> ${availability.items.filter((i) => i.available_portions === 0).slice(0, 5).map((i) => escapeHtml(i.name)).join(", ")}
            </div>
          ` : ""}
        ` : '<p class="text-secondary text-sm">Activez le module de disponibilit\xE9 pour voir les donn\xE9es</p>'}
      </div>

      <!-- Variance Summary -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">\u{1F4CA} Analyse des \xE9carts (30j)</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);text-align:center">
          <div>
            <div style="font-size:var(--text-xl);font-weight:700;color:${variance.health === "good" ? "var(--color-success)" : variance.health === "warning" ? "var(--color-warning)" : "var(--color-danger)"}">
              ${formatCurrency(variance.total_loss_value)}
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Pertes d\xE9clar\xE9es</div>
          </div>
          <div>
            <div style="font-size:var(--text-xl);font-weight:700">${variance.ingredients_with_losses}</div>
            <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Ingr\xE9dients impact\xE9s</div>
          </div>
        </div>
        <a href="#/stock/variance" style="display:block;text-align:center;margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-accent)">Analyse d\xE9taill\xE9e \u2192</a>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="margin-top:var(--space-4)">
      <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Actions rapides</h3>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
        <a href="#/stock/reception" class="btn btn-secondary">\u{1F4E5} R\xE9ception stock</a>
        <a href="#/stock/variance" class="btn btn-secondary">\u{1F4CA} Analyse \xE9carts</a>
        <a href="#/haccp" class="btn btn-secondary">\u{1F6E1}\uFE0F HACCP</a>
        <a href="#/analytics" class="btn btn-secondary">\u{1F4C8} Analytics complet</a>
        <a href="#/orders" class="btn btn-secondary">\u{1F4CB} Commandes fournisseurs</a>
      </div>
    </div>
  `;
}
function _healthKpiCard(label, value, color, subtitle) {
  return `
    <div class="card" style="padding:var(--space-3);text-align:center">
      <div style="font-size:var(--text-xl);font-weight:700;color:${color}">${value}</div>
      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">${label}</div>
      ${subtitle ? `<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">${subtitle}</div>` : ""}
    </div>
  `;
}
function _complianceColor(pct) {
  if (pct == null) return "var(--text-tertiary)";
  if (pct >= 95) return "var(--color-success)";
  if (pct >= 80) return "var(--color-warning)";
  return "var(--color-danger)";
}
class MoreView {
  render() {
    const app = document.getElementById("app");
    const account = getAccount();
    const role = account ? account.role : getRole();
    const isGerant = role === "gerant";
    const showAdvanced = localStorage.getItem("restosuite_show_advanced") === "true";
    app.innerHTML = `
      <div class="view-header">
        ${account ? `
        <div class="more-user-info">
          ${renderAvatar(account.name, 48)}
          <div>
            <h1>${escapeHtml(account.name)}</h1>
            <p class="text-secondary text-sm">${role === "gerant" ? "\u{1F451} G\xE9rant \u2014 Acc\xE8s complet" : role === "cuisinier" ? "\u{1F468}\u200D\u{1F373} Cuisinier" : role === "salle" ? "\u{1F37D}\uFE0F Salle" : "\u{1F464} \xC9quipier"}</p>
          </div>
        </div>
        ` : `<h1>Param\xE8tres</h1>`}
        <p class="text-secondary">Param\xE8tres & configuration</p>
      </div>

      ${isGerant ? `
      <div style="margin-bottom:var(--space-4)">
        <a href="#/team" class="more-card more-card--active" style="text-decoration:none;cursor:pointer;display:flex;flex-direction:column">
          <div class="more-card__icon" style="background:var(--color-info)"><i data-lucide="users"></i></div>
          <div class="more-card__content"><h3>G\xE9rer l'\xE9quipe</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">Comptes, permissions, acc\xE8s par r\xF4le</p>
        </a>
      </div>
      ` : ""}

      <div class="section-title" style="margin-top:var(--space-2);margin-bottom:var(--space-2);">\u2699\uFE0F Configuration</div>
      <div class="more-grid">
        ${isGerant ? `
        <a href="#/integrations" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:#00B37E"><i data-lucide="plug"></i></div>
          <div class="more-card__content"><h3>Int\xE9grations</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">TheFork, caisse, livraison, r\xE9servations</p>
        </a>
        <a href="#/qrcodes" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:var(--color-accent)"><i data-lucide="qr-code"></i></div>
          <div class="more-card__content"><h3>QR Codes Menu</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">Menu digital, commande client par QR code</p>
        </a>
        <a href="#/crm" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:#EC4899"><i data-lucide="heart"></i></div>
          <div class="more-card__content"><h3>CRM & Fid\xE9lit\xE9</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">Clients, fid\xE9lit\xE9, VIP</p>
        </a>
        <a href="#/errors-log" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:#DC2626"><i data-lucide="bug"></i></div>
          <div class="more-card__content"><h3>Journal d'erreurs</h3><span class="badge badge--error">Tech</span></div>
          <p class="text-secondary text-sm">Erreurs serveur et client en temps r\xE9el</p>
        </a>
        ` : ""}
      </div>

      ${isGerant ? `
      <div style="margin:var(--space-5) 0 var(--space-3)">
        <button id="btn-toggle-advanced" class="btn btn-secondary" style="width:100%;justify-content:center;gap:var(--space-2)">
          <i data-lucide="${showAdvanced ? "eye-off" : "eye"}" style="width:16px;height:16px"></i>
          ${showAdvanced ? "Masquer les modules avanc\xE9s" : "Afficher les modules avanc\xE9s"}
        </button>
      </div>
      <div id="advanced-modules" style="display:${showAdvanced ? "block" : "none"}">
        <div class="section-title" style="margin-bottom:var(--space-2);">\u{1F52C} Modules avanc\xE9s</div>
        <div class="more-grid">
          <a href="#/multi-site" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:var(--color-info)"><i data-lucide="building-2"></i></div>
            <div class="more-card__content"><h3>Multi-Sites</h3><span class="badge badge--info">Avanc\xE9</span></div>
            <p class="text-secondary text-sm">G\xE9rez plusieurs \xE9tablissements</p>
          </a>
          <a href="#/api-keys" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:var(--color-primary)"><i data-lucide="key"></i></div>
            <div class="more-card__content"><h3>API Publique</h3><span class="badge badge--info">Avanc\xE9</span></div>
            <p class="text-secondary text-sm">Cl\xE9s API, int\xE9grations externes</p>
          </a>
          <a href="#/carbon" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:#16A34A"><i data-lucide="leaf"></i></div>
            <div class="more-card__content"><h3>Bilan Carbone</h3><span class="badge badge--info">Avanc\xE9</span></div>
            <p class="text-secondary text-sm">Empreinte CO\u2082 par recette, notation A\u2192E</p>
          </a>
          <a href="#/supplier-portal" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:var(--color-primary-light)"><i data-lucide="truck"></i></div>
            <div class="more-card__content"><h3>Portail Fournisseur</h3><span class="badge badge--info">Avanc\xE9</span></div>
            <p class="text-secondary text-sm">Fournisseurs mettent \xE0 jour leurs catalogues</p>
          </a>
        </div>
      </div>
      ` : ""}

      <div class="section-title" style="margin-top:var(--space-6);">Pr\xE9f\xE9rences</div>
      <div class="setting-row">
        <span>\u{1F319} Mode sombre</span>
        <label class="toggle">
          <input type="checkbox" id="themeToggle">
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="more-footer">
        <div style="text-align:center;margin-top:2rem">
          <button class="btn btn-secondary" id="btn-export-data" style="margin-bottom:1rem">
            <i data-lucide="download" style="width:18px;height:18px"></i> Exporter mes donn\xE9es
          </button>
          <br>
          <button class="btn btn-secondary" onclick="logout()" style="margin-bottom:1rem">
            <i data-lucide="log-out" style="width:18px;height:18px"></i> Se d\xE9connecter
          </button>
          <p class="text-secondary text-sm">RestoSuite v1.0 \u2014 Votre cuisine tourne. Vos chiffres suivent.</p>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    const toggleBtn = document.getElementById("btn-toggle-advanced");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const newVal = localStorage.getItem("restosuite_show_advanced") !== "true";
        localStorage.setItem("restosuite_show_advanced", String(newVal));
        new MoreView().render();
      });
    }
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.checked = document.documentElement.getAttribute("data-theme") !== "light";
      themeToggle.addEventListener("change", () => {
        const theme = themeToggle.checked ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("restosuite_theme", theme);
      });
    }
    const exportBtn = document.getElementById("btn-export-data");
    if (exportBtn && account) {
      exportBtn.addEventListener("click", async () => {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i data-lucide="loader" style="width:18px;height:18px"></i> Export en cours\u2026';
        try {
          const res = await fetch(`/api/accounts/${account.id}/export`);
          if (!res.ok) throw new Error("Erreur export");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `restosuite-export-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast("Donn\xE9es export\xE9es \u2713", "success");
        } catch (e) {
          showToast("Erreur lors de l'export", "error");
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<i data-lucide="download" style="width:18px;height:18px"></i> Exporter mes donn\xE9es';
          if (window.lucide) lucide.createIcons();
        }
      });
    }
  }
}
class OnboardingWizard {
  constructor(onComplete) {
    this.step = 1;
    this.totalSteps = 7;
    this.onComplete = onComplete;
    this.direction = "next";
    this.data = {};
    this.tables = [];
    this.tableMode = "quick";
    this.members = [];
    this.staffPassword = "";
    this.zones = [
      { name: "Frigo 1", type: "fridge", min_temp: 0, max_temp: 4 },
      { name: "Frigo 2", type: "fridge", min_temp: 0, max_temp: 4 },
      { name: "Cong\xE9lateur", type: "freezer", min_temp: -25, max_temp: -18 },
      { name: "Chambre froide", type: "cold_room", min_temp: 0, max_temp: 3 }
    ];
    this.suppliers = [];
  }
  async show() {
    try {
      this.data = await API.getOnboardingStatus();
      if (this.data.current_step > 0 && this.data.current_step < 7) {
        this.step = this.data.current_step + 1;
      }
      if (this.data.zones && this.data.zones.length > 0) {
        this.zones = this.data.zones.map((z) => ({
          name: z.name,
          type: z.type,
          min_temp: z.min_temp,
          max_temp: z.max_temp
        }));
      }
      if (this.data.tables && this.data.tables.length > 0) {
        this.tables = this.data.tables;
      }
      if (this.data.suppliers && this.data.suppliers.length > 0) {
        this.suppliers = this.data.suppliers.map((s) => ({
          name: s.name,
          contact: s.contact || "",
          phone: s.phone || "",
          email: s.email || ""
        }));
      }
    } catch (e) {
      console.warn("Could not fetch onboarding status:", e);
    }
    this.overlay = document.createElement("div");
    this.overlay.className = "onboarding-overlay";
    this.overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-progress">
          <div class="onboarding-progress-bar" id="ob-progress"></div>
        </div>
        <div class="onboarding-body" id="ob-body"></div>
        <div class="onboarding-footer" id="ob-footer"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add("visible"));
    this.renderStep();
  }
  renderStep() {
    const body = document.getElementById("ob-body");
    const footer = document.getElementById("ob-footer");
    const progress = document.getElementById("ob-progress");
    if (!body || !footer || !progress) return;
    progress.style.width = `${this.step / this.totalSteps * 100}%`;
    body.classList.remove("slide-in-left", "slide-in-right");
    body.classList.add(this.direction === "next" ? "slide-in-right" : "slide-in-left");
    switch (this.step) {
      case 1:
        this.renderStep1(body, footer);
        break;
      case 2:
        this.renderStep2(body, footer);
        break;
      case 3:
        this.renderStep3(body, footer);
        break;
      case 4:
        this.renderStep4(body, footer);
        break;
      case 5:
        this.renderStep5(body, footer);
        break;
      case 6:
        this.renderStep6(body, footer);
        break;
      case 7:
        this.renderStep7(body, footer);
        break;
    }
  }
  // ─── Step 1: Mon profil ───
  renderStep1(body, footer) {
    const acc = this.data.account || {};
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">\u{1F464}</div>
        <h2 class="ob-title">Mon profil</h2>
        <p class="ob-desc">Vos informations personnelles</p>
        <div class="ob-form">
          <div class="form-group">
            <label>Pr\xE9nom</label>
            <input type="text" class="form-control" id="ob-firstname" value="${escapeHtml(acc.first_name || "")}" placeholder="Pr\xE9nom">
          </div>
          <div class="form-group">
            <label>Nom</label>
            <input type="text" class="form-control" id="ob-lastname" value="${escapeHtml(acc.last_name || "")}" placeholder="Nom">
          </div>
          <div class="form-group">
            <label>T\xE9l\xE9phone</label>
            <input type="tel" class="form-control" id="ob-phone" value="${escapeHtml(acc.phone || "")}" placeholder="06 12 34 56 78">
          </div>
        </div>
      </div>
    `;
    this.renderNavButtons(footer, false);
  }
  // ─── Step 2: Mon restaurant ───
  renderStep2(body, footer) {
    const r = this.data.restaurant || {};
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">\u{1F3EA}</div>
        <h2 class="ob-title">Mon restaurant</h2>
        <p class="ob-desc">Les informations de votre \xE9tablissement</p>
        <div class="ob-form">
          <div class="form-group">
            <label>Nom du restaurant</label>
            <input type="text" class="form-control" id="ob-rname" value="${escapeHtml(r.name || "")}" placeholder="Chez Marcel">
          </div>
          <div class="form-group">
            <label>Type d'\xE9tablissement</label>
            <select class="form-control" id="ob-rtype">
              <option value="">\u2014 Choisir \u2014</option>
              ${["brasserie", "gastro", "fast-food", "pizzeria", "bar", "traiteur", "boulangerie", "autre"].map((t) => `<option value="${t}" ${r.type === t ? "selected" : ""}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Adresse</label>
            <input type="text" class="form-control" id="ob-raddress" value="${escapeHtml(r.address || "")}" placeholder="12 rue de la Paix">
          </div>
          <div style="display:flex;gap:var(--space-3)">
            <div class="form-group" style="flex:2">
              <label>Ville</label>
              <input type="text" class="form-control" id="ob-rcity" value="${escapeHtml(r.city || "")}" placeholder="Lyon">
            </div>
            <div class="form-group" style="flex:1">
              <label>Code postal</label>
              <input type="text" class="form-control" id="ob-rpostal" value="${escapeHtml(r.postal_code || "")}" placeholder="69001" maxlength="5">
            </div>
          </div>
          <div style="display:flex;gap:var(--space-3)">
            <div class="form-group" style="flex:1">
              <label>T\xE9l\xE9phone</label>
              <input type="tel" class="form-control" id="ob-rphone" value="${escapeHtml(r.phone || "")}" placeholder="04 78 00 00 00">
            </div>
            <div class="form-group" style="flex:1">
              <label>Nombre de couverts</label>
              <input type="number" class="form-control" id="ob-rcovers" value="${r.covers || 30}" placeholder="30" min="1">
            </div>
          </div>
        </div>
      </div>
    `;
    this.renderNavButtons(footer, true);
  }
  // ─── Step 3: Ma salle ───
  renderStep3(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">\u{1FA91}</div>
        <h2 class="ob-title">Ma salle</h2>
        <p class="ob-desc">Configurez vos tables par zone</p>
        <div class="ob-form">
          <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4)">
            <button class="btn ${this.tableMode === "quick" ? "btn-primary" : "btn-secondary"} btn-sm" id="ob-mode-quick">Rapide</button>
            <button class="btn ${this.tableMode === "advanced" ? "btn-primary" : "btn-secondary"} btn-sm" id="ob-mode-advanced">Avanc\xE9</button>
          </div>
          <div id="ob-tables-content"></div>
        </div>
      </div>
    `;
    document.getElementById("ob-mode-quick").addEventListener("click", () => {
      this.tableMode = "quick";
      this.renderTablesContent();
    });
    document.getElementById("ob-mode-advanced").addEventListener("click", () => {
      this.tableMode = "advanced";
      this.renderTablesContent();
    });
    this.renderTablesContent();
    this.renderNavButtons(footer, true);
  }
  renderTablesContent() {
    const container = document.getElementById("ob-tables-content");
    if (!container) return;
    if (this.tableMode === "quick") {
      container.innerHTML = `
        <div class="form-group">
          <label>Salle \u2014 nombre de tables</label>
          <input type="number" class="form-control" id="ob-salle-count" value="${this._countZone("Salle")}" min="0" placeholder="0">
        </div>
        <div class="form-group">
          <label>Terrasse \u2014 nombre de tables</label>
          <input type="number" class="form-control" id="ob-terrasse-count" value="${this._countZone("Terrasse")}" min="0" placeholder="0">
        </div>
        <div class="form-group">
          <label>Bar \u2014 nombre de tables</label>
          <input type="number" class="form-control" id="ob-bar-count" value="${this._countZone("Bar")}" min="0" placeholder="0">
        </div>
        <div class="form-group">
          <label>Couverts par table (par d\xE9faut)</label>
          <input type="number" class="form-control" id="ob-seats-default" value="4" min="1">
        </div>
      `;
    } else {
      container.innerHTML = `
        <div id="ob-adv-tables">
          ${this.tables.map((t, i) => this._renderTableRow(t, i)).join("")}
        </div>
        <button class="btn btn-ghost" id="ob-add-table" style="margin-top:var(--space-3)">+ Ajouter une table</button>
      `;
      document.getElementById("ob-add-table").addEventListener("click", () => {
        const nextNum = this.tables.length > 0 ? Math.max(...this.tables.map((t) => t.table_number)) + 1 : 1;
        this.tables.push({ table_number: nextNum, zone: "Salle", seats: 4 });
        this.renderTablesContent();
      });
      container.querySelectorAll(".ob-table-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.tables.splice(parseInt(btn.dataset.index), 1);
          this.renderTablesContent();
        });
      });
    }
  }
  _countZone(zone) {
    return this.tables.filter((t) => t.zone === zone).length;
  }
  _renderTableRow(t, i) {
    return `
      <div style="display:flex;gap:var(--space-2);align-items:center;margin-bottom:var(--space-2)">
        <input type="number" class="form-control" style="width:60px" value="${t.table_number}" data-index="${i}" data-field="table_number" min="1">
        <select class="form-control" style="flex:1" data-index="${i}" data-field="zone">
          ${["Salle", "Terrasse", "Bar", "Priv\xE9"].map((z) => `<option value="${z}" ${t.zone === z ? "selected" : ""}>${z}</option>`).join("")}
        </select>
        <input type="number" class="form-control" style="width:60px" value="${t.seats}" data-index="${i}" data-field="seats" min="1" placeholder="4">
        <button class="ob-table-delete" data-index="${i}" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:18px">\u2715</button>
      </div>
    `;
  }
  _collectTablesFromQuick() {
    var _a, _b, _c, _d;
    const salleCount = parseInt((_a = document.getElementById("ob-salle-count")) == null ? void 0 : _a.value) || 0;
    const terrasseCount = parseInt((_b = document.getElementById("ob-terrasse-count")) == null ? void 0 : _b.value) || 0;
    const barCount = parseInt((_c = document.getElementById("ob-bar-count")) == null ? void 0 : _c.value) || 0;
    const seats = parseInt((_d = document.getElementById("ob-seats-default")) == null ? void 0 : _d.value) || 4;
    const tables = [];
    let num = 1;
    for (let i = 0; i < salleCount; i++) tables.push({ table_number: num++, zone: "Salle", seats });
    for (let i = 0; i < terrasseCount; i++) tables.push({ table_number: num++, zone: "Terrasse", seats });
    for (let i = 0; i < barCount; i++) tables.push({ table_number: num++, zone: "Bar", seats });
    return tables;
  }
  _collectTablesFromAdvanced() {
    const container = document.getElementById("ob-adv-tables");
    if (!container) return this.tables;
    container.querySelectorAll("input, select").forEach((el) => {
      const idx = parseInt(el.dataset.index);
      const field = el.dataset.field;
      if (idx >= 0 && field && this.tables[idx]) {
        this.tables[idx][field] = field === "zone" ? el.value : parseInt(el.value) || 1;
      }
    });
    return this.tables;
  }
  // ─── Step 4: Mon équipe ───
  renderStep4(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">\u{1F465}</div>
        <h2 class="ob-title">Mon \xE9quipe</h2>
        <p class="ob-desc">Ajoutez les membres de votre staff</p>

        <div style="padding:var(--space-3);background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:var(--space-4);text-align:left">
          <div style="display:flex;align-items:flex-start;gap:var(--space-3)">
            <span style="font-size:1.3rem;line-height:1">\u{1F4A1}</span>
            <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5">
              <strong style="color:var(--text-primary)">Comment \xE7a marche ?</strong><br>
              Votre staff se connecte avec le <strong>mot de passe \xE9quipe</strong> d\xE9fini \xE0 l'inscription, puis s\xE9lectionne son nom et cr\xE9e son <strong>code PIN personnel</strong> \xE0 sa premi\xE8re connexion.
            </div>
          </div>
        </div>

        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-2)">Membres de l'\xE9quipe</h3>
        <p style="font-size:var(--text-sm);color:var(--text-tertiary);margin-bottom:var(--space-3)">Ajoutez vos membres avec leur nom et r\xF4le. Vous pourrez en ajouter d'autres plus tard.</p>
        <div id="ob-members-list"></div>
        <button class="btn btn-ghost" id="ob-add-member" style="margin-top:var(--space-3)">+ Ajouter un membre</button>
      </div>
    `;
    this.renderMembersList();
    document.getElementById("ob-add-member").addEventListener("click", () => {
      this.members.push({ name: "", role: "cuisinier" });
      this.renderMembersList();
    });
    this.renderNavButtons(footer, true);
  }
  renderMembersList() {
    const container = document.getElementById("ob-members-list");
    if (!container) return;
    if (this.members.length === 0) {
      container.innerHTML = '<p style="color:var(--text-tertiary);font-size:var(--text-sm);text-align:center;padding:var(--space-4)">Aucun membre ajout\xE9. Vous pourrez en ajouter plus tard.</p>';
      return;
    }
    container.innerHTML = this.members.map((m, i) => `
      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <strong style="font-size:var(--text-sm)">Membre ${i + 1}</strong>
          <button class="ob-member-delete" data-index="${i}" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:16px">\u2715</button>
        </div>
        <div class="form-group" style="margin-bottom:var(--space-2)">
          <input type="text" class="form-control" placeholder="Nom / surnom" value="${escapeHtml(m.name)}" data-index="${i}" data-field="name">
        </div>
        <div style="display:flex;gap:var(--space-2)">
          <select class="form-control ob-role-select" data-index="${i}" data-field="role" style="flex:1">
            <option value="cuisinier" ${m.role === "cuisinier" ? "selected" : ""}>\u{1F468}\u200D\u{1F373} Cuisinier</option>
            <option value="serveur" ${m.role === "serveur" ? "selected" : ""}>\u{1F37D}\uFE0F Serveur</option>
            <option value="__custom__" ${!["cuisinier", "serveur"].includes(m.role) && m.role ? "selected" : ""}>\u270F\uFE0F Personnalis\xE9\u2026</option>
          </select>
          <input type="text" class="form-control ob-custom-role" data-index="${i}" data-field="custom_role" placeholder="Ex: P\xE2tissier"
                 value="${escapeHtml(!["cuisinier", "serveur", "equipier", ""].includes(m.role) ? m.role : "")}"
                 style="flex:1;${["cuisinier", "serveur", "equipier", ""].includes(m.role) ? "display:none" : ""}">
        </div>
      </div>
    `).join("");
    container.querySelectorAll(".ob-role-select").forEach((el) => {
      el.addEventListener("change", () => {
        const idx = parseInt(el.dataset.index);
        const customInput = container.querySelector(`.ob-custom-role[data-index="${idx}"]`);
        if (el.value === "__custom__") {
          customInput.style.display = "";
          customInput.focus();
          this.members[idx].role = customInput.value || "";
        } else {
          customInput.style.display = "none";
          this.members[idx].role = el.value;
        }
      });
    });
    container.querySelectorAll(".ob-custom-role").forEach((el) => {
      el.addEventListener("input", () => {
        const idx = parseInt(el.dataset.index);
        if (idx >= 0 && this.members[idx]) {
          this.members[idx].role = el.value;
        }
      });
    });
    container.querySelectorAll('input[data-field="name"]').forEach((el) => {
      el.addEventListener("input", () => {
        const idx = parseInt(el.dataset.index);
        if (idx >= 0 && this.members[idx]) {
          this.members[idx].name = el.value;
        }
      });
    });
    container.querySelectorAll(".ob-member-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.members.splice(parseInt(btn.dataset.index), 1);
        this.renderMembersList();
      });
    });
  }
  // ─── Step 5: Mes zones froides ───
  renderStep5(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">\u{1F321}\uFE0F</div>
        <h2 class="ob-title">Mes zones froides</h2>
        <p class="ob-desc">Configurez vos zones de temp\xE9rature pour le HACCP</p>
        <div class="ob-zones" id="ob-zones-list"></div>
        <button class="btn btn-ghost" id="ob-add-zone" style="margin-top:var(--space-3)">+ Ajouter une zone</button>
      </div>
    `;
    this.renderZonesList();
    document.getElementById("ob-add-zone").addEventListener("click", () => {
      this.zones.push({ name: "Nouvelle zone", type: "fridge", min_temp: 0, max_temp: 4 });
      this.renderZonesList();
    });
    this.renderNavButtons(footer, true);
  }
  renderZonesList() {
    const container = document.getElementById("ob-zones-list");
    if (!container) return;
    container.innerHTML = this.zones.map((z, i) => `
      <div class="ob-zone-row" data-index="${i}">
        <input type="text" class="ob-zone-name" value="${escapeHtml(z.name)}" data-field="name" data-index="${i}">
        <div class="ob-zone-range">
          <input type="number" class="ob-zone-input" value="${z.min_temp}" data-field="min_temp" data-index="${i}" step="1">
          <span class="ob-zone-sep">\xB0C \u2014</span>
          <input type="number" class="ob-zone-input" value="${z.max_temp}" data-field="max_temp" data-index="${i}" step="1">
          <span class="ob-zone-unit">\xB0C</span>
        </div>
        <button class="ob-zone-delete" data-index="${i}" title="Supprimer">\u2715</button>
      </div>
    `).join("");
    container.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        const idx = parseInt(input.dataset.index);
        const field = input.dataset.field;
        if (field === "name") this.zones[idx].name = input.value;
        else if (field === "min_temp") this.zones[idx].min_temp = parseFloat(input.value);
        else if (field === "max_temp") this.zones[idx].max_temp = parseFloat(input.value);
      });
    });
    container.querySelectorAll(".ob-zone-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.zones.splice(parseInt(btn.dataset.index), 1);
        this.renderZonesList();
      });
    });
  }
  // ─── Step 6: Mes fournisseurs ───
  renderStep6(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">\u{1F69A}</div>
        <h2 class="ob-title">Mes fournisseurs</h2>
        <p class="ob-desc">Ajoutez vos fournisseurs habituels (optionnel)</p>
        <div id="ob-suppliers-list"></div>
        <button class="btn btn-ghost" id="ob-add-supplier" style="margin-top:var(--space-3)">+ Ajouter un fournisseur</button>
      </div>
    `;
    this.renderSuppliersList();
    document.getElementById("ob-add-supplier").addEventListener("click", () => {
      this.suppliers.push({ name: "", contact: "", phone: "", email: "" });
      this.renderSuppliersList();
    });
    this.renderNavButtons(footer, true);
  }
  renderSuppliersList() {
    const container = document.getElementById("ob-suppliers-list");
    if (!container) return;
    if (this.suppliers.length === 0) {
      container.innerHTML = '<p style="color:var(--text-tertiary);font-size:var(--text-sm);text-align:center;padding:var(--space-4)">Aucun fournisseur ajout\xE9. Vous pourrez en ajouter plus tard.</p>';
      return;
    }
    container.innerHTML = this.suppliers.map((s, i) => `
      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <strong style="font-size:var(--text-sm)">Fournisseur ${i + 1}</strong>
          <button class="ob-supplier-delete" data-index="${i}" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:16px">\u2715</button>
        </div>
        <div class="form-group" style="margin-bottom:var(--space-2)">
          <input type="text" class="form-control" placeholder="Nom de l'entreprise" value="${escapeHtml(s.name)}" data-index="${i}" data-field="name">
        </div>
        <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)">
          <input type="text" class="form-control" placeholder="Contact" value="${escapeHtml(s.contact)}" data-index="${i}" data-field="contact" style="flex:1">
          <input type="tel" class="form-control" placeholder="T\xE9l\xE9phone" value="${escapeHtml(s.phone)}" data-index="${i}" data-field="phone" style="flex:1">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <input type="email" class="form-control" placeholder="Email" value="${escapeHtml(s.email)}" data-index="${i}" data-field="email">
        </div>
      </div>
    `).join("");
    container.querySelectorAll("input").forEach((el) => {
      el.addEventListener("input", () => {
        const idx = parseInt(el.dataset.index);
        const field = el.dataset.field;
        if (idx >= 0 && field && this.suppliers[idx]) {
          this.suppliers[idx][field] = el.value;
        }
      });
    });
    container.querySelectorAll(".ob-supplier-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.suppliers.splice(parseInt(btn.dataset.index), 1);
        this.renderSuppliersList();
      });
    });
  }
  // ─── Step 7: Terminé ───
  renderStep7(body, footer) {
    const acc = this.data.account || {};
    const r = this.data.restaurant || {};
    body.innerHTML = `
      <div class="ob-step ob-finish">
        <div class="ob-icon" style="font-size:4rem">\u{1F389}</div>
        <h2 class="ob-title">Votre restaurant est configur\xE9 !</h2>
        <p class="ob-desc">Tout est pr\xEAt. Commencez \xE0 utiliser RestoSuite.</p>

        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-4);margin-top:var(--space-4);text-align:left;width:100%">
          <h3 style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-3)">\u{1F4CB} R\xE9capitulatif</h3>
          ${r.name ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Restaurant :</strong> ${escapeHtml(r.name)}</p>` : ""}
          ${r.city ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Ville :</strong> ${escapeHtml(r.city)}</p>` : ""}
          ${this.tables.length ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Tables :</strong> ${this.tables.length}</p>` : ""}
          ${this.members.length ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>\xC9quipe :</strong> ${this.members.length} membre(s)</p>` : ""}
          ${this.zones.length ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Zones froides :</strong> ${this.zones.length}</p>` : ""}
        </div>
      </div>
    `;
    footer.innerHTML = `
      <div class="ob-buttons ob-buttons--finish">
        <button class="btn btn-primary ob-btn-next" id="ob-finish" style="min-width:250px;padding:14px">
          \u{1F680} Acc\xE9der \xE0 RestoSuite
        </button>
      </div>
    `;
    document.getElementById("ob-finish").addEventListener("click", async () => {
      try {
        await API.saveOnboardingStep(7, {});
      } catch (e) {
      }
      this.complete();
    });
  }
  // ─── Navigation buttons ───
  renderNavButtons(footer, showBack) {
    footer.innerHTML = `
      <div class="ob-buttons">
        ${showBack ? '<button class="btn btn-ghost ob-btn-prev" id="ob-prev">\u2190 Retour</button>' : "<div></div>"}
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-ghost" id="ob-skip">Passer</button>
          <button class="btn btn-primary ob-btn-next" id="ob-next">Suivant \u2192</button>
        </div>
      </div>
    `;
    if (showBack) {
      document.getElementById("ob-prev").addEventListener("click", () => this.prev());
    }
    document.getElementById("ob-skip").addEventListener("click", () => this.skip());
    document.getElementById("ob-next").addEventListener("click", () => this.saveAndNext());
  }
  async saveAndNext() {
    const nextBtn = document.getElementById("ob-next");
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = "...";
    }
    try {
      await this.saveCurrentStep();
      this.next();
    } catch (e) {
      console.error("Save step error:", e);
      if (typeof showToast === "function") showToast(e.message || "Erreur de sauvegarde", "error");
    } finally {
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = "Suivant \u2192";
      }
    }
  }
  async saveCurrentStep() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    switch (this.step) {
      case 1: {
        const firstName = ((_a = document.getElementById("ob-firstname")) == null ? void 0 : _a.value) || "";
        const lastName = ((_b = document.getElementById("ob-lastname")) == null ? void 0 : _b.value) || "";
        const phone = ((_c = document.getElementById("ob-phone")) == null ? void 0 : _c.value) || "";
        await API.saveOnboardingStep(1, { first_name: firstName, last_name: lastName, phone });
        this.data.account = __spreadProps(__spreadValues({}, this.data.account), { first_name: firstName, last_name: lastName, phone });
        break;
      }
      case 2: {
        const data = {
          name: ((_d = document.getElementById("ob-rname")) == null ? void 0 : _d.value) || "",
          type: ((_e = document.getElementById("ob-rtype")) == null ? void 0 : _e.value) || "",
          address: ((_f = document.getElementById("ob-raddress")) == null ? void 0 : _f.value) || "",
          city: ((_g = document.getElementById("ob-rcity")) == null ? void 0 : _g.value) || "",
          postal_code: ((_h = document.getElementById("ob-rpostal")) == null ? void 0 : _h.value) || "",
          phone: ((_i = document.getElementById("ob-rphone")) == null ? void 0 : _i.value) || "",
          covers: parseInt((_j = document.getElementById("ob-rcovers")) == null ? void 0 : _j.value) || 30
        };
        await API.saveOnboardingStep(2, data);
        this.data.restaurant = __spreadValues(__spreadValues({}, this.data.restaurant), data);
        break;
      }
      case 3: {
        if (this.tableMode === "quick") {
          this.tables = this._collectTablesFromQuick();
        } else {
          this.tables = this._collectTablesFromAdvanced();
        }
        await API.saveOnboardingStep(3, { tables: this.tables });
        break;
      }
      case 4: {
        const container = document.getElementById("ob-members-list");
        if (container) {
          container.querySelectorAll("input, select").forEach((el) => {
            const idx = parseInt(el.dataset.index);
            const field = el.dataset.field;
            if (idx >= 0 && field && this.members[idx]) {
              this.members[idx][field] = el.value;
            }
          });
        }
        const validMembers = this.members.filter((m) => m.name && m.name.trim());
        await API.saveOnboardingStep(4, { members: validMembers });
        break;
      }
      case 5: {
        await API.saveOnboardingStep(5, { zones: this.zones });
        break;
      }
      case 6: {
        const container = document.getElementById("ob-suppliers-list");
        if (container) {
          container.querySelectorAll("input").forEach((el) => {
            const idx = parseInt(el.dataset.index);
            const field = el.dataset.field;
            if (idx >= 0 && field && this.suppliers[idx]) {
              this.suppliers[idx][field] = el.value;
            }
          });
        }
        const validSuppliers = this.suppliers.filter((s) => s.name && s.name.trim());
        await API.saveOnboardingStep(6, { suppliers: validSuppliers });
        break;
      }
    }
  }
  async skip() {
    try {
      await API.saveOnboardingStep(this.step, this.step === 3 ? { tables: [] } : {});
    } catch (e) {
    }
    this.next();
  }
  next() {
    if (this.step < this.totalSteps) {
      this.direction = "next";
      this.step++;
      this.renderStep();
    }
  }
  prev() {
    if (this.step > 1) {
      this.direction = "prev";
      this.step--;
      this.renderStep();
    }
  }
  complete() {
    try {
      const stored = JSON.parse(localStorage.getItem("restosuite_account") || "{}");
      stored.onboarding_step = 7;
      localStorage.setItem("restosuite_account", JSON.stringify(stored));
    } catch (e) {
    }
    this.overlay.classList.remove("visible");
    setTimeout(() => {
      this.overlay.remove();
    }, 300);
    if (this.onComplete) this.onComplete();
  }
}
function shouldShowOnboarding() {
  const account = getAccount();
  if (!account) return false;
  return account.onboarding_step < 7;
}
function showOnboardingIfNeeded(callback) {
  if (shouldShowOnboarding()) {
    const wizard = new OnboardingWizard(callback);
    wizard.show();
    return true;
  }
  return false;
}
const AVATAR_COLORS = [
  "#E8722A",
  "#2D8B55",
  "#4A90D9",
  "#D93025",
  "#E5A100",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316"
];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function renderAvatar(name, size = 40) {
  const color = getAvatarColor(name);
  const letter = (name || "?").charAt(0).toUpperCase();
  return `<div class="account-avatar" style="width:${size}px;height:${size}px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size * 0.45}px;color:#fff;flex-shrink:0">${letter}</div>`;
}
class LoginView {
  constructor() {
    this.mode = "choice";
    this.staffMembers = [];
    this.selectedMember = null;
    this.restaurantName = "";
    this.pinDigits = [];
  }
  async render() {
    const app = document.getElementById("app");
    const nav = document.getElementById("nav");
    if (nav) nav.style.display = "none";
    switch (this.mode) {
      case "choice":
        this.renderChoice(app);
        break;
      case "gerant":
        this.renderGerant(app);
        break;
      case "register":
        this.renderRegister(app);
        break;
      case "staff-password":
        this.renderStaffPassword(app);
        break;
      case "team-picker":
        this.renderTeamPicker(app);
        break;
      case "staff-pin":
        this.renderStaffPin(app);
        break;
      case "create-pin":
        this.renderCreatePin(app);
        break;
    }
  }
  // ─── Choice Screen ───
  renderChoice(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <div class="login-logo">
            <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 80px; width: auto;">
          </div>
          <h1 class="login-title">Resto<span class="text-accent">Suite</span></h1>
          <p class="login-tagline">Votre cuisine tourne. Vos chiffres suivent.</p>

          <div style="display:flex;flex-direction:column;gap:16px;margin-top:var(--space-6);width:100%">
            <button class="btn btn-primary" id="btn-gerant" style="padding:16px;font-size:var(--text-base);display:flex;align-items:center;justify-content:center;gap:10px">
              <span style="font-size:1.4rem">\u{1F451}</span> G\xE9rant
            </button>
            <button class="btn btn-secondary" id="btn-staff" style="padding:16px;font-size:var(--text-base);display:flex;align-items:center;justify-content:center;gap:10px">
              <span style="font-size:1.4rem">\u{1F465}</span> \xC9quipe
            </button>
          </div>

          <div style="margin-top:var(--space-6);text-align:center">
            <a href="#" id="link-register" style="color:var(--text-tertiary);font-size:var(--text-sm);text-decoration:none">
              Pas encore de compte ? <span style="color:var(--color-accent)">Essai gratuit 60 jours</span>
            </a>
          </div>
        </div>
      </div>
    `;
    document.getElementById("btn-gerant").addEventListener("click", () => {
      this.mode = "gerant";
      this.render();
    });
    document.getElementById("btn-staff").addEventListener("click", () => {
      this.mode = "staff-password";
      this.render();
    });
    document.getElementById("link-register").addEventListener("click", (e) => {
      e.preventDefault();
      this.mode = "register";
      this.render();
    });
  }
  // ─── Gérant Login ───
  renderGerant(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <button class="login-back" id="back-btn">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i> Retour
          </button>
          <div class="login-logo">
            <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 60px; width: auto;">
          </div>
          <h2 class="login-subtitle">Connexion g\xE9rant</h2>

          <div style="text-align:left;width:100%;margin-top:var(--space-4)">
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="login-email" placeholder="votre@email.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label>Mot de passe</label>
              <input type="password" class="form-control" id="login-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="current-password">
            </div>
          </div>

          <div id="login-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);min-height:20px"></div>

          <button class="btn btn-primary" id="login-submit" style="margin-top:var(--space-3);width:100%;padding:12px;font-size:var(--text-base)">
            Se connecter
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    document.getElementById("back-btn").addEventListener("click", () => {
      this.mode = "choice";
      this.render();
    });
    document.getElementById("login-submit").addEventListener("click", () => this.handleGerantLogin());
    document.getElementById("login-password").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleGerantLogin();
    });
  }
  async handleGerantLogin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    const submitBtn = document.getElementById("login-submit");
    errorEl.textContent = "";
    if (!email) {
      errorEl.textContent = "L'email est requis";
      return;
    }
    if (!password) {
      errorEl.textContent = "Le mot de passe est requis";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Connexion...";
    try {
      const result = await API.login({ email, password });
      localStorage.setItem("restosuite_token", result.token);
      localStorage.setItem("restosuite_account", JSON.stringify(result.account));
      const nav = document.getElementById("nav");
      if (nav) nav.style.display = "";
      if (result.account.onboarding_step < 7 && result.account.is_owner) {
        const wizard = new OnboardingWizard(() => {
          bootApp(result.account.role, result.account);
        });
        wizard.show();
      } else {
        bootApp(result.account.role, result.account);
      }
    } catch (e) {
      errorEl.textContent = e.message || "Erreur de connexion";
      submitBtn.disabled = false;
      submitBtn.textContent = "Se connecter";
    }
  }
  // ─── Register ───
  renderRegister(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <button class="login-back" id="back-btn">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i> Retour
          </button>
          <div class="login-logo">
            <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 60px; width: auto;">
          </div>
          <h2 class="login-subtitle">Cr\xE9er un compte</h2>
          <p class="login-tagline">Essai gratuit 60 jours \u2014 aucun engagement</p>

          <div style="text-align:left;width:100%;margin-top:var(--space-4)">
            <div style="display:flex;gap:var(--space-3)">
              <div class="form-group" style="flex:1">
                <label>Pr\xE9nom</label>
                <input type="text" class="form-control" id="reg-firstname" placeholder="Paul" autocomplete="given-name">
              </div>
              <div class="form-group" style="flex:1">
                <label>Nom</label>
                <input type="text" class="form-control" id="reg-lastname" placeholder="Dupont" autocomplete="family-name">
              </div>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="reg-email" placeholder="votre@email.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label>Mot de passe (6 caract\xE8res min.)</label>
              <input type="password" class="form-control" id="reg-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label>Confirmer le mot de passe</label>
              <input type="password" class="form-control" id="reg-password2" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
            </div>
            <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border-default)">
              <div style="display:flex;align-items:flex-start;gap:var(--space-3);margin-bottom:var(--space-3);padding:var(--space-3);background:var(--bg-secondary);border-radius:var(--radius-md)">
                <span style="font-size:1.3rem;line-height:1">\u{1F4A1}</span>
                <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5">
                  <strong>Deux mots de passe, deux acc\xE8s :</strong><br>
                  <strong style="color:var(--text-primary)">Votre mot de passe</strong> (ci-dessus) est personnel et donne acc\xE8s complet au logiciel.<br>
                  <strong style="color:var(--text-primary)">Le mot de passe \xE9quipe</strong> (ci-dessous) est un code simple que vous partagez avec votre staff pour qu'ils acc\xE8dent \xE0 leur espace limit\xE9.
                </div>
              </div>
              <div class="form-group">
                <label>Mot de passe \xE9quipe (partag\xE9 avec le staff)</label>
                <input type="text" class="form-control" id="reg-staff-password" placeholder="ex: resto2026" autocomplete="off"
                       style="font-family:var(--font-mono);letter-spacing:0.05em">
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-1)">Optionnel \u2014 vous pourrez le configurer plus tard dans \xC9quipe.</p>
            </div>
          </div>

          <div id="reg-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);min-height:20px"></div>

          <button class="btn btn-primary" id="reg-submit" style="margin-top:var(--space-3);width:100%;padding:12px;font-size:var(--text-base)">
            Cr\xE9er mon compte
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    document.getElementById("back-btn").addEventListener("click", () => {
      this.mode = "choice";
      this.render();
    });
    document.getElementById("reg-submit").addEventListener("click", () => this.handleRegister());
    document.getElementById("reg-password2").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleRegister();
    });
  }
  async handleRegister() {
    const firstName = document.getElementById("reg-firstname").value.trim();
    const lastName = document.getElementById("reg-lastname").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const password2 = document.getElementById("reg-password2").value;
    const staffPassword = document.getElementById("reg-staff-password").value.trim();
    const errorEl = document.getElementById("reg-error");
    const submitBtn = document.getElementById("reg-submit");
    errorEl.textContent = "";
    if (!email) {
      errorEl.textContent = "L'email est requis";
      return;
    }
    if (!password || password.length < 6) {
      errorEl.textContent = "Le mot de passe doit faire au moins 6 caract\xE8res";
      return;
    }
    if (password !== password2) {
      errorEl.textContent = "Les mots de passe ne correspondent pas";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Cr\xE9ation...";
    try {
      const result = await API.register({ email, password, first_name: firstName, last_name: lastName, staff_password: staffPassword || void 0 });
      localStorage.setItem("restosuite_token", result.token);
      localStorage.setItem("restosuite_account", JSON.stringify(result.account));
      const nav = document.getElementById("nav");
      if (nav) nav.style.display = "none";
      const wizard = new OnboardingWizard(() => {
        if (nav) nav.style.display = "";
        bootApp(result.account.role, result.account);
      });
      wizard.show();
    } catch (e) {
      errorEl.textContent = e.message || "Erreur lors de l'inscription";
      submitBtn.disabled = false;
      submitBtn.textContent = "Cr\xE9er mon compte";
    }
  }
  // ─── Staff Password ───
  renderStaffPassword(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <button class="login-back" id="back-btn">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i> Retour
          </button>
          <div style="margin-bottom:var(--space-4)">
            <span style="font-size:2.5rem">\u{1F465}</span>
          </div>
          <h2 class="login-subtitle">Acc\xE8s \xE9quipe</h2>
          <p class="login-tagline">Entrez le mot de passe du restaurant</p>

          <div style="text-align:left;width:100%;margin-top:var(--space-4)">
            <div class="form-group">
              <label>Mot de passe restaurant</label>
              <input type="password" class="form-control" id="staff-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="off" style="text-align:center;font-size:1.2rem;letter-spacing:4px">
            </div>
          </div>

          <div id="staff-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);min-height:20px"></div>

          <button class="btn btn-primary" id="staff-submit" style="margin-top:var(--space-3);width:100%;padding:12px;font-size:var(--text-base)">
            Continuer
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    document.getElementById("back-btn").addEventListener("click", () => {
      this.mode = "choice";
      this.render();
    });
    document.getElementById("staff-submit").addEventListener("click", () => this.handleStaffPassword());
    document.getElementById("staff-password").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleStaffPassword();
    });
    document.getElementById("staff-password").focus();
  }
  async handleStaffPassword() {
    const password = document.getElementById("staff-password").value;
    const errorEl = document.getElementById("staff-error");
    const submitBtn = document.getElementById("staff-submit");
    errorEl.textContent = "";
    if (!password) {
      errorEl.textContent = "Le mot de passe est requis";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "V\xE9rification...";
    try {
      const result = await API.staffLogin(password);
      this.staffMembers = result.members;
      this.restaurantName = result.restaurant_name;
      if (this.staffMembers.length === 0) {
        errorEl.textContent = "Aucun membre d'\xE9quipe trouv\xE9. Le g\xE9rant doit d'abord cr\xE9er des comptes.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Continuer";
        return;
      }
      this.mode = "team-picker";
      this.render();
    } catch (e) {
      errorEl.textContent = e.message || "Mot de passe incorrect";
      submitBtn.disabled = false;
      submitBtn.textContent = "Continuer";
    }
  }
  // ─── Team Picker ───
  renderTeamPicker(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:500px">
          <button class="login-back" id="back-btn">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i> Retour
          </button>
          <h2 class="login-subtitle">${escapeHtml(this.restaurantName)}</h2>
          <p class="login-tagline">Qui \xEAtes-vous ?</p>

          <div class="team-picker-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:16px;margin-top:var(--space-5);width:100%">
            ${this.staffMembers.map((m) => `
              <button class="team-picker-card" data-id="${m.id}" style="
                display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 12px;
                border-radius:var(--radius-lg);border:2px solid var(--border-primary);
                background:var(--bg-secondary);cursor:pointer;transition:all 0.2s;
              ">
                ${renderAvatar(m.name, 56)}
                <span style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary);text-align:center">${escapeHtml(m.name)}</span>
                <span style="font-size:11px;color:var(--text-tertiary)">${_getRoleLabel(m.role)}</span>
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    document.getElementById("back-btn").addEventListener("click", () => {
      this.mode = "staff-password";
      this.render();
    });
    document.querySelectorAll(".team-picker-card").forEach((card) => {
      card.addEventListener("mouseenter", () => {
        card.style.borderColor = "var(--color-accent)";
        card.style.background = "var(--bg-tertiary)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.borderColor = "var(--border-primary)";
        card.style.background = "var(--bg-secondary)";
      });
      card.addEventListener("click", () => {
        const id = parseInt(card.dataset.id);
        this.selectedMember = this.staffMembers.find((m) => m.id === id);
        this.mode = this.selectedMember.has_pin ? "staff-pin" : "create-pin";
        this.render();
      });
    });
  }
  // ─── Staff PIN ───
  renderStaffPin(app) {
    const member = this.selectedMember;
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content pin-content">
          <button class="login-back" id="pin-back">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i> Retour
          </button>

          <div style="margin-bottom:var(--space-3)">
            ${renderAvatar(member.name, 64)}
          </div>
          <h2 class="login-subtitle">${escapeHtml(member.name)}</h2>
          <p class="login-tagline">Entrez votre PIN</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <div class="pin-error" id="pin-error"></div>

          <div class="pin-pad" id="pin-pad">
            <button class="pin-key" data-digit="1">1</button>
            <button class="pin-key" data-digit="2">2</button>
            <button class="pin-key" data-digit="3">3</button>
            <button class="pin-key" data-digit="4">4</button>
            <button class="pin-key" data-digit="5">5</button>
            <button class="pin-key" data-digit="6">6</button>
            <button class="pin-key" data-digit="7">7</button>
            <button class="pin-key" data-digit="8">8</button>
            <button class="pin-key" data-digit="9">9</button>
            <button class="pin-key pin-key--empty"></button>
            <button class="pin-key" data-digit="0">0</button>
            <button class="pin-key pin-key--delete" id="pin-delete">
              <i data-lucide="delete" style="width:24px;height:24px"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    this.pinDigits = [];
    document.getElementById("pin-back").addEventListener("click", () => {
      this.mode = "team-picker";
      this.render();
    });
    const pad = document.getElementById("pin-pad");
    pad.querySelectorAll(".pin-key[data-digit]").forEach((key) => {
      key.addEventListener("click", () => {
        if (this.pinDigits.length >= 4) return;
        this.pinDigits.push(key.dataset.digit);
        this.updatePinDots();
        if (this.pinDigits.length === 4) this.handleStaffPinLogin();
      });
    });
    document.getElementById("pin-delete").addEventListener("click", () => {
      this.pinDigits.pop();
      this.updatePinDots();
      document.getElementById("pin-error").textContent = "";
      document.getElementById("pin-dots").classList.remove("shake");
    });
  }
  // ─── Create PIN (first-time) ───
  renderCreatePin(app) {
    const member = this.selectedMember;
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content pin-content">
          <button class="login-back" id="pin-back">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i> Retour
          </button>

          <div style="margin-bottom:var(--space-3)">
            ${renderAvatar(member.name, 64)}
          </div>
          <h2 class="login-subtitle">${escapeHtml(member.name)}</h2>
          <p class="login-tagline" id="create-pin-label">Cr\xE9ez votre code PIN (4 chiffres)</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <div class="pin-error" id="pin-error"></div>

          <div class="pin-pad" id="pin-pad">
            <button class="pin-key" data-digit="1">1</button>
            <button class="pin-key" data-digit="2">2</button>
            <button class="pin-key" data-digit="3">3</button>
            <button class="pin-key" data-digit="4">4</button>
            <button class="pin-key" data-digit="5">5</button>
            <button class="pin-key" data-digit="6">6</button>
            <button class="pin-key" data-digit="7">7</button>
            <button class="pin-key" data-digit="8">8</button>
            <button class="pin-key" data-digit="9">9</button>
            <button class="pin-key pin-key--empty"></button>
            <button class="pin-key" data-digit="0">0</button>
            <button class="pin-key pin-key--delete" id="pin-delete">
              <i data-lucide="delete" style="width:24px;height:24px"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    this.pinDigits = [];
    this.createPinStep = "choose";
    this.chosenPin = "";
    document.getElementById("pin-back").addEventListener("click", () => {
      if (this.createPinStep === "confirm") {
        this.createPinStep = "choose";
        this.chosenPin = "";
        this.pinDigits = [];
        this.updatePinDots();
        document.getElementById("create-pin-label").textContent = "Cr\xE9ez votre code PIN (4 chiffres)";
        document.getElementById("pin-error").textContent = "";
      } else {
        this.mode = "team-picker";
        this.render();
      }
    });
    const pad = document.getElementById("pin-pad");
    pad.querySelectorAll(".pin-key[data-digit]").forEach((key) => {
      key.addEventListener("click", () => {
        if (this.pinDigits.length >= 4) return;
        this.pinDigits.push(key.dataset.digit);
        this.updatePinDots();
        if (this.pinDigits.length === 4) {
          if (this.createPinStep === "choose") {
            this.chosenPin = this.pinDigits.join("");
            this.pinDigits = [];
            this.createPinStep = "confirm";
            setTimeout(() => {
              this.updatePinDots();
              document.getElementById("create-pin-label").textContent = "Confirmez votre code PIN";
              document.getElementById("pin-dots").querySelectorAll(".pin-dot").forEach((d) => d.classList.remove("filled"));
            }, 200);
          } else {
            const confirmPin = this.pinDigits.join("");
            if (confirmPin === this.chosenPin) {
              this.handleCreatePinSubmit(this.chosenPin);
            } else {
              this.pinDigits = [];
              this.updatePinDots();
              const dotsEl = document.getElementById("pin-dots");
              dotsEl.classList.add("shake");
              document.getElementById("pin-error").textContent = "Les PIN ne correspondent pas. R\xE9essayez.";
              setTimeout(() => dotsEl.classList.remove("shake"), 600);
            }
          }
        }
      });
    });
    document.getElementById("pin-delete").addEventListener("click", () => {
      this.pinDigits.pop();
      this.updatePinDots();
      document.getElementById("pin-error").textContent = "";
      document.getElementById("pin-dots").classList.remove("shake");
    });
  }
  async handleCreatePinSubmit(pin) {
    try {
      const result = await API.staffPinLogin(this.selectedMember.id, pin, true);
      localStorage.setItem("restosuite_token", result.token);
      localStorage.setItem("restosuite_account", JSON.stringify(result.account));
      const nav = document.getElementById("nav");
      if (nav) nav.style.display = "";
      bootApp(result.account.role, result.account);
    } catch (e) {
      this.pinDigits = [];
      this.updatePinDots();
      const errorEl = document.getElementById("pin-error");
      errorEl.textContent = e.message || "Erreur de cr\xE9ation du PIN";
    }
  }
  updatePinDots() {
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((dot, i) => {
      dot.classList.toggle("filled", i < this.pinDigits.length);
    });
  }
  async handleStaffPinLogin() {
    const pin = this.pinDigits.join("");
    try {
      const result = await API.staffPinLogin(this.selectedMember.id, pin);
      localStorage.setItem("restosuite_token", result.token);
      localStorage.setItem("restosuite_account", JSON.stringify(result.account));
      const nav = document.getElementById("nav");
      if (nav) nav.style.display = "";
      bootApp(result.account.role, result.account);
    } catch (e) {
      this.pinDigits = [];
      this.updatePinDots();
      const dotsEl = document.getElementById("pin-dots");
      const errorEl = document.getElementById("pin-error");
      dotsEl.classList.add("shake");
      errorEl.textContent = "PIN incorrect";
      setTimeout(() => dotsEl.classList.remove("shake"), 600);
    }
  }
}
function getAccount() {
  try {
    const stored = localStorage.getItem("restosuite_account");
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}
function _getRoleLabel(role) {
  switch (role) {
    case "gerant":
      return "\u{1F451} G\xE9rant";
    case "cuisinier":
      return "\u{1F468}\u200D\u{1F373} Cuisinier";
    case "salle":
      return "\u{1F37D}\uFE0F Salle";
    case "serveur":
      return "\u{1F37D}\uFE0F Serveur";
    default:
      return role ? `\u{1F464} ${role.charAt(0).toUpperCase() + role.slice(1)}` : "\u{1F464} Membre";
  }
}
function getRole() {
  const account = getAccount();
  if (account) return account.role;
  return localStorage.getItem("restosuite_role");
}
function getPermissions() {
  const account = getAccount();
  if (!account) {
    const role = localStorage.getItem("restosuite_role");
    if (role === "gerant") {
      return { view_recipes: true, view_costs: true, edit_recipes: true, view_suppliers: true, export_pdf: true };
    }
    return { view_recipes: true, view_costs: false, edit_recipes: false, view_suppliers: false, export_pdf: false };
  }
  return account.permissions || {};
}
function applyRole(role) {
  document.body.className = role ? `role-${role}` : "";
  const perms = getPermissions();
  document.body.classList.toggle("perm-no-costs", !perms.view_costs);
  document.body.classList.toggle("perm-no-edit", !perms.edit_recipes);
  document.body.classList.toggle("perm-no-suppliers", !perms.view_suppliers);
  document.body.classList.toggle("perm-no-export", !perms.export_pdf);
}
function logout() {
  clearTrialStatusInterval();
  localStorage.removeItem("restosuite_account");
  localStorage.removeItem("restosuite_token");
  localStorage.removeItem("restosuite_role");
  document.body.className = "";
  location.hash = "";
  location.reload();
}
function renderSupplierLogin() {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  if (nav) nav.style.display = "none";
  let mode = "login";
  let supplierData = null;
  let selectedMember = null;
  function render() {
    if (mode === "login") renderLoginForm();
    else if (mode === "member-picker") renderMemberPicker();
    else if (mode === "member-pin") renderMemberPin();
  }
  function renderLoginForm() {
    app.innerHTML = `
      <div class="login-screen supplier-theme">
        <div class="login-content">
          <div class="login-logo">
            <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 60px; width: auto;">
          </div>
          <h1 class="login-title" style="font-size:var(--text-2xl)">Portail <span style="color:#4A90D9">Fournisseur</span></h1>
          <p class="login-tagline">Connectez-vous \xE0 votre espace fournisseur</p>

          <div style="width:100%;max-width:360px;margin:var(--space-6) auto 0">
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="supplier-email"
                     placeholder="contact@fournisseur.fr" autocomplete="email">
            </div>
            <div class="form-group">
              <label>Mot de passe</label>
              <input type="password" class="form-control" id="supplier-password"
                     placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="current-password">
            </div>
            <div id="supplier-login-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3);text-align:center"></div>
            <button class="btn btn-primary" id="supplier-login-btn" style="width:100%;padding:14px;font-size:var(--text-lg);background:#4A90D9;border-color:#4A90D9">
              <i data-lucide="log-in" style="width:20px;height:20px"></i> Se connecter
            </button>
          </div>

          <button class="btn btn-secondary" id="supplier-login-back" style="margin-top:var(--space-6)">
            <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    document.getElementById("supplier-login-back").addEventListener("click", () => {
      const login = new LoginView();
      login.render();
    });
    const emailInput = document.getElementById("supplier-email");
    const passwordInput = document.getElementById("supplier-password");
    const loginBtn = document.getElementById("supplier-login-btn");
    const errorEl = document.getElementById("supplier-login-error");
    async function doLogin() {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        errorEl.textContent = "Email et mot de passe requis";
        return;
      }
      errorEl.textContent = "";
      loginBtn.disabled = true;
      loginBtn.textContent = "Connexion...";
      try {
        const result = await API.supplierCompanyLogin(email, password);
        if (result.token && result.auto_login) {
          setSupplierSession(result);
          bootSupplierApp(result);
          return;
        }
        if (result.members && result.members.length > 0) {
          supplierData = result;
          mode = "member-picker";
          render();
          return;
        }
        errorEl.textContent = "Aucun membre configur\xE9. Demandez au restaurant d'ajouter vos comptes.";
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i data-lucide="log-in" style="width:20px;height:20px"></i> Se connecter';
        if (window.lucide) lucide.createIcons();
      } catch (e) {
        errorEl.textContent = e.message || "Erreur de connexion";
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i data-lucide="log-in" style="width:20px;height:20px"></i> Se connecter';
        if (window.lucide) lucide.createIcons();
      }
    }
    loginBtn.addEventListener("click", doLogin);
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
    emailInput.focus();
  }
  function renderMemberPicker() {
    const members = supplierData.members || [];
    app.innerHTML = `
      <div class="login-screen supplier-theme">
        <div class="login-content">
          <div class="login-logo">
            <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 50px; width: auto;">
          </div>
          <h1 class="login-title" style="font-size:var(--text-xl)">${escapeHtml(supplierData.supplier_name)}</h1>
          <p class="login-tagline">Qui se connecte ?</p>

          <div class="team-picker-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-4);width:100%;max-width:480px;margin:var(--space-6) auto 0">
            ${members.map((m) => `
              <button class="team-picker-card" data-id="${m.id}" data-name="${escapeHtml(m.name)}"
                style="display:flex;flex-direction:column;align-items:center;gap:var(--space-2);padding:var(--space-5) var(--space-3);
                       background:var(--bg-elevated);border:2px solid var(--border-default);border-radius:var(--radius-lg);
                       cursor:pointer;transition:all 0.15s ease;color:var(--text-primary);font-size:var(--text-base)">
                ${renderAvatar(m.name, 56)}
                <span style="font-weight:600">${escapeHtml(m.name)}</span>
              </button>
            `).join("")}
          </div>

          <button class="btn btn-secondary" id="supplier-picker-back" style="margin-top:var(--space-6)">
            <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Changer de compte
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    document.querySelectorAll(".team-picker-card").forEach((card) => {
      card.addEventListener("mouseenter", () => {
        card.style.borderColor = "#4A90D9";
        card.style.transform = "translateY(-2px)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.borderColor = "var(--border-default)";
        card.style.transform = "";
      });
      card.addEventListener("click", () => {
        selectedMember = {
          id: Number(card.dataset.id),
          name: card.dataset.name
        };
        mode = "member-pin";
        render();
      });
    });
    document.getElementById("supplier-picker-back").addEventListener("click", () => {
      mode = "login";
      supplierData = null;
      render();
    });
  }
  function renderMemberPin() {
    app.innerHTML = `
      <div class="login-screen supplier-theme">
        <div class="login-content">
          <div class="login-logo">
            ${renderAvatar(selectedMember.name, 72)}
          </div>
          <h1 class="login-title" style="font-size:var(--text-xl)">${escapeHtml(selectedMember.name)}</h1>
          <p class="login-tagline">Entrez votre code PIN</p>

          <div style="width:100%;max-width:280px;margin:var(--space-5) auto 0">
            <div class="pin-display" id="pin-display" style="display:flex;justify-content:center;gap:var(--space-3);margin-bottom:var(--space-5)">
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
            </div>
            <div id="supplier-pin-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3);text-align:center"></div>
            <div class="pin-pad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);max-width:240px;margin:0 auto">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "\u232B"].map((k) => k === "" ? "<div></div>" : `
                <button class="pin-key" data-key="${k}"
                  style="padding:var(--space-4);font-size:var(--text-xl);font-weight:600;border-radius:var(--radius-lg);
                         background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);
                         cursor:pointer;transition:background 0.1s">${k}</button>
              `).join("")}
            </div>
          </div>

          <button class="btn btn-secondary" id="supplier-pin-back" style="margin-top:var(--space-6)">
            <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    let pinValue = "";
    const dots = document.querySelectorAll(".pin-dot");
    const errorEl = document.getElementById("supplier-pin-error");
    function updateDots() {
      dots.forEach((dot, i) => {
        dot.style.background = i < pinValue.length ? "#4A90D9" : "transparent";
      });
    }
    async function submitPin() {
      errorEl.textContent = "";
      try {
        const result = await API.supplierMemberPin(supplierData.supplier_id, selectedMember.id, pinValue);
        setSupplierSession(result);
        bootSupplierApp(result);
      } catch (e) {
        errorEl.textContent = e.message || "PIN incorrect";
        pinValue = "";
        updateDots();
        const display = document.getElementById("pin-display");
        if (display) {
          display.style.animation = "shake 0.4s";
          setTimeout(() => display.style.animation = "", 400);
        }
      }
    }
    document.querySelectorAll(".pin-key").forEach((key) => {
      key.addEventListener("click", () => {
        const k = key.dataset.key;
        if (k === "\u232B") {
          pinValue = pinValue.slice(0, -1);
          updateDots();
        } else if (pinValue.length < 4) {
          pinValue += k;
          updateDots();
          if (pinValue.length === 4) {
            setTimeout(submitPin, 200);
          }
        }
      });
    });
    document.addEventListener("keydown", function pinKeyHandler(e) {
      if (mode !== "member-pin") {
        document.removeEventListener("keydown", pinKeyHandler);
        return;
      }
      if (/^\d$/.test(e.key) && pinValue.length < 4) {
        pinValue += e.key;
        updateDots();
        if (pinValue.length === 4) setTimeout(submitPin, 200);
      } else if (e.key === "Backspace") {
        pinValue = pinValue.slice(0, -1);
        updateDots();
      }
    });
    document.getElementById("supplier-pin-back").addEventListener("click", () => {
      mode = "member-picker";
      selectedMember = null;
      render();
    });
  }
  render();
}
function bootSupplierApp(session) {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  if (nav) nav.style.display = "none";
  document.body.classList.add("supplier-mode");
  app.innerHTML = `
    <div class="supplier-shell">
      <header class="supplier-header">
        <div class="supplier-header__left">
          <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 28px; width: auto; margin-right: 8px;">
          <div>
            <span class="supplier-header__title">Portail Fournisseur</span>
            <span class="supplier-header__name">${escapeHtml(session.supplier_name || session.name)}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="supplier-logout">
          <i data-lucide="log-out" style="width:16px;height:16px"></i> D\xE9connexion
        </button>
      </header>
      <nav class="supplier-nav">
        <button class="supplier-nav__tab active" data-tab="catalog">
          <i data-lucide="package" style="width:18px;height:18px"></i> Catalogue
        </button>
        <button class="supplier-nav__tab" data-tab="deliveries">
          <i data-lucide="truck" style="width:18px;height:18px"></i> Livraisons
        </button>
        <button class="supplier-nav__tab" data-tab="history">
          <i data-lucide="history" style="width:18px;height:18px"></i> Historique
        </button>
      </nav>
      <main class="supplier-main" id="supplier-content"></main>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById("supplier-logout").addEventListener("click", () => {
    clearSupplierSession();
    document.body.classList.remove("supplier-mode");
    location.reload();
  });
  document.querySelectorAll(".supplier-nav__tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".supplier-nav__tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      if (tab.dataset.tab === "catalog") renderSupplierCatalogTab();
      else if (tab.dataset.tab === "deliveries") renderSupplierDeliveriesTab();
      else renderSupplierHistoryTab();
    });
  });
  renderSupplierCatalogTab();
}
async function renderSupplierCatalogTab() {
  const content = document.getElementById("supplier-content");
  if (!content) return;
  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Mon catalogue</h2>
      <button class="btn btn-primary" id="btn-add-product" style="background:#4A90D9;border-color:#4A90D9">
        <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter
      </button>
    </div>
    <div id="supplier-catalog-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById("btn-add-product").addEventListener("click", showAddProductModal);
  try {
    const catalog = await API.getSupplierCatalog();
    const listEl = document.getElementById("supplier-catalog-list");
    if (catalog.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="package-open"></i></div>
          <p>Votre catalogue est vide</p>
          <p class="text-secondary text-sm">Ajoutez vos produits pour que le restaurant puisse voir vos tarifs</p>
          <button class="btn btn-primary" onclick="showAddProductModal()" style="background:#4A90D9;border-color:#4A90D9">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter un produit
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }
    const categories = {};
    catalog.forEach((p) => {
      const cat = p.category || "Sans cat\xE9gorie";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    });
    listEl.innerHTML = Object.entries(categories).map(([cat, products]) => `
      <div class="supplier-category">
        <h3 class="supplier-category__title">${escapeHtml(cat)}</h3>
        ${products.map((p) => `
          <div class="supplier-product-card ${!p.available ? "supplier-product-card--unavailable" : ""}" data-id="${p.id}">
            <div class="supplier-product-card__info">
              <span class="supplier-product-card__name">${escapeHtml(p.product_name)}</span>
              <span class="supplier-product-card__unit">${escapeHtml(p.unit)}${p.min_order > 0 ? ` \xB7 Min: ${p.min_order}` : ""}</span>
            </div>
            <div class="supplier-product-card__actions">
              <span class="supplier-product-card__price" data-id="${p.id}" data-price="${p.price}" title="Cliquer pour modifier">
                ${formatCurrency(p.price)}
              </span>
              <label class="supplier-toggle" title="${p.available ? "Disponible" : "Indisponible"}">
                <input type="checkbox" ${p.available ? "checked" : ""} data-toggle-id="${p.id}">
                <span class="supplier-toggle__slider"></span>
              </label>
              <button class="btn-icon supplier-product-card__delete" aria-label="Supprimer le produit" data-delete-id="${p.id}" data-delete-name="${escapeHtml(p.product_name)}" title="Supprimer">
                <i data-lucide="trash-2" style="width:16px;height:16px"></i>
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");
    if (window.lucide) lucide.createIcons();
    listEl.querySelectorAll(".supplier-product-card__price").forEach((priceEl) => {
      priceEl.addEventListener("click", () => {
        const id = priceEl.dataset.id;
        const currentPrice = parseFloat(priceEl.dataset.price);
        startInlinePriceEdit(priceEl, id, currentPrice);
      });
    });
    listEl.querySelectorAll("[data-toggle-id]").forEach((toggle) => {
      toggle.addEventListener("change", async () => {
        const id = toggle.dataset.toggleId;
        try {
          await API.toggleSupplierProductAvailability(id, toggle.checked);
          showToast(toggle.checked ? "Produit disponible" : "Produit indisponible", "success");
          renderSupplierCatalogTab();
        } catch (e) {
          showToast(e.message, "error");
          toggle.checked = !toggle.checked;
        }
      });
    });
    listEl.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteId;
        const name = btn.dataset.deleteName;
        showConfirmModal("Retirer le produit", `\xCAtes-vous s\xFBr de vouloir retirer "${name}" du catalogue ?`, async () => {
          try {
            await API.deleteSupplierProduct(id);
            showToast("Produit retir\xE9", "success");
            renderSupplierCatalogTab();
          } catch (e) {
            showToast(e.message, "error");
          }
        }, { confirmText: "Retirer", confirmClass: "btn btn-danger" });
        return;
      });
    });
  } catch (e) {
    document.getElementById("supplier-catalog-list").innerHTML = `<p class="text-danger">Erreur: ${escapeHtml(e.message)}</p>`;
  }
}
function startInlinePriceEdit(priceEl, id, currentPrice) {
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  input.min = "0";
  input.value = currentPrice.toFixed(2);
  input.className = "supplier-price-input";
  input.style.cssText = "width:80px;font-family:var(--font-mono);font-size:var(--text-base);text-align:right;padding:4px 8px;border-radius:var(--radius-sm);border:2px solid #4A90D9;background:var(--bg-base);color:var(--text-primary)";
  const originalHTML = priceEl.innerHTML;
  priceEl.innerHTML = "";
  priceEl.appendChild(input);
  input.focus();
  input.select();
  async function savePrice() {
    const newPrice = parseFloat(input.value);
    if (isNaN(newPrice) || newPrice < 0) {
      priceEl.innerHTML = originalHTML;
      return;
    }
    if (newPrice === currentPrice) {
      priceEl.innerHTML = originalHTML;
      return;
    }
    try {
      await API.updateSupplierProduct(id, { price: newPrice });
      showToast("Prix mis \xE0 jour", "success");
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message, "error");
      priceEl.innerHTML = originalHTML;
    }
  }
  input.addEventListener("blur", savePrice);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      priceEl.innerHTML = originalHTML;
    }
  });
}
function showAddProductModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Ajouter un produit</h2>
      <div class="form-group">
        <label>Nom du produit</label>
        <input type="text" class="form-control" id="m-prod-name" placeholder="ex: Tomates bio">
      </div>
      <div class="form-group">
        <label>Cat\xE9gorie</label>
        <input type="text" class="form-control" id="m-prod-category" placeholder="ex: L\xE9gumes, Viandes, Cr\xE8merie...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix (\u20AC)</label>
          <input type="number" class="form-control" id="m-prod-price" step="0.01" min="0" placeholder="0.00"
                 style="font-family:var(--font-mono)">
        </div>
        <div class="form-group">
          <label>Unit\xE9</label>
          <select class="form-control" id="m-prod-unit">
            <option value="kg">kg</option>
            <option value="L">L</option>
            <option value="pi\xE8ce">pi\xE8ce</option>
            <option value="botte">botte</option>
            <option value="barquette">barquette</option>
            <option value="carton">carton</option>
            <option value="sac">sac</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Commande minimum (optionnel)</label>
        <input type="number" class="form-control" id="m-prod-min" step="0.1" min="0" value="0">
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-prod-save" style="background:#4A90D9;border-color:#4A90D9">
          <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter
        </button>
        <button class="btn btn-secondary" id="m-prod-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.querySelector("#m-prod-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#m-prod-save").onclick = async () => {
    const product_name = document.getElementById("m-prod-name").value.trim();
    const category = document.getElementById("m-prod-category").value.trim();
    const price = parseFloat(document.getElementById("m-prod-price").value);
    const unit = document.getElementById("m-prod-unit").value;
    const min_order = parseFloat(document.getElementById("m-prod-min").value) || 0;
    if (!product_name) {
      showToast("Nom du produit requis", "error");
      return;
    }
    if (isNaN(price) || price < 0) {
      showToast("Prix invalide", "error");
      return;
    }
    try {
      await API.addSupplierProduct({ product_name, category: category || null, price, unit, min_order });
      showToast("Produit ajout\xE9", "success");
      overlay.remove();
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message, "error");
    }
  };
  document.getElementById("m-prod-name").focus();
}
async function renderSupplierHistoryTab() {
  const content = document.getElementById("supplier-content");
  if (!content) return;
  content.innerHTML = `
    <h2 style="margin:0 0 var(--space-4);font-size:var(--text-xl)">Historique des modifications</h2>
    <div id="supplier-history-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  try {
    const history = await API.getSupplierHistory();
    const listEl = document.getElementById("supplier-history-list");
    if (history.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="clock"></i></div>
          <p>Aucune modification pour le moment</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }
    listEl.innerHTML = history.map((h) => `
      <div class="notification-item" style="margin-bottom:var(--space-2)">
        <div class="notification-icon">${getHistoryIcon(h.change_type)}</div>
        <div class="notification-content">
          <strong>${escapeHtml(h.product_name)}</strong>
          <br><span class="text-secondary text-sm">${getHistoryLabel(h)}</span>
        </div>
        <span class="text-tertiary text-sm">${formatDateShort(h.created_at)}</span>
      </div>
    `).join("");
  } catch (e) {
    document.getElementById("supplier-history-list").innerHTML = `<p class="text-danger">Erreur: ${escapeHtml(e.message)}</p>`;
  }
}
function getHistoryIcon(type) {
  switch (type) {
    case "new":
      return "\u{1F195}";
    case "update":
      return "\u{1F4B0}";
    case "removed":
      return "\u{1F5D1}\uFE0F";
    case "unavailable":
      return "\u26A0\uFE0F";
    default:
      return "\u{1F4DD}";
  }
}
function getHistoryLabel(h) {
  switch (h.change_type) {
    case "new":
      return `Ajout\xE9 au catalogue \u2014 ${formatCurrency(h.new_price)}`;
    case "update":
      return `Prix modifi\xE9: ${formatCurrency(h.old_price)} \u2192 ${formatCurrency(h.new_price)}`;
    case "removed":
      return "Retir\xE9 du catalogue";
    case "unavailable":
      return "Marqu\xE9 indisponible";
    default:
      return "Modification";
  }
}
function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
async function renderSupplierDeliveriesTab() {
  const content = document.getElementById("supplier-content");
  if (!content) return;
  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Mes bons de livraison</h2>
      <button class="btn btn-primary" id="btn-new-delivery" style="background:#4A90D9;border-color:#4A90D9">
        <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau bon
      </button>
    </div>
    <div id="supplier-deliveries-list">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById("btn-new-delivery").addEventListener("click", showNewDeliveryForm);
  await loadSupplierDeliveries();
}
async function loadSupplierDeliveries() {
  const list = document.getElementById("supplier-deliveries-list");
  if (!list) return;
  try {
    const notes = await API.getSupplierDeliveryNotes();
    if (notes.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:var(--space-8);color:var(--text-secondary)">
          <div style="font-size:3rem;margin-bottom:var(--space-3)">\u{1F4C4}</div>
          <p>Aucun bon de livraison</p>
          <p class="text-sm">Cr\xE9ez votre premier bon de livraison pour envoyer vos produits.</p>
        </div>
      `;
      return;
    }
    const statusColors = { pending: "#E8722A", received: "#22c55e", partial: "#eab308", rejected: "#ef4444" };
    const statusLabels = { pending: "En attente", received: "Re\xE7u", partial: "Partiel", rejected: "Refus\xE9" };
    list.innerHTML = notes.map((n) => `
      <div class="card supplier-delivery-card" data-id="${n.id}" style="padding:var(--space-4);margin-bottom:var(--space-3);border-left:4px solid ${statusColors[n.status] || "#666"};border-radius:var(--radius-lg);background:var(--bg-elevated);cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>Bon #${n.id}</strong>
            <span class="text-secondary text-sm" style="margin-left:var(--space-2)">
              ${n.delivery_date || new Date(n.created_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <span class="badge" style="background:${statusColors[n.status]};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md)">
            ${statusLabels[n.status] || n.status}
          </span>
        </div>
        <div class="text-secondary text-sm" style="margin-top:var(--space-2)">
          ${n.item_count} produit${n.item_count > 1 ? "s" : ""}
          ${n.total_amount ? ` \u2014 ${n.total_amount.toFixed(2)} \u20AC` : ""}
        </div>
      </div>
    `).join("");
    list.querySelectorAll(".supplier-delivery-card").forEach((card) => {
      card.addEventListener("click", () => showSupplierDeliveryDetail(Number(card.dataset.id)));
    });
  } catch (e) {
    list.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
async function showSupplierDeliveryDetail(id) {
  const content = document.getElementById("supplier-content");
  try {
    const d = await API.getSupplierDeliveryNote(id);
    const statusLabels = { pending: "\u{1F7E0} En attente", received: "\u{1F7E2} Re\xE7u", partial: "\u{1F7E1} Partiel", rejected: "\u{1F534} Refus\xE9" };
    content.innerHTML = `
      <div style="margin-bottom:var(--space-4)">
        <button class="btn btn-secondary btn-sm" id="back-supplier-deliveries">\u2190 Retour</button>
      </div>
      <h2>Bon #${d.id} \u2014 ${statusLabels[d.status] || d.status}</h2>
      ${d.delivery_date ? `<p class="text-secondary">Date livraison : ${d.delivery_date}</p>` : ""}
      ${d.notes ? `<p class="text-secondary">\u{1F4DD} ${escapeHtml(d.notes)}</p>` : ""}
      <div style="overflow-x:auto;margin-top:var(--space-4)">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="background:var(--bg-sunken);text-align:left">
              <th style="padding:var(--space-3)">Produit</th>
              <th style="padding:var(--space-3)">Qt\xE9</th>
              <th style="padding:var(--space-3)">Prix/u</th>
              <th style="padding:var(--space-3)">N\xB0 Lot</th>
              <th style="padding:var(--space-3)">DLC</th>
              <th style="padding:var(--space-3)">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${d.items.map((item) => {
      const sc = { accepted: "#22c55e", rejected: "#ef4444", pending: "#888" };
      const sl = { accepted: "\u2705", rejected: "\u274C", pending: "\u23F3" };
      return `
                <tr style="border-bottom:1px solid var(--border-default)">
                  <td style="padding:var(--space-3)">${escapeHtml(item.product_name)}</td>
                  <td style="padding:var(--space-3)">${item.quantity} ${escapeHtml(item.unit)}</td>
                  <td style="padding:var(--space-3)">${item.price_per_unit != null ? item.price_per_unit.toFixed(2) + "\u20AC" : "\u2014"}</td>
                  <td style="padding:var(--space-3);font-family:monospace;font-size:var(--text-xs)">${escapeHtml(item.batch_number || "\u2014")}</td>
                  <td style="padding:var(--space-3)">${item.dlc || "\u2014"}</td>
                  <td style="padding:var(--space-3);color:${sc[item.status]}">${sl[item.status] || item.status}</td>
                </tr>
              `;
    }).join("")}
          </tbody>
        </table>
      </div>
      ${d.total_amount ? `<p style="text-align:right;font-weight:600;margin-top:var(--space-3)">Total : ${d.total_amount.toFixed(2)} \u20AC</p>` : ""}
    `;
    document.getElementById("back-supplier-deliveries").addEventListener("click", renderSupplierDeliveriesTab);
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
function showNewDeliveryForm() {
  const content = document.getElementById("supplier-content");
  content.innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <button class="btn btn-secondary btn-sm" id="back-supplier-deliveries-form">\u2190 Retour</button>
    </div>
    <h2 style="margin-bottom:var(--space-4)">Nouveau bon de livraison</h2>
    <div class="form-group" style="margin-bottom:var(--space-4)">
      <label class="form-label">Date de livraison</label>
      <input type="date" id="dn-date" class="input" value="${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}">
    </div>
    <div class="form-group" style="margin-bottom:var(--space-4)">
      <label class="form-label">Notes</label>
      <textarea id="dn-notes" class="input" rows="2" placeholder="Notes optionnelles..."></textarea>
    </div>
    <h3 style="margin-bottom:var(--space-3)">Produits</h3>
    <div id="dn-items-list"></div>
    <button class="btn btn-secondary" id="dn-add-item" style="margin-bottom:var(--space-5)">
      + Ajouter un produit
    </button>
    <div style="text-align:right">
      <button class="btn btn-primary btn-lg" id="dn-submit" style="background:#4A90D9;border-color:#4A90D9">
        \u{1F4E4} Envoyer le bon
      </button>
    </div>
  `;
  let itemIndex = 0;
  function addItemRow() {
    const list = document.getElementById("dn-items-list");
    const idx = itemIndex++;
    const row = document.createElement("div");
    row.className = "dn-item-row";
    row.dataset.idx = idx;
    row.style.cssText = "background:var(--bg-sunken);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3);position:relative";
    row.innerHTML = `
      <button class="btn btn-secondary btn-sm dn-remove-item" style="position:absolute;top:8px;right:8px;padding:2px 8px;font-size:var(--text-xs)">\u2715</button>
      <div style="display:grid;grid-template-columns:1fr 80px 80px 100px;gap:var(--space-2);margin-bottom:var(--space-2)">
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Produit *</label>
          <input type="text" class="input dn-product-name" placeholder="Nom du produit" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Quantit\xE9 *</label>
          <input type="number" class="input dn-quantity" step="0.01" min="0.01" placeholder="0" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Unit\xE9</label>
          <select class="input dn-unit">
            <option value="kg">kg</option>
            <option value="L">L</option>
            <option value="pi\xE8ce">pi\xE8ce</option>
            <option value="barquette">barquette</option>
            <option value="colis">colis</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Prix/unit\xE9 (\u20AC)</label>
          <input type="number" class="input dn-price" step="0.01" min="0" placeholder="0.00">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 100px;gap:var(--space-2);margin-bottom:var(--space-2)">
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">N\xB0 Lot</label>
          <input type="text" class="input dn-batch" placeholder="N\xB0 lot">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">DLC</label>
          <input type="date" class="input dn-dlc">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">T\xB0 max (\xB0C)</label>
          <input type="number" class="input dn-temp" step="0.1" placeholder="4">
        </div>
      </div>
      <details style="margin-top:var(--space-2)">
        <summary style="cursor:pointer;font-size:var(--text-xs);color:var(--text-secondary)">\u{1F41F} Poisson / \u{1F969} Viande (optionnel)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-top:var(--space-2)">
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">Zone de p\xEAche (FAO)</label>
            <input type="text" class="input dn-fishing-zone" placeholder="Ex: 27.7">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">M\xE9thode de p\xEAche</label>
            <input type="text" class="input dn-fishing-method" placeholder="Ex: chalut">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">Origine (viande)</label>
            <input type="text" class="input dn-origin" placeholder="Ex: France, Charolais">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">N\xB0 agr\xE9ment sanitaire</label>
            <input type="text" class="input dn-sanitary" placeholder="Ex: FR 01.234.567 CE">
          </div>
        </div>
      </details>
    `;
    list.appendChild(row);
    row.querySelector(".dn-remove-item").addEventListener("click", () => row.remove());
  }
  addItemRow();
  document.getElementById("dn-add-item").addEventListener("click", addItemRow);
  document.getElementById("back-supplier-deliveries-form").addEventListener("click", renderSupplierDeliveriesTab);
  document.getElementById("dn-submit").addEventListener("click", async () => {
    const delivery_date = document.getElementById("dn-date").value || null;
    const notes = document.getElementById("dn-notes").value || null;
    const rows = document.querySelectorAll(".dn-item-row");
    const items = [];
    for (const row of rows) {
      const product_name = row.querySelector(".dn-product-name").value.trim();
      const quantity = parseFloat(row.querySelector(".dn-quantity").value);
      if (!product_name || isNaN(quantity) || quantity <= 0) {
        showToast("Chaque produit doit avoir un nom et une quantit\xE9", "error");
        return;
      }
      items.push({
        product_name,
        quantity,
        unit: row.querySelector(".dn-unit").value,
        price_per_unit: parseFloat(row.querySelector(".dn-price").value) || null,
        batch_number: row.querySelector(".dn-batch").value || null,
        dlc: row.querySelector(".dn-dlc").value || null,
        temperature_required: parseFloat(row.querySelector(".dn-temp").value) || null,
        fishing_zone: row.querySelector(".dn-fishing-zone").value || null,
        fishing_method: row.querySelector(".dn-fishing-method").value || null,
        origin: row.querySelector(".dn-origin").value || null,
        sanitary_approval: row.querySelector(".dn-sanitary").value || null
      });
    }
    if (items.length === 0) {
      showToast("Ajoutez au moins un produit", "error");
      return;
    }
    try {
      await API.createSupplierDeliveryNote({ delivery_date, notes, items });
      showToast("Bon de livraison envoy\xE9 !", "success");
      renderSupplierDeliveriesTab();
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  });
}
async function renderDeliveries() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <h1>\u{1F69A} Livraisons</h1>
      <p class="text-secondary">R\xE9ception et suivi des bons de livraison</p>
    </div>
    <div class="delivery-tabs" style="display:flex;gap:var(--space-2);margin-bottom:var(--space-5);flex-wrap:wrap">
      <button class="btn btn-accent delivery-tab active" data-status="">Tous</button>
      <button class="btn btn-secondary delivery-tab" data-status="pending">\u{1F7E0} En attente</button>
      <button class="btn btn-secondary delivery-tab" data-status="received">\u{1F7E2} Re\xE7us</button>
      <button class="btn btn-secondary delivery-tab" data-status="partial">\u{1F7E1} Partiels</button>
      <button class="btn btn-secondary delivery-tab" data-status="rejected">\u{1F534} Refus\xE9s</button>
    </div>
    <div id="dlc-alerts-banner"></div>
    <div id="deliveries-content">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  document.querySelectorAll(".delivery-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".delivery-tab").forEach((t) => {
        t.classList.remove("active", "btn-accent");
        t.classList.add("btn-secondary");
      });
      tab.classList.add("active", "btn-accent");
      tab.classList.remove("btn-secondary");
      loadDeliveries(tab.dataset.status || null);
    });
  });
  try {
    const alerts = await API.getDlcAlerts();
    const banner = document.getElementById("dlc-alerts-banner");
    if (alerts.length > 0) {
      banner.innerHTML = `
        <div style="background:var(--color-warning-light, #fff3cd);border:1px solid var(--color-warning, #ffc107);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
          <h3 style="color:var(--color-warning-dark, #856404);margin-bottom:var(--space-2)">\u26A0\uFE0F ${alerts.length} produit${alerts.length > 1 ? "s" : ""} avec DLC proche</h3>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
            ${alerts.map((a) => `
              <span class="badge" style="background:${a.days_remaining <= 1 ? "var(--color-danger)" : "var(--color-warning)"};color:white;font-size:var(--text-sm);padding:4px 10px;border-radius:var(--radius-md)">
                ${escapeHtml(a.product_name)} \u2014 Lot ${escapeHtml(a.batch_number || "?")} \u2014 DLC ${a.dlc} (${a.days_remaining}j)
              </span>
            `).join("")}
          </div>
        </div>
      `;
    }
  } catch (e) {
  }
  await loadDeliveries();
}
async function loadDeliveries(status) {
  const content = document.getElementById("deliveries-content");
  try {
    const deliveries = await API.getDeliveries(status);
    if (deliveries.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--space-8)">
          <div style="font-size:3rem;margin-bottom:var(--space-3)">\u{1F69A}</div>
          <h3>Aucune livraison</h3>
          <p class="text-secondary">Les bons de livraison cr\xE9\xE9s par vos fournisseurs appara\xEEtront ici.</p>
        </div>
      `;
      return;
    }
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-4)">
        ${deliveries.map((d) => renderDeliveryCard(d)).join("")}
      </div>
    `;
    content.querySelectorAll(".delivery-card").forEach((card) => {
      card.addEventListener("click", () => {
        renderDeliveryDetail(Number(card.dataset.id));
      });
    });
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
function renderDeliveryCard(d) {
  const statusColors = { pending: "#E8722A", received: "#22c55e", partial: "#eab308", rejected: "#ef4444" };
  const statusLabels = { pending: "\u{1F7E0} En attente", received: "\u{1F7E2} Re\xE7u", partial: "\u{1F7E1} Partiel", rejected: "\u{1F534} Refus\xE9" };
  const borderColor = statusColors[d.status] || "#666";
  return `
    <div class="card delivery-card" data-id="${d.id}" style="padding:var(--space-4);border-left:4px solid ${borderColor};border-radius:var(--radius-lg);background:var(--bg-elevated);cursor:pointer;transition:transform 0.15s">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3)">
        <div>
          <h3 style="font-size:var(--text-base);font-weight:600;margin:0">${escapeHtml(d.supplier_name)}</h3>
          <span class="text-secondary text-sm">Bon #${d.id}</span>
        </div>
        <span class="badge" style="background:${borderColor};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md)">
          ${statusLabels[d.status] || d.status}
        </span>
      </div>
      <div style="display:flex;gap:var(--space-4);font-size:var(--text-sm);color:var(--text-secondary)">
        <span>\u{1F4C5} ${d.delivery_date || new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
        <span>\u{1F4E6} ${d.item_count} produit${d.item_count > 1 ? "s" : ""}</span>
        ${d.total_amount ? `<span>\u{1F4B0} ${d.total_amount.toFixed(2)}\u20AC</span>` : ""}
      </div>
    </div>
  `;
}
async function renderDeliveryDetail(id) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div style="padding:var(--space-4)">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  try {
    const d = await API.getDelivery(id);
    const account = getAccount();
    const isPending = d.status === "pending";
    app.innerHTML = `
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3)">
        <div>
          <button class="btn btn-secondary btn-sm" id="back-deliveries" style="margin-bottom:var(--space-2)">
            \u2190 Retour
          </button>
          <h1>\u{1F69A} Bon #${d.id} \u2014 ${escapeHtml(d.supplier_name)}</h1>
          <p class="text-secondary">
            ${d.delivery_date ? `Livraison pr\xE9vue : ${d.delivery_date}` : `Cr\xE9\xE9 le ${new Date(d.created_at).toLocaleDateString("fr-FR")}`}
            ${d.received_at ? ` \u2014 R\xE9ceptionn\xE9 le ${new Date(d.received_at).toLocaleDateString("fr-FR")} par ${escapeHtml(d.received_by_name || "?")}` : ""}
          </p>
        </div>
      </div>
      ${d.notes ? `<div style="background:var(--bg-sunken);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-4);font-size:var(--text-sm)">\u{1F4DD} ${escapeHtml(d.notes)}</div>` : ""}
      <div style="overflow-x:auto;margin-bottom:var(--space-5)">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="background:var(--bg-sunken);text-align:left">
              <th style="padding:var(--space-3)">Produit</th>
              <th style="padding:var(--space-3)">Qt\xE9</th>
              <th style="padding:var(--space-3)">N\xB0 Lot</th>
              <th style="padding:var(--space-3)">DLC</th>
              <th style="padding:var(--space-3)">T\xB0 requise</th>
              ${isPending ? '<th style="padding:var(--space-3)">T\xB0 mesur\xE9e</th>' : ""}
              <th style="padding:var(--space-3)">Infos</th>
              ${isPending ? '<th style="padding:var(--space-3)">Action</th>' : '<th style="padding:var(--space-3)">Statut</th>'}
            </tr>
          </thead>
          <tbody>
            ${d.items.map((item) => renderDeliveryItemRow(item, isPending)).join("")}
          </tbody>
        </table>
      </div>
      ${d.total_amount ? `<p style="text-align:right;font-weight:600;font-size:var(--text-lg);margin-bottom:var(--space-4)">Total : ${d.total_amount.toFixed(2)} \u20AC</p>` : ""}
      ${isPending ? `
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;justify-content:flex-end;margin-bottom:var(--space-4)">
          <div class="form-group" style="flex:1;max-width:400px">
            <label class="form-label">Notes de r\xE9ception</label>
            <textarea id="reception-notes" class="input" rows="2" placeholder="Notes optionnelles..."></textarea>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
          <button class="btn btn-accent btn-lg" id="btn-accept-all">\u2705 Tout accepter</button>
          <button class="btn btn-primary btn-lg" id="btn-validate-selection">\u{1F4CB} Valider la s\xE9lection</button>
        </div>
        <p class="text-secondary text-sm" style="text-align:right;margin-top:var(--space-2)">
          R\xE9ceptionn\xE9 par : <strong>${escapeHtml(account ? account.name : "?")}</strong>
        </p>
      ` : ""}
    `;
    document.getElementById("back-deliveries").addEventListener("click", () => renderDeliveries());
    if (isPending) {
      document.getElementById("btn-accept-all").addEventListener("click", () => {
        document.querySelectorAll(".item-action-select").forEach((sel) => sel.value = "accepted");
        submitReception(d);
      });
      document.getElementById("btn-validate-selection").addEventListener("click", () => submitReception(d));
    }
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    app.innerHTML = `<p style="color:var(--color-danger);padding:var(--space-4)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
function renderDeliveryItemRow(item, isPending) {
  var _a, _b;
  const dlcDays = item.dlc ? Math.ceil((new Date(item.dlc) - /* @__PURE__ */ new Date()) / 864e5) : null;
  const dlcWarning = dlcDays !== null && dlcDays <= 3;
  const statusColors = { accepted: "#22c55e", rejected: "#ef4444", pending: "#888" };
  const statusLabels = { accepted: "\u2705 Accept\xE9", rejected: "\u274C Refus\xE9", pending: "\u23F3 En attente" };
  const extraInfo = [];
  if (item.fishing_zone) extraInfo.push(`\u{1F3A3} Zone ${item.fishing_zone}`);
  if (item.fishing_method) extraInfo.push(`\u{1FA9D} ${item.fishing_method}`);
  if (item.origin) extraInfo.push(`\u{1F3F7}\uFE0F ${item.origin}`);
  if (item.sanitary_approval) extraInfo.push(`\u{1F4CB} Agr. ${item.sanitary_approval}`);
  return `
    <tr style="border-bottom:1px solid var(--border-default)" data-item-id="${item.id}">
      <td style="padding:var(--space-3);font-weight:500">${escapeHtml(item.product_name)}</td>
      <td style="padding:var(--space-3)">${formatQuantity(item.quantity, item.unit)}</td>
      <td style="padding:var(--space-3);font-family:var(--font-mono,monospace);font-size:var(--text-xs)">${escapeHtml(item.batch_number || "\u2014")}</td>
      <td style="padding:var(--space-3);${dlcWarning ? "color:var(--color-warning);font-weight:700" : ""}">
        ${item.dlc || "\u2014"}
        ${dlcWarning ? `<br><small style="color:${dlcDays <= 1 ? "var(--color-danger)" : "var(--color-warning)"}">\u26A0\uFE0F ${dlcDays}j restant${dlcDays > 1 ? "s" : ""}</small>` : ""}
      </td>
      <td style="padding:var(--space-3)">${item.temperature_required != null ? item.temperature_required + "\xB0C" : "\u2014"}</td>
      ${isPending ? `
        <td style="padding:var(--space-3)">
          <input type="number" class="input item-temp" step="0.1" value="${(_a = item.temperature_required) != null ? _a : ""}"
                 style="width:80px;font-size:var(--text-sm)" data-item-id="${item.id}" data-temp-required="${(_b = item.temperature_required) != null ? _b : ""}">
          <span class="temp-warning" data-item-id="${item.id}" style="display:none;color:var(--color-danger);font-size:var(--text-xs);font-weight:700">\u26A0\uFE0F T\xB0 trop haute !</span>
        </td>
      ` : ""}
      <td style="padding:var(--space-3);font-size:var(--text-xs)">${extraInfo.length ? extraInfo.join("<br>") : "\u2014"}</td>
      ${isPending ? `
        <td style="padding:var(--space-3)">
          <select class="input item-action-select" data-item-id="${item.id}" style="font-size:var(--text-sm)">
            <option value="accepted">\u2705 Accepter</option>
            <option value="rejected">\u274C Refuser</option>
          </select>
          <input type="text" class="input item-rejection-reason" data-item-id="${item.id}" placeholder="Motif refus..."
                 style="display:none;margin-top:4px;font-size:var(--text-xs);width:140px">
        </td>
      ` : `
        <td style="padding:var(--space-3)">
          <span style="color:${statusColors[item.status] || "#888"};font-weight:600">${statusLabels[item.status] || item.status}</span>
          ${item.rejection_reason ? `<br><small style="color:var(--text-tertiary)">${escapeHtml(item.rejection_reason)}</small>` : ""}
          ${item.temperature_measured != null ? `<br><small>T\xB0 mesur\xE9e : ${item.temperature_measured}\xB0C</small>` : ""}
        </td>
      `}
    </tr>
  `;
}
document.addEventListener("change", (e) => {
  if (e.target.classList.contains("item-temp")) {
    const tempReq = parseFloat(e.target.dataset.tempRequired);
    const tempMeasured = parseFloat(e.target.value);
    const warning = document.querySelector(`.temp-warning[data-item-id="${e.target.dataset.itemId}"]`);
    if (warning && !isNaN(tempReq) && !isNaN(tempMeasured) && tempMeasured > tempReq) {
      warning.style.display = "block";
    } else if (warning) {
      warning.style.display = "none";
    }
  }
  if (e.target.classList.contains("item-action-select")) {
    const reasonInput = document.querySelector(`.item-rejection-reason[data-item-id="${e.target.dataset.itemId}"]`);
    if (reasonInput) {
      reasonInput.style.display = e.target.value === "rejected" ? "block" : "none";
    }
  }
});
async function submitReception(delivery) {
  var _a;
  const items = delivery.items.map((item) => {
    const select = document.querySelector(`.item-action-select[data-item-id="${item.id}"]`);
    const tempInput = document.querySelector(`.item-temp[data-item-id="${item.id}"]`);
    const reasonInput = document.querySelector(`.item-rejection-reason[data-item-id="${item.id}"]`);
    return {
      id: item.id,
      status: select ? select.value : "accepted",
      temperature_measured: tempInput ? parseFloat(tempInput.value) || null : null,
      rejection_reason: reasonInput ? reasonInput.value || null : null
    };
  });
  const receptionNotes = ((_a = document.getElementById("reception-notes")) == null ? void 0 : _a.value) || null;
  try {
    const result = await API.receiveDelivery(delivery.id, { items, reception_notes: receptionNotes });
    showToast(`R\xE9ception enregistr\xE9e : ${result.accepted} accept\xE9(s), ${result.rejected} refus\xE9(s)`, "success");
    renderDeliveryDetail(delivery.id);
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
async function renderSupplierPortalManage() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <button class="btn btn-secondary btn-sm" onclick="location.hash='#/suppliers'">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i>
        </button>
        <h1>Portail Fournisseur</h1>
      </div>
      <button class="btn btn-primary" id="btn-invite-supplier">
        <i data-lucide="user-plus" style="width:18px;height:18px"></i> Inviter
      </button>
    </div>

    <!-- Notifications -->
    <div id="portal-notifications" style="margin-bottom:var(--space-6)"></div>

    <!-- Supplier accounts list -->
    <div id="portal-accounts"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();
  document.getElementById("btn-invite-supplier").addEventListener("click", showInviteSupplierModal);
  await Promise.all([
    loadPortalNotifications(),
    loadPortalAccounts()
  ]);
}
async function loadPortalNotifications() {
  var _a;
  const container = document.getElementById("portal-notifications");
  if (!container) return;
  try {
    const [notifications, unread] = await Promise.all([
      API.getSupplierNotifications(),
      API.getSupplierNotificationsUnread()
    ]);
    const unreadNotifs = notifications.filter((n) => !n.read);
    if (unreadNotifs.length === 0) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      <div class="card" style="border-left:3px solid var(--color-info)">
        <div class="card-header" style="margin-bottom:var(--space-3)">
          <span class="card-title">
            <i data-lucide="bell" style="width:18px;height:18px;color:var(--color-info)"></i>
            Notifications <span class="badge badge-info">${unreadNotifs.length}</span>
          </span>
          <button class="btn btn-secondary btn-sm" id="btn-mark-all-read">Tout marquer lu</button>
        </div>
        <div class="notification-list">
          ${unreadNotifs.slice(0, 10).map((n) => `
            <div class="notification-item" data-id="${n.id}">
              <div class="notification-icon">${getChangeIcon(n.change_type)}</div>
              <div class="notification-content">
                <strong>${escapeHtml(n.supplier_name)}</strong> \u2014 ${escapeHtml(n.product_name)}
                <br><span class="text-secondary text-sm">${getChangeLabel(n)}</span>
              </div>
              <button class="btn-icon" title="Marquer comme lu" data-dismiss="${n.id}">
                <i data-lucide="check" style="width:16px;height:16px"></i>
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    lucide.createIcons();
    (_a = document.getElementById("btn-mark-all-read")) == null ? void 0 : _a.addEventListener("click", async () => {
      await API.markAllNotificationsRead();
      loadPortalNotifications();
    });
    container.querySelectorAll("[data-dismiss]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await API.markNotificationRead(btn.dataset.dismiss);
        loadPortalNotifications();
      });
    });
  } catch (e) {
    container.innerHTML = "";
  }
}
function getChangeIcon(type) {
  switch (type) {
    case "new":
      return "\u{1F195}";
    case "update":
      return "\u{1F4B0}";
    case "removed":
      return "\u{1F5D1}\uFE0F";
    case "unavailable":
      return "\u26A0\uFE0F";
    default:
      return "\u{1F4E6}";
  }
}
function getChangeLabel(n) {
  switch (n.change_type) {
    case "new":
      return `Nouveau produit \u2014 ${formatCurrency(n.new_price)}`;
    case "update":
      return `Prix: ${formatCurrency(n.old_price)} \u2192 ${formatCurrency(n.new_price)}`;
    case "removed":
      return `Produit retir\xE9 du catalogue`;
    case "unavailable":
      return `Produit temporairement indisponible`;
    default:
      return "Modification";
  }
}
async function loadPortalAccounts() {
  const container = document.getElementById("portal-accounts");
  if (!container) return;
  try {
    const accounts = await API.getSupplierAccounts();
    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="link"></i></div>
          <p>Aucun fournisseur connect\xE9 au portail</p>
          <p class="text-secondary text-sm">Invitez vos fournisseurs pour qu'ils mettent \xE0 jour leurs catalogues directement</p>
          <button class="btn btn-primary" onclick="showInviteSupplierModal()">
            <i data-lucide="user-plus" style="width:18px;height:18px"></i> Inviter un fournisseur
          </button>
        </div>`;
      lucide.createIcons();
      return;
    }
    container.innerHTML = accounts.map((a) => `
      <div class="card" style="margin-bottom:var(--space-3)">
        <div class="card-header">
          <div>
            <span class="card-title">${escapeHtml(a.supplier_name || a.name)}</span>
            <span class="text-secondary text-sm" style="display:block;margin-top:2px">
              ${a.email ? escapeHtml(a.email) : "Pas d'email"}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <span class="badge ${a.last_login ? "badge-success" : "badge-warning"}">
              ${a.last_login ? "Actif" : "Jamais connect\xE9"}
            </span>
          </div>
        </div>
        <div class="card-stats" style="margin-top:var(--space-3)">
          <div>
            <span class="stat-value text-sm">${a.last_login ? new Date(a.last_login).toLocaleDateString("fr-FR") : "\u2014"}</span>
            <span class="stat-label">Derni\xE8re connexion</span>
          </div>
          <div>
            <span class="stat-value text-sm">${new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
            <span class="stat-label">Invit\xE9 le</span>
          </div>
        </div>
        <div style="margin-top:var(--space-3);display:flex;gap:var(--space-2)">
          <button class="btn btn-danger btn-sm" onclick="revokeSupplierAccess(${a.id}, '${escapeHtml(a.supplier_name || a.name)}')">
            <i data-lucide="user-x" style="width:14px;height:14px"></i> R\xE9voquer
          </button>
        </div>
      </div>
    `).join("");
    lucide.createIcons();
  } catch (e) {
    container.innerHTML = `<p class="text-danger">Erreur de chargement</p>`;
  }
}
async function showInviteSupplierModal() {
  let suppliers = [];
  try {
    suppliers = await API.getSuppliers();
  } catch (e) {
  }
  let existingAccounts = [];
  try {
    existingAccounts = await API.getSupplierAccounts();
  } catch (e) {
  }
  const existingSupplierIds = new Set(existingAccounts.map((a) => a.supplier_id));
  const availableSuppliers = suppliers.filter((s) => !existingSupplierIds.has(s.id));
  if (availableSuppliers.length === 0) {
    showToast("Tous vos fournisseurs ont d\xE9j\xE0 un acc\xE8s portail", "info");
    return;
  }
  const randomPin = String(Math.floor(1e3 + Math.random() * 9e3));
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Inviter un fournisseur</h2>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-4)">
        Cr\xE9ez un acc\xE8s portail pour que votre fournisseur puisse g\xE9rer son catalogue directement.
      </p>
      <div class="form-group">
        <label>Fournisseur</label>
        <select class="form-control" id="m-invite-supplier">
          <option value="">\u2014 Choisir \u2014</option>
          ${availableSuppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Code PIN \xE0 communiquer</label>
        <input type="text" class="form-control" id="m-invite-pin" value="${randomPin}"
               style="font-family:var(--font-mono);font-size:var(--text-xl);text-align:center;letter-spacing:0.3em"
               maxlength="6" inputmode="numeric">
        <small class="text-secondary">Communiquez ce code au fournisseur par t\xE9l\xE9phone ou email</small>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-invite-save">
          <i data-lucide="send" style="width:18px;height:18px"></i> Cr\xE9er l'acc\xE8s
        </button>
        <button class="btn btn-secondary" id="m-invite-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  overlay.querySelector("#m-invite-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#m-invite-save").onclick = async () => {
    const supplier_id = document.getElementById("m-invite-supplier").value;
    const pin = document.getElementById("m-invite-pin").value.trim();
    if (!supplier_id) {
      showToast("S\xE9lectionnez un fournisseur", "error");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      showToast("Le PIN doit \xEAtre entre 4 et 6 chiffres", "error");
      return;
    }
    try {
      await API.inviteSupplier({ supplier_id: parseInt(supplier_id), pin });
      showToast("Acc\xE8s cr\xE9\xE9 ! Communiquez le PIN au fournisseur.", "success");
      overlay.remove();
      loadPortalAccounts();
    } catch (e) {
      showToast(e.message, "error");
    }
  };
}
async function revokeSupplierAccess(id, name) {
  showConfirmModal("R\xE9voquer l'acc\xE8s", `\xCAtes-vous s\xFBr de vouloir r\xE9voquer l'acc\xE8s portail de "${name}" ?`, async () => {
    try {
      await API.revokeSupplierAccess(id);
      showToast("Acc\xE8s r\xE9voqu\xE9", "success");
      loadPortalAccounts();
    } catch (e) {
      showToast(e.message, "error");
    }
  }, { confirmText: "R\xE9voquer", confirmClass: "btn btn-danger" });
  return;
}
async function renderTeam() {
  const account = getAccount();
  if (!account || account.role !== "gerant") {
    location.hash = "#/";
    return;
  }
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/more" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus</a>
        <h1 style="margin-top:4px">G\xE9rer l'\xE9quipe</h1>
      </div>
      <button class="btn btn-primary" id="add-member-btn">
        <i data-lucide="user-plus" style="width:18px;height:18px"></i> Ajouter
      </button>
    </div>

    <!-- Staff Password Section -->
    <div style="background:var(--bg-card);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5);border:1px solid var(--border-color)">
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
        <i data-lucide="lock" style="width:20px;height:20px;color:var(--color-accent)"></i>
        <h3 style="margin:0;font-size:var(--text-lg)">Mot de passe \xE9quipe</h3>
      </div>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-3)">Ce mot de passe est partag\xE9 avec votre staff pour acc\xE9der au restaurant. Chaque membre cr\xE9e ensuite son propre PIN personnel.</p>
      <div style="display:flex;gap:var(--space-2);align-items:center">
        <input type="password" class="form-control" id="staff-password-input" placeholder="Nouveau mot de passe" autocomplete="new-password" style="max-width:280px">
        <button class="btn btn-ghost" id="staff-password-toggle" style="padding:8px" title="Afficher/masquer">
          <i data-lucide="eye" style="width:18px;height:18px" id="staff-password-eye"></i>
        </button>
        <button class="btn btn-primary" id="staff-password-save-btn">Enregistrer</button>
      </div>
      <div id="staff-password-message" style="margin-top:var(--space-2);font-size:var(--text-sm)"></div>
    </div>

    <div id="team-list"><div class="loading"><div class="spinner"></div></div></div>

    <!-- Danger Zone \u2014 styled to match site DA -->
    <div style="margin-top:var(--space-8);padding:var(--space-4);border:1px solid rgba(217,48,37,0.3);border-radius:var(--radius-lg);background:linear-gradient(135deg, rgba(217,48,37,0.05), transparent)">
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
        <i data-lucide="alert-triangle" style="width:20px;height:20px;color:var(--color-danger)"></i>
        <h3 style="color:var(--color-danger);margin:0;font-size:var(--text-base)">Zone dangereuse</h3>
      </div>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-3)">Supprimer votre compte et toutes les donn\xE9es du restaurant. Cette action est irr\xE9versible.</p>
      <button class="btn btn-sm" id="delete-account-btn" style="color:var(--color-danger);border:1px solid rgba(217,48,37,0.4);background:transparent;border-radius:var(--radius-md);padding:8px 16px;transition:var(--transition-base)">
        <i data-lucide="trash-2" style="width:14px;height:14px"></i> Supprimer mon compte
      </button>
    </div>
  `;
  lucide.createIcons();
  document.getElementById("staff-password-toggle").addEventListener("click", () => {
    const input = document.getElementById("staff-password-input");
    const icon = document.getElementById("staff-password-eye");
    if (input.type === "password") {
      input.type = "text";
      icon.setAttribute("data-lucide", "eye-off");
    } else {
      input.type = "password";
      icon.setAttribute("data-lucide", "eye");
    }
    lucide.createIcons();
  });
  document.getElementById("delete-account-btn").addEventListener("click", () => showDeleteAccountModal());
  document.getElementById("staff-password-save-btn").addEventListener("click", async () => {
    const input = document.getElementById("staff-password-input");
    const msg = document.getElementById("staff-password-message");
    const password = input.value.trim();
    if (!password || password.length < 4) {
      msg.style.color = "var(--color-danger)";
      msg.textContent = "Le mot de passe doit faire au moins 4 caract\xE8res";
      return;
    }
    try {
      await API.setStaffPassword(password);
      msg.style.color = "var(--color-success)";
      msg.textContent = "Mot de passe enregistr\xE9 \u2713";
      input.value = "";
      setTimeout(() => msg.textContent = "", 3e3);
    } catch (e) {
      msg.style.color = "var(--color-danger)";
      msg.textContent = e.message || "Erreur";
    }
  });
  let accounts = [];
  try {
    accounts = await API.getAccounts();
  } catch (e) {
    showToast("Erreur de chargement", "error");
  }
  const listEl = document.getElementById("team-list");
  if (accounts.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>Aucun membre dans l'\xE9quipe</p></div>`;
    document.getElementById("add-member-btn").addEventListener("click", showAddMemberModal);
    return;
  }
  const gerant = accounts.find((a) => a.role === "gerant");
  const staff = accounts.filter((a) => a.role !== "gerant");
  let html = "";
  if (gerant) {
    html += `
      <div class="team-card" style="border-left:3px solid var(--color-accent)">
        <div class="team-card__header">
          ${renderAvatar(gerant.name, 44)}
          <div class="team-card__info">
            <span class="team-card__name">${escapeHtml(gerant.name)}</span>
            <span class="team-card__role">\u{1F451} G\xE9rant</span>
          </div>
        </div>
        <div class="team-card__badge">Acc\xE8s complet \u2014 non modifiable</div>
      </div>
    `;
  }
  if (staff.length === 0) {
    html += `<p style="color:var(--text-tertiary);text-align:center;padding:var(--space-4)">Aucun membre d'\xE9quipe. Cliquez sur "Ajouter" pour commencer.</p>`;
  } else {
    for (const m of staff) {
      const lastLogin = m.last_login ? new Date(m.last_login).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Jamais";
      const pinStatus = m.has_pin ? '<span style="color:var(--color-success);font-size:var(--text-xs)">PIN configur\xE9</span>' : '<span style="color:var(--color-warning);font-size:var(--text-xs)">PIN non d\xE9fini</span>';
      html += `
        <div class="team-card" data-member-id="${m.id}">
          <div class="team-card__header">
            ${renderAvatar(m.name, 44)}
            <div class="team-card__info">
              <span class="team-card__name">${escapeHtml(m.name)}</span>
              <span class="team-card__role">${_getRoleLabel(m.role)}</span>
            </div>
            <div style="text-align:right;font-size:var(--text-xs);color:var(--text-tertiary)">
              ${pinStatus}<br>
              Connexion : ${lastLogin}
            </div>
          </div>
          <div class="team-card__actions" style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-3)">
            <button class="btn btn-secondary btn-sm team-action" data-action="edit" data-id="${m.id}">
              <i data-lucide="pencil" style="width:14px;height:14px"></i> Modifier
            </button>
            <button class="btn btn-secondary btn-sm team-action" data-action="permissions" data-id="${m.id}">
              <i data-lucide="shield" style="width:14px;height:14px"></i> Permissions
            </button>
            <button class="btn btn-secondary btn-sm team-action" data-action="reset-pin" data-id="${m.id}" data-name="${escapeHtml(m.name)}" ${!m.has_pin ? 'disabled title="Pas de PIN \xE0 r\xE9initialiser"' : ""}>
              <i data-lucide="key-round" style="width:14px;height:14px"></i> Reset PIN
            </button>
            <button class="btn btn-sm team-action" data-action="delete" data-id="${m.id}" data-name="${escapeHtml(m.name)}" style="color:var(--color-danger);border:1px solid rgba(217,48,37,0.3);background:transparent">
              <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
          </div>
        </div>
      `;
    }
  }
  listEl.innerHTML = html;
  lucide.createIcons();
  listEl.querySelectorAll(".team-action").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      const name = btn.dataset.name;
      const member = staff.find((m) => m.id === id);
      switch (action) {
        case "edit":
          showEditMemberModal(member);
          break;
        case "permissions":
          showPermissionsModal(id);
          break;
        case "reset-pin":
          await handleResetPin(id, name);
          break;
        case "delete":
          await deleteTeamMember(id, name);
          break;
      }
    });
  });
  document.getElementById("add-member-btn").addEventListener("click", showAddMemberModal);
}
function showAddMemberModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Ajouter un membre</h2>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-4)">Le membre cr\xE9era son propre code PIN lors de sa premi\xE8re connexion.</p>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-member-name" placeholder="Pr\xE9nom ou surnom" autocomplete="off">
      </div>
      <div class="form-group">
        <label>R\xF4le</label>
        <div style="display:flex;gap:var(--space-2)">
          <select class="form-control" id="m-member-role" style="flex:1">
            <option value="cuisinier">\u{1F468}\u200D\u{1F373} Cuisinier \u2014 cuisine + stock + HACCP</option>
            <option value="salle">\u{1F37D}\uFE0F Salle \u2014 service + commandes</option>
            <option value="__custom__">\u270F\uFE0F Personnalis\xE9\u2026</option>
          </select>
          <input type="text" class="form-control" id="m-member-custom-role" placeholder="Ex: P\xE2tissier" style="flex:1;display:none">
        </div>
      </div>
      <div id="m-member-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-member-save">
          <i data-lucide="user-plus" style="width:18px;height:18px"></i> Cr\xE9er
        </button>
        <button class="btn btn-secondary" id="m-member-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  const roleSelect = overlay.querySelector("#m-member-role");
  const customRoleInput = overlay.querySelector("#m-member-custom-role");
  roleSelect.addEventListener("change", () => {
    customRoleInput.style.display = roleSelect.value === "__custom__" ? "" : "none";
    if (roleSelect.value === "__custom__") customRoleInput.focus();
  });
  overlay.querySelector("#m-member-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#m-member-save").onclick = async () => {
    const name = document.getElementById("m-member-name").value.trim();
    let role = document.getElementById("m-member-role").value;
    if (role === "__custom__") role = document.getElementById("m-member-custom-role").value.trim();
    const errorEl = document.getElementById("m-member-error");
    const caller = getAccount();
    if (!name) {
      errorEl.textContent = "Le nom est requis";
      return;
    }
    if (!role) {
      errorEl.textContent = "Le r\xF4le est requis";
      return;
    }
    try {
      await API.createAccount({ name, role, caller_id: caller.id });
      showToast("Membre ajout\xE9 \u2014 il cr\xE9era son PIN \xE0 sa premi\xE8re connexion", "success");
      overlay.remove();
      renderTeam();
    } catch (e) {
      errorEl.textContent = e.message || "Erreur";
    }
  };
  document.getElementById("m-member-name").focus();
}
function showEditMemberModal(member) {
  const isCustomRole = !["cuisinier", "salle", "serveur"].includes(member.role);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Modifier \u2014 ${escapeHtml(member.name)}</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-edit-name" value="${escapeHtml(member.name)}" autocomplete="off">
      </div>
      <div class="form-group">
        <label>R\xF4le</label>
        <div style="display:flex;gap:var(--space-2)">
          <select class="form-control" id="m-edit-role" style="flex:1">
            <option value="cuisinier" ${member.role === "cuisinier" ? "selected" : ""}>\u{1F468}\u200D\u{1F373} Cuisinier</option>
            <option value="salle" ${member.role === "salle" ? "selected" : ""}>\u{1F37D}\uFE0F Salle</option>
            <option value="serveur" ${member.role === "serveur" ? "selected" : ""}>\u{1F37D}\uFE0F Serveur</option>
            <option value="__custom__" ${isCustomRole ? "selected" : ""}>\u270F\uFE0F Personnalis\xE9\u2026</option>
          </select>
          <input type="text" class="form-control" id="m-edit-custom-role" placeholder="Ex: P\xE2tissier"
                 value="${escapeHtml(isCustomRole ? member.role : "")}"
                 style="flex:1;${isCustomRole ? "" : "display:none"}">
        </div>
      </div>
      <div id="m-edit-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-edit-save">
          <i data-lucide="save" style="width:18px;height:18px"></i> Enregistrer
        </button>
        <button class="btn btn-secondary" id="m-edit-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  const roleSelect = overlay.querySelector("#m-edit-role");
  const customInput = overlay.querySelector("#m-edit-custom-role");
  roleSelect.addEventListener("change", () => {
    customInput.style.display = roleSelect.value === "__custom__" ? "" : "none";
    if (roleSelect.value === "__custom__") customInput.focus();
  });
  overlay.querySelector("#m-edit-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#m-edit-save").onclick = async () => {
    const name = document.getElementById("m-edit-name").value.trim();
    let role = document.getElementById("m-edit-role").value;
    if (role === "__custom__") role = document.getElementById("m-edit-custom-role").value.trim();
    const errorEl = document.getElementById("m-edit-error");
    const caller = getAccount();
    if (!name) {
      errorEl.textContent = "Le nom est requis";
      return;
    }
    if (!role) {
      errorEl.textContent = "Le r\xF4le est requis";
      return;
    }
    try {
      await API.updateAccount(member.id, { name, role, caller_id: caller.id });
      showToast("Membre mis \xE0 jour", "success");
      overlay.remove();
      renderTeam();
    } catch (e) {
      errorEl.textContent = e.message || "Erreur";
    }
  };
  document.getElementById("m-edit-name").focus();
}
async function handleResetPin(accountId, name) {
  showConfirmModal("R\xE9initialiser le PIN", `\xCAtes-vous s\xFBr de vouloir r\xE9initialiser le PIN de ${name} ?

Il devra cr\xE9er un nouveau PIN \xE0 sa prochaine connexion.`, async () => {
    const caller = getAccount();
    try {
      await API.resetMemberPin(accountId, caller.id);
      showToast(`PIN de ${name} r\xE9initialis\xE9`, "success");
      renderTeam();
    } catch (e) {
      showToast(e.message, "error");
    }
  }, { confirmText: "R\xE9initialiser", confirmClass: "btn btn-primary" });
  return;
}
async function showPermissionsModal(accountId) {
  let accounts;
  try {
    accounts = await API.getAccounts();
  } catch (e) {
    return;
  }
  const target = accounts.find((a) => a.id === accountId);
  if (!target) return;
  const perms = target.permissions;
  const caller = getAccount();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Permissions \u2014 ${escapeHtml(target.name)}</h2>
      <div class="perm-list">
        <label class="perm-toggle">
          <span class="perm-toggle__label">\u{1F4D6} Voir les fiches techniques</span>
          <input type="checkbox" checked disabled>
          <span class="perm-toggle__hint">Toujours actif</span>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">\u{1F4B0} Voir les co\xFBts et marges</span>
          <input type="checkbox" id="perm-view_costs" ${perms.view_costs ? "checked" : ""}>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">\u270F\uFE0F Cr\xE9er/modifier les fiches</span>
          <input type="checkbox" id="perm-edit_recipes" ${perms.edit_recipes ? "checked" : ""}>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">\u{1F69A} Voir les fournisseurs</span>
          <input type="checkbox" id="perm-view_suppliers" ${perms.view_suppliers ? "checked" : ""}>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">\u{1F4C4} Exporter en PDF</span>
          <input type="checkbox" id="perm-export_pdf" ${perms.export_pdf ? "checked" : ""}>
        </label>
      </div>
      <div class="actions-row" style="margin-top:var(--space-5)">
        <button class="btn btn-primary" id="perm-save">
          <i data-lucide="save" style="width:18px;height:18px"></i> Enregistrer
        </button>
        <button class="btn btn-secondary" id="perm-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  overlay.querySelector("#perm-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector("#perm-save").onclick = async () => {
    const newPerms = {
      view_recipes: true,
      view_costs: document.getElementById("perm-view_costs").checked,
      edit_recipes: document.getElementById("perm-edit_recipes").checked,
      view_suppliers: document.getElementById("perm-view_suppliers").checked,
      export_pdf: document.getElementById("perm-export_pdf").checked
    };
    try {
      await API.updateAccount(accountId, { permissions: newPerms, caller_id: caller.id });
      showToast("Permissions mises \xE0 jour", "success");
      overlay.remove();
      renderTeam();
    } catch (e) {
      showToast(e.message, "error");
    }
  };
}
async function deleteTeamMember(accountId, name) {
  showConfirmModal("Supprimer le compte", `\xCAtes-vous s\xFBr de vouloir supprimer d\xE9finitivement le compte de ${name} ?

Cette action est irr\xE9versible.`, async () => {
    const caller = getAccount();
    try {
      await API.deleteAccount(accountId, caller.id);
      showToast("Compte supprim\xE9", "success");
      renderTeam();
    } catch (e) {
      showToast(e.message, "error");
    }
  }, { confirmText: "Supprimer", confirmClass: "btn btn-danger" });
  return;
}
function showDeleteAccountModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2 style="color:var(--color-danger)">Supprimer mon compte</h2>
      <div style="background:rgba(217,48,37,0.06);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-4);border:1px solid rgba(217,48,37,0.15)">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;margin:0">
          Cette action va <strong style="color:var(--color-danger)">supprimer d\xE9finitivement</strong> votre compte g\xE9rant, tous les comptes \xE9quipe, le restaurant et toutes ses donn\xE9es (recettes, stocks, fournisseurs, commandes\u2026).
        </p>
      </div>
      <div class="form-group">
        <label style="font-weight:600">Tapez <span style="color:var(--color-danger);font-family:var(--font-mono)">SUPPRIMER</span> pour confirmer</label>
        <input type="text" class="form-control" id="m-delete-confirm" placeholder="SUPPRIMER" autocomplete="off"
               style="font-family:var(--font-mono);text-align:center;font-size:var(--text-lg);letter-spacing:0.1em">
      </div>
      <div id="m-delete-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn" id="m-delete-submit" disabled style="color:white;background:var(--color-danger);border:none;border-radius:var(--radius-md);opacity:0.5;transition:var(--transition-base)">
          <i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer d\xE9finitivement
        </button>
        <button class="btn btn-secondary" id="m-delete-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  const confirmInput = document.getElementById("m-delete-confirm");
  const submitBtn = document.getElementById("m-delete-submit");
  confirmInput.addEventListener("input", () => {
    const match = confirmInput.value.trim() === "SUPPRIMER";
    submitBtn.disabled = !match;
    submitBtn.style.opacity = match ? "1" : "0.5";
  });
  overlay.querySelector("#m-delete-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  submitBtn.addEventListener("click", async () => {
    const errorEl = document.getElementById("m-delete-error");
    submitBtn.disabled = true;
    submitBtn.textContent = "Suppression...";
    try {
      await API.deleteSelfAccount("SUPPRIMER");
      localStorage.removeItem("restosuite_token");
      localStorage.removeItem("restosuite_account");
      overlay.remove();
      location.reload();
    } catch (e) {
      errorEl.textContent = e.message || "Erreur lors de la suppression";
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer d\xE9finitivement';
      submitBtn.style.opacity = "1";
      if (window.lucide) lucide.createIcons();
    }
  });
  confirmInput.focus();
}
function renderSubscribe() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="subscribe-page">
      <div class="subscribe-card">
        <h1 class="subscribe-title">Passez en Pro</h1>
        
        <div class="subscribe-features">
          <div class="subscribe-feature">
            <span class="subscribe-check">\u2705</span>
            <span>Fiches techniques illimit\xE9es</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">\u2705</span>
            <span>Saisie vocale IA</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">\u2705</span>
            <span>Module HACCP complet</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">\u2705</span>
            <span>Export PDF</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">\u2705</span>
            <span>Multi-comptes</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">\u2705</span>
            <span>Support prioritaire</span>
          </div>
        </div>

        <div class="subscribe-price">
          <span class="subscribe-amount">39\u20AC</span>
          <span class="subscribe-period">/mois \xB7 Sans engagement</span>
        </div>

        <button class="btn btn-primary subscribe-btn" id="subscribe-now">
          S'abonner maintenant
        </button>

        <div class="subscribe-reassurance">
          <p>Vos donn\xE9es sont pr\xE9serv\xE9es.</p>
          <p>Tout se d\xE9bloque instantan\xE9ment.</p>
        </div>
      </div>
    </div>
  `;
  document.getElementById("subscribe-now").addEventListener("click", async () => {
    const btn = document.getElementById("subscribe-now");
    btn.textContent = "Redirection...";
    btn.disabled = true;
    try {
      const account = getAccount();
      const accountId = account ? account.id : null;
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast("Erreur lors de la redirection vers le paiement", "error");
        btn.textContent = "S'abonner maintenant";
        btn.disabled = false;
      }
    } catch (err) {
      showToast("Erreur de connexion au service de paiement", "error");
      btn.textContent = "S'abonner maintenant";
      btn.disabled = false;
    }
  });
}
async function renderScanInvoice() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <a href="#/stock" class="btn btn-secondary btn-sm">\u2190 Stock</a>
      <h1>\u{1F4F7} Scanner une facture</h1>
    </div>

    <div class="card" style="padding:var(--space-4);text-align:center">
      <p class="text-secondary" style="margin-bottom:var(--space-3)">
        Prenez en photo ou importez une facture fournisseur.<br>
        L'IA extraira automatiquement les donn\xE9es.
      </p>
      <label class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px">
        <i data-lucide="camera" style="width:20px;height:20px"></i>
        Choisir une image
        <input type="file" id="invoice-input" accept="image/*" capture="environment" style="display:none">
      </label>
      <div id="invoice-preview" style="margin-top:var(--space-3);display:none">
        <img id="invoice-img" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--color-border)">
      </div>
    </div>

    <div id="scan-loading" style="display:none;text-align:center;padding:var(--space-5)">
      <div class="skeleton" style="height:20px;width:60%;margin:0 auto var(--space-2)"></div>
      <p class="text-secondary">Analyse IA en cours...</p>
    </div>

    <div id="scan-results" style="display:none">
      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Donn\xE9es extraites</h3>
        <div id="invoice-header" style="margin-bottom:var(--space-3)"></div>
        <div style="overflow-x:auto">
          <table class="scan-table" style="width:100%;border-collapse:collapse;font-size:0.9rem">
            <thead>
              <tr style="border-bottom:2px solid var(--color-border)">
                <th style="text-align:left;padding:8px 4px">Produit</th>
                <th style="text-align:center;padding:8px 4px">Qt\xE9</th>
                <th style="text-align:left;padding:8px 4px">Unit\xE9</th>
                <th style="text-align:right;padding:8px 4px">PU</th>
                <th style="text-align:right;padding:8px 4px">Total</th>
                <th style="text-align:left;padding:8px 4px">Lot</th>
                <th style="text-align:left;padding:8px 4px">DLC</th>
                <th style="text-align:left;padding:8px 4px">Ingr\xE9dient</th>
              </tr>
            </thead>
            <tbody id="invoice-items"></tbody>
          </table>
        </div>
        <div id="invoice-totals" style="margin-top:var(--space-3);text-align:right"></div>
        <div style="margin-top:var(--space-4);display:flex;gap:var(--space-2);justify-content:flex-end">
          <button class="btn btn-primary" id="btn-create-delivery">\u{1F4E6} Cr\xE9er le bon de r\xE9ception</button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  let scanData = null;
  const fileInput = document.getElementById("invoice-input");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById("invoice-preview");
    const img = document.getElementById("invoice-img");
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.src = ev.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
    document.getElementById("scan-loading").style.display = "block";
    document.getElementById("scan-results").style.display = "none";
    try {
      const formData = new FormData();
      formData.append("invoice", file);
      const token = localStorage.getItem("restosuite_token");
      const headers = {};
      if (token) headers["Authorization"] = "Bearer " + token;
      const account = typeof getAccount === "function" ? getAccount() : null;
      if (account && account.id) headers["X-Account-Id"] = String(account.id);
      const res = await fetch("/api/ai/scan-invoice", {
        method: "POST",
        headers,
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur scan");
      }
      scanData = await res.json();
      renderScanResults(scanData);
    } catch (err) {
      showToast(err.message || "Erreur lors du scan", "error");
    } finally {
      document.getElementById("scan-loading").style.display = "none";
    }
  });
  document.getElementById("btn-create-delivery").addEventListener("click", () => {
    if (!scanData) return;
    createDeliveryFromScan(scanData);
  });
}
function renderScanResults(data) {
  document.getElementById("scan-results").style.display = "block";
  const header = document.getElementById("invoice-header");
  header.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-2)">
      <div><strong>Fournisseur :</strong> ${escapeHtml(data.supplier_name || "\u2014")}</div>
      <div><strong>N\xB0 Facture :</strong> ${escapeHtml(data.invoice_number || "\u2014")}</div>
      <div><strong>Date :</strong> ${escapeHtml(data.invoice_date || "\u2014")}</div>
    </div>
  `;
  const tbody = document.getElementById("invoice-items");
  tbody.innerHTML = (data.items || []).map((item, i) => `
    <tr style="border-bottom:1px solid var(--color-border)">
      <td style="padding:8px 4px">${escapeHtml(item.product_name || "\u2014")}</td>
      <td style="text-align:center;padding:8px 4px">
        <input type="number" value="${item.quantity || ""}" data-idx="${i}" data-field="quantity" 
               style="width:60px;text-align:center;background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:4px;color:inherit">
      </td>
      <td style="padding:8px 4px">${escapeHtml(item.unit || "\u2014")}</td>
      <td style="text-align:right;padding:8px 4px">${item.unit_price != null ? item.unit_price.toFixed(2) + "\u20AC" : "\u2014"}</td>
      <td style="text-align:right;padding:8px 4px">${item.total_price != null ? item.total_price.toFixed(2) + "\u20AC" : "\u2014"}</td>
      <td style="padding:8px 4px">${escapeHtml(item.batch_number || "\u2014")}</td>
      <td style="padding:8px 4px">${escapeHtml(item.dlc || "\u2014")}</td>
      <td style="padding:8px 4px">
        ${item.matched_ingredient ? `<span style="color:var(--color-success)">\u2713 ${escapeHtml(item.matched_ingredient)}</span>` : '<span style="color:var(--color-text-muted)">Non trouv\xE9</span>'}
      </td>
    </tr>
  `).join("");
  const totals = document.getElementById("invoice-totals");
  totals.innerHTML = `
    <div style="display:inline-grid;grid-template-columns:auto auto;gap:4px 16px;text-align:right">
      <span>Total HT :</span><strong>${data.total_ht != null ? data.total_ht.toFixed(2) + "\u20AC" : "\u2014"}</strong>
      <span>TVA :</span><strong>${data.tva != null ? data.tva.toFixed(2) + "\u20AC" : "\u2014"}</strong>
      <span>Total TTC :</span><strong style="font-size:1.1em;color:var(--color-accent)">${data.total_ttc != null ? data.total_ttc.toFixed(2) + "\u20AC" : "\u2014"}</strong>
    </div>
  `;
}
async function createDeliveryFromScan(data) {
  try {
    let suppliers = await API.getSuppliers();
    let supplier = suppliers.find((s) => s.name.toLowerCase() === (data.supplier_name || "").toLowerCase());
    if (!supplier && data.supplier_name) {
      supplier = await API.createSupplier({ name: data.supplier_name });
    }
    if (!supplier) {
      showToast("Impossible de trouver le fournisseur", "error");
      return;
    }
    const lines = (data.items || []).filter((item) => item.ingredient_id && item.quantity).map((item) => ({
      ingredient_id: item.ingredient_id,
      quantity: item.quantity,
      unit: item.unit || "kg",
      unit_price: item.unit_price || null,
      supplier_id: supplier.id,
      batch_number: item.batch_number || null,
      dlc: item.dlc || null
    }));
    if (lines.length === 0) {
      showToast("Aucun ingr\xE9dient reconnu pour la r\xE9ception", "error");
      return;
    }
    const account = getAccount();
    await API.postReception({ lines, recorded_by: account ? account.id : null });
    showToast(`\u2705 R\xE9ception cr\xE9\xE9e : ${lines.length} ligne(s)`, "success");
    location.hash = "#/stock";
  } catch (e) {
    showToast(e.message || "Erreur cr\xE9ation r\xE9ception", "error");
  }
}
async function renderMercuriale() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/analytics" class="btn btn-secondary btn-sm">\u2190 Analytics</a>
        <h1 style="margin-top:4px">\u{1F4CA} Mercuriale</h1>
      </div>
      <a href="#/import-mercuriale" class="btn btn-primary"><i data-lucide="camera" style="width:16px;height:16px"></i> Scanner une mercuriale</a>
    </div>

    <div id="price-alerts-section">
      <h2 style="margin-bottom:var(--space-3)">\u26A0\uFE0F Alertes prix</h2>
      <div id="price-alerts-list">
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>

    <div style="margin-top:var(--space-5)">
      <h2 style="margin-bottom:var(--space-3)">\u{1F4CB} Tous les ingr\xE9dients</h2>
      <div id="mercuriale-table">
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>

    <div id="price-chart-modal" class="modal-overlay" style="display:none">
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <h3 id="chart-title">\xC9volution du prix</h3>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('price-chart-modal').style.display='none'">\u2715</button>
        </div>
        <div id="price-chart-container" style="padding:var(--space-4)"></div>
        <div style="padding:0 var(--space-4) var(--space-4);display:flex;gap:var(--space-2)">
          <button class="btn btn-secondary btn-sm period-btn active" data-period="30d">30 jours</button>
          <button class="btn btn-secondary btn-sm period-btn" data-period="90d">90 jours</button>
          <button class="btn btn-secondary btn-sm period-btn" data-period="1y">1 an</button>
        </div>
      </div>
    </div>
  `;
  let alerts = [];
  let ingredients = [];
  try {
    const results = await Promise.all([
      API.request("/analytics/price-alerts"),
      API.getIngredients()
    ]);
    alerts = results[0];
    const ingredientsResponse = results[1];
    ingredients = ingredientsResponse.ingredients || [];
  } catch (e) {
    showToast("Erreur chargement donn\xE9es", "error");
  }
  const alertsList = document.getElementById("price-alerts-list");
  if (alerts.length === 0) {
    alertsList.innerHTML = `<div class="card" style="padding:var(--space-3);text-align:center;color:var(--color-success)">
      \u2705 Aucune variation significative d\xE9tect\xE9e
    </div>`;
  } else {
    alertsList.innerHTML = alerts.map((a) => {
      const isUp = a.variation_percent > 0;
      const color = isUp ? "var(--color-danger)" : "var(--color-success)";
      const arrow = isUp ? "\u2191" : "\u2193";
      return `
        <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-2);border-left:4px solid ${color}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${escapeHtml(a.ingredient_name)}</strong>
              <span class="text-secondary text-sm"> \u2014 ${escapeHtml(a.supplier_name || "")}</span>
            </div>
            <div style="text-align:right">
              <span style="color:${color};font-weight:600;font-size:1.1em">${arrow} ${Math.abs(a.variation_percent).toFixed(1)}%</span>
              <div class="text-secondary text-sm">${a.current_price.toFixed(2)}\u20AC (moy: ${a.avg_price.toFixed(2)}\u20AC)</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
  const enriched = [];
  for (const ing of ingredients) {
    const priceInfo = alerts.find((a) => a.ingredient_id === ing.id);
    enriched.push({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      current_price: priceInfo ? priceInfo.current_price : ing.price_per_unit || 0,
      avg_price: priceInfo ? priceInfo.avg_price : null,
      variation: priceInfo ? priceInfo.variation_percent : null,
      supplier: priceInfo ? priceInfo.supplier_name : null
    });
  }
  const tableDiv = document.getElementById("mercuriale-table");
  if (enriched.length === 0) {
    tableDiv.innerHTML = '<div class="empty-state"><p>Aucun ingr\xE9dient</p></div>';
  } else {
    tableDiv.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="border-bottom:2px solid var(--color-border)">
              <th style="text-align:left;padding:10px 6px">Ingr\xE9dient</th>
              <th style="text-align:left;padding:10px 6px">Cat\xE9gorie</th>
              <th style="text-align:right;padding:10px 6px">Prix actuel</th>
              <th style="text-align:right;padding:10px 6px">Moy. 30j</th>
              <th style="text-align:center;padding:10px 6px">Tendance</th>
              <th style="text-align:center;padding:10px 6px">D\xE9tails</th>
            </tr>
          </thead>
          <tbody>
            ${enriched.map((ing) => {
      const trend = ing.variation == null ? "\u2192" : ing.variation > 2 ? "\u2191" : ing.variation < -2 ? "\u2193" : "\u2192";
      const trendColor = trend === "\u2191" ? "var(--color-danger)" : trend === "\u2193" ? "var(--color-success)" : "var(--color-text-muted)";
      return `
                <tr style="border-bottom:1px solid var(--color-border)">
                  <td style="padding:10px 6px"><strong>${escapeHtml(ing.name)}</strong></td>
                  <td style="padding:10px 6px" class="text-secondary">${escapeHtml(ing.category || "\u2014")}</td>
                  <td style="text-align:right;padding:10px 6px">${ing.current_price > 0 ? ing.current_price.toFixed(2) + "\u20AC" : "\u2014"}</td>
                  <td style="text-align:right;padding:10px 6px">${ing.avg_price ? ing.avg_price.toFixed(2) + "\u20AC" : "\u2014"}</td>
                  <td style="text-align:center;padding:10px 6px;color:${trendColor};font-size:1.3em;font-weight:bold">${trend}</td>
                  <td style="text-align:center;padding:10px 6px">
                    <button class="btn btn-secondary btn-sm btn-chart" data-id="${ing.id}" data-name="${escapeHtml(ing.name)}">\u{1F4C8}</button>
                  </td>
                </tr>
              `;
    }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }
  let currentChartIngredientId = null;
  document.querySelectorAll(".btn-chart").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = parseInt(btn.dataset.id);
      const name = btn.dataset.name;
      currentChartIngredientId = id;
      document.getElementById("chart-title").textContent = `\u{1F4C8} ${name}`;
      document.getElementById("price-chart-modal").style.display = "flex";
      document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
      document.querySelector('.period-btn[data-period="30d"]').classList.add("active");
      await loadChart(id, "30d");
    });
  });
  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (currentChartIngredientId) {
        await loadChart(currentChartIngredientId, btn.dataset.period);
      }
    });
  });
  document.getElementById("price-chart-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.target.style.display = "none";
  });
}
async function loadChart(ingredientId, period) {
  const container = document.getElementById("price-chart-container");
  container.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  try {
    const data = await API.request(`/analytics/price-trends?ingredient_id=${ingredientId}&period=${period}`);
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-secondary" style="text-align:center;padding:var(--space-4)">Aucune donn\xE9e de prix pour cette p\xE9riode</p>';
      return;
    }
    container.innerHTML = renderSVGChart(data);
  } catch (e) {
    container.innerHTML = '<p style="color:var(--color-danger);text-align:center">Erreur chargement donn\xE9es</p>';
  }
}
function renderSVGChart(data) {
  const W = 540, H = 220, PAD_L = 55, PAD_R = 15, PAD_T = 15, PAD_B = 35;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const prices = data.map((d) => d.price);
  const minP = Math.min(...prices) * 0.95;
  const maxP = Math.max(...prices) * 1.05;
  const rangeP = maxP - minP || 1;
  const dates = data.map((d) => new Date(d.date));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const rangeDate = maxDate - minDate || 1;
  const points = data.map((d, i) => {
    const x = PAD_L + (dates[i] - minDate) / rangeDate * chartW;
    const y = PAD_T + chartH - (d.price - minP) / rangeP * chartH;
    return { x, y, price: d.price, date: d.date, supplier: d.supplier_name };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const val = minP + rangeP * i / 4;
    const y = PAD_T + chartH - chartH * i / 4;
    yLabels.push(`<text x="${PAD_L - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-muted)" font-size="11">${val.toFixed(2)}\u20AC</text>`);
    yLabels.push(`<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="4,4"/>`);
  }
  const xLabels = [];
  const step = Math.max(1, Math.floor(data.length / 5));
  for (let i = 0; i < data.length; i += step) {
    const d = new Date(data[i].date);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    xLabels.push(`<text x="${points[i].x}" y="${H - 5}" text-anchor="middle" fill="var(--color-text-muted)" font-size="11">${label}</text>`);
  }
  const circles = points.map(
    (p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--color-accent)" stroke="#fff" stroke-width="1.5">
      <title>${p.price.toFixed(2)}\u20AC \u2014 ${new Date(p.date).toLocaleDateString("fr-FR")}${p.supplier ? " (" + p.supplier + ")" : ""}</title>
    </circle>`
  ).join("");
  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;font-family:inherit">
      ${yLabels.join("")}
      ${xLabels.join("")}
      <path d="${linePath}" fill="none" stroke="var(--color-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${circles}
    </svg>
  `;
}
let _mercurialeData = null;
async function renderImportMercuriale() {
  const app = document.getElementById("app");
  _mercurialeData = null;
  app.innerHTML = `
    <div class="view-header">
      <a href="#/mercuriale" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-2);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Mercuriale
      </a>
      <h1>\u{1F4F7} Import mercuriale IA</h1>
      <p class="text-secondary">Scannez une liste de prix fournisseur et mettez \xE0 jour vos prix automatiquement</p>
    </div>

    <div id="merc-upload-section">
      <div style="border:2px dashed var(--border-color);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;background:var(--bg-sunken);cursor:pointer" id="merc-drop-zone">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">\u{1F4C4}</div>
        <h3 style="margin-bottom:var(--space-2)">Glissez votre mercuriale ici</h3>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-3)">
          Photo, PDF ou scan de la liste de prix fournisseur
        </p>
        <label class="btn btn-primary" style="cursor:pointer">
          <i data-lucide="camera" style="width:16px;height:16px"></i> Choisir un fichier
          <input type="file" id="merc-file-input" accept="image/*,application/pdf" capture="environment" style="display:none">
        </label>
        <p style="color:var(--text-tertiary);font-size:var(--text-xs);margin-top:var(--space-2)">JPG, PNG ou PDF \u2014 max 10 Mo</p>
      </div>
    </div>

    <div id="merc-preview" class="hidden" style="margin-top:var(--space-4)">
      <img id="merc-preview-img" style="max-width:100%;max-height:300px;border-radius:var(--radius-md);border:1px solid var(--border-light)" alt="">
    </div>

    <div id="merc-processing" class="hidden" style="text-align:center;padding:var(--space-8)">
      <div class="spinner" style="margin:0 auto var(--space-3)"></div>
      <h3>Analyse en cours\u2026</h3>
      <p class="text-secondary">L'IA extrait les prix de votre mercuriale</p>
    </div>

    <div id="merc-results" class="hidden"></div>
  `;
  if (window.lucide) lucide.createIcons();
  const fileInput = document.getElementById("merc-file-input");
  const dropZone = document.getElementById("merc-drop-zone");
  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleMercurialeFile(e.target.files[0]);
  });
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--color-accent)";
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "";
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "";
    if (e.dataTransfer.files[0]) handleMercurialeFile(e.dataTransfer.files[0]);
  });
}
async function handleMercurialeFile(file) {
  if (file.type.startsWith("image/")) {
    const preview = document.getElementById("merc-preview");
    const img = document.getElementById("merc-preview-img");
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
  document.getElementById("merc-upload-section").classList.add("hidden");
  document.getElementById("merc-processing").classList.remove("hidden");
  try {
    const data = await API.scanMercuriale(file);
    _mercurialeData = data;
    document.getElementById("merc-processing").classList.add("hidden");
    renderMercurialeResults(data);
  } catch (e) {
    document.getElementById("merc-processing").classList.add("hidden");
    document.getElementById("merc-upload-section").classList.remove("hidden");
    showToast("Erreur : " + e.message, "error");
  }
}
async function renderMercurialeResults(data) {
  const el = document.getElementById("merc-results");
  el.classList.remove("hidden");
  let suppliers = [];
  try {
    suppliers = await API.getSuppliers();
  } catch (e) {
  }
  const supplierOptions = suppliers.map(
    (s) => `<option value="${s.id}" ${data.supplier_id === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`
  ).join("");
  el.innerHTML = `
    <!-- Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-accent)">${data.summary.total_items}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Produits d\xE9tect\xE9s</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-success)">${data.summary.matched_items}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Correspondances</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-warning)">${data.summary.unmatched_items}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Non reconnus</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.match_rate}%</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Taux de correspondance</div>
      </div>
    </div>

    <!-- Supplier selector -->
    <div style="display:flex;gap:var(--space-3);align-items:flex-end;margin-bottom:var(--space-4);flex-wrap:wrap">
      <div class="form-group" style="margin:0;flex:1;min-width:200px">
        <label class="form-label">Fournisseur</label>
        <select class="input" id="merc-supplier-select">
          <option value="">\u2014 S\xE9lectionner un fournisseur \u2014</option>
          ${supplierOptions}
        </select>
      </div>
      ${data.supplier_name ? `<div style="font-size:var(--text-sm);color:var(--text-secondary);padding-bottom:8px">D\xE9tect\xE9 : <strong>${escapeHtml(data.supplier_name)}</strong></div>` : ""}
      ${data.date ? `<div style="font-size:var(--text-sm);color:var(--text-secondary);padding-bottom:8px">Date : ${escapeHtml(data.date)}</div>` : ""}
    </div>

    <!-- Items table -->
    <div class="table-container" style="margin-bottom:var(--space-4)">
      <table>
        <thead>
          <tr>
            <th style="width:30px"><input type="checkbox" id="merc-check-all" checked></th>
            <th>Produit (mercuriale)</th>
            <th>Correspondance</th>
            <th class="numeric">Prix</th>
            <th>Unit\xE9</th>
            <th>Cat\xE9gorie</th>
          </tr>
        </thead>
        <tbody id="merc-items-body">
          ${(data.items || []).map((item, i) => {
    const matched = item.ingredient_id ? true : false;
    const confidence = item.match_confidence === "exact" ? "\u2705" : item.match_confidence === "fuzzy" ? "\u{1F536}" : "\u274C";
    return `
              <tr style="${!matched ? "opacity:0.6" : ""}">
                <td><input type="checkbox" class="merc-item-cb" data-idx="${i}" ${matched ? "checked" : ""}></td>
                <td style="font-weight:500">${escapeHtml(item.product_name || "\u2014")}
                  ${item.organic ? '<span style="color:var(--color-success);font-size:11px"> \u{1F33F} Bio</span>' : ""}
                </td>
                <td>
                  ${matched ? `<span style="color:var(--color-success)">${confidence} ${escapeHtml(item.matched_ingredient)}</span>` : `<span style="color:var(--text-tertiary)">Non reconnu</span>`}
                </td>
                <td class="numeric mono" style="font-weight:600">${item.price != null ? formatCurrency(item.price) : "\u2014"}</td>
                <td>${escapeHtml(item.unit || "\u2014")}</td>
                <td style="font-size:var(--text-xs);color:var(--text-secondary)">${escapeHtml(item.category || "\u2014")}</td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:var(--space-3);justify-content:flex-end;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="renderImportMercuriale()">
        <i data-lucide="refresh-cw" style="width:16px;height:16px"></i> Nouveau scan
      </button>
      <button class="btn btn-primary" id="merc-import-btn" style="min-width:200px">
        <i data-lucide="download" style="width:16px;height:16px"></i> Importer les prix s\xE9lectionn\xE9s
      </button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById("merc-check-all").addEventListener("change", (e) => {
    document.querySelectorAll(".merc-item-cb").forEach((cb) => cb.checked = e.target.checked);
  });
  document.getElementById("merc-import-btn").addEventListener("click", importMercurialeItems);
}
async function importMercurialeItems() {
  const supplierId = document.getElementById("merc-supplier-select").value;
  if (!supplierId) {
    showToast("S\xE9lectionnez un fournisseur", "error");
    return;
  }
  const checkedIdxs = [];
  document.querySelectorAll(".merc-item-cb:checked").forEach((cb) => checkedIdxs.push(parseInt(cb.dataset.idx)));
  if (checkedIdxs.length === 0) {
    showToast("S\xE9lectionnez au moins un produit", "error");
    return;
  }
  const items = checkedIdxs.map((i) => _mercurialeData.items[i]).filter((item) => item.ingredient_id && item.price > 0).map((item) => ({
    ingredient_id: item.ingredient_id,
    price: item.price,
    unit: item.unit || "kg"
  }));
  if (items.length === 0) {
    showToast("Aucun produit reconnu dans la s\xE9lection", "error");
    return;
  }
  try {
    const result = await API.importMercuriale({ supplier_id: Number(supplierId), items });
    showToast(`Import r\xE9ussi : ${result.updated} mis \xE0 jour, ${result.created} nouveaux prix`, "success");
    const el = document.getElementById("merc-results");
    el.innerHTML = `
      <div style="text-align:center;padding:var(--space-8)">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">\u2705</div>
        <h2>Import termin\xE9</h2>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-4)">
          <strong>${result.updated}</strong> prix mis \xE0 jour \xB7
          <strong>${result.created}</strong> nouveaux prix \xB7
          <strong>${result.skipped}</strong> ignor\xE9s
        </p>
        <div style="display:flex;gap:var(--space-3);justify-content:center">
          <button class="btn btn-primary" onclick="renderImportMercuriale()">Nouveau scan</button>
          <a href="#/mercuriale" class="btn btn-secondary">Voir la mercuriale</a>
        </div>
      </div>
    `;
  } catch (e) {
    showToast("Erreur import : " + e.message, "error");
  }
}
let _chefHistory = [];
let _chefLoading = false;
async function renderAIChef() {
  const app = document.getElementById("app");
  _chefHistory = [];
  _chefLoading = false;
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 80px);max-width:800px;margin:0 auto">
      <div class="view-header" style="flex-shrink:0;padding-bottom:var(--space-3)">
        <a href="#/" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Accueil
        </a>
        <h1 style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1.5rem">\u{1F468}\u200D\u{1F373}</span> Chef IA
        </h1>
        <p class="text-secondary" style="font-size:var(--text-sm)">Assistant expert qui conna\xEEt votre restaurant</p>
      </div>

      <div id="chef-messages" style="flex:1;overflow-y:auto;padding:var(--space-3) 0;display:flex;flex-direction:column;gap:var(--space-3)">
        <div class="chef-msg chef-msg--ai">
          <div class="chef-msg__avatar">\u{1F468}\u200D\u{1F373}</div>
          <div class="chef-msg__bubble">
            <p>Bonjour ! Je suis <strong>Chef</strong>, votre assistant IA RestoSuite.</p>
            <p style="margin-top:8px">Je connais vos fiches techniques, vos stocks, vos fournisseurs et vos donn\xE9es HACCP. Posez-moi vos questions !</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
              <button class="chef-suggestion" onclick="sendChefSuggestion('Quel est mon food cost moyen et comment l\\'am\xE9liorer ?')">\u{1F4CA} Food cost</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Quels ingr\xE9dients sont en stock bas ?')">\u{1F4E6} Stock bas</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Analyse mes pertes sur les 30 derniers jours')">\u{1F4C9} Pertes</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Quels plats ont la meilleure marge ?')">\u{1F4B0} Marges</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Donne-moi des conseils HACCP pour cette semaine')">\u{1F6E1}\uFE0F HACCP</button>
            </div>
          </div>
        </div>
      </div>

      <div style="flex-shrink:0;padding:var(--space-3) 0;border-top:1px solid var(--border-light)">
        <form id="chef-form" style="display:flex;gap:var(--space-2)">
          <input type="text" id="chef-input" class="input" placeholder="Posez votre question \xE0 Chef\u2026"
            style="flex:1;font-size:var(--text-base)" autocomplete="off">
          <button type="submit" class="btn btn-primary" id="chef-send-btn" style="padding:8px 16px">
            <i data-lucide="send" style="width:18px;height:18px"></i>
          </button>
        </form>
      </div>
    </div>

    <style>
      .chef-msg { display:flex;gap:10px;max-width:90% }
      .chef-msg--user { align-self:flex-end;flex-direction:row-reverse }
      .chef-msg__avatar { width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;background:var(--bg-sunken) }
      .chef-msg--user .chef-msg__avatar { background:var(--color-accent);color:white;font-size:0.8rem }
      .chef-msg__bubble { background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:12px 16px;font-size:var(--text-sm);line-height:1.6 }
      .chef-msg--user .chef-msg__bubble { background:var(--color-accent);color:white;border-color:transparent }
      .chef-msg__bubble p { margin:0 }
      .chef-msg__bubble p + p { margin-top:8px }
      .chef-msg__bubble strong { font-weight:600 }
      .chef-msg__bubble ul, .chef-msg__bubble ol { margin:8px 0;padding-left:20px }
      .chef-msg__bubble li { margin:4px 0 }
      .chef-suggestion { background:var(--bg-sunken);border:1px solid var(--border-light);border-radius:20px;padding:6px 12px;font-size:var(--text-xs);cursor:pointer;white-space:nowrap }
      .chef-suggestion:hover { background:var(--color-accent-light);border-color:var(--color-accent) }
      .chef-typing { display:flex;gap:4px;padding:8px 0 }
      .chef-typing span { width:8px;height:8px;border-radius:50%;background:var(--text-tertiary);animation:chefTyping 1.4s infinite }
      .chef-typing span:nth-child(2) { animation-delay:0.2s }
      .chef-typing span:nth-child(3) { animation-delay:0.4s }
      @keyframes chefTyping { 0%,60%,100%{opacity:0.3} 30%{opacity:1} }
    </style>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById("chef-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chef-input");
    const msg = input.value.trim();
    if (msg && !_chefLoading) {
      input.value = "";
      sendChefMessage(msg);
    }
  });
}
function sendChefSuggestion(text) {
  if (!_chefLoading) sendChefMessage(text);
}
async function sendChefMessage(message) {
  var _a;
  if (_chefLoading) return;
  _chefLoading = true;
  const messagesEl = document.getElementById("chef-messages");
  const sendBtn = document.getElementById("chef-send-btn");
  if (sendBtn) sendBtn.disabled = true;
  const userMsg = document.createElement("div");
  userMsg.className = "chef-msg chef-msg--user";
  userMsg.innerHTML = `
    <div class="chef-msg__avatar">Moi</div>
    <div class="chef-msg__bubble">${escapeHtml(message)}</div>
  `;
  messagesEl.appendChild(userMsg);
  const typing = document.createElement("div");
  typing.className = "chef-msg chef-msg--ai";
  typing.id = "chef-typing";
  typing.innerHTML = `
    <div class="chef-msg__avatar">\u{1F468}\u200D\u{1F373}</div>
    <div class="chef-msg__bubble"><div class="chef-typing"><span></span><span></span><span></span></div></div>
  `;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  try {
    const result = await API.request("/ai/chef", {
      method: "POST",
      body: { message, conversation_history: _chefHistory }
    });
    _chefHistory.push({ role: "user", text: message });
    _chefHistory.push({ role: "model", text: result.reply });
    typing.remove();
    const aiMsg = document.createElement("div");
    aiMsg.className = "chef-msg chef-msg--ai";
    aiMsg.innerHTML = `
      <div class="chef-msg__avatar">\u{1F468}\u200D\u{1F373}</div>
      <div class="chef-msg__bubble">${formatChefReply(result.reply)}</div>
    `;
    messagesEl.appendChild(aiMsg);
  } catch (e) {
    typing.remove();
    const errMsg = document.createElement("div");
    errMsg.className = "chef-msg chef-msg--ai";
    errMsg.innerHTML = `
      <div class="chef-msg__avatar">\u{1F468}\u200D\u{1F373}</div>
      <div class="chef-msg__bubble" style="border-color:var(--color-danger)">
        <p style="color:var(--color-danger)">D\xE9sol\xE9, une erreur est survenue : ${escapeHtml(e.message)}</p>
      </div>
    `;
    messagesEl.appendChild(errMsg);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  _chefLoading = false;
  if (sendBtn) sendBtn.disabled = false;
  (_a = document.getElementById("chef-input")) == null ? void 0 : _a.focus();
}
function formatChefReply(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:2px 4px;border-radius:3px">$1</code>').replace(/^### (.*$)/gm, '<h4 style="margin:12px 0 6px;font-size:var(--text-sm)">$1</h4>').replace(/^## (.*$)/gm, '<h3 style="margin:12px 0 6px">$1</h3>').replace(/^- (.*$)/gm, '<li style="margin-left:16px">$1</li>').replace(/^(\d+)\. (.*$)/gm, '<li style="margin-left:16px">$2</li>').replace(/\n{2,}/g, '</p><p style="margin-top:8px">').replace(/\n/g, "<br>");
}
let _aiHistory = [];
let _aiLoading = false;
async function renderAIAssistant() {
  const app = document.getElementById("app");
  _aiHistory = [];
  _aiLoading = false;
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 80px);max-width:900px;margin:0 auto;padding:var(--space-3)">
      <div class="view-header" style="flex-shrink:0;margin-bottom:var(--space-4)">
        <h1 style="display:flex;align-items:center;gap:8px;margin:0">
          <span style="font-size:1.8rem">\u{1F9E0}</span> Assistant IA
        </h1>
        <p class="text-secondary" style="font-size:var(--text-sm);margin-top:4px">Chef expert \xB7 Recommandations intelligentes \xB7 Actions confirm\xE9es</p>
      </div>

      <div id="ai-messages" style="flex:1;overflow-y:auto;padding:var(--space-3) 0;display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-4)">
        <div class="ai-msg ai-msg--ai">
          <div class="ai-msg__avatar">\u{1F9E0}</div>
          <div class="ai-msg__bubble">
            <p>Bonjour ! Je suis votre <strong>Assistant IA</strong> RestoSuite.</p>
            <p style="margin-top:8px">Je connais vos fiches techniques, vos stocks, vos fournisseurs et vos donn\xE9es HACCP. Je peux vous aider et ex\xE9cuter des actions avec votre confirmation.</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
              <button class="ai-suggestion" onclick="sendAISuggestion('Quel est mon food cost moyen et comment l\\'am\xE9liorer ?')">\u{1F4CA} Food cost</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Quels ingr\xE9dients sont en stock bas ?')">\u{1F4E6} Stock</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Optimise les marges de mes plats')">\u{1F4B0} Marges</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Enregistre une temp\xE9rature de 5\xB0C en chambre froide')">\u{1F321}\uFE0F HACCP</button>
            </div>
          </div>
        </div>
      </div>

      <div style="flex-shrink:0;padding:var(--space-3);border:1px solid var(--border-light);border-radius:var(--radius-lg);background:var(--bg-sunken)">
        <form id="ai-form" style="display:flex;gap:var(--space-2)">
          <button type="button" class="btn" id="ai-voice-btn" style="padding:8px 12px;background:var(--bg-elevated);border:1px solid var(--border-light);color:var(--text-secondary)" title="Enregistrer au micro">
            <i data-lucide="mic" style="width:18px;height:18px"></i>
          </button>
          <input type="text" id="ai-input" class="input" placeholder="Posez votre question \xE0 l'Assistant IA\u2026"
            style="flex:1;font-size:var(--text-base)" autocomplete="off">
          <button type="submit" class="btn btn-primary" id="ai-send-btn" style="padding:8px 16px">
            <i data-lucide="send" style="width:18px;height:18px"></i>
          </button>
        </form>
      </div>
    </div>

    <style>
      .ai-msg { display:flex;gap:10px;max-width:85%;animation:aiMessageSlide 0.3s ease-out }
      .ai-msg--user { align-self:flex-end;flex-direction:row-reverse }
      .ai-msg__avatar { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;background:var(--bg-sunken) }
      .ai-msg--user .ai-msg__avatar { background:var(--color-accent);color:white;font-size:1rem }
      .ai-msg__bubble { background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:12px 16px;font-size:var(--text-sm);line-height:1.6 }
      .ai-msg--user .ai-msg__bubble { background:var(--color-accent);color:white;border-color:transparent }
      .ai-msg__bubble p { margin:0 }
      .ai-msg__bubble p + p { margin-top:8px }
      .ai-msg__bubble strong { font-weight:600 }
      .ai-msg__bubble ul, .ai-msg__bubble ol { margin:8px 0;padding-left:20px }
      .ai-msg__bubble li { margin:4px 0 }

      .ai-action-card {
        background:var(--color-accent-light);
        border:1px solid var(--color-accent);
        border-radius:var(--radius-lg);
        padding:var(--space-3);
        margin:var(--space-2) 0;
      }

      .ai-action-title {
        font-weight:600;
        font-size:var(--text-sm);
        margin-bottom:var(--space-2);
        display:flex;align-items:center;gap:8px
      }

      .ai-action-buttons {
        display:flex;gap:var(--space-2);
        margin-top:var(--space-2)
      }

      .ai-action-buttons button {
        flex:1;padding:8px 12px;border-radius:var(--radius-md);border:none;cursor:pointer;font-size:var(--text-sm);font-weight:500;transition:all 0.2s
      }

      .ai-action-confirm {
        background:var(--color-accent);color:white
      }

      .ai-action-confirm:hover {
        background:var(--color-accent-hover);transform:translateY(-1px)
      }

      .ai-action-cancel {
        background:transparent;color:var(--color-accent);border:1px solid var(--color-accent)
      }

      .ai-action-cancel:hover {
        background:rgba(232,114,42,0.05)
      }

      .ai-suggestion { background:var(--bg-sunken);border:1px solid var(--border-light);border-radius:20px;padding:6px 12px;font-size:var(--text-xs);cursor:pointer;white-space:nowrap;color:var(--text-primary);transition:all 0.2s }
      .ai-suggestion:hover { background:var(--color-accent-light);border-color:var(--color-accent);color:var(--text-primary) }
      .ai-typing { display:flex;gap:4px;padding:8px 0 }
      .ai-typing span { width:8px;height:8px;border-radius:50%;background:var(--text-tertiary);animation:aiTyping 1.4s infinite }
      .ai-typing span:nth-child(2) { animation-delay:0.2s }
      .ai-typing span:nth-child(3) { animation-delay:0.4s }
      @keyframes aiTyping { 0%,60%,100%{opacity:0.3} 30%{opacity:1} }
      @keyframes aiMessageSlide { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:translateY(0) } }
    </style>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById("ai-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("ai-input");
    const msg = input.value.trim();
    if (msg && !_aiLoading) {
      input.value = "";
      sendAIMessage(msg);
    }
  });
  document.getElementById("ai-voice-btn").addEventListener("click", toggleAIVoice);
}
function sendAISuggestion(text) {
  if (!_aiLoading) sendAIMessage(text);
}
let _aiVoiceRecognition = null;
function toggleAIVoice() {
  const recognition2 = window.webkitSpeechRecognition || window.SpeechRecognition;
  if (!recognition2) {
    showToast("Reconnaissance vocale non support\xE9e", "error");
    return;
  }
  if (_aiVoiceRecognition) {
    _aiVoiceRecognition.abort();
    _aiVoiceRecognition = null;
    document.getElementById("ai-voice-btn").style.opacity = "1";
    return;
  }
  _aiVoiceRecognition = new recognition2();
  _aiVoiceRecognition.lang = "fr-FR";
  _aiVoiceRecognition.continuous = false;
  _aiVoiceRecognition.interimResults = true;
  const btn = document.getElementById("ai-voice-btn");
  btn.style.opacity = "0.6";
  btn.style.background = "var(--color-accent)";
  btn.style.color = "white";
  let transcript = "";
  _aiVoiceRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        transcript += t + " ";
      }
    }
    if (event.isFinal && transcript.trim()) {
      const input = document.getElementById("ai-input");
      input.value = transcript.trim();
      btn.style.opacity = "1";
      btn.style.background = "";
      btn.style.color = "";
      sendAIMessage(transcript.trim());
      _aiVoiceRecognition = null;
    }
  };
  _aiVoiceRecognition.onerror = (event) => {
    btn.style.opacity = "1";
    btn.style.background = "";
    btn.style.color = "";
    if (event.error !== "no-speech") {
      showToast("Erreur vocale: " + event.error, "error");
    }
    _aiVoiceRecognition = null;
  };
  _aiVoiceRecognition.onend = () => {
    btn.style.opacity = "1";
    btn.style.background = "";
    btn.style.color = "";
    _aiVoiceRecognition = null;
  };
  _aiVoiceRecognition.start();
}
async function sendAIMessage(message) {
  var _a;
  if (_aiLoading) return;
  _aiLoading = true;
  const messagesEl = document.getElementById("ai-messages");
  const sendBtn = document.getElementById("ai-send-btn");
  const voiceBtn = document.getElementById("ai-voice-btn");
  if (sendBtn) sendBtn.disabled = true;
  if (voiceBtn) voiceBtn.disabled = true;
  const userMsg = document.createElement("div");
  userMsg.className = "ai-msg ai-msg--user";
  userMsg.innerHTML = `
    <div class="ai-msg__avatar">\u{1F464}</div>
    <div class="ai-msg__bubble">${escapeHtml(message)}</div>
  `;
  messagesEl.appendChild(userMsg);
  const typing = document.createElement("div");
  typing.className = "ai-msg ai-msg--ai";
  typing.id = "ai-typing";
  typing.innerHTML = `
    <div class="ai-msg__avatar">\u{1F9E0}</div>
    <div class="ai-msg__bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>
  `;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  try {
    const result = await API.request("/ai/assistant", {
      method: "POST",
      body: { message, conversation_history: _aiHistory }
    });
    _aiHistory.push({ role: "user", text: message });
    _aiHistory.push({ role: "model", text: result.reply });
    typing.remove();
    const aiMsg = document.createElement("div");
    aiMsg.className = "ai-msg ai-msg--ai";
    aiMsg.innerHTML = `
      <div class="ai-msg__avatar">\u{1F9E0}</div>
      <div class="ai-msg__bubble">${formatAIReply(result.reply)}</div>
    `;
    messagesEl.appendChild(aiMsg);
    if (result.actions && result.actions.length > 0) {
      for (const action of result.actions) {
        if (!action.requires_confirmation) continue;
        const actionEl = document.createElement("div");
        actionEl.className = "ai-msg ai-msg--ai";
        actionEl.innerHTML = `
          <div class="ai-msg__avatar"></div>
          <div class="ai-action-card">
            <div class="ai-action-title">
              <i data-lucide="zap" style="width:16px;height:16px"></i> ${escapeHtml(action.description)}
            </div>
            <div class="ai-action-buttons">
              <button class="ai-action-confirm" onclick="confirmAIAction('${action.type}', '${btoa(JSON.stringify(action.params))}')">\u2713 Confirmer</button>
              <button class="ai-action-cancel" onclick="dismissAction(this)">\u2715 Annuler</button>
            </div>
          </div>
        `;
        messagesEl.appendChild(actionEl);
        if (window.lucide) lucide.createIcons();
      }
    }
  } catch (e) {
    typing.remove();
    const errMsg = document.createElement("div");
    errMsg.className = "ai-msg ai-msg--ai";
    errMsg.innerHTML = `
      <div class="ai-msg__avatar">\u{1F9E0}</div>
      <div class="ai-msg__bubble" style="border-color:var(--color-danger)">
        <p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>
      </div>
    `;
    messagesEl.appendChild(errMsg);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  _aiLoading = false;
  if (sendBtn) sendBtn.disabled = false;
  if (voiceBtn) voiceBtn.disabled = false;
  (_a = document.getElementById("ai-input")) == null ? void 0 : _a.focus();
}
async function confirmAIAction(type, paramsBase64) {
  try {
    const params = JSON.parse(atob(paramsBase64));
    const messagesEl = document.getElementById("ai-messages");
    const loadingEl = document.createElement("div");
    loadingEl.className = "ai-msg ai-msg--ai";
    loadingEl.innerHTML = `
      <div class="ai-msg__avatar">\u{1F9E0}</div>
      <div class="ai-msg__bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>
    `;
    messagesEl.appendChild(loadingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    const result = await API.request("/ai/execute-action", {
      method: "POST",
      body: { type, params }
    });
    loadingEl.remove();
    const resultMsg = document.createElement("div");
    resultMsg.className = "ai-msg ai-msg--ai";
    if (result.success) {
      resultMsg.innerHTML = `
        <div class="ai-msg__avatar">\u2713</div>
        <div class="ai-msg__bubble" style="background:var(--color-success-light);border-color:var(--color-success)">
          <p style="color:var(--color-success);font-weight:500">${result.message}</p>
        </div>
      `;
    } else {
      resultMsg.innerHTML = `
        <div class="ai-msg__avatar">\u2715</div>
        <div class="ai-msg__bubble" style="border-color:var(--color-danger)">
          <p style="color:var(--color-danger)">${result.error || "Impossible d'ex\xE9cuter l'action"}</p>
        </div>
      `;
    }
    messagesEl.appendChild(resultMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
}
function dismissAction(btn) {
  btn.closest(".ai-action-card").parentElement.remove();
}
function formatAIReply(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.1);padding:2px 4px;border-radius:3px">$1</code>').replace(/^### (.*$)/gm, '<h4 style="margin:12px 0 6px;font-size:var(--text-sm)">$1</h4>').replace(/^## (.*$)/gm, '<h3 style="margin:12px 0 6px">$1</h3>').replace(/^- (.*$)/gm, '<li style="margin-left:16px">$1</li>').replace(/^(\d+)\. (.*$)/gm, '<li style="margin-left:16px">$2</li>').replace(/\n{2,}/g, '</p><p style="margin-top:8px">').replace(/\n/g, "<br>");
}
async function renderMenuEngineering() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <a href="#/analytics" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Analytics
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="target" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Menu Engineering
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Optimisez votre carte avec la matrice popularit\xE9 \xD7 marge</p>
    </div>

    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <select id="me-period" class="input" style="width:auto">
        <option value="7">7 jours</option>
        <option value="30" selected>30 jours</option>
        <option value="90">90 jours</option>
      </select>
      <select id="me-category" class="input" style="width:auto">
        <option value="">Toutes cat\xE9gories</option>
      </select>
    </div>

    <div id="me-content">
      <div style="text-align:center;padding:var(--space-6)">
        <div class="loading-spinner"></div>
        <p class="text-secondary" style="margin-top:var(--space-2)">Analyse en cours\u2026</p>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById("me-period").addEventListener("change", () => loadMenuEngineering());
  document.getElementById("me-category").addEventListener("change", () => filterMenuEngineering());
  await loadMenuEngineering();
}
let _meData = null;
async function loadMenuEngineering() {
  const days = document.getElementById("me-period").value;
  const content = document.getElementById("me-content");
  try {
    _meData = await API.request(`/analytics/menu-engineering?days=${days}`);
    populateMECategories();
    renderMEContent();
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}
function populateMECategories() {
  if (!_meData) return;
  const sel = document.getElementById("me-category");
  const cats = [...new Set(_meData.items.map((i) => i.category))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">Toutes cat\xE9gories</option>' + cats.map((c) => `<option value="${escapeHtml(c)}" ${c === current ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
}
function filterMenuEngineering() {
  renderMEContent();
}
function renderMEContent() {
  if (!_meData) return;
  const content = document.getElementById("me-content");
  const catFilter = document.getElementById("me-category").value;
  const data = _meData;
  const items = catFilter ? data.items.filter((i) => i.category === catFilter) : data.items;
  const stars = items.filter((i) => i.classification === "star");
  const puzzles = items.filter((i) => i.classification === "puzzle");
  const plowhorses = items.filter((i) => i.classification === "plowhorse");
  const dogs = items.filter((i) => i.classification === "dog");
  content.innerHTML = `
    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #F59E0B">
        <div style="font-size:1.5rem">\u2B50</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#F59E0B">${stars.length}</div>
        <div class="text-secondary text-sm">Stars</div>
        <div class="text-secondary" style="font-size:10px">Haute marge + populaire</div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #8B5CF6">
        <div style="font-size:1.5rem">\u{1F9E9}</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#8B5CF6">${puzzles.length}</div>
        <div class="text-secondary text-sm">Puzzles</div>
        <div class="text-secondary" style="font-size:10px">Haute marge, peu vendu</div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #3B82F6">
        <div style="font-size:1.5rem">\u{1F434}</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#3B82F6">${plowhorses.length}</div>
        <div class="text-secondary text-sm">Plowhorses</div>
        <div class="text-secondary" style="font-size:10px">Populaire, faible marge</div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #EF4444">
        <div style="font-size:1.5rem">\u{1F415}</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#EF4444">${dogs.length}</div>
        <div class="text-secondary text-sm">Dogs</div>
        <div class="text-secondary" style="font-size:10px">Faible marge + peu vendu</div>
      </div>
    </div>

    <!-- KPI Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Revenu total</div>
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.total_revenue.toFixed(0)} \u20AC</div>
      </div>
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Profit total</div>
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-success)">${data.summary.total_profit.toFixed(0)} \u20AC</div>
      </div>
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Marge moyenne</div>
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.avg_margin.toFixed(2)} \u20AC</div>
      </div>
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Ventes moy./plat</div>
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.avg_qty_sold.toFixed(1)}</div>
      </div>
    </div>

    <!-- Visual Matrix -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Matrice Menu Engineering</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:2px;border-radius:var(--radius-lg);overflow:hidden;min-height:300px">
        <!-- Top-left: Puzzle (high margin, low popularity) -->
        <div style="background:rgba(139,92,246,0.1);padding:var(--space-3);border:1px solid rgba(139,92,246,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#8B5CF6">\u{1F9E9} Puzzles <span class="text-secondary text-sm">(\xE0 promouvoir)</span></div>
          ${puzzles.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : puzzles.map((i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit">${escapeHtml(i.name)}</a>
              <span style="color:#8B5CF6;font-weight:600">${i.margin.toFixed(2)}\u20AC</span>
            </div>
          `).join("")}
        </div>
        <!-- Top-right: Star (high margin, high popularity) -->
        <div style="background:rgba(245,158,11,0.1);padding:var(--space-3);border:1px solid rgba(245,158,11,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#F59E0B">\u2B50 Stars <span class="text-secondary text-sm">(\xE0 maintenir)</span></div>
          ${stars.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : stars.map((i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit">${escapeHtml(i.name)}</a>
              <span style="color:#F59E0B;font-weight:600">${i.qty_sold} vendus</span>
            </div>
          `).join("")}
        </div>
        <!-- Bottom-left: Dog (low margin, low popularity) -->
        <div style="background:rgba(239,68,68,0.1);padding:var(--space-3);border:1px solid rgba(239,68,68,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#EF4444">\u{1F415} Dogs <span class="text-secondary text-sm">(\xE0 repenser)</span></div>
          ${dogs.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : dogs.map((i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit;opacity:0.7">${escapeHtml(i.name)}</a>
              <span style="color:#EF4444;font-size:var(--text-xs)">${i.qty_sold} vendus \xB7 ${i.margin.toFixed(2)}\u20AC</span>
            </div>
          `).join("")}
        </div>
        <!-- Bottom-right: Plowhorse (low margin, high popularity) -->
        <div style="background:rgba(59,130,246,0.1);padding:var(--space-3);border:1px solid rgba(59,130,246,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#3B82F6">\u{1F434} Plowhorses <span class="text-secondary text-sm">(\xE0 optimiser)</span></div>
          ${plowhorses.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : plowhorses.map((i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit">${escapeHtml(i.name)}</a>
              <span style="color:#3B82F6;font-size:var(--text-xs)">FC: ${i.food_cost_pct}%</span>
            </div>
          `).join("")}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary)">
        <span>\u2190 Faible popularit\xE9</span>
        <span>Forte popularit\xE9 \u2192</span>
      </div>
      <div style="text-align:center;margin-top:2px;font-size:var(--text-xs);color:var(--text-tertiary)">
        \u2191 Haute marge &nbsp;&nbsp; \u2193 Faible marge
      </div>
    </div>

    <!-- Recommendations -->
    ${data.recommendations.length > 0 ? `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Recommandations</h3>
      ${data.recommendations.map((r) => `
        <div style="padding:var(--space-2) var(--space-3);margin-bottom:var(--space-2);background:${r.severity === "warning" ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)"};border-radius:var(--radius-md);font-size:var(--text-sm);border-left:3px solid ${r.severity === "warning" ? "#F59E0B" : "#3B82F6"}">
          ${r.type === "remove" ? "\u{1F5D1}\uFE0F" : r.type === "optimize" ? "\u{1F527}" : "\u{1F4E3}"} ${escapeHtml(r.message)}
        </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- Detailed Table -->
    <div class="card" style="padding:var(--space-4);overflow-x:auto">
      <h3 style="margin-bottom:var(--space-3)">D\xE9tail par plat</h3>
      <table class="table" style="font-size:var(--text-sm)">
        <thead>
          <tr>
            <th>Plat</th>
            <th>Cat\xE9gorie</th>
            <th style="text-align:right">Prix</th>
            <th style="text-align:right">Co\xFBt</th>
            <th style="text-align:right">Marge</th>
            <th style="text-align:right">FC %</th>
            <th style="text-align:right">Vendus</th>
            <th style="text-align:right">Profit</th>
            <th>Classif.</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((i) => `
            <tr>
              <td><a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit;font-weight:500">${escapeHtml(i.name)}</a></td>
              <td class="text-secondary">${escapeHtml(i.category)}</td>
              <td style="text-align:right">${i.selling_price.toFixed(2)} \u20AC</td>
              <td style="text-align:right">${i.cost.toFixed(2)} \u20AC</td>
              <td style="text-align:right;font-weight:600;color:${i.margin >= data.summary.avg_margin ? "var(--color-success)" : "var(--color-danger)"}">${i.margin.toFixed(2)} \u20AC</td>
              <td style="text-align:right;color:${i.food_cost_pct > 35 ? "var(--color-danger)" : i.food_cost_pct > 30 ? "var(--color-warning)" : "var(--color-success)"}">${i.food_cost_pct}%</td>
              <td style="text-align:right">${i.qty_sold}</td>
              <td style="text-align:right;font-weight:600">${i.total_profit.toFixed(2)} \u20AC</td>
              <td>
                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:var(--text-xs);font-weight:600;background:${classifColor(i.classification)}20;color:${classifColor(i.classification)}">
                  ${i.emoji} ${i.label}
                </span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}
function classifColor(c) {
  return { star: "#F59E0B", puzzle: "#8B5CF6", plowhorse: "#3B82F6", dog: "#EF4444" }[c] || "#666";
}
async function renderCarbon() {
  const app = document.getElementById("app");
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
        <p class="text-secondary" style="margin-top:var(--space-2)">Calcul en cours\u2026</p>
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
  document.querySelectorAll(".carbon-tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.className = b.classList.contains("active") ? "btn btn-primary carbon-tab-btn active" : "btn btn-secondary carbon-tab-btn";
  });
  if (tab === "recipes") loadCarbonRecipes();
  else loadCarbonGlobal();
}
async function loadCarbonRecipes() {
  const content = document.getElementById("carbon-content");
  try {
    if (!_carbonRecipes) {
      _carbonRecipes = await API.request("/carbon/recipes");
    }
    renderCarbonRecipes(_carbonRecipes);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}
async function loadCarbonGlobal() {
  const content = document.getElementById("carbon-content");
  content.innerHTML = '<div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>';
  try {
    if (!_carbonGlobal) {
      _carbonGlobal = await API.request("/carbon/global?days=30");
    }
    renderCarbonGlobal(_carbonGlobal);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}
function renderCarbonRecipes(data) {
  const content = document.getElementById("carbon-content");
  const s = data.summary;
  content.innerHTML = `
    <!-- Rating Distribution -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-2);margin-bottom:var(--space-4)">
      ${["A", "B", "C", "D", "E"].map((r) => `
        <div class="card" style="text-align:center;padding:var(--space-3)">
          <div class="carbon-rating carbon-rating-${r}" style="margin:0 auto var(--space-1)">${r}</div>
          <div style="font-size:var(--text-xl);font-weight:700">${s.rating_distribution[r]}</div>
          <div class="text-secondary" style="font-size:10px">${r === "A" ? "< 0.5 kg" : r === "B" ? "< 1 kg" : r === "C" ? "< 2 kg" : r === "D" ? "< 4 kg" : "\u2265 4 kg"}</div>
        </div>
      `).join("")}
    </div>

    <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-4);text-align:center">
      <span class="text-secondary">\xC9mission moyenne par portion :</span>
      <span style="font-size:var(--text-xl);font-weight:700;margin-left:8px">${s.avg_co2_per_portion.toFixed(2)} kg CO\u2082e</span>
    </div>

    <!-- Recipe List -->
    <div style="display:flex;flex-direction:column;gap:var(--space-2)">
      ${data.recipes.map((r) => `
        <div class="card" style="padding:var(--space-3)">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div class="carbon-rating carbon-rating-${r.rating}">${r.rating}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:var(--space-2)">
                <a href="#/recipes/${r.id}" style="font-weight:600;text-decoration:none;color:inherit">${escapeHtml(r.name)}</a>
                <span class="text-secondary text-sm">${escapeHtml(r.category)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:var(--space-3);margin-top:4px">
                <span class="text-secondary text-sm">${r.co2_per_portion.toFixed(2)} kg CO\u2082e / portion</span>
                <span class="text-secondary text-sm">${r.total_co2_kg.toFixed(2)} kg total</span>
              </div>
              ${r.breakdown.length > 0 ? `
              <div style="margin-top:8px">
                <div style="display:flex;gap:2px;height:6px;border-radius:3px;overflow:hidden">
                  ${r.breakdown.slice(0, 5).map((b) => {
    const pct = r.total_co2_kg > 0 ? b.co2_kg / r.total_co2_kg * 100 : 0;
    const color = b.factor >= 10 ? "#DC2626" : b.factor >= 5 ? "#EA580C" : b.factor >= 2 ? "#CA8A04" : "#16A34A";
    return `<div style="width:${Math.max(pct, 2)}%;background:${color}" title="${b.ingredient}: ${b.co2_kg.toFixed(3)} kg CO\u2082e"></div>`;
  }).join("")}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;font-size:10px;color:var(--text-tertiary)">
                  ${r.breakdown.slice(0, 3).map((b) => `${b.ingredient} (${(r.total_co2_kg > 0 ? b.co2_kg / r.total_co2_kg * 100 : 0).toFixed(0)}%)`).join(" \xB7 ")}
                </div>
              </div>
              ` : ""}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
function renderCarbonGlobal(data) {
  const content = document.getElementById("carbon-content");
  const maxCat = data.categories.length > 0 ? data.categories[0].co2_kg : 1;
  content.innerHTML = `
    <!-- Global KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-4);text-align:center;border-left:4px solid #16A34A">
        <div style="font-size:1.5rem">\u{1F30D}</div>
        <div style="font-size:var(--text-2xl);font-weight:700">${data.total_co2_kg.toFixed(0)}</div>
        <div class="text-secondary text-sm">kg CO\u2082e total (${data.period_days}j)</div>
      </div>
      <div class="card" style="padding:var(--space-4);text-align:center;border-left:4px solid #065F46">
        <div style="font-size:1.5rem">\u{1F4C5}</div>
        <div style="font-size:var(--text-2xl);font-weight:700">${data.daily_avg_co2.toFixed(1)}</div>
        <div class="text-secondary text-sm">kg CO\u2082e / jour</div>
      </div>
    </div>

    <!-- Equivalents -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">\xC9quivalences</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3)">
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span style="font-size:1.5rem">\u{1F697}</span>
          <div>
            <div style="font-weight:600">${data.equivalents.car_km.toLocaleString("fr-FR")} km</div>
            <div class="text-secondary text-sm">en voiture</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span style="font-size:1.5rem">\u{1F333}</span>
          <div>
            <div style="font-weight:600">${data.equivalents.tree_days.toLocaleString("fr-FR")} jours-arbre</div>
            <div class="text-secondary text-sm">pour compenser</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span style="font-size:1.5rem">\u2708\uFE0F</span>
          <div>
            <div style="font-weight:600">${data.equivalents.flights_paris_marseille} vols</div>
            <div class="text-secondary text-sm">Paris \u2192 Marseille</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Categories Breakdown -->
    <div class="card" style="padding:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">R\xE9partition par cat\xE9gorie</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        ${data.categories.map((c) => `
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-weight:500">${escapeHtml(c.name)}</span>
              <span style="font-weight:600">${c.co2_kg.toFixed(1)} kg CO\u2082e <span class="text-secondary text-sm">(${c.pct}%)</span></span>
            </div>
            <div style="width:100%;background:var(--bg-sunken);border-radius:4px;height:8px;overflow:hidden">
              <div class="carbon-bar" style="width:${(c.co2_kg / maxCat * 100).toFixed(1)}%;background:${c.pct > 40 ? "#DC2626" : c.pct > 20 ? "#EA580C" : c.pct > 10 ? "#CA8A04" : "#16A34A"}"></div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card" style="padding:var(--space-3);margin-top:var(--space-4);background:rgba(22,163,74,0.05);border-color:rgba(22,163,74,0.2)">
      <p class="text-secondary text-sm" style="margin:0">
        \u{1F4A1} <strong>Conseils :</strong> R\xE9duisez l'empreinte carbone en privil\xE9giant les prot\xE9ines v\xE9g\xE9tales,
        en limitant le boeuf/agneau, en choisissant des produits de saison et locaux, et en r\xE9duisant le gaspillage alimentaire.
      </p>
    </div>
  `;
}
const PROVIDER_META = {
  thefork: { name: "TheFork / LaFourchette", icon: "\u{1F374}", color: "#00B37E", desc: "Synchronisation des r\xE9servations TheFork en temps r\xE9el" },
  pos_caisse: { name: "Caisse / POS", icon: "\u{1F4B3}", color: "#3B82F6", desc: "Connectez votre syst\xE8me de caisse pour synchroniser les ventes" },
  comptabilite: { name: "Comptabilit\xE9", icon: "\u{1F4CA}", color: "#8B5CF6", desc: "Export automatique vers votre logiciel comptable (Pennylane, Cegid\u2026)" },
  deliveroo: { name: "Deliveroo", icon: "\u{1F6F5}", color: "#00CCBC", desc: "Recevez les commandes Deliveroo directement dans RestoSuite" },
  ubereats: { name: "Uber Eats", icon: "\u{1F961}", color: "#06C167", desc: "Recevez les commandes Uber Eats directement dans RestoSuite" }
};
async function renderIntegrations() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="plug" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Int\xE9grations
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Connectez TheFork, votre caisse, livraison, comptabilit\xE9</p>
    </div>

    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4)">
      <button class="btn btn-primary integ-tab active" data-tab="integrations" onclick="switchIntegTab('integrations')">Int\xE9grations</button>
      <button class="btn btn-secondary integ-tab" data-tab="reservations" onclick="switchIntegTab('reservations')">R\xE9servations</button>
    </div>

    <div id="integ-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadIntegrations();
}
function switchIntegTab(tab) {
  document.querySelectorAll(".integ-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.className = b.classList.contains("active") ? "btn btn-primary integ-tab active" : "btn btn-secondary integ-tab";
  });
  if (tab === "integrations") loadIntegrations();
  else loadReservations();
}
async function loadIntegrations() {
  const content = document.getElementById("integ-content");
  try {
    const data = await API.request("/integrations");
    renderIntegrationsList(data);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
function renderIntegrationsList(integrations) {
  const content = document.getElementById("integ-content");
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${integrations.map((integ) => {
    const meta = PROVIDER_META[integ.provider] || { name: integ.provider, icon: "\u{1F50C}", color: "#666", desc: "" };
    const enabled = integ.enabled;
    const statusLabel = enabled ? "Connect\xE9" : integ.has_credentials ? "Configur\xE9 (d\xE9sactiv\xE9)" : "Non configur\xE9";
    const statusColor = enabled ? "var(--color-success)" : integ.has_credentials ? "var(--color-warning)" : "var(--text-tertiary)";
    return `
        <div class="card" style="padding:var(--space-4)">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div style="width:48px;height:48px;border-radius:12px;background:${meta.color}20;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${meta.icon}</div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:var(--space-2)">
                <h3 style="margin:0">${meta.name}</h3>
                <span style="font-size:var(--text-xs);color:${statusColor};font-weight:600">${statusLabel}</span>
              </div>
              <p class="text-secondary text-sm" style="margin:4px 0 0">${meta.desc}</p>
              ${integ.last_sync ? `<p class="text-secondary" style="font-size:10px;margin:4px 0 0">Derni\xE8re synchro : ${new Date(integ.last_sync).toLocaleString("fr-FR")}</p>` : ""}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="configureIntegration('${integ.provider}')" style="flex-shrink:0">
              ${enabled ? "G\xE9rer" : "Configurer"}
            </button>
          </div>
        </div>`;
  }).join("")}
    </div>

    <div class="card" style="padding:var(--space-3);margin-top:var(--space-4);background:rgba(59,130,246,0.05);border-color:rgba(59,130,246,0.2)">
      <p class="text-secondary text-sm" style="margin:0">
        \u{1F4A1} <strong>TheFork :</strong> RestoSuite s'int\xE8gre avec TheFork pour synchroniser vos r\xE9servations automatiquement.
        Contactez votre account manager TheFork pour obtenir vos cl\xE9s API, puis configurez-les ici.
      </p>
    </div>
  `;
}
function configureIntegration(provider) {
  const meta = PROVIDER_META[provider] || { name: provider };
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h2>Configurer ${meta.name}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Cl\xE9 API</label>
          <input type="text" class="input" id="integ-api-key" placeholder="Votre cl\xE9 API ${meta.name}">
        </div>
        <div class="form-group">
          <label class="label">Secret API (optionnel)</label>
          <input type="password" class="input" id="integ-api-secret" placeholder="Secret ou token">
        </div>
        <div class="form-group">
          <label class="label">URL Webhook (optionnel)</label>
          <input type="url" class="input" id="integ-webhook" placeholder="https://...">
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:var(--space-2)">
          <label class="toggle">
            <input type="checkbox" id="integ-enabled" checked>
            <span class="toggle-slider"></span>
          </label>
          <span>Activer l'int\xE9gration</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveIntegration('${provider}')">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
async function saveIntegration(provider) {
  var _a;
  try {
    await API.request(`/integrations/${provider}`, {
      method: "PUT",
      body: {
        api_key: document.getElementById("integ-api-key").value || null,
        api_secret: document.getElementById("integ-api-secret").value || null,
        webhook_url: document.getElementById("integ-webhook").value || null,
        enabled: document.getElementById("integ-enabled").checked ? 1 : 0
      }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast("Int\xE9gration sauvegard\xE9e", "success");
    loadIntegrations();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function loadReservations() {
  const content = document.getElementById("integ-content");
  content.innerHTML = '<div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>';
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const [reservations, stats] = await Promise.all([
      API.request(`/integrations/reservations?date=${today}`),
      API.request("/integrations/reservations/stats")
    ]);
    renderReservationsList(reservations, stats, today);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
function renderReservationsList(reservations, stats, date) {
  const content = document.getElementById("integ-content");
  content.innerHTML = `
    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700">${stats.today_count}</div>
        <div class="text-secondary text-sm">R\xE9sa. aujourd'hui</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700">${stats.today_covers}</div>
        <div class="text-secondary text-sm">Couverts pr\xE9vus</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700">${stats.week_count}</div>
        <div class="text-secondary text-sm">Cette semaine</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700;color:${stats.no_show_rate_pct > 10 ? "var(--color-danger)" : "var(--color-success)"}">${stats.no_show_rate_pct}%</div>
        <div class="text-secondary text-sm">No-show (30j)</div>
      </div>
    </div>

    <!-- Date selector + Add -->
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);align-items:center">
      <input type="date" id="resa-date" class="input" value="${date}" style="width:auto" onchange="changeResaDate()">
      <div style="flex:1"></div>
      <button class="btn btn-primary btn-sm" onclick="showAddReservation()">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Nouvelle r\xE9sa.
      </button>
    </div>

    <!-- Reservations list -->
    ${reservations.length === 0 ? `
      <div class="card" style="padding:var(--space-4);text-align:center">
        <p class="text-secondary">Aucune r\xE9servation pour cette date</p>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${reservations.map((r) => `
          <div class="card" style="padding:var(--space-3)">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div style="text-align:center;min-width:48px">
                <div style="font-size:var(--text-lg);font-weight:700">${r.reservation_time.slice(0, 5)}</div>
              </div>
              <div style="flex:1">
                <div style="font-weight:600">${escapeHtml(r.customer_name)}</div>
                <div class="text-secondary text-sm">
                  ${r.party_size} couvert${r.party_size > 1 ? "s" : ""}
                  ${r.table_number ? ` \xB7 Table ${r.table_number}` : ""}
                  ${r.source !== "manual" ? ` \xB7 <span style="color:${r.source === "thefork" ? "#00B37E" : "var(--color-info)"}">via ${r.source}</span>` : ""}
                </div>
                ${r.notes ? `<div class="text-secondary" style="font-size:10px;margin-top:2px">${escapeHtml(r.notes)}</div>` : ""}
              </div>
              <div style="display:flex;gap:4px">
                <span style="padding:2px 8px;border-radius:12px;font-size:var(--text-xs);font-weight:600;background:${r.status === "confirmed" ? "rgba(22,163,74,0.1);color:#16A34A" : r.status === "seated" ? "rgba(59,130,246,0.1);color:#3B82F6" : r.status === "completed" ? "rgba(107,114,128,0.1);color:#6B7280" : "rgba(239,68,68,0.1);color:#EF4444"}">${r.status === "confirmed" ? "Confirm\xE9" : r.status === "seated" ? "Install\xE9" : r.status === "completed" ? "Termin\xE9" : "Annul\xE9"}</span>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `}
  `;
  if (window.lucide) lucide.createIcons();
}
async function changeResaDate() {
  const date = document.getElementById("resa-date").value;
  const content = document.getElementById("integ-content");
  try {
    const [reservations, stats] = await Promise.all([
      API.request(`/integrations/reservations?date=${date}`),
      API.request("/integrations/reservations/stats")
    ]);
    renderReservationsList(reservations, stats, date);
  } catch (e) {
    showToast(e.message, "error");
  }
}
function showAddReservation() {
  var _a;
  const date = ((_a = document.getElementById("resa-date")) == null ? void 0 : _a.value) || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h2>Nouvelle r\xE9servation</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom du client *</label>
          <input type="text" class="input" id="resa-name" placeholder="Nom" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Date *</label>
            <input type="date" class="input" id="resa-date-input" value="${date}">
          </div>
          <div class="form-group">
            <label class="label">Heure *</label>
            <input type="time" class="input" id="resa-time" value="19:30">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Couverts</label>
            <input type="number" class="input" id="resa-party" value="2" min="1" max="50">
          </div>
          <div class="form-group">
            <label class="label">T\xE9l\xE9phone</label>
            <input type="tel" class="input" id="resa-phone" placeholder="06...">
          </div>
        </div>
        <div class="form-group">
          <label class="label">Notes</label>
          <textarea class="input" id="resa-notes" rows="2" placeholder="Anniversaire, allergies, chaise b\xE9b\xE9\u2026"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveReservation()">Cr\xE9er</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("resa-name").focus();
}
async function saveReservation() {
  var _a;
  const name = document.getElementById("resa-name").value.trim();
  if (!name) return showToast("Nom requis", "error");
  try {
    await API.request("/integrations/reservations", {
      method: "POST",
      body: {
        customer_name: name,
        reservation_date: document.getElementById("resa-date-input").value,
        reservation_time: document.getElementById("resa-time").value,
        party_size: parseInt(document.getElementById("resa-party").value) || 2,
        customer_phone: document.getElementById("resa-phone").value || null,
        notes: document.getElementById("resa-notes").value || null,
        source: "manual"
      }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast("R\xE9servation cr\xE9\xE9e", "success");
    loadReservations();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function renderMultiSite() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="building-2" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Multi-Sites
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">G\xE9rez tous vos \xE9tablissements depuis un seul tableau de bord</p>
    </div>
    <div id="multisite-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadMultiSite();
}
async function loadMultiSite() {
  const content = document.getElementById("multisite-content");
  try {
    const [sites, comparison] = await Promise.all([
      API.request("/sites"),
      API.request("/sites/compare/all?days=30")
    ]);
    renderMultiSiteContent(sites, comparison);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
function renderMultiSiteContent(sites, comparison) {
  const content = document.getElementById("multisite-content");
  const compMap = {};
  for (const s of comparison.sites) compMap[s.id] = s;
  content.innerHTML = `
    <!-- Comparaison -->
    ${comparison.sites.length > 1 ? `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Comparaison des sites (30 jours)</h3>
      <div style="overflow-x:auto">
        <table class="table" style="font-size:var(--text-sm)">
          <thead>
            <tr>
              <th>Site</th>
              <th style="text-align:right">Chiffre d'affaires</th>
              <th style="text-align:right">Commandes</th>
              <th style="text-align:right">Ticket moyen</th>
              <th style="text-align:right">\xC9quipe</th>
              <th style="text-align:right">Tables</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.sites.map((s) => `
              <tr>
                <td style="font-weight:600">${escapeHtml(s.name)}</td>
                <td style="text-align:right">${s.revenue.toFixed(0)} \u20AC</td>
                <td style="text-align:right">${s.orders}</td>
                <td style="text-align:right">${s.avg_ticket.toFixed(2)} \u20AC</td>
                <td style="text-align:right">${s.staff}</td>
                <td style="text-align:right">${s.tables}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
    ` : ""}

    <!-- Sites list -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <h3>${sites.length} \xE9tablissement${sites.length > 1 ? "s" : ""}</h3>
      <button class="btn btn-primary btn-sm" onclick="showAddSiteModal()">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Ajouter un site
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-3)">
      ${sites.map((site) => {
    const comp = compMap[site.id] || {};
    return `
        <div class="card" style="padding:var(--space-4)">
          <div style="display:flex;align-items:start;gap:var(--space-3)">
            <div style="width:48px;height:48px;border-radius:12px;background:var(--color-accent);display:flex;align-items:center;justify-content:center;color:white;font-size:1.2rem;font-weight:700;flex-shrink:0">
              ${(site.name || "R").charAt(0).toUpperCase()}
            </div>
            <div style="flex:1">
              <h3 style="margin:0">${escapeHtml(site.name || "Mon restaurant")}</h3>
              <p class="text-secondary text-sm" style="margin:2px 0 0">${escapeHtml(site.address || "")} ${escapeHtml(site.city || "")}</p>
              ${site.phone ? `<p class="text-secondary" style="font-size:10px">${escapeHtml(site.phone)}</p>` : ""}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-light)">
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.table_count || 0}</div>
              <div class="text-secondary text-sm">Tables</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.staff_count || 0}</div>
              <div class="text-secondary text-sm">\xC9quipe</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.covers || 0}</div>
              <div class="text-secondary text-sm">Couverts</div>
            </div>
          </div>
          ${comp.revenue > 0 ? `
          <div style="margin-top:var(--space-2);padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md);font-size:var(--text-xs);text-align:center">
            <span style="font-weight:600">${comp.revenue.toFixed(0)} \u20AC</span> CA 30j
            \xB7 <span style="font-weight:600">${comp.orders}</span> commandes
            \xB7 Ticket moy. <span style="font-weight:600">${comp.avg_ticket.toFixed(2)} \u20AC</span>
          </div>
          ` : ""}
          <div style="margin-top:var(--space-3);display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="editSite(${site.id})">Modifier</button>
          </div>
        </div>`;
  }).join("")}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}
function showAddSiteModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h2>Nouvel \xE9tablissement</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom *</label>
          <input type="text" class="input" id="site-name" placeholder="Nom du restaurant">
        </div>
        <div class="form-group">
          <label class="label">Type</label>
          <select class="input" id="site-type">
            <option value="restaurant">Restaurant</option>
            <option value="brasserie">Brasserie</option>
            <option value="bistrot">Bistrot</option>
            <option value="gastronomique">Gastronomique</option>
            <option value="fast-casual">Fast Casual</option>
            <option value="traiteur">Traiteur</option>
            <option value="dark-kitchen">Dark Kitchen</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Adresse</label>
          <input type="text" class="input" id="site-address" placeholder="Adresse">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Ville</label>
            <input type="text" class="input" id="site-city" placeholder="Ville">
          </div>
          <div class="form-group">
            <label class="label">Code postal</label>
            <input type="text" class="input" id="site-postal" placeholder="75001">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">T\xE9l\xE9phone</label>
            <input type="tel" class="input" id="site-phone" placeholder="01 23 45 67 89">
          </div>
          <div class="form-group">
            <label class="label">Couverts</label>
            <input type="number" class="input" id="site-covers" value="30" min="1">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveSite()">Cr\xE9er</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("site-name").focus();
}
async function saveSite() {
  var _a;
  const name = document.getElementById("site-name").value.trim();
  if (!name) return showToast("Nom requis", "error");
  try {
    await API.request("/sites", {
      method: "POST",
      body: {
        name,
        type: document.getElementById("site-type").value,
        address: document.getElementById("site-address").value || null,
        city: document.getElementById("site-city").value || null,
        postal_code: document.getElementById("site-postal").value || null,
        phone: document.getElementById("site-phone").value || null,
        covers: parseInt(document.getElementById("site-covers").value) || 30
      }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast("\xC9tablissement cr\xE9\xE9", "success");
    loadMultiSite();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function editSite(id) {
  try {
    const site = await API.request(`/sites/${id}`);
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h2>Modifier ${escapeHtml(site.name)}</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="label">Nom</label>
            <input type="text" class="input" id="edit-site-name" value="${escapeHtml(site.name || "")}">
          </div>
          <div class="form-group">
            <label class="label">Adresse</label>
            <input type="text" class="input" id="edit-site-address" value="${escapeHtml(site.address || "")}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
            <div class="form-group">
              <label class="label">Ville</label>
              <input type="text" class="input" id="edit-site-city" value="${escapeHtml(site.city || "")}">
            </div>
            <div class="form-group">
              <label class="label">T\xE9l\xE9phone</label>
              <input type="tel" class="input" id="edit-site-phone" value="${escapeHtml(site.phone || "")}">
            </div>
          </div>
          <div class="form-group">
            <label class="label">Couverts</label>
            <input type="number" class="input" id="edit-site-covers" value="${site.covers || 30}">
          </div>
          <div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
            <p class="text-secondary text-sm"><strong>${site.table_count || 0}</strong> tables \xB7 <strong>${site.staff_count || 0}</strong> membres d'\xE9quipe</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
          <button class="btn btn-primary" onclick="updateSite(${id})">Enregistrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function updateSite(id) {
  var _a;
  try {
    await API.request(`/sites/${id}`, {
      method: "PUT",
      body: {
        name: document.getElementById("edit-site-name").value,
        address: document.getElementById("edit-site-address").value || null,
        city: document.getElementById("edit-site-city").value || null,
        phone: document.getElementById("edit-site-phone").value || null,
        covers: parseInt(document.getElementById("edit-site-covers").value) || 30
      }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast("Site mis \xE0 jour", "success");
    loadMultiSite();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function renderPredictions() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <a href="#/analytics" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Analytics
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="brain" style="width:28px;height:28px;color:#7C3AED"></i>
        Pr\xE9dictions IA
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Anticipez la demande des 7 prochains jours</p>
    </div>
    <div id="pred-content">
      <div style="text-align:center;padding:var(--space-6)">
        <div class="loading-spinner"></div>
        <p class="text-secondary" style="margin-top:var(--space-2)">Analyse en cours\u2026</p>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadPredictions();
}
async function loadPredictions() {
  const content = document.getElementById("pred-content");
  try {
    const data = await API.request("/predictions/demand");
    renderPredictionsContent(data);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}
function renderPredictionsContent(data) {
  const content = document.getElementById("pred-content");
  const maxOrders = Math.max(...data.forecast.map((f) => f.predicted_orders), 1);
  content.innerHTML = `
    <!-- AI Insight -->
    ${data.ai_insight ? `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4);background:rgba(124,58,237,0.05);border-color:rgba(124,58,237,0.2)">
      <div style="display:flex;align-items:start;gap:var(--space-2)">
        <span style="font-size:1.2rem">\u{1F9E0}</span>
        <div>
          <strong style="color:#7C3AED">Analyse IA</strong>
          <p style="margin:8px 0 0;font-size:var(--text-sm)">${escapeHtml(data.ai_insight)}</p>
        </div>
      </div>
    </div>
    ` : ""}

    <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-4);text-align:center">
      <span class="text-secondary text-sm">Bas\xE9 sur <strong>${data.data_points}</strong> jours de donn\xE9es historiques</span>
      ${data.cached ? '<span class="text-secondary text-sm"> \xB7 R\xE9sultats en cache</span>' : ""}
    </div>

    <!-- 7-Day Forecast -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Pr\xE9visions 7 jours</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        ${data.forecast.map((f) => `
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div style="min-width:90px">
              <div style="font-weight:600;font-size:var(--text-sm)">${f.day_name}</div>
              <div class="text-secondary" style="font-size:10px">${f.date}</div>
            </div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px">
                <div style="flex:1;height:24px;background:var(--bg-sunken);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${(f.predicted_orders / maxOrders * 100).toFixed(0)}%;background:linear-gradient(90deg,#7C3AED,#A78BFA);border-radius:4px;display:flex;align-items:center;padding-left:8px">
                    <span style="color:white;font-size:11px;font-weight:600">${f.predicted_orders} cmd</span>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:var(--space-3);font-size:10px;color:var(--text-tertiary)">
                <span>${f.predicted_revenue.toFixed(0)} \u20AC pr\xE9vu</span>
                ${f.trend_pct !== 0 ? `<span style="color:${f.trend_pct > 0 ? "var(--color-success)" : "var(--color-danger)"}">
                  ${f.trend_pct > 0 ? "\u2191" : "\u2193"} ${Math.abs(f.trend_pct)}% vs moyenne
                </span>` : ""}
                <span style="color:${f.confidence === "high" ? "var(--color-success)" : f.confidence === "medium" ? "var(--color-warning)" : "var(--text-tertiary)"}">
                  Confiance: ${f.confidence === "high" ? "haute" : f.confidence === "medium" ? "moyenne" : "faible"}
                </span>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Weekly Pattern & Peak Hours -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Pattern hebdo. moyen</h3>
        ${data.weekly_pattern.map((d) => {
    const maxWeekly = Math.max(...data.weekly_pattern.map((w) => w.avg_orders), 1);
    return `
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:6px">
            <span style="min-width:60px;font-size:var(--text-xs)">${d.day_name.slice(0, 3)}</span>
            <div style="flex:1;height:16px;background:var(--bg-sunken);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${(d.avg_orders / maxWeekly * 100).toFixed(0)}%;background:var(--color-accent);border-radius:3px"></div>
            </div>
            <span style="min-width:35px;text-align:right;font-size:var(--text-xs);font-weight:600">${d.avg_orders}</span>
          </div>`;
  }).join("")}
      </div>

      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Heures de pointe</h3>
        ${data.peak_hours.length === 0 ? '<p class="text-secondary text-sm">Pas assez de donn\xE9es</p>' : ""}
        ${data.peak_hours.map((h, i) => `
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:8px">
            <span style="font-size:1.2rem">${i === 0 ? "\u{1F525}" : i === 1 ? "\u{1F7E0}" : "\u{1F7E1}"}</span>
            <span style="font-weight:600;min-width:50px">${h.hour}</span>
            <span class="text-secondary text-sm">${h.count} commandes</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Stock suggestions -->
    ${data.stock_suggestions.length > 0 ? `
    <div class="card" style="padding:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Suggestion de commande (7j)</h3>
      <table class="table" style="font-size:var(--text-sm)">
        <thead>
          <tr>
            <th>Ingr\xE9dient</th>
            <th style="text-align:right">Besoin 7j</th>
            <th style="text-align:right">Stock actuel</th>
            <th style="text-align:right">\xC0 commander</th>
            <th>Urgence</th>
          </tr>
        </thead>
        <tbody>
          ${data.stock_suggestions.map((s) => `
            <tr>
              <td>${escapeHtml(s.ingredient_name)}</td>
              <td style="text-align:right">${s.needed_7d} ${s.unit}</td>
              <td style="text-align:right">${s.current_stock} ${s.unit}</td>
              <td style="text-align:right;font-weight:600">${s.to_order} ${s.unit}</td>
              <td>
                <span style="padding:2px 8px;border-radius:12px;font-size:var(--text-xs);font-weight:600;background:${s.urgency === "critical" ? "rgba(239,68,68,0.1);color:#EF4444" : s.urgency === "high" ? "rgba(245,158,11,0.1);color:#F59E0B" : "rgba(59,130,246,0.1);color:#3B82F6"}">
                  ${s.urgency === "critical" ? "Critique" : s.urgency === "high" ? "\xC9lev\xE9e" : "Normale"}
                </span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    ` : ""}
  `;
}
async function renderCRM() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="heart" style="width:28px;height:28px;color:#EC4899"></i>
        CRM & Fid\xE9lit\xE9
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">G\xE9rez vos clients, points de fid\xE9lit\xE9 et r\xE9compenses</p>
    </div>

    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <button class="btn btn-primary crm-tab active" data-tab="customers" onclick="switchCrmTab('customers')">Clients</button>
      <button class="btn btn-secondary crm-tab" data-tab="rewards" onclick="switchCrmTab('rewards')">R\xE9compenses</button>
      <button class="btn btn-secondary crm-tab" data-tab="stats" onclick="switchCrmTab('stats')">Statistiques</button>
    </div>

    <div id="crm-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadCrmCustomers();
}
function switchCrmTab(tab) {
  document.querySelectorAll(".crm-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.className = b.classList.contains("active") ? "btn btn-primary crm-tab active" : "btn btn-secondary crm-tab";
  });
  if (tab === "customers") loadCrmCustomers();
  else if (tab === "rewards") loadCrmRewards();
  else loadCrmStats();
}
async function loadCrmCustomers() {
  const content = document.getElementById("crm-content");
  try {
    const customers = await API.request("/crm/customers");
    renderCrmCustomers(customers);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
function renderCrmCustomers(customers) {
  const content = document.getElementById("crm-content");
  content.innerHTML = `
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);align-items:center">
      <input type="text" class="input" id="crm-search" placeholder="Rechercher un client\u2026" style="flex:1" oninput="searchCrmCustomers()">
      <button class="btn btn-primary btn-sm" onclick="showAddCustomer()">
        <i data-lucide="user-plus" style="width:16px;height:16px"></i> Ajouter
      </button>
    </div>

    ${customers.length === 0 ? `
      <div class="card" style="padding:var(--space-6);text-align:center">
        <p style="font-size:1.5rem">\u{1F465}</p>
        <p class="text-secondary">Aucun client enregistr\xE9</p>
        <button class="btn btn-primary" style="margin-top:var(--space-3)" onclick="showAddCustomer()">Ajouter votre premier client</button>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:var(--space-2)" id="crm-list">
        ${customers.map((c) => renderCustomerCard(c)).join("")}
      </div>
    `}
  `;
  if (window.lucide) lucide.createIcons();
}
function renderCustomerCard(c) {
  return `
    <div class="card" style="padding:var(--space-3);cursor:pointer" onclick="showCustomerDetail(${c.id})">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        ${renderAvatar(c.name, 40)}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <span style="font-weight:600">${escapeHtml(c.name)}</span>
            ${c.vip ? '<span style="font-size:var(--text-xs);background:linear-gradient(135deg,#F59E0B,#EF4444);color:white;padding:1px 6px;border-radius:8px;font-weight:700">VIP</span>' : ""}
          </div>
          <div class="text-secondary text-sm">
            ${c.total_visits} visite${c.total_visits > 1 ? "s" : ""} \xB7 ${(c.total_spent || 0).toFixed(0)}\u20AC d\xE9pens\xE9s
            ${c.phone ? ` \xB7 ${c.phone}` : ""}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:var(--text-lg);font-weight:700;color:#EC4899">${c.loyalty_points}</div>
          <div class="text-secondary" style="font-size:10px">points</div>
        </div>
      </div>
    </div>`;
}
async function searchCrmCustomers() {
  const search = document.getElementById("crm-search").value.trim();
  try {
    const customers = await API.request(`/crm/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
    const list = document.getElementById("crm-list");
    if (list) {
      list.innerHTML = customers.map((c) => renderCustomerCard(c)).join("");
    }
  } catch (e) {
  }
}
function showAddCustomer() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h2>Nouveau client</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom *</label>
          <input type="text" class="input" id="cust-name" placeholder="Nom complet">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Email</label>
            <input type="email" class="input" id="cust-email" placeholder="email@exemple.com">
          </div>
          <div class="form-group">
            <label class="label">T\xE9l\xE9phone</label>
            <input type="tel" class="input" id="cust-phone" placeholder="06 12 34 56 78">
          </div>
        </div>
        <div class="form-group">
          <label class="label">Date d'anniversaire</label>
          <input type="date" class="input" id="cust-birthday">
        </div>
        <div class="form-group">
          <label class="label">Notes</label>
          <textarea class="input" id="cust-notes" rows="2" placeholder="Pr\xE9f\xE9rences, allergies, table pr\xE9f\xE9r\xE9e\u2026"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveCustomer()">Cr\xE9er</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("cust-name").focus();
}
async function saveCustomer() {
  var _a;
  const name = document.getElementById("cust-name").value.trim();
  if (!name) return showToast("Nom requis", "error");
  try {
    await API.request("/crm/customers", {
      method: "POST",
      body: {
        name,
        email: document.getElementById("cust-email").value || null,
        phone: document.getElementById("cust-phone").value || null,
        birthday: document.getElementById("cust-birthday").value || null,
        notes: document.getElementById("cust-notes").value || null
      }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast("Client cr\xE9\xE9", "success");
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function showCustomerDetail(id) {
  try {
    const c = await API.request(`/crm/customers/${id}`);
    const rewards = await API.request("/crm/rewards");
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h2 style="display:flex;align-items:center;gap:var(--space-2)">
            ${escapeHtml(c.name)} ${c.vip ? '<span style="font-size:var(--text-xs);background:linear-gradient(135deg,#F59E0B,#EF4444);color:white;padding:2px 8px;border-radius:8px">VIP</span>' : ""}
          </h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
        </div>
        <div class="modal-body">
          <!-- Stats -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-bottom:var(--space-4)">
            <div style="text-align:center;padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md)">
              <div style="font-size:var(--text-xl);font-weight:700;color:#EC4899">${c.loyalty_points}</div>
              <div class="text-secondary text-sm">Points</div>
            </div>
            <div style="text-align:center;padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md)">
              <div style="font-size:var(--text-xl);font-weight:700">${c.total_visits}</div>
              <div class="text-secondary text-sm">Visites</div>
            </div>
            <div style="text-align:center;padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md)">
              <div style="font-size:var(--text-xl);font-weight:700">${(c.total_spent || 0).toFixed(0)}\u20AC</div>
              <div class="text-secondary text-sm">D\xE9pens\xE9</div>
            </div>
          </div>

          <!-- Contact -->
          <div style="margin-bottom:var(--space-3)">
            ${c.email ? `<p class="text-secondary text-sm">\u{1F4E7} ${escapeHtml(c.email)}</p>` : ""}
            ${c.phone ? `<p class="text-secondary text-sm">\u{1F4F1} ${escapeHtml(c.phone)}</p>` : ""}
            ${c.birthday ? `<p class="text-secondary text-sm">\u{1F382} ${c.birthday}</p>` : ""}
            ${c.notes ? `<p class="text-secondary text-sm">\u{1F4DD} ${escapeHtml(c.notes)}</p>` : ""}
          </div>

          <!-- Quick actions -->
          <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4)">
            <button class="btn btn-primary btn-sm" onclick="recordVisit(${c.id})">Enregistrer une visite</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleVip(${c.id}, ${c.vip ? 0 : 1})">${c.vip ? "Retirer VIP" : "Passer VIP"}</button>
          </div>

          <!-- Available rewards -->
          ${rewards.length > 0 ? `
          <h4 style="margin-bottom:var(--space-2)">R\xE9compenses disponibles</h4>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-3)">
            ${rewards.filter((r) => r.is_active).map((r) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md)">
                <div>
                  <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(r.name)}</span>
                  <span class="text-secondary text-sm">(${r.points_required} pts)</span>
                </div>
                ${c.loyalty_points >= r.points_required ? `<button class="btn btn-primary btn-sm" onclick="redeemReward(${c.id}, ${r.id})">Utiliser</button>` : `<span class="text-secondary text-sm">${r.points_required - c.loyalty_points} pts manquants</span>`}
              </div>
            `).join("")}
          </div>
          ` : ""}

          <!-- Recent transactions -->
          ${c.transactions && c.transactions.length > 0 ? `
          <h4 style="margin-bottom:var(--space-2)">Derni\xE8res transactions</h4>
          <div style="font-size:var(--text-sm)">
            ${c.transactions.slice(0, 10).map((t) => `
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-light)">
                <span class="text-secondary">${t.description || t.type}</span>
                <span style="font-weight:600;color:${t.points >= 0 ? "var(--color-success)" : "var(--color-danger)"}">${t.points >= 0 ? "+" : ""}${t.points} pts</span>
              </div>
            `).join("")}
          </div>
          ` : ""}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function recordVisit(customerId) {
  var _a;
  const amount = prompt("Montant de l'addition (\u20AC) :");
  if (amount === null) return;
  const val = parseFloat(amount) || 0;
  try {
    const result = await API.request(`/crm/customers/${customerId}/visit`, {
      method: "POST",
      body: { amount: val }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast(`Visite enregistr\xE9e : +${result.points_earned} points`, "success");
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function toggleVip(id, vip) {
  var _a;
  try {
    await API.request(`/crm/customers/${id}`, { method: "PUT", body: { vip } });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast(vip ? "Client VIP !" : "VIP retir\xE9", "success");
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function redeemReward(customerId, rewardId) {
  var _a;
  try {
    const result = await API.request(`/crm/customers/${customerId}/redeem/${rewardId}`, { method: "POST" });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast(result.message, "success");
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function loadCrmRewards() {
  const content = document.getElementById("crm-content");
  try {
    const rewards = await API.request("/crm/rewards");
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3>R\xE9compenses fid\xE9lit\xE9</h3>
        <button class="btn btn-primary btn-sm" onclick="showAddReward()">
          <i data-lucide="gift" style="width:16px;height:16px"></i> Ajouter
        </button>
      </div>

      ${rewards.length === 0 ? `
        <div class="card" style="padding:var(--space-4);text-align:center">
          <p class="text-secondary">Aucune r\xE9compense configur\xE9e</p>
          <p class="text-secondary text-sm">Cr\xE9ez des paliers pour motiver vos clients fid\xE8les</p>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${rewards.map((r) => `
            <div class="card" style="padding:var(--space-3)">
              <div style="display:flex;align-items:center;gap:var(--space-3)">
                <div style="width:48px;height:48px;border-radius:12px;background:rgba(236,72,153,0.1);display:flex;align-items:center;justify-content:center;font-size:1.5rem">\u{1F381}</div>
                <div style="flex:1">
                  <div style="font-weight:600">${escapeHtml(r.name)}</div>
                  <div class="text-secondary text-sm">${r.description || ""}</div>
                  <div class="text-secondary" style="font-size:10px">${r.times_redeemed} fois utilis\xE9e</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:var(--text-lg);font-weight:700;color:#EC4899">${r.points_required}</div>
                  <div class="text-secondary" style="font-size:10px">points</div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    `;
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
function showAddReward() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:450px">
      <div class="modal-header">
        <h2>Nouvelle r\xE9compense</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom *</label>
          <input type="text" class="input" id="reward-name" placeholder="Ex: Dessert offert">
        </div>
        <div class="form-group">
          <label class="label">Description</label>
          <input type="text" class="input" id="reward-desc" placeholder="D\xE9tails de la r\xE9compense">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Points n\xE9cessaires *</label>
            <input type="number" class="input" id="reward-points" value="100" min="1">
          </div>
          <div class="form-group">
            <label class="label">Type</label>
            <select class="input" id="reward-type">
              <option value="discount">R\xE9duction</option>
              <option value="free_item">Produit offert</option>
              <option value="percentage">% de r\xE9duction</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveReward()">Cr\xE9er</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
async function saveReward() {
  var _a;
  const name = document.getElementById("reward-name").value.trim();
  if (!name) return showToast("Nom requis", "error");
  try {
    await API.request("/crm/rewards", {
      method: "POST",
      body: {
        name,
        description: document.getElementById("reward-desc").value || null,
        points_required: parseInt(document.getElementById("reward-points").value) || 100,
        reward_type: document.getElementById("reward-type").value
      }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    showToast("R\xE9compense cr\xE9\xE9e", "success");
    loadCrmRewards();
  } catch (e) {
    showToast(e.message, "error");
  }
}
async function loadCrmStats() {
  const content = document.getElementById("crm-content");
  try {
    const stats = await API.request("/crm/stats");
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
        <div class="card" style="padding:var(--space-3);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700">${stats.total_customers}</div>
          <div class="text-secondary text-sm">Clients</div>
        </div>
        <div class="card" style="padding:var(--space-3);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:#F59E0B">${stats.vip_customers}</div>
          <div class="text-secondary text-sm">VIP</div>
        </div>
        <div class="card" style="padding:var(--space-3);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:#EC4899">${stats.total_points_outstanding}</div>
          <div class="text-secondary text-sm">Points en circulation</div>
        </div>
        <div class="card" style="padding:var(--space-3);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700">${stats.avg_spent_per_customer.toFixed(0)}\u20AC</div>
          <div class="text-secondary text-sm">D\xE9pense moy.</div>
        </div>
      </div>

      ${stats.top_spenders.length > 0 ? `
      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-3)">
        <h3 style="margin-bottom:var(--space-3)">Top clients</h3>
        ${stats.top_spenders.map((c, i) => `
          <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) 0;${i < stats.top_spenders.length - 1 ? "border-bottom:1px solid var(--border-light)" : ""}">
            <span style="font-weight:700;min-width:20px;color:var(--text-tertiary)">${i + 1}</span>
            <span style="flex:1;font-weight:500">${escapeHtml(c.name)} ${c.vip ? "\u2B50" : ""}</span>
            <span class="text-secondary text-sm">${c.total_visits} visites</span>
            <span style="font-weight:600">${(c.total_spent || 0).toFixed(0)}\u20AC</span>
          </div>
        `).join("")}
      </div>
      ` : ""}

      ${stats.recent_visitors.length > 0 ? `
      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Derni\xE8res visites</h3>
        ${stats.recent_visitors.map((c) => `
          <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;font-size:var(--text-sm)">
            <span style="flex:1;font-weight:500">${escapeHtml(c.name)} ${c.vip ? "\u2B50" : ""}</span>
            <span class="text-secondary">${c.last_visit ? new Date(c.last_visit).toLocaleDateString("fr-FR") : "-"}</span>
            <span style="color:#EC4899;font-weight:600">${c.loyalty_points} pts</span>
          </div>
        `).join("")}
      </div>
      ` : ""}
    `;
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
async function renderAPIKeys() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="key" style="width:28px;height:28px;color:var(--color-accent)"></i>
        API Publique
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">G\xE9rez vos cl\xE9s API pour int\xE9grer RestoSuite avec vos outils</p>
    </div>
    <div id="apikeys-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadAPIKeys();
}
async function loadAPIKeys() {
  const content = document.getElementById("apikeys-content");
  try {
    const [keys, docs] = await Promise.all([
      API.request("/public/keys"),
      API.request("/public/docs")
    ]);
    renderAPIKeysContent(keys, docs);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
function renderAPIKeysContent(keys, docs) {
  const content = document.getElementById("apikeys-content");
  content.innerHTML = `
    <!-- API Documentation -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Documentation API</h3>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-3)">
        Base URL : <code style="background:var(--bg-sunken);padding:2px 6px;border-radius:4px">/api/public/v1</code> \xB7
        Auth : Header <code style="background:var(--bg-sunken);padding:2px 6px;border-radius:4px">X-API-Key</code>
      </p>
      <div style="overflow-x:auto">
        <table class="table" style="font-size:var(--text-sm)">
          <thead>
            <tr><th>M\xE9thode</th><th>Endpoint</th><th>Description</th><th>Permission</th></tr>
          </thead>
          <tbody>
            ${docs.endpoints.map((e) => `
              <tr>
                <td><span style="padding:2px 6px;border-radius:4px;font-size:var(--text-xs);font-weight:600;background:${e.method === "GET" ? "rgba(22,163,74,0.1);color:#16A34A" : "rgba(59,130,246,0.1);color:#3B82F6"}">${e.method}</span></td>
                <td><code style="font-size:var(--text-xs)">${e.path}</code></td>
                <td>${e.description}</td>
                <td><span class="text-secondary text-sm">${e.permission}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- API Keys -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <h3>Cl\xE9s API</h3>
      <button class="btn btn-primary btn-sm" onclick="showCreateAPIKey()">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Nouvelle cl\xE9
      </button>
    </div>

    ${keys.length === 0 ? `
      <div class="card" style="padding:var(--space-4);text-align:center">
        <p class="text-secondary">Aucune cl\xE9 API cr\xE9\xE9e</p>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${keys.map((k) => `
          <div class="card" style="padding:var(--space-3)">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div style="flex:1">
                <div style="font-weight:600">${escapeHtml(k.key_name)}</div>
                <code style="font-size:var(--text-xs);background:var(--bg-sunken);padding:2px 6px;border-radius:4px">${k.api_key.slice(0, 12)}\u2026${k.api_key.slice(-4)}</code>
                <div class="text-secondary" style="font-size:10px;margin-top:4px">
                  ${k.permissions.join(", ")} \xB7 ${k.request_count} requ\xEAtes
                  ${k.last_used ? ` \xB7 Derni\xE8re utilisation : ${new Date(k.last_used).toLocaleDateString("fr-FR")}` : ""}
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="copyAPIKey('${k.api_key}')">Copier</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--color-danger)" onclick="deleteAPIKey(${k.id})">Supprimer</button>
            </div>
          </div>
        `).join("")}
      </div>
    `}
  `;
  if (window.lucide) lucide.createIcons();
}
function showCreateAPIKey() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:450px">
      <div class="modal-header">
        <h2>Nouvelle cl\xE9 API</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">\u2715</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom de la cl\xE9 *</label>
          <input type="text" class="input" id="key-name" placeholder="Ex: Site web, Caisse, TheFork">
        </div>
        <div class="form-group">
          <label class="label">Permissions</label>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <label style="display:flex;align-items:center;gap:var(--space-2)">
              <input type="checkbox" value="read" checked disabled> Lecture (toujours actif)
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2)">
              <input type="checkbox" id="perm-write" value="write"> \xC9criture (cr\xE9er des commandes)
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="createAPIKey()">G\xE9n\xE9rer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("key-name").focus();
}
async function createAPIKey() {
  var _a;
  const name = document.getElementById("key-name").value.trim();
  if (!name) return showToast("Nom requis", "error");
  const perms = ["read"];
  if (document.getElementById("perm-write").checked) perms.push("write");
  try {
    const result = await API.request("/public/keys", {
      method: "POST",
      body: { key_name: name, permissions: perms }
    });
    (_a = document.querySelector(".modal-overlay")) == null ? void 0 : _a.remove();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h2>Cl\xE9 API cr\xE9\xE9e</h2>
        </div>
        <div class="modal-body">
          <p style="color:var(--color-warning);font-weight:600;margin-bottom:var(--space-3)">
            Copiez cette cl\xE9 maintenant \u2014 elle ne sera plus affich\xE9e en entier.
          </p>
          <div style="background:var(--bg-sunken);padding:var(--space-3);border-radius:var(--radius-md);word-break:break-all;font-family:monospace;font-size:var(--text-sm)">
            ${result.api_key}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="copyAPIKey('${result.api_key}');this.closest('.modal-overlay').remove();loadAPIKeys();">Copier et fermer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
    showToast(e.message, "error");
  }
}
function copyAPIKey(key) {
  navigator.clipboard.writeText(key).then(() => {
    showToast("Cl\xE9 copi\xE9e", "success");
  }).catch(() => {
    showToast("Erreur copie", "error");
  });
}
async function deleteAPIKey(id) {
  showConfirmModal("Supprimer la cl\xE9", "Cette action est irr\xE9versible. Les int\xE9grations utilisant cette cl\xE9 ne fonctionneront plus.", async () => {
    try {
      await API.request(`/public/keys/${id}`, { method: "DELETE" });
      showToast("Cl\xE9 supprim\xE9e", "success");
      loadAPIKeys();
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}
async function renderQRCodes() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <style>
      @media print {
        body > *:not(#app) { display:none !important; }
        #app { padding:0 !important; }
        .qr-header, .qr-print-hide { display:none !important; }
        .qr-grid { 
          display:grid !important; 
          grid-template-columns:repeat(3, 1fr) !important; 
          gap:12px !important; 
          page-break-inside:auto; 
        }
        .qr-card { 
          break-inside:avoid; 
          border:2px solid #000 !important; 
          padding:16px !important; 
          text-align:center !important; 
          background:white !important;
          color:black !important;
        }
        .qr-card img { width:180px !important; height:180px !important; }
        .qr-card .qr-table-number { font-size:28px !important; font-weight:700 !important; color:black !important; }
      }
    </style>
    <div class="qr-header page-header">
      <div>
        <a href="#/more" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus</a>
        <h1 style="margin-top:4px">\u{1F4F1} QR Codes \u2014 Menu</h1>
      </div>
      <button class="btn btn-primary qr-print-hide" onclick="window.print()">
        <i data-lucide="printer" style="width:18px;height:18px"></i> Imprimer
      </button>
    </div>
    <p class="text-secondary qr-print-hide" style="margin-bottom:var(--space-4)">
      Imprimez ces QR codes et placez-les sur vos tables. Les clients peuvent scanner pour voir le menu et commander.
    </p>
    <div id="qr-grid" class="qr-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  try {
    const tables = await API.request("/qrcode/tables");
    const gridEl = document.getElementById("qr-grid");
    if (!tables || tables.length === 0) {
      const fallback = Array.from({ length: 20 }, (_, i) => ({
        table_number: i + 1,
        qr_data_url: null
      }));
      renderQRGrid(gridEl, fallback);
    } else {
      renderQRGrid(gridEl, tables);
    }
  } catch (e) {
    document.getElementById("qr-grid").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">\u26A0\uFE0F</div>
        <p>Erreur de chargement des QR codes</p>
      </div>
    `;
  }
}
function renderQRGrid(gridEl, tables) {
  gridEl.innerHTML = tables.map((t) => `
    <div class="qr-card" style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;border:1px solid var(--color-border)">
      <div class="qr-table-number" style="font-size:22px;font-weight:700;margin-bottom:8px">Table ${t.table_number}</div>
      ${t.zone ? `<div class="text-secondary text-sm" style="margin-bottom:8px">${escapeHtml(t.zone)}</div>` : ""}
      ${t.qr_data_url ? `<img src="${t.qr_data_url}" alt="QR Table ${t.table_number}" style="width:200px;height:200px;border-radius:8px">` : `<img src="/api/qrcode/table/${t.table_number}" alt="QR Table ${t.table_number}" style="width:200px;height:200px;border-radius:8px">`}
      <div class="text-secondary text-sm" style="margin-top:8px">Scannez pour commander</div>
    </div>
  `).join("");
}
let _commandPaletteOpen = false;
const _commands = [
  { name: "Nouvelle fiche technique", icon: "plus", hash: "#/new", category: "Fiches" },
  { name: "Ingr\xE9dients", icon: "leaf", hash: "#/ingredients", category: "Fiches" },
  { name: "Stock", icon: "warehouse", hash: "#/stock", category: "Stock" },
  { name: "HACCP", icon: "shield-check", hash: "#/haccp", category: "HACCP" },
  { name: "Commandes fournisseurs", icon: "clipboard-pen", hash: "#/orders", category: "Commandes" },
  { name: "Service (Salle)", icon: "concierge-bell", hash: "#/service", category: "Service" },
  { name: "Cuisine", icon: "chef-hat", hash: "#/kitchen", category: "Service" },
  { name: "Fournisseurs", icon: "truck", hash: "#/suppliers", category: "Fournisseurs" },
  { name: "Analytics", icon: "trending-up", hash: "#/analytics", category: "Analytics" },
  { name: "Scan facture", icon: "camera", hash: "#/scan-invoice", category: "Stock" },
  { name: "Mercuriale", icon: "bar-chart-3", hash: "#/mercuriale", category: "Donn\xE9es" },
  { name: "QR Codes", icon: "qr-code", hash: "#/qrcodes", category: "Outils" },
  { name: "\xC9quipe", icon: "users", hash: "#/team", category: "Param\xE8tres" }
];
function toggleCommandPalette() {
  if (_commandPaletteOpen) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}
function openCommandPalette() {
  if (_commandPaletteOpen) return;
  _commandPaletteOpen = true;
  const backdrop = document.createElement("div");
  backdrop.id = "command-palette-backdrop";
  backdrop.className = "command-palette-backdrop";
  backdrop.addEventListener("click", closeCommandPalette);
  const modal = document.createElement("div");
  modal.id = "command-palette-modal";
  modal.className = "command-palette-modal";
  modal.innerHTML = `
    <div class="command-palette-content">
      <div class="command-palette-search-wrapper">
        <svg class="command-palette-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          id="command-palette-input"
          class="command-palette-input"
          placeholder="Rechercher une action..."
          autocomplete="off"
        >
      </div>
      <div class="command-palette-list" id="command-palette-list">
        ${renderCommandGroups(_commands)}
      </div>
      <div class="command-palette-footer">
        <span class="command-palette-hint">\u23CE Valider</span>
        <span class="command-palette-hint">\u238B Fermer</span>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  const input = document.getElementById("command-palette-input");
  const list = document.getElementById("command-palette-list");
  setTimeout(() => input.focus(), 50);
  input.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered2 = _commands.filter(
      (cmd) => cmd.name.toLowerCase().includes(query) || cmd.category.toLowerCase().includes(query)
    );
    list.innerHTML = renderCommandGroups(filtered2, query);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCommandPalette();
      e.preventDefault();
    } else if (e.key === "Enter") {
      const selected = list.querySelector(".command-item.selected");
      if (selected) {
        const cmd = _commands.find((c) => c.hash === selected.dataset.hash);
        if (cmd) {
          location.hash = cmd.hash;
          closeCommandPalette();
        }
      } else if (filtered.length > 0) {
        location.hash = filtered[0].hash;
        closeCommandPalette();
      }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      navigateCommandList(1);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      navigateCommandList(-1);
      e.preventDefault();
    }
  });
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".command-item");
    if (item) {
      location.hash = item.dataset.hash;
      closeCommandPalette();
    }
  });
  updateCommandSelection();
}
function closeCommandPalette() {
  _commandPaletteOpen = false;
  const backdrop = document.getElementById("command-palette-backdrop");
  const modal = document.getElementById("command-palette-modal");
  if (backdrop) backdrop.remove();
  if (modal) modal.remove();
}
function renderCommandGroups(commands, query = "") {
  const groups = {};
  commands.forEach((cmd) => {
    if (!groups[cmd.category]) {
      groups[cmd.category] = [];
    }
    groups[cmd.category].push(cmd);
  });
  return Object.entries(groups).map(([category, cmds]) => `
      <div class="command-group">
        <div class="command-group-label">${escapeHtml(category)}</div>
        ${cmds.map((cmd, idx) => `
          <button
            class="command-item ${idx === 0 ? "selected" : ""}"
            data-hash="${cmd.hash}"
            onclick="location.hash='${cmd.hash}'; closeCommandPalette();"
          >
            <svg class="command-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${getLucideIconPath(cmd.icon)}
            </svg>
            <span class="command-item-name">${escapeHtml(cmd.name)}</span>
            <span class="command-item-shortcut">${cmd.category}</span>
          </button>
        `).join("")}
      </div>
    `).join("");
}
function navigateCommandList(direction) {
  const list = document.getElementById("command-palette-list");
  const items = list.querySelectorAll(".command-item");
  const selected = list.querySelector(".command-item.selected");
  if (!selected) {
    if (items.length > 0) items[0].classList.add("selected");
    return;
  }
  const currentIndex = Array.from(items).indexOf(selected);
  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) nextIndex = items.length - 1;
  if (nextIndex >= items.length) nextIndex = 0;
  selected.classList.remove("selected");
  items[nextIndex].classList.add("selected");
  items[nextIndex].scrollIntoView({ block: "nearest" });
}
function updateCommandSelection() {
  const list = document.getElementById("command-palette-list");
  const items = list.querySelectorAll(".command-item");
  items.forEach((item, idx) => {
    if (idx === 0) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });
}
function getLucideIconPath(icon) {
  const paths = {
    "plus": '<g><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></g>',
    "leaf": '<g><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 21 7.6 21 13a9 9 0 0 1-9 9c-1.8 0-3.5-.5-5-1.3"></path><path d="M11 13a3 3 0 1 1-3-3 3 3 0 0 1 3 3"></path></g>',
    "warehouse": '<g><path d="M12 3v8m0 8v2M3 10h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10zm9-7L3 10h18L12 3z"></path></g>',
    "shield-check": '<g><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="10 17 14 21 22 13"></polyline></g>',
    "clipboard-pen": '<g><rect x="3" y="3" width="15" height="15" rx="2" ry="2"></rect><path d="M10 12h4"></path><path d="M10 16h4"></path><line x1="12" y1="3" x2="12" y2="0"></line><path d="M20 10c.55-.5 1.45.5.5 1.5l-4 4"></path></g>',
    "truck": '<g><rect x="1" y="6" width="22" height="13" rx="2" ry="2"></rect><path d="M16 6v-2a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><circle cx="5.5" cy="19.5" r="2.5"></circle><circle cx="18.5" cy="19.5" r="2.5"></circle></g>',
    "trending-up": '<g><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></g>',
    "camera": '<g><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></g>',
    "bar-chart-3": '<g><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></g>',
    "qr-code": '<g><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></g>',
    "users": '<g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></g>'
  };
  return paths[icon] || '<circle cx="12" cy="12" r="10"></circle>';
}
class ErrorsLogView {
  async render() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="view-header">
        <h1>Journal d'erreurs</h1>
        <p class="text-secondary">50 derni\xE8res erreurs \u2014 serveur & client</p>
      </div>
      <div id="errors-log-content">
        <div class="loading-spinner"></div>
      </div>
    `;
    try {
      const token = localStorage.getItem("restosuite_token");
      const res = await fetch("/api/errors/recent", {
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) throw new Error("Acc\xE8s refus\xE9");
      const { errors } = await res.json();
      this._renderList(errors);
    } catch (e) {
      document.getElementById("errors-log-content").innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">\u26A0\uFE0F</div>
          <p>Impossible de charger les erreurs : ${escapeHtml(e.message)}</p>
        </div>
      `;
    }
  }
  _renderList(errors) {
    const container = document.getElementById("errors-log-content");
    if (!errors.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">\u2705</div>
          <p>Aucune erreur enregistr\xE9e.</p>
        </div>
      `;
      return;
    }
    const rows = errors.map((e) => {
      const badge = e.origin === "server" ? '<span class="badge badge--error">Serveur</span>' : '<span class="badge badge--warning">Client</span>';
      const date = new Date(e.ts).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
      const context = e.route ? `<span class="text-secondary text-sm">${escapeHtml(e.route)}</span>` : e.source ? `<span class="text-secondary text-sm">${escapeHtml(e.source)}${e.lineno ? ":" + e.lineno : ""}</span>` : "";
      const stackHtml = e.stack ? `<pre class="error-stack">${escapeHtml(e.stack)}</pre>` : "";
      return `
        <div class="error-entry" onclick="this.classList.toggle('error-entry--open')">
          <div class="error-entry__header">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              ${badge}
              <span class="text-sm">${escapeHtml(e.message)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
              ${context}
              <span class="text-secondary text-sm">${date}</span>
              <i data-lucide="chevron-down" style="width:14px;height:14px;opacity:.5"></i>
            </div>
          </div>
          ${stackHtml ? `<div class="error-entry__body">${stackHtml}</div>` : ""}
        </div>
      `;
    }).join("");
    container.innerHTML = `
      <div style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <span class="text-secondary text-sm">${errors.length} erreur(s)</span>
        <button class="btn btn-secondary btn-sm" onclick="new ErrorsLogView().render()">
          <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Actualiser
        </button>
      </div>
      <div class="errors-list">${rows}</div>
      <style>
        .error-entry {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          margin-bottom: .5rem;
          overflow: hidden;
          cursor: pointer;
        }
        .error-entry__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: .5rem;
          padding: .75rem 1rem;
          flex-wrap: wrap;
        }
        .error-entry__body {
          display: none;
          border-top: 1px solid var(--color-border);
          padding: .75rem 1rem;
          background: var(--color-bg-subtle, #0d0d0d);
        }
        .error-entry--open .error-entry__body {
          display: block;
        }
        .error-stack {
          font-size: .75rem;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
          color: var(--color-text-secondary);
        }
      </style>
    `;
    if (window.lucide) lucide.createIcons();
  }
}
let _bubbleState = {
  visible: true,
  listening: false,
  transcript: "",
  aiResponse: "",
  history: []
};
function initFloatingAIBubble() {
  const token = localStorage.getItem("restosuite_token");
  if (!token) return;
  const container = document.createElement("div");
  container.id = "floating-ai-bubble-container";
  container.innerHTML = `
    <style>
      #floating-ai-bubble-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        font-family: var(--font-sans);
      }

      .bubble-fab {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--color-accent);
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(232, 114, 42, 0.3);
        transition: all 0.2s;
        font-size: 1.5rem;
      }

      .bubble-fab:hover {
        background: var(--color-accent-hover);
        box-shadow: 0 6px 16px rgba(232, 114, 42, 0.4);
        transform: scale(1.05);
      }

      .bubble-fab.listening {
        animation: bubblePulse 1.5s infinite;
      }

      @keyframes bubblePulse {
        0%, 100% { box-shadow: 0 4px 12px rgba(232, 114, 42, 0.3); transform: scale(1); }
        50% { box-shadow: 0 4px 20px rgba(232, 114, 42, 0.6); transform: scale(1.08); }
      }

      .bubble-panel {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 320px;
        max-height: 500px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-light);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: bubbleSlideUp 0.2s ease-out;
      }

      @keyframes bubbleSlideUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .bubble-header {
        padding: var(--space-3);
        border-bottom: 1px solid var(--border-light);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .bubble-header h3 {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: 600;
      }

      .bubble-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bubble-messages {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .bubble-msg {
        font-size: var(--text-xs);
        line-height: 1.4;
        padding: 8px 10px;
        border-radius: 8px;
        max-width: 90%;
        word-wrap: break-word;
      }

      .bubble-msg.user {
        background: var(--color-accent);
        color: white;
        align-self: flex-end;
      }

      .bubble-msg.ai {
        background: var(--bg-sunken);
        color: var(--text-primary);
        align-self: flex-start;
      }

      .bubble-input-area {
        padding: var(--space-3);
        border-top: 1px solid var(--border-light);
        display: flex;
        gap: var(--space-2);
      }

      .bubble-voice-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--color-accent);
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s;
      }

      .bubble-voice-btn:hover {
        background: var(--color-accent-hover);
      }

      .bubble-voice-btn.recording {
        animation: voiceRecording 0.8s infinite;
      }

      @keyframes voiceRecording {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      .bubble-text-input {
        flex: 1;
        background: var(--bg-sunken);
        border: 1px solid var(--border-light);
        border-radius: 6px;
        padding: 6px 10px;
        color: var(--text-primary);
        font-size: var(--text-xs);
        font-family: var(--font-sans);
      }

      .bubble-text-input::placeholder {
        color: var(--text-tertiary);
      }

      .bubble-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--color-primary-light);
        border: none;
        color: var(--color-accent);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .bubble-send-btn:hover {
        background: var(--color-primary);
      }

      .bubble-transcript {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        padding: 8px;
        background: var(--bg-sunken);
        border-radius: 6px;
        margin-bottom: 8px;
      }

      .bubble-loading {
        display: flex;
        gap: 4px;
      }

      .bubble-loading span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--text-tertiary);
        animation: bubbleLoadingBounce 1s infinite;
      }

      .bubble-loading span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .bubble-loading span:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes bubbleLoadingBounce {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }

      @media (max-width: 640px) {
        #floating-ai-bubble-container {
          bottom: 10px;
          right: 10px;
        }

        .bubble-panel {
          width: calc(100vw - 20px);
          max-height: calc(100vh - 100px);
        }
      }
    </style>

    <button class="bubble-fab" id="bubble-fab" title="Assistant IA">\u{1F3A4}</button>
    <div class="bubble-panel" id="bubble-panel" style="display:none">
      <div class="bubble-header">
        <h3>Assistant IA</h3>
        <button class="bubble-close" id="bubble-close">\u2715</button>
      </div>
      <div class="bubble-messages" id="bubble-messages"></div>
      <div id="bubble-transcript" class="bubble-transcript" style="display:none"></div>
      <div class="bubble-input-area">
        <button class="bubble-voice-btn" id="bubble-voice-btn" title="Enregistrer au micro">\u{1F3A4}</button>
        <input type="text" class="bubble-text-input" id="bubble-text-input" placeholder="Votre question\u2026" autocomplete="off">
        <button class="bubble-send-btn" id="bubble-send-btn" title="Envoyer">\u2B06</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);
  document.getElementById("bubble-fab").addEventListener("click", toggleBubblePanel);
  document.getElementById("bubble-close").addEventListener("click", closeBubblePanel);
  document.getElementById("bubble-voice-btn").addEventListener("click", toggleVoiceRecording);
  document.getElementById("bubble-send-btn").addEventListener("click", sendBubbleMessage);
  document.getElementById("bubble-text-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBubbleMessage();
    }
  });
  const savedHistory = localStorage.getItem("bubble_chat_history");
  if (savedHistory) {
    try {
      _bubbleState.history = JSON.parse(savedHistory);
      renderBubbleMessages();
    } catch (e) {
      console.warn("Could not load bubble history:", e);
    }
  }
}
function toggleBubblePanel() {
  const panel = document.getElementById("bubble-panel");
  const fab = document.getElementById("bubble-fab");
  const visible = panel.style.display !== "none";
  if (visible) {
    closeBubblePanel();
  } else {
    panel.style.display = "flex";
    fab.classList.add("expanded");
    setTimeout(() => {
      var _a;
      return (_a = document.getElementById("bubble-text-input")) == null ? void 0 : _a.focus();
    }, 100);
  }
}
function closeBubblePanel() {
  const panel = document.getElementById("bubble-panel");
  const fab = document.getElementById("bubble-fab");
  panel.style.display = "none";
  fab.classList.remove("expanded");
}
function toggleVoiceRecording() {
  const recognition2 = window.webkitSpeechRecognition || window.SpeechRecognition;
  if (!recognition2) {
    alert("Reconnaissance vocale non support\xE9e par votre navigateur");
    return;
  }
  if (_bubbleState.listening) {
    stopVoiceRecording();
    return;
  }
  const rec = new recognition2();
  rec.lang = "fr-FR";
  rec.continuous = true;
  rec.interimResults = true;
  const btn = document.getElementById("bubble-voice-btn");
  btn.classList.add("recording");
  _bubbleState.listening = true;
  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        _bubbleState.transcript += transcript + " ";
      } else {
        interim += transcript;
      }
    }
    const transcriptEl = document.getElementById("bubble-transcript");
    if (_bubbleState.transcript || interim) {
      transcriptEl.textContent = (_bubbleState.transcript + interim).trim();
      transcriptEl.style.display = "block";
    }
  };
  rec.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    if (event.error !== "no-speech") {
      showBubbleMessage("Erreur reconnaissance vocale: " + event.error, "ai");
    }
    stopVoiceRecording();
  };
  rec.onend = () => {
    stopVoiceRecording();
    if (_bubbleState.transcript.trim()) {
      sendBubbleMessage(_bubbleState.transcript.trim());
      _bubbleState.transcript = "";
      document.getElementById("bubble-transcript").style.display = "none";
    }
  };
  rec.start();
}
function stopVoiceRecording() {
  const btn = document.getElementById("bubble-voice-btn");
  btn.classList.remove("recording");
  _bubbleState.listening = false;
}
async function sendBubbleMessage(msg) {
  var _a, _b;
  let message = msg || ((_b = (_a = document.getElementById("bubble-text-input")) == null ? void 0 : _a.value) == null ? void 0 : _b.trim());
  if (!message) return;
  document.getElementById("bubble-text-input").value = "";
  showBubbleMessage(message, "user");
  _bubbleState.history.push({ role: "user", text: message });
  const messagesEl = document.getElementById("bubble-messages");
  const loadingEl = document.createElement("div");
  loadingEl.className = "bubble-msg ai";
  loadingEl.innerHTML = '<div class="bubble-loading"><span></span><span></span><span></span></div>';
  loadingEl.id = "bubble-loading";
  messagesEl.appendChild(loadingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  try {
    const result = await API.request("/ai/assistant", {
      method: "POST",
      body: {
        message,
        conversation_history: _bubbleState.history
      }
    });
    loadingEl.remove();
    if (result.reply) {
      showBubbleMessage(result.reply, "ai");
      _bubbleState.history.push({ role: "model", text: result.reply });
      if (result.actions && result.actions.length > 0) {
        showBubbleActions(result.actions);
      }
      localStorage.setItem("bubble_chat_history", JSON.stringify(_bubbleState.history));
    }
  } catch (e) {
    loadingEl.remove();
    showBubbleMessage("Erreur : " + e.message, "ai");
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function showBubbleMessage(text, role) {
  const messagesEl = document.getElementById("bubble-messages");
  const msgEl = document.createElement("div");
  msgEl.className = `bubble-msg ${role}`;
  msgEl.textContent = text;
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function showBubbleActions(actions) {
  const messagesEl = document.getElementById("bubble-messages");
  for (const action of actions) {
    if (!action.requires_confirmation) continue;
    const actionEl = document.createElement("div");
    actionEl.style.cssText = `
      background: var(--color-accent-light);
      border: 1px solid var(--color-accent);
      border-radius: 8px;
      padding: 10px;
      margin: 4px 0;
      font-size: var(--text-xs);
    `;
    actionEl.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600">${escapeHtml(action.description)}</div>
      <div style="display: flex; gap: 6px">
        <button onclick="confirmBubbleAction('${action.type}', '${btoa(JSON.stringify(action.params))}'" style="flex: 1; padding: 4px 8px; background: var(--color-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--text-xs)">Confirmer</button>
        <button onclick="closeBubbleAction(this)" style="flex: 1; padding: 4px 8px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border-light); border-radius: 4px; cursor: pointer; font-size: var(--text-xs)">Annuler</button>
      </div>
    `;
    messagesEl.appendChild(actionEl);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
async function confirmBubbleAction(type, paramsBase64) {
  try {
    const params = JSON.parse(atob(paramsBase64));
    const result = await API.request("/ai/execute-action", {
      method: "POST",
      body: { type, params }
    });
    if (result.success) {
      showBubbleMessage("\u2713 " + result.message, "ai");
    } else {
      showBubbleMessage("Erreur : " + (result.error || "Impossible d'ex\xE9cuter l'action"), "ai");
    }
  } catch (e) {
    showBubbleMessage("Erreur : " + e.message, "ai");
  }
  const messagesEl = document.getElementById("bubble-messages");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function closeBubbleAction(btn) {
  btn.closest("div").remove();
}
function renderBubbleMessages() {
  const messagesEl = document.getElementById("bubble-messages");
  messagesEl.innerHTML = "";
  for (const msg of _bubbleState.history) {
    const msgEl = document.createElement("div");
    msgEl.className = `bubble-msg ${msg.role}`;
    msgEl.textContent = msg.text;
    messagesEl.appendChild(msgEl);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => initFloatingAIBubble(), 500);
});
const ROUTE_ROLES = {
  "/": ["gerant", "cuisinier", "equipier"],
  "/new": ["gerant"],
  "/recipe/": ["gerant", "cuisinier", "equipier"],
  "/edit/": ["gerant"],
  "/ingredients": ["gerant", "cuisinier", "equipier"],
  "/stock": ["gerant", "cuisinier"],
  "/stock/": ["gerant", "cuisinier"],
  "/deliveries": ["gerant", "cuisinier"],
  "/deliveries/": ["gerant", "cuisinier"],
  "/orders": ["gerant"],
  "/orders/": ["gerant"],
  "/haccp": ["gerant", "cuisinier"],
  "/haccp/": ["gerant", "cuisinier"],
  "/suppliers": ["gerant"],
  "/ia": ["gerant", "cuisinier", "equipier"],
  "/analytics": ["gerant"],
  "/team": ["gerant"],
  "/service": ["gerant", "salle"],
  "/kitchen": ["gerant", "cuisinier"],
  "/more": ["gerant", "cuisinier", "equipier"],
  "/subscribe": ["gerant"],
  "/supplier-portal": ["gerant"],
  "/scan-invoice": ["gerant"],
  "/mercuriale": ["gerant"],
  "/qrcodes": ["gerant"],
  "/errors-log": ["gerant"]
};
function isRouteAllowed(path, role) {
  if (ROUTE_ROLES[path]) {
    return ROUTE_ROLES[path].includes(role);
  }
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
    if (routePrefix.endsWith("/") && path.startsWith(routePrefix)) {
      return allowedRoles.includes(role);
    }
  }
  return false;
}
const Router = {
  routes: [],
  add(pattern, handler) {
    this.routes.push({ pattern, handler });
  },
  navigate(hash) {
    const path = hash.replace("#", "") || "/";
    const role = typeof getRole === "function" ? getRole() : null;
    if (role && !isRouteAllowed(path, role)) {
      console.warn(`Access denied to ${path} for role ${role}`);
      location.hash = "#/";
      return;
    }
    if (typeof _svcCleanup === "function" && !path.startsWith("/service")) {
      _svcCleanup();
    }
    document.querySelectorAll(".modal-overlay").forEach((el) => el.remove());
    document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
      const route = link.dataset.route;
      const isActive = route === path || route !== "/" && path.startsWith(route);
      link.classList.toggle("active", isActive);
    });
    if (typeof ROUTE_TO_GROUP !== "undefined") {
      let activeGroup = ROUTE_TO_GROUP[path];
      if (!activeGroup) {
        const key = Object.keys(ROUTE_TO_GROUP).find((p) => p !== "/" && path.startsWith(p));
        activeGroup = key ? ROUTE_TO_GROUP[key] : null;
      }
      document.querySelectorAll(".nav-link[data-group]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.group === activeGroup);
      });
    }
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        route.handler(...match.slice(1));
        return;
      }
    }
    document.getElementById("app").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="search-x" style="width:48px;height:48px;color:var(--text-tertiary)"></i></div>
        <p>Page introuvable</p>
        <a href="#/" class="btn btn-primary">Retour aux fiches</a>
      </div>
    `;
  },
  init() {
    window.addEventListener("hashchange", () => this.navigate(location.hash));
    this.navigate(location.hash || "#/");
  }
};
(function() {
  const savedTheme = localStorage.getItem("restosuite_theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }
})();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("restosuite_theme")) {
    document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
  }
});
const NAV_GROUPS = {
  cuisine: {
    label: "Cuisine",
    items: [
      { label: "Fiches Techniques", route: "/", icon: "clipboard-list", roles: ["gerant", "cuisinier", "equipier"] },
      { label: "Ingr\xE9dients", route: "/ingredients", icon: "package", roles: ["gerant", "cuisinier", "equipier"] },
      { label: "Stock & R\xE9ception", route: "/stock", icon: "warehouse", roles: ["gerant", "cuisinier"] }
    ]
  },
  operations: {
    label: "Op\xE9rations",
    items: [
      { label: "Commandes fournisseurs", route: "/orders", icon: "clipboard-pen", roles: ["gerant"] },
      { label: "Fournisseurs", route: "/suppliers", icon: "truck", roles: ["gerant"] },
      { label: "Livraisons", route: "/deliveries", icon: "package-check", roles: ["gerant", "cuisinier"] },
      { label: "Service (Salle)", route: "/service", icon: "concierge-bell", roles: ["gerant", "salle"] },
      { label: "Cuisine (\xE9cran)", route: "/kitchen", icon: "chef-hat", roles: ["gerant", "cuisinier"] }
    ]
  },
  config: {
    label: "Param\xE8tres",
    items: [
      { label: "\xC9quipe", route: "/team", icon: "users", roles: ["gerant"] },
      { label: "CRM & Fid\xE9lit\xE9", route: "/crm", icon: "heart", roles: ["gerant"] },
      { label: "Int\xE9grations", route: "/integrations", icon: "plug", roles: ["gerant"] },
      { label: "QR Codes", route: "/qrcodes", icon: "qr-code", roles: ["gerant"] },
      { label: "Bilan Carbone", route: "/carbon", icon: "leaf", roles: ["gerant"] },
      { label: "Multi-Sites", route: "/multi-site", icon: "building-2", roles: ["gerant"] },
      { label: "API", route: "/api-keys", icon: "key", roles: ["gerant"] },
      { label: "Portail Fournisseur", route: "/supplier-portal", icon: "truck", roles: ["gerant"] },
      { label: "Journal erreurs", route: "/errors-log", icon: "bug", roles: ["gerant"] },
      { label: "Se d\xE9connecter", route: null, icon: "log-out", roles: ["gerant", "cuisinier", "equipier"], action: "logout" }
    ]
  },
  pilotage: {
    label: "Pilotage",
    items: [
      { label: "Sant\xE9 du restaurant", route: "/health", icon: "heart-pulse", roles: ["gerant"] },
      { label: "Analytics", route: "/analytics", icon: "bar-chart-3", roles: ["gerant"] },
      { label: "Menu Engineering", route: "/menu-engineering", icon: "target", roles: ["gerant"] },
      { label: "Pr\xE9dictions IA", route: "/predictions", icon: "brain", roles: ["gerant"] },
      { label: "Mercuriale", route: "/mercuriale", icon: "trending-up", roles: ["gerant"] }
    ]
  }
};
const ROUTE_TO_GROUP = {
  "/": "cuisine",
  "/new": "cuisine",
  "/ingredients": "cuisine",
  "/stock": "cuisine",
  "/recipe": "cuisine",
  "/edit": "cuisine",
  "/orders": "operations",
  "/suppliers": "operations",
  "/deliveries": "operations",
  "/service": "operations",
  "/kitchen": "operations",
  "/scan-invoice": "operations",
  "/analytics": "pilotage",
  "/health": "pilotage",
  "/menu-engineering": "pilotage",
  "/predictions": "pilotage",
  "/mercuriale": "pilotage",
  "/import-mercuriale": "pilotage",
  "/more": "config",
  "/team": "config",
  "/integrations": "config",
  "/multi-site": "config",
  "/api-keys": "config",
  "/qrcodes": "config",
  "/carbon": "config",
  "/supplier-portal": "config",
  "/errors-log": "config",
  "/crm": "config",
  "/subscribe": "config"
};
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    toggleCommandPalette();
  }
});
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});
function showInstallBanner() {
  if (localStorage.getItem("restosuite_install_dismissed")) return;
  const banner = document.createElement("div");
  banner.className = "install-banner";
  banner.innerHTML = `
    <div class="install-content">
      <img src="assets/icon-192.png" width="40" height="40" style="border-radius:8px">
      <div>
        <strong>Installer RestoSuite</strong>
        <small>Acc\xE8s rapide depuis votre \xE9cran d'accueil</small>
      </div>
    </div>
    <div class="install-actions">
      <button class="install-btn" id="installBtn">Installer</button>
      <button class="install-dismiss" id="dismissBtn">Plus tard</button>
    </div>
  `;
  document.body.appendChild(banner);
  document.getElementById("installBtn").addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
    banner.remove();
  });
  document.getElementById("dismissBtn").addEventListener("click", () => {
    localStorage.setItem("restosuite_install_dismissed", "true");
    banner.remove();
  });
}
let _trialStatus = null;
let _trialStatusIntervalId = null;
function getTrialStatus() {
  return _trialStatus;
}
function clearTrialStatusInterval() {
  if (_trialStatusIntervalId) {
    clearInterval(_trialStatusIntervalId);
    _trialStatusIntervalId = null;
  }
}
async function fetchTrialStatus() {
  const account = getAccount();
  if (!account) return null;
  try {
    const status = await API.request(`/accounts/${account.id}/status`);
    _trialStatus = status;
    return status;
  } catch (e) {
    console.warn("Could not fetch trial status:", e);
    return null;
  }
}
function renderTrialBanner() {
  const existing = document.querySelector(".trial-banner");
  if (existing) existing.remove();
  const status = _trialStatus;
  if (!status) return;
  if (status.status === "pro") {
    document.body.classList.remove("read-only-mode");
    return;
  }
  let bannerHTML = "";
  if (status.status === "expired") {
    document.body.classList.add("read-only-mode");
    bannerHTML = `
      <div class="trial-banner trial-banner--expired">
        <span>Votre essai gratuit est termin\xE9. Vos donn\xE9es sont en lecture seule.</span>
        <a href="#/subscribe" class="btn btn-primary btn-sm">Passer en Pro \u2014 39\u20AC/mois</a>
      </div>
    `;
  } else if (status.status === "trial") {
    document.body.classList.remove("read-only-mode");
    const daysLeft = status.daysLeft;
    if (daysLeft <= 3) {
      bannerHTML = `
        <div class="trial-banner trial-banner--urgent">
          <span>Plus que <strong>${daysLeft} jour${daysLeft > 1 ? "s" : ""}</strong> d'essai gratuit \u2014 vos donn\xE9es passeront en lecture seule</span>
          <a href="#/subscribe">Passer en Pro</a>
        </div>
      `;
    } else if (daysLeft <= 14) {
      bannerHTML = `
        <div class="trial-banner trial-banner--warning">
          <span>Plus que ${daysLeft} jours d'essai gratuit</span>
          <a href="#/subscribe">Passer en Pro</a>
        </div>
      `;
    }
  }
  if (bannerHTML) {
    document.body.insertAdjacentHTML("afterbegin", bannerHTML);
  }
  renderTrialHeaderBadge();
}
function renderTrialHeaderBadge() {
  const existing = document.querySelector(".trial-header-badge");
  if (existing) existing.remove();
  const status = _trialStatus;
  if (!status || status.status !== "trial") return;
  const daysLeft = status.daysLeft;
  let badgeClass, label;
  if (daysLeft <= 3) {
    badgeClass = "trial-header-badge--red";
    label = `Essai : ${daysLeft}j \u2014 Passer en Pro`;
  } else if (daysLeft <= 14) {
    badgeClass = "trial-header-badge--yellow";
    label = `Essai : ${daysLeft}j`;
  } else {
    badgeClass = "trial-header-badge--green";
    label = `Essai : ${daysLeft}j restants`;
  }
  const nav = document.getElementById("nav");
  if (!nav) return;
  const navLinks = nav.querySelector(".nav-links");
  if (!navLinks) return;
  const badge = document.createElement("a");
  badge.href = "#/subscribe";
  badge.className = `trial-header-badge ${badgeClass}`;
  badge.textContent = label;
  navLinks.insertBefore(badge, navLinks.firstChild);
}
function registerRoutes() {
  if (Router.routes.length > 0) return;
  Router.add(/^\/$/, renderDashboard);
  Router.add(/^\/new$/, () => renderRecipeForm(null));
  Router.add(/^\/recipe\/(\d+)$/, (id) => renderRecipeDetail(parseInt(id)));
  Router.add(/^\/edit\/(\d+)$/, (id) => renderRecipeForm(parseInt(id)));
  Router.add(/^\/ingredients$/, renderIngredients);
  Router.add(/^\/stock$/, renderStockDashboard);
  Router.add(/^\/deliveries$/, renderDeliveries);
  Router.add(/^\/deliveries\/(\d+)$/, (id) => renderDeliveryDetail(parseInt(id)));
  Router.add(/^\/stock\/reception$/, renderStockReception);
  Router.add(/^\/stock\/movements$/, renderStockMovements);
  Router.add(/^\/stock\/variance$/, renderStockVariance);
  Router.add(/^\/orders$/, renderOrdersDashboard);
  Router.add(/^\/orders\/new$/, renderNewOrder);
  Router.add(/^\/orders\/(\d+)$/, (id) => renderOrderDetail(parseInt(id)));
  Router.add(/^\/kitchen$/, renderKitchenView);
  Router.add(/^\/suppliers$/, renderSuppliers);
  Router.add(/^\/ia$/, renderAIAssistant);
  Router.add(/^\/haccp$/, renderHACCPDashboard);
  Router.add(/^\/haccp\/temperatures$/, renderHACCPTemperatures);
  Router.add(/^\/haccp\/cleaning$/, renderHACCPCleaning);
  Router.add(/^\/haccp\/traceability$/, renderHACCPTraceability);
  Router.add(/^\/haccp\/cooling$/, renderHACCPCooling);
  Router.add(/^\/haccp\/reheating$/, renderHACCPReheating);
  Router.add(/^\/haccp\/fryers$/, renderHACCPFryers);
  Router.add(/^\/haccp\/non-conformities$/, renderHACCPNonConformities);
  Router.add(/^\/haccp\/allergens$/, renderHACCPAllergens);
  Router.add(/^\/analytics$/, renderAnalytics);
  Router.add(/^\/health$/, renderHealthDashboard);
  Router.add(/^\/more$/, () => new MoreView().render());
  Router.add(/^\/team$/, renderTeam);
  Router.add(/^\/subscribe$/, renderSubscribe);
  Router.add(/^\/supplier-portal$/, renderSupplierPortalManage);
  Router.add(/^\/service$/, renderServiceView);
  Router.add(/^\/scan-invoice$/, renderScanInvoice);
  Router.add(/^\/mercuriale$/, renderMercuriale);
  Router.add(/^\/import-mercuriale$/, renderImportMercuriale);
  Router.add(/^\/chef$/, renderAIChef);
  Router.add(/^\/menu-engineering$/, renderMenuEngineering);
  Router.add(/^\/carbon$/, renderCarbon);
  Router.add(/^\/integrations$/, renderIntegrations);
  Router.add(/^\/multi-site$/, renderMultiSite);
  Router.add(/^\/predictions$/, renderPredictions);
  Router.add(/^\/crm$/, renderCRM);
  Router.add(/^\/api-keys$/, renderAPIKeys);
  Router.add(/^\/qrcodes$/, renderQRCodes);
  Router.add(/^\/errors-log$/, () => new ErrorsLogView().render());
}
function bootApp(role, account, opts = {}) {
  applyRole(role);
  updateNavUser(account);
  registerRoutes();
  initNavGroups(role);
  const navLinks = document.querySelectorAll(".nav-link[data-roles]");
  navLinks.forEach((link) => {
    const allowedRoles = link.dataset.roles.split(",").map((r) => r.trim());
    if (!allowedRoles.includes(role)) {
      link.style.display = "none";
    } else {
      link.style.display = "";
    }
  });
  if (role === "salle") {
    const nav = document.getElementById("nav");
    if (nav) nav.style.display = "none";
    location.hash = "#/service";
  } else if (role === "cuisinier") {
    const nav = document.getElementById("nav");
    if (nav) nav.style.display = "none";
    location.hash = "#/kitchen";
  } else {
    location.hash = "#/";
  }
  Router.init();
  if (window.lucide) lucide.createIcons();
  const displayName = account ? account.name : role;
  console.log("%c RestoSuite ", "background:#E8722A;color:#fff;border-radius:4px;padding:2px 8px;font-weight:600", `loaded (${displayName})`);
  fetchTrialStatus().then(() => renderTrialBanner());
  clearTrialStatusInterval();
  _trialStatusIntervalId = setInterval(() => fetchTrialStatus().then(() => renderTrialBanner()), 5 * 60 * 1e3);
}
function updateNavUser(account) {
  const existing = document.querySelector(".nav-user-badge");
  if (existing) existing.remove();
  if (!account) return;
  const nav = document.getElementById("nav");
  if (!nav) return;
  const badge = document.createElement("div");
  badge.className = "nav-user-badge";
  badge.innerHTML = `${renderAvatar(account.name, 32)}<span class="nav-user-name">${escapeHtml(account.name)}</span>`;
  badge.addEventListener("click", () => {
    location.hash = "#/more";
  });
  const navLinks = nav.querySelector(".nav-links");
  if (navLinks) {
    navLinks.appendChild(badge);
  }
}
function initNavGroups(role) {
  const panel = document.getElementById("nav-panel");
  const panelContent = document.getElementById("nav-panel-content");
  if (!panel || !panelContent) return;
  const backdrop = panel.querySelector(".nav-panel-backdrop");
  let activeGroupKey = null;
  function closePanel() {
    panel.classList.remove("open");
    document.querySelectorAll(".nav-link.panel-open").forEach((el) => el.classList.remove("panel-open"));
    activeGroupKey = null;
  }
  function openPanel(btn, groupKey) {
    const group = NAV_GROUPS[groupKey];
    if (!group) return;
    const accessible = group.items.filter((item) => item.roles.includes(role));
    if (accessible.length === 0) return;
    if (accessible.length === 1) {
      closePanel();
      location.hash = "#" + accessible[0].route;
      return;
    }
    const currentPath = location.hash.replace("#", "") || "/";
    panelContent.innerHTML = `
      <div class="nav-panel-title">${escapeHtml(group.label)}</div>
      ${accessible.map((item) => {
      if (item.action === "logout") {
        return `<button class="nav-panel-item nav-panel-item--danger" onclick="logout()">
            <i data-lucide="${item.icon}"></i>
            ${escapeHtml(item.label)}
          </button>`;
      }
      const isActive = currentPath === item.route || item.route !== "/" && currentPath.startsWith(item.route);
      return `<a href="#${item.route}" class="nav-panel-item${isActive ? " active" : ""}">
          <i data-lucide="${item.icon}"></i>
          ${escapeHtml(item.label)}
        </a>`;
    }).join("")}
    `;
    if (window.lucide) lucide.createIcons({ nodes: [panelContent] });
    if (window.innerWidth >= 768) {
      const rect = btn.getBoundingClientRect();
      const sheet = panelContent.parentElement;
      sheet.style.left = Math.max(8, rect.left - 20) + "px";
    }
    panel.classList.add("open");
    btn.classList.add("panel-open");
    activeGroupKey = groupKey;
    panelContent.querySelectorAll(".nav-panel-item").forEach((item) => {
      item.addEventListener("click", closePanel, { once: true });
    });
  }
  document.querySelectorAll(".nav-link[data-group]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const groupKey = btn.dataset.group;
      if (activeGroupKey === groupKey && panel.classList.contains("open")) {
        closePanel();
      } else {
        closePanel();
        openPanel(btn, groupKey);
      }
    });
  });
  if (backdrop) backdrop.addEventListener("click", closePanel);
  window.addEventListener("hashchange", closePanel);
}
(async function init() {
  const supplierSession = getSupplierSession();
  if (supplierSession && getSupplierToken()) {
    document.body.classList.add("supplier-mode");
    bootSupplierApp(supplierSession);
    return;
  }
  const token = localStorage.getItem("restosuite_token");
  if (token) {
    try {
      const result = await API.getMe();
      const account2 = result.account;
      localStorage.setItem("restosuite_account", JSON.stringify(account2));
      if (account2.onboarding_step < 7 && account2.is_owner) {
        const nav = document.getElementById("nav");
        if (nav) nav.style.display = "none";
        const wizard = new OnboardingWizard(() => {
          if (nav) nav.style.display = "";
          bootApp(account2.role, account2);
        });
        wizard.show();
        return;
      }
      if (account2.role === "fournisseur") {
        const login2 = new LoginView();
        login2.mode = "login";
        login2.render();
        return;
      }
      bootApp(account2.role, account2);
      return;
    } catch (e) {
      console.warn("Token verification failed:", e);
      localStorage.removeItem("restosuite_token");
      localStorage.removeItem("restosuite_account");
    }
  }
  const account = getAccount();
  if (account && !token) {
    if (account.role === "fournisseur") {
      const login2 = new LoginView();
      login2.render();
      return;
    }
    bootApp(account.role, account);
    return;
  }
  const role = localStorage.getItem("restosuite_role");
  if (role && role !== "fournisseur") {
    bootApp(role, null);
    return;
  }
  if (role === "fournisseur") {
    const login2 = new LoginView();
    login2.render();
    return;
  }
  const login = new LoginView();
  login.render();
})();
(function() {
  let _errorBuffer = [];
  let _flushTimer = null;
  function reportErrors() {
    if (!_errorBuffer.length) return;
    const token = localStorage.getItem("restosuite_token");
    if (!token) {
      _errorBuffer = [];
      return;
    }
    const batch = _errorBuffer.splice(0);
    batch.forEach((entry) => {
      fetch("/api/errors/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify(entry)
      }).catch(() => {
      });
    });
  }
  function scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(() => {
      _flushTimer = null;
      reportErrors();
    }, 2e3);
  }
  function captureError(opts) {
    _errorBuffer.push(opts);
    scheduleFlush();
  }
  window.onerror = function(message, source, lineno, colno, error) {
    captureError({
      type: "onerror",
      message: String(message),
      source,
      lineno,
      colno,
      stack: error && error.stack ? error.stack : void 0
    });
  };
  window.onunhandledrejection = function(event) {
    const reason = event.reason;
    captureError({
      type: "unhandledrejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error && reason.stack ? reason.stack : void 0
    });
  };
})();
