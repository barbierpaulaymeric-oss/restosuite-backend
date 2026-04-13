// ═══════════════════════════════════════════
// QR Codes — Print grid for tables
// ═══════════════════════════════════════════

async function renderQRCodes() {
  const app = document.getElementById('app');
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
        <h1 style="margin-top:4px"><i data-lucide="qr-code" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>QR Codes — Menu</h1>
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
    const tables = await API.request('/qrcode/tables');
    const gridEl = document.getElementById('qr-grid');

    if (!tables || tables.length === 0) {
      // Fallback: generate for tables 1-20
      const fallback = Array.from({length: 20}, (_, i) => ({
        table_number: i + 1,
        qr_data_url: null
      }));
      renderQRGrid(gridEl, fallback);
    } else {
      renderQRGrid(gridEl, tables);
    }
  } catch (e) {
    document.getElementById('qr-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="alert-triangle"></i></div>
        <p>Erreur de chargement des QR codes</p>
      </div>
    `;
  }
}

function renderQRGrid(gridEl, tables) {
  gridEl.innerHTML = tables.map(t => `
    <div class="qr-card" style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;border:1px solid var(--color-border)">
      <div class="qr-table-number" style="font-size:22px;font-weight:700;margin-bottom:8px">Table ${t.table_number}</div>
      ${t.zone ? `<div class="text-secondary text-sm" style="margin-bottom:8px">${escapeHtml(t.zone)}</div>` : ''}
      ${t.qr_data_url 
        ? `<img src="${t.qr_data_url}" alt="QR Table ${t.table_number}" style="width:200px;height:200px;border-radius:8px">`
        : `<img src="/api/qrcode/table/${t.table_number}" alt="QR Table ${t.table_number}" style="width:200px;height:200px;border-radius:8px">`
      }
      <div class="text-secondary text-sm" style="margin-top:8px">Scannez pour commander</div>
    </div>
  `).join('');
}
