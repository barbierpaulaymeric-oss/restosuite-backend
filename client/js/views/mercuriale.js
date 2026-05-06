// ═══════════════════════════════════════════
// Mercuriale — Catalogue fournisseurs
// ═══════════════════════════════════════════

async function renderMercuriale() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/analytics" class="back-link" style="display:inline-flex;align-items:center;gap:4px;color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm);margin-bottom:var(--space-1)">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Analytics
        </a>
        <h1 style="margin-top:4px"><i data-lucide="book-open" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Mercuriale</h1>
        <p class="text-secondary" style="margin:0;font-size:var(--text-sm)">Catalogue produits référencés par fournisseur</p>
      </div>
      <a href="#/import-mercuriale" class="btn btn-primary"><i data-lucide="camera" style="width:16px;height:16px"></i> Scanner une mercuriale</a>
    </div>

    <div id="merc-summary" class="card" style="padding:var(--space-3);margin-bottom:var(--space-4);display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:center">
      <div class="skeleton" style="height:24px;width:100%"></div>
    </div>

    <section style="margin-bottom:var(--space-5)">
      <h2 style="margin-bottom:var(--space-3);display:flex;align-items:center;gap:6px">
        <i data-lucide="alert-triangle" style="width:20px;height:20px"></i> Alertes prix
      </h2>
      <div id="merc-alerts">
        <div class="skeleton skeleton-card"></div>
      </div>
    </section>

    <section>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3);flex-wrap:wrap">
        <h2 style="margin:0;display:flex;align-items:center;gap:6px">
          <i data-lucide="building-2" style="width:20px;height:20px"></i> Fournisseurs
        </h2>
        <input type="search" id="merc-search" placeholder="Rechercher un produit…" class="form-control" style="max-width:280px" data-ui="custom">
      </div>
      <div id="merc-suppliers">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card" style="margin-top:var(--space-2)"></div>
      </div>
    </section>
  `;

  if (window.lucide) lucide.createIcons();

  let catalog = null;
  let priceData = null;

  try {
    [catalog, priceData] = await Promise.all([
      API.request('/analytics/mercuriale-catalog'),
      API.request('/analytics/prices')
    ]);
  } catch (e) {
    document.getElementById('merc-summary').innerHTML =
      '<div style="color:var(--color-danger)">Erreur de chargement</div>';
    if (typeof showToast === 'function') showToast('Erreur chargement mercuriale', 'error');
    return;
  }

  renderSummary(catalog.totals);
  renderAlerts(priceData.recent_changes || []);
  renderMercurialeSuppliers(catalog.suppliers || []);

  // Search filter
  const search = document.getElementById('merc-search');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll('.merc-product-row').forEach(row => {
      const name = (row.dataset.name || '').toLowerCase();
      row.style.display = !q || name.includes(q) ? '' : 'none';
    });
    // Hide categories/suppliers with no visible products
    document.querySelectorAll('.merc-category').forEach(cat => {
      const visible = cat.querySelectorAll('.merc-product-row:not([style*="display: none"])').length;
      cat.style.display = visible > 0 ? '' : 'none';
    });
    document.querySelectorAll('.merc-supplier').forEach(sup => {
      const visible = sup.querySelectorAll('.merc-product-row:not([style*="display: none"])').length;
      sup.style.display = !q || visible > 0 ? '' : 'none';
    });
  });

  if (window.lucide) lucide.createIcons();
}

function renderSummary(totals) {
  const el = document.getElementById('merc-summary');
  const supText = `${totals.suppliers} fournisseur${totals.suppliers > 1 ? 's' : ''}`;
  const prodText = `${totals.products} produit${totals.products > 1 ? 's' : ''} référencé${totals.products > 1 ? 's' : ''}`;
  const updateText = totals.last_update
    ? `Dernière mise à jour: ${timeAgoFR(totals.last_update)}`
    : 'Aucune mise à jour';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;font-weight:600">
      <i data-lucide="building-2" style="width:18px;height:18px;color:var(--color-accent)"></i>
      ${escapeHtml(supText)}
    </div>
    <span style="color:var(--text-tertiary)">·</span>
    <div style="display:flex;align-items:center;gap:6px;font-weight:600">
      <i data-lucide="package" style="width:18px;height:18px;color:var(--color-accent)"></i>
      ${escapeHtml(prodText)}
    </div>
    <span style="color:var(--text-tertiary)">·</span>
    <div style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:var(--text-sm)">
      <i data-lucide="clock" style="width:16px;height:16px"></i>
      ${escapeHtml(updateText)}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function renderAlerts(changes) {
  const el = document.getElementById('merc-alerts');
  if (!changes || changes.length === 0) {
    el.innerHTML = `
      <div class="card" style="padding:var(--space-3);text-align:center;color:var(--color-success);background:var(--bg-elevated)">
        <i data-lucide="check-circle" style="width:18px;height:18px;vertical-align:middle"></i>
        Aucune variation de prix récente
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Show top 5 by absolute change_pct, plus a "voir tout" toggle
  const sorted = [...changes].sort((a, b) => Math.abs(b.change_pct || 0) - Math.abs(a.change_pct || 0));
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  el.innerHTML = `
    <div style="display:grid;gap:var(--space-2)" id="merc-alerts-grid">
      ${top.map(renderAlertCard).join('')}
      ${rest.length > 0 ? `
        <details style="margin-top:var(--space-1)">
          <summary style="cursor:pointer;color:var(--color-accent);font-size:var(--text-sm);user-select:none;padding:var(--space-2)">
            Voir ${rest.length} variation${rest.length > 1 ? 's' : ''} de plus
          </summary>
          <div style="display:grid;gap:var(--space-2);margin-top:var(--space-2)">
            ${rest.map(renderAlertCard).join('')}
          </div>
        </details>
      ` : ''}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function renderAlertCard(c) {
  const pct = Number(c.change_pct) || 0;
  const isNew = c.old_price == null || c.old_price === 0;
  const isUp = pct > 0;
  const color = isNew ? 'var(--color-info, var(--color-accent))' : isUp ? 'var(--color-danger)' : pct < 0 ? 'var(--color-success)' : 'var(--text-tertiary)';
  const iconName = isNew ? 'sparkles' : isUp ? 'trending-up' : pct < 0 ? 'trending-down' : 'minus';
  const label = isNew ? 'Nouveau' : `${isUp ? '+' : ''}${pct.toFixed(1)}%`;
  const oldStr = c.old_price > 0 ? `${Number(c.old_price).toFixed(2)}€` : '—';
  const newStr = c.new_price != null ? `${Number(c.new_price).toFixed(2)}€` : '—';
  return `
    <div class="card" style="padding:var(--space-3);border-left:3px solid ${color};display:flex;justify-content:space-between;align-items:center;gap:var(--space-3)">
      <div style="min-width:0;flex:1">
        <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.product || '—')}</div>
        <div style="color:var(--text-secondary);font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escapeHtml(c.supplier || '—')} · ${timeAgoFR(c.date)}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="display:inline-flex;align-items:center;gap:4px;color:${color};font-weight:600">
          <i data-lucide="${iconName}" style="width:16px;height:16px"></i>
          ${escapeHtml(label)}
        </div>
        <div style="color:var(--text-secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums">
          ${isNew ? newStr : `${oldStr} → ${newStr}`}
        </div>
      </div>
    </div>
  `;
}

function renderMercurialeSuppliers(suppliers) {
  const el = document.getElementById('merc-suppliers');
  if (!suppliers || suppliers.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:var(--space-6)">
        <i data-lucide="package-x" style="width:40px;height:40px;color:var(--text-tertiary);margin-bottom:var(--space-2)"></i>
        <p style="color:var(--text-secondary)">Aucun produit référencé pour le moment</p>
        <a href="#/import-mercuriale" class="btn btn-primary" style="margin-top:var(--space-3)">
          <i data-lucide="camera" style="width:16px;height:16px"></i> Scanner votre première mercuriale
        </a>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Suppliers expanded by default if ≤2; otherwise first only
  const expandFirst = suppliers.length <= 2;

  el.innerHTML = suppliers.map((sup, idx) => {
    const open = expandFirst || idx === 0 ? 'open' : '';
    return `
      <details class="merc-supplier card" ${open} style="padding:0;margin-bottom:var(--space-3);overflow:hidden">
        <summary style="padding:var(--space-3);cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);background:var(--bg-elevated);border-bottom:1px solid var(--border-light)">
          <div style="display:flex;align-items:center;gap:var(--space-2);min-width:0;flex:1">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--color-accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">
              ${escapeHtml((sup.name || '?').charAt(0).toUpperCase())}
            </div>
            <div style="min-width:0">
              <div style="font-weight:600;font-size:var(--text-base);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(sup.name)}</div>
              <div style="color:var(--text-secondary);font-size:var(--text-xs)">
                ${sup.products_count} produit${sup.products_count > 1 ? 's' : ''}
                · ${sup.categories.length} catégorie${sup.categories.length > 1 ? 's' : ''}
                ${sup.last_update ? ' · maj ' + timeAgoFR(sup.last_update) : ''}
              </div>
            </div>
          </div>
          <i data-lucide="chevron-down" class="merc-chevron" style="width:20px;height:20px;color:var(--text-secondary);flex-shrink:0"></i>
        </summary>
        <div style="padding:var(--space-3)">
          ${sup.categories.map(cat => renderCategory(cat)).join('')}
        </div>
      </details>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderCategory(cat) {
  return `
    <div class="merc-category" style="margin-bottom:var(--space-4)">
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);padding-bottom:var(--space-1);border-bottom:1px solid var(--border-light)">
        <span style="font-weight:600;font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary)">
          ${escapeHtml(cat.name)}
        </span>
        <span style="color:var(--text-tertiary);font-size:var(--text-xs)">${cat.items.length}</span>
      </div>
      <div style="display:grid;gap:1px;background:var(--border-light);border-radius:var(--radius-md);overflow:hidden">
        ${cat.items.map(p => renderProductRow(p)).join('')}
      </div>
    </div>
  `;
}

