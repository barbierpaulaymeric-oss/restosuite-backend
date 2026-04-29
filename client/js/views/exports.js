// ═══════════════════════════════════════════
// Exports comptables — Route #/exports
// Monthly CSV + PDF exports for the accountant
// ═══════════════════════════════════════════

(function () {
  // Default to the previous full month (current month is rarely "closed").
  function defaultMonth() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function monthLabel(iso) {
    if (!/^\d{4}-\d{2}$/.test(iso)) return iso;
    const [y, m] = iso.split('-').map(Number);
    const names = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return `${names[m - 1]} ${y}`;
  }

  // Auth-aware blob download — same pattern as pms-export.js btn-pms-pdf.
  // Cookie auth covers most cases; legacy bearer kept as fallback.
  async function downloadExport(apiPath, fallbackFilename) {
    const token = localStorage.getItem('restosuite_token');
    const res = await fetch(apiPath, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    // Prefer server-supplied filename when present.
    let filename = fallbackFilename;
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    if (m && m[1]) filename = m[1];

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderExports() {
    const app = document.getElementById('app');
    const month = defaultMonth();

    app.innerHTML = `
      <div class="exports-page" style="max-width:780px;margin:0 auto;padding:24px 20px">
        <header style="margin-bottom:24px">
          <h1 style="margin:0;font-size:22px;font-weight:700;display:flex;align-items:center;gap:10px">
            <i data-lucide="file-spreadsheet" style="width:24px;height:24px;color:var(--color-accent)"></i>
            Exports comptables
          </h1>
          <p style="margin:6px 0 0 0;color:var(--text-secondary);font-size:14px">
            Générez les fichiers mensuels à transmettre à votre comptable.
          </p>
        </header>

        <div class="card" style="padding:20px;margin-bottom:20px">
          <label for="exports-month" style="display:block;font-weight:600;margin-bottom:8px">Mois à exporter</label>
          <input type="month" id="exports-month" value="${month}" max="${defaultMonth().slice(0,4)}-12"
                 data-ui="custom"
                 style="width:100%;max-width:240px;padding:8px 12px;font-size:15px">
          <p id="exports-month-label" style="margin:8px 0 0 0;color:var(--text-secondary);font-size:13px">
            Période : <strong>${escapeHtml(monthLabel(month))}</strong>
          </p>
        </div>

        <div class="exports-grid" style="display:grid;grid-template-columns:1fr;gap:14px">
          ${exportCard({
            id: 'btn-export-purchases',
            icon: 'shopping-cart',
            title: 'Achats fournisseurs (CSV)',
            desc: 'Toutes les commandes envoyées : date, fournisseur, n° commande, articles, HT, TVA, TTC.',
          })}
          ${exportCard({
            id: 'btn-export-foodcost',
            icon: 'chef-hat',
            title: 'Food cost par fiche (CSV)',
            desc: 'Portions vendues, coût ingrédients, prix de vente, marge et food cost % par recette.',
          })}
          ${exportCard({
            id: 'btn-export-variance',
            icon: 'package',
            title: 'Variance de stock (CSV)',
            desc: 'Stock initial, réceptions, consommation, pertes, stock final et variance par ingrédient.',
          })}
          ${exportCard({
            id: 'btn-export-haccp',
            icon: 'shield-check',
            title: 'Synthèse HACCP (PDF)',
            desc: 'Relevés de température, plan de nettoyage et non-conformités du mois.',
          })}
          ${exportCard({
            id: 'btn-export-monthly',
            icon: 'file-text',
            title: 'Rapport mensuel comptable (PDF)',
            desc: 'Document tout-en-un : couverture, achats, food cost, variance stock, factures, pertes, HACCP. À transmettre à votre comptable.',
          })}
        </div>

        <p style="margin-top:24px;color:var(--text-secondary);font-size:12px;line-height:1.5">
          <i data-lucide="info" style="width:14px;height:14px;vertical-align:middle"></i>
          La TVA des achats est calculée au taux standard restauration (10 %). Si certains produits relèvent d'un autre taux,
          ajustez dans votre logiciel comptable.
        </p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const monthInput = document.getElementById('exports-month');
    const monthLabelEl = document.getElementById('exports-month-label');

    function currentMonth() {
      const v = monthInput.value;
      return /^\d{4}-\d{2}$/.test(v) ? v : month;
    }

    monthInput.addEventListener('change', () => {
      monthLabelEl.innerHTML = `Période : <strong>${escapeHtml(monthLabel(currentMonth()))}</strong>`;
    });

    bindDownload('btn-export-purchases', () => ({
      path: `/api/exports/monthly-purchases?month=${currentMonth()}`,
      file: `achats-${currentMonth()}.csv`,
    }));
    bindDownload('btn-export-foodcost', () => ({
      path: `/api/exports/monthly-food-cost?month=${currentMonth()}`,
      file: `food-cost-${currentMonth()}.csv`,
    }));
    bindDownload('btn-export-variance', () => ({
      path: `/api/exports/stock-variance?month=${currentMonth()}`,
      file: `variance-stock-${currentMonth()}.csv`,
    }));
    bindDownload('btn-export-haccp', () => ({
      path: `/api/exports/haccp-summary?month=${currentMonth()}`,
      file: `haccp-${currentMonth()}.pdf`,
    }));
    bindDownload('btn-export-monthly', () => ({
      path: `/api/exports/monthly-report?month=${currentMonth()}`,
      file: `rapport-mensuel-${currentMonth()}.pdf`,
    }));
  }

  function exportCard({ id, icon, title, desc }) {
    return `
      <div class="card" style="display:flex;gap:16px;align-items:flex-start;padding:16px">
        <div style="flex:0 0 44px;height:44px;border-radius:10px;background:var(--bg-subtle, #f3f1ec);display:flex;align-items:center;justify-content:center">
          <i data-lucide="${icon}" style="width:22px;height:22px;color:var(--color-accent)"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:15px;margin-bottom:4px">${escapeHtml(title)}</div>
          <div style="color:var(--text-secondary);font-size:13px;line-height:1.4">${escapeHtml(desc)}</div>
        </div>
        <button id="${id}" class="btn btn-primary" style="flex:0 0 auto;align-self:center">
          <i data-lucide="download" style="width:16px;height:16px"></i>
          Télécharger
        </button>
      </div>
    `;
  }

  function bindDownload(buttonId, getRequest) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" style="width:16px;height:16px;animation:spin 1s linear infinite"></i> Génération…';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      try {
        const req = getRequest();
        await downloadExport(req.path, req.file);
        if (typeof showToast === 'function') showToast('Téléchargement lancé ✓', 'success');
      } catch (err) {
        if (typeof showToast === 'function') {
          showToast(`Erreur export : ${err.message}`, 'error');
        } else {
          alert(`Erreur export : ${err.message}`);
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    });
  }

  // Expose for router.
  window.renderExports = renderExports;
})();