function renderProductRow(p) {
  const tva = p.tva_rate != null ? ` · TVA ${p.tva_rate}%` : '';
  const sku = p.sku ? ` · ${escapeHtml(p.sku)}` : '';
  const pkg = p.packaging ? ` · ${escapeHtml(p.packaging)}` : '';

  let trendBadge = '';
  if (p.last_change && p.last_change.trend) {
    const t = p.last_change.trend;
    const pct = p.last_change.change_pct;
    const isNew = p.last_change.old_price == null || p.last_change.old_price === 0;
    if (isNew) {
      trendBadge = `<span style="display:inline-flex;align-items:center;gap:3px;font-size:var(--text-xs);color:var(--color-accent);font-weight:600"><i data-lucide="sparkles" style="width:12px;height:12px"></i>nouveau</span>`;
    } else {
      const color = t === 'up' ? 'var(--color-danger)' : t === 'down' ? 'var(--color-success)' : 'var(--text-tertiary)';
      const icon = t === 'up' ? 'arrow-up' : t === 'down' ? 'arrow-down' : 'minus';
      const sign = pct > 0 ? '+' : '';
      trendBadge = `<span style="display:inline-flex;align-items:center;gap:2px;font-size:var(--text-xs);color:${color};font-weight:600"><i data-lucide="${icon}" style="width:12px;height:12px"></i>${sign}${(pct || 0).toFixed(1)}%</span>`;
    }
  }

  const ingrBadge = p.ingredient_id
    ? `<span title="Lié à un ingrédient" style="display:inline-flex;align-items:center;gap:2px;font-size:var(--text-xs);color:var(--color-success)"><i data-lucide="link" style="width:11px;height:11px"></i></span>`
    : '';

  const updateText = p.updated_at ? timeAgoFR(p.updated_at) : '—';

  return `
    <div class="merc-product-row" data-name="${escapeHtml(p.product_name || '')}" style="padding:var(--space-3);background:var(--bg-card, var(--bg-elevated));display:grid;grid-template-columns:1fr auto;gap:var(--space-2);align-items:center">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">
          <span style="font-weight:500">${escapeHtml(p.product_name || '—')}</span>
          ${ingrBadge}
          ${trendBadge}
        </div>
        <div style="color:var(--text-tertiary);font-size:var(--text-xs);margin-top:2px">
          ${escapeHtml('Maj ' + updateText)}${sku}${pkg}${tva}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:600;font-variant-numeric:tabular-nums">${(p.price || 0).toFixed(2)}€</div>
        <div style="color:var(--text-secondary);font-size:var(--text-xs)">/ ${escapeHtml(p.unit || '—')}</div>
      </div>
    </div>
  `;
}

function timeAgoFR(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'à l’instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD} j`;
  if (diffD < 30) return `il y a ${Math.floor(diffD / 7)} sem`;
  if (diffD < 365) return `il y a ${Math.floor(diffD / 30)} mois`;
  return `il y a ${Math.floor(diffD / 365)} an${Math.floor(diffD / 365) > 1 ? 's' : ''}`;
}
