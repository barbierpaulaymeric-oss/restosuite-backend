// ═══════════════════════════════════════════
// Multi-Sites — Gestion multi-établissements
// ═══════════════════════════════════════════

// Fonction masquée (décision produit 2026-07-30) : le multi-établissement n'est
// pas prêt (la tenancy ne rattache pas les nouveaux sites au compte créateur).
// Le lien de nav est retiré (app.js, more.js) et la CRÉATION est bloquée côté
// serveur (feature flag MULTISITE_ENABLED off, server/routes/multi-site.js).
// Cet écran « Bientôt disponible » ne s'affiche que si la route #/multi-site est
// atteinte directement (ancien favori, lien externe). Le code du wizard
// NewSiteWizant est conservé plus bas pour la future implémentation complète.
async function renderMultiSite() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="building-2" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Multi-établissements
      </h1>
    </div>
    <div class="card" style="padding:var(--space-6);text-align:center;max-width:520px;margin:var(--space-4) auto">
      <div style="font-size:40px;margin-bottom:var(--space-3)">🏗️</div>
      <h2 style="margin-bottom:var(--space-2)">Bientôt disponible</h2>
      <p class="text-secondary" style="font-size:var(--text-sm);line-height:1.6">
        La gestion de plusieurs établissements depuis un seul compte est en cours de préparation.
        Nous voulons la livrer avec une isolation stricte des données entre vos sites — nous
        prenons le temps de bien la faire.
      </p>
      <p class="text-secondary" style="font-size:var(--text-sm);margin-top:var(--space-3)">
        Un besoin urgent sur ce sujet ? Écrivez-nous à
        <a href="mailto:contact@restosuite.fr" style="color:var(--color-accent)">contact@restosuite.fr</a>.
      </p>
      <a href="#/" class="btn btn-primary" style="margin-top:var(--space-4);text-decoration:none;display:inline-flex">Retour au tableau de bord</a>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

// Ancienne implémentation conservée (inactive) pour la future tenancy complète.
async function _renderMultiSiteFull() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="building-2" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Multi-Sites
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Gérez tous vos établissements depuis un seul tableau de bord</p>
    </div>
    <div id="multisite-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadMultiSite();
}

async function loadMultiSite() {
  const content = document.getElementById('multisite-content');
  try {
    const [sites, comparison] = await Promise.all([
      API.request('/sites'),
      API.request('/sites/compare/all?days=30')
    ]);
    renderMultiSiteContent(sites, comparison);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function renderMultiSiteContent(sites, comparison) {
  const content = document.getElementById('multisite-content');
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
              <th style="text-align:right">Équipe</th>
              <th style="text-align:right">Tables</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.sites.map(s => `
              <tr>
                <td style="font-weight:600">${escapeHtml(s.name)}</td>
                <td style="text-align:right">${s.revenue.toFixed(0)} €</td>
                <td style="text-align:right">${s.orders}</td>
                <td style="text-align:right">${s.avg_ticket.toFixed(2)} €</td>
                <td style="text-align:right">${s.staff}</td>
                <td style="text-align:right">${s.tables}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Sites list -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <h3>${sites.length} établissement${sites.length > 1 ? 's' : ''}</h3>
      <button class="btn btn-primary btn-sm" onclick="showAddSiteModal()">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Ajouter un site
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-3)">
      ${sites.map(site => {
        const comp = compMap[site.id] || {};
        return `
        <div class="card" style="padding:var(--space-4)">
          <div style="display:flex;align-items:start;gap:var(--space-3)">
            <div style="width:48px;height:48px;border-radius:12px;background:var(--color-accent);display:flex;align-items:center;justify-content:center;color:white;font-size:1.2rem;font-weight:700;flex-shrink:0">
              ${(site.name || 'R').charAt(0).toUpperCase()}
            </div>
            <div style="flex:1">
              <h3 style="margin:0">${escapeHtml(site.name || 'Mon restaurant')}</h3>
              <p class="text-secondary text-sm" style="margin:2px 0 0">${escapeHtml(site.address || '')} ${escapeHtml(site.city || '')}</p>
              ${site.phone ? `<p class="text-secondary" style="font-size:10px">${escapeHtml(site.phone)}</p>` : ''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-light)">
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.table_count || 0}</div>
              <div class="text-secondary text-sm">Tables</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.staff_count || 0}</div>
              <div class="text-secondary text-sm">Équipe</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-lg);font-weight:700">${site.covers || 0}</div>
              <div class="text-secondary text-sm">Couverts</div>
            </div>
          </div>
          ${comp.revenue > 0 ? `
          <div style="margin-top:var(--space-2);padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md);font-size:var(--text-xs);text-align:center">
            <span style="font-weight:600">${comp.revenue.toFixed(0)} €</span> CA 30j
            · <span style="font-weight:600">${comp.orders}</span> commandes
            · Ticket moy. <span style="font-weight:600">${comp.avg_ticket.toFixed(2)} €</span>
          </div>
          ` : ''}
          <div style="margin-top:var(--space-3);display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="editSite(${site.id})">Modifier</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

// ─── New-establishment wizard (mirrors onboarding) ───
class NewSiteWizard {
  constructor(onComplete) {
    this.step = 1;
    this.totalSteps = 5;
    this.onComplete = onComplete;
    this.direction = 'next';

    this.info = { name: '', type: 'restaurant', address: '', city: '', postal_code: '', phone: '', covers: 30 };
    this.tableMode = 'quick';
    this.tables = [];
    this.zones = [
      { name: 'Frigo 1', type: 'fridge', min_temp: 0, max_temp: 4 },
      { name: 'Frigo 2', type: 'fridge', min_temp: 0, max_temp: 4 },
      { name: 'Congélateur', type: 'freezer', min_temp: -25, max_temp: -18 },
      { name: 'Chambre froide', type: 'cold_room', min_temp: 0, max_temp: 3 }
    ];
    this.suppliers = [];
  }

  show() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'ns-dialog-title');
    this.overlay.innerHTML = `
      <div class="onboarding-card">
        <button class="modal-close" type="button" id="ns-close" aria-label="Fermer" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:20px;color:var(--text-secondary);cursor:pointer;z-index:2">✕</button>
        <div class="onboarding-progress" role="progressbar" aria-label="Progression de la configuration" aria-valuemin="0" aria-valuemax="${this.totalSteps}" aria-valuenow="${this.step}">
          <div class="onboarding-progress-bar" id="ns-progress"></div>
        </div>
        <div class="onboarding-body" id="ns-body" aria-live="polite"></div>
        <div class="onboarding-footer" id="ns-footer"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add('visible'));
    document.getElementById('ns-close').addEventListener('click', () => this.cancel());
    this.renderStep();
  }

  cancel() {
    this.overlay.classList.remove('visible');
    setTimeout(() => this.overlay.remove(), 300);
  }

  renderStep() {
    const body = document.getElementById('ns-body');
    const footer = document.getElementById('ns-footer');
    const progress = document.getElementById('ns-progress');
    if (!body || !footer || !progress) return;

    progress.style.width = `${(this.step / this.totalSteps) * 100}%`;
    const wrap = progress.parentElement;
    if (wrap) wrap.setAttribute('aria-valuenow', String(this.step));

    body.classList.remove('slide-in-left', 'slide-in-right');
    body.classList.add(this.direction === 'next' ? 'slide-in-right' : 'slide-in-left');

    switch (this.step) {
      case 1: this.renderInfo(body, footer); break;
      case 2: this.renderTables(body, footer); break;
      case 3: this.renderZones(body, footer); break;
      case 4: this.renderSuppliers(body, footer); break;
      case 5: this.renderRecap(body, footer); break;
    }
  }

  renderInfo(body, footer) {
    const i = this.info;
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">🏪</div>
        <h2 class="ob-title" id="ns-dialog-title">Nouvel établissement</h2>
        <p class="ob-desc">Les informations de votre nouveau site</p>
        <div class="ob-form">
          <div class="form-group">
            <label for="ns-name">Nom *</label>
            <input type="text" class="form-control" id="ns-name" value="${escapeHtml(i.name)}" placeholder="Chez Marcel" data-ui="custom">
          </div>
          <div class="form-group">
            <label for="ns-type">Type d'établissement</label>
            <select class="form-control" id="ns-type" data-ui="custom">
              ${[
                ['restaurant', 'Restaurant'],
                ['brasserie', 'Brasserie'],
                ['bistrot', 'Bistrot'],
                ['gastronomique', 'Gastronomique'],
                ['fast-casual', 'Fast Casual'],
                ['traiteur', 'Traiteur'],
                ['dark-kitchen', 'Dark Kitchen']
              ].map(([v, l]) => `<option value="${v}" ${i.type === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="ns-address">Adresse</label>
            <input type="text" class="form-control" id="ns-address" value="${escapeHtml(i.address)}" placeholder="12 rue de la Paix" autocomplete="street-address" data-ui="custom">
          </div>
          <div style="display:flex;gap:var(--space-3)">
            <div class="form-group" style="flex:2">
              <label for="ns-city">Ville</label>
              <input type="text" class="form-control" id="ns-city" value="${escapeHtml(i.city)}" placeholder="Lyon" autocomplete="address-level2" data-ui="custom">
            </div>
            <div class="form-group" style="flex:1">
              <label for="ns-postal">Code postal</label>
              <input type="text" class="form-control" id="ns-postal" value="${escapeHtml(i.postal_code)}" placeholder="69001" maxlength="5" inputmode="numeric" autocomplete="postal-code" data-ui="custom">
            </div>
          </div>
          <div style="display:flex;gap:var(--space-3)">
            <div class="form-group" style="flex:1">
              <label for="ns-phone">Téléphone</label>
              <input type="tel" class="form-control" id="ns-phone" value="${escapeHtml(i.phone)}" placeholder="04 78 00 00 00" data-ui="custom">
            </div>
            <div class="form-group" style="flex:1">
              <label for="ns-covers">Couverts</label>
              <input type="number" class="form-control" id="ns-covers" value="${i.covers}" min="1" inputmode="numeric" data-ui="custom">
            </div>
          </div>
        </div>
      </div>
    `;
    this.renderNav(footer, false);
    setTimeout(() => document.getElementById('ns-name')?.focus(), 50);
  }

  renderTables(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">🪑</div>
        <h2 class="ob-title" id="ns-dialog-title">Ma salle</h2>
        <p class="ob-desc">Configurez vos tables par zone</p>
        <div class="ob-form">
          <div role="tablist" aria-label="Mode de configuration des tables" class="ob-tabs">
            <button class="ob-tab ${this.tableMode === 'quick' ? 'is-active' : ''}" id="ns-mode-quick" role="tab" aria-selected="${this.tableMode === 'quick'}" type="button">Rapide</button>
            <button class="ob-tab ${this.tableMode === 'advanced' ? 'is-active' : ''}" id="ns-mode-advanced" role="tab" aria-selected="${this.tableMode === 'advanced'}" type="button">Avancé</button>
          </div>
          <div id="ns-tables-content" role="region" aria-label="Configuration des tables"></div>
        </div>
      </div>
    `;
    const setMode = (mode) => {
      this.tableMode = mode;
      document.getElementById('ns-mode-quick').classList.toggle('is-active', mode === 'quick');
      document.getElementById('ns-mode-advanced').classList.toggle('is-active', mode === 'advanced');
      this.renderTablesContent();
    };
    document.getElementById('ns-mode-quick').addEventListener('click', () => setMode('quick'));
    document.getElementById('ns-mode-advanced').addEventListener('click', () => setMode('advanced'));
    this.renderTablesContent();
    this.renderNav(footer, true);
  }

  renderTablesContent() {
    const c = document.getElementById('ns-tables-content');
    if (!c) return;
    if (this.tableMode === 'quick') {
      const cnt = (z) => this.tables.filter(t => t.zone === z).length;
      c.innerHTML = `
        <div class="form-group">
          <label for="ns-salle">Salle — nombre de tables</label>
          <input type="number" class="form-control" id="ns-salle" value="${cnt('Salle')}" min="0" inputmode="numeric" data-ui="custom">
        </div>
        <div class="form-group">
          <label for="ns-terrasse">Terrasse — nombre de tables</label>
          <input type="number" class="form-control" id="ns-terrasse" value="${cnt('Terrasse')}" min="0" inputmode="numeric" data-ui="custom">
        </div>
        <div class="form-group">
          <label for="ns-bar">Bar — nombre de tables</label>
          <input type="number" class="form-control" id="ns-bar" value="${cnt('Bar')}" min="0" inputmode="numeric" data-ui="custom">
        </div>
        <div class="form-group">
          <label for="ns-seats">Couverts par table (par défaut)</label>
          <input type="number" class="form-control" id="ns-seats" value="4" min="1" inputmode="numeric" data-ui="custom">
        </div>
      `;
    } else {
      c.innerHTML = `
        <div id="ns-adv-tables" role="list" aria-label="Tables configurées">
          ${this.tables.map((t, i) => `
            <div role="listitem" style="display:flex;gap:var(--space-2);align-items:center;margin-bottom:var(--space-2)">
              <input type="number" class="form-control" style="width:70px" value="${t.table_number}" data-index="${i}" data-field="table_number" min="1" aria-label="Numéro de table" inputmode="numeric" data-ui="custom">
              <select class="form-control" style="flex:1" data-index="${i}" data-field="zone" aria-label="Zone" data-ui="custom">
                ${['Salle', 'Terrasse', 'Bar', 'Privé'].map(z => `<option value="${z}" ${t.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
              </select>
              <input type="number" class="form-control" style="width:70px" value="${t.seats}" data-index="${i}" data-field="seats" min="1" aria-label="Couverts" inputmode="numeric" data-ui="custom">
              <button class="ns-table-del" data-index="${i}" type="button" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:18px" aria-label="Supprimer">✕</button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-ghost" id="ns-add-table" type="button" style="margin-top:var(--space-3)">+ Ajouter une table</button>
      `;
      document.getElementById('ns-add-table').addEventListener('click', () => {
        const next = this.tables.length > 0 ? Math.max(...this.tables.map(t => t.table_number)) + 1 : 1;
        this.tables.push({ table_number: next, zone: 'Salle', seats: 4 });
        this.renderTablesContent();
      });
      c.querySelectorAll('.ns-table-del').forEach(btn => {
        btn.addEventListener('click', () => {
          this.tables.splice(parseInt(btn.dataset.index), 1);
          this.renderTablesContent();
        });
      });
    }
  }

  renderZones(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">🌡️</div>
        <h2 class="ob-title" id="ns-dialog-title">Mes zones froides</h2>
        <p class="ob-desc">Configurez vos zones de température pour le HACCP</p>
        <div class="ob-zones" id="ns-zones-list" role="list" aria-label="Zones de température"></div>
        <button class="btn btn-ghost" id="ns-add-zone" type="button" style="margin-top:var(--space-3)">+ Ajouter une zone</button>
      </div>
    `;
    this.renderZonesList();
    document.getElementById('ns-add-zone').addEventListener('click', () => {
      this.zones.push({ name: 'Nouvelle zone', type: 'fridge', min_temp: 0, max_temp: 4 });
      this.renderZonesList();
    });
    this.renderNav(footer, true);
  }

  renderZonesList() {
    const c = document.getElementById('ns-zones-list');
    if (!c) return;
    c.innerHTML = this.zones.map((z, i) => `
      <div class="ob-zone-row" role="listitem" data-index="${i}">
        <input type="text" class="ob-zone-name" value="${escapeHtml(z.name)}" data-field="name" data-index="${i}" aria-label="Nom de la zone">
        <div class="ob-zone-range">
          <span class="ob-temp-pair">
            <input type="number" class="ob-zone-input" value="${z.min_temp}" data-field="min_temp" data-index="${i}" step="1" aria-label="Min" inputmode="numeric">
            <span class="ob-zone-unit" aria-hidden="true">°C</span>
          </span>
          <span class="ob-zone-arrow" aria-hidden="true">→</span>
          <span class="ob-temp-pair">
            <input type="number" class="ob-zone-input" value="${z.max_temp}" data-field="max_temp" data-index="${i}" step="1" aria-label="Max" inputmode="numeric">
            <span class="ob-zone-unit" aria-hidden="true">°C</span>
          </span>
        </div>
        <button class="ob-zone-delete" data-index="${i}" type="button" aria-label="Supprimer">✕</button>
      </div>
    `).join('');
    c.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.index);
        const f = inp.dataset.field;
        if (f === 'name') this.zones[idx].name = inp.value;
        else this.zones[idx][f] = parseFloat(inp.value);
      });
    });
    c.querySelectorAll('.ob-zone-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        this.zones.splice(parseInt(btn.dataset.index), 1);
        this.renderZonesList();
      });
    });
  }

  renderSuppliers(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">🚚</div>
        <h2 class="ob-title" id="ns-dialog-title">Mes fournisseurs</h2>
        <p class="ob-desc">Ajoutez les fournisseurs habituels de ce site (optionnel)</p>
        <div id="ns-suppliers-list" role="list" aria-label="Fournisseurs"></div>
        <button class="btn btn-ghost" id="ns-add-supplier" type="button" style="margin-top:var(--space-3)">+ Ajouter un fournisseur</button>
      </div>
    `;
    this.renderSuppliersList();
    document.getElementById('ns-add-supplier').addEventListener('click', () => {
      this.suppliers.push({ name: '', contact: '', phone: '', email: '' });
      this.renderSuppliersList();
    });
    this.renderNav(footer, true);
  }

  renderSuppliersList() {
    const c = document.getElementById('ns-suppliers-list');
    if (!c) return;
    if (this.suppliers.length === 0) {
      c.innerHTML = '<p style="color:var(--text-tertiary);font-size:var(--text-sm);text-align:center;padding:var(--space-4)">Aucun fournisseur ajouté. Vous pourrez en ajouter plus tard.</p>';
      return;
    }
    c.innerHTML = this.suppliers.map((s, i) => `
      <div role="listitem" style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <strong style="font-size:var(--text-sm)">Fournisseur ${i + 1}</strong>
          <button class="ns-supplier-del" data-index="${i}" type="button" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:16px" aria-label="Supprimer">✕</button>
        </div>
        <div class="form-group" style="margin-bottom:var(--space-2)">
          <input type="text" class="form-control" placeholder="Nom de l'entreprise" value="${escapeHtml(s.name)}" data-index="${i}" data-field="name" aria-label="Nom" data-ui="custom">
        </div>
        <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)">
          <input type="text" class="form-control" placeholder="Contact" value="${escapeHtml(s.contact)}" data-index="${i}" data-field="contact" style="flex:1" aria-label="Contact" data-ui="custom">
          <input type="tel" class="form-control" placeholder="Téléphone" value="${escapeHtml(s.phone)}" data-index="${i}" data-field="phone" style="flex:1" aria-label="Téléphone" data-ui="custom">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <input type="email" class="form-control" placeholder="Email" value="${escapeHtml(s.email)}" data-index="${i}" data-field="email" aria-label="Email" data-ui="custom">
        </div>
      </div>
    `).join('');
    c.querySelectorAll('input').forEach(el => {
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.index);
        const f = el.dataset.field;
        if (idx >= 0 && f && this.suppliers[idx]) this.suppliers[idx][f] = el.value;
      });
    });
    c.querySelectorAll('.ns-supplier-del').forEach(btn => {
      btn.addEventListener('click', () => {
        this.suppliers.splice(parseInt(btn.dataset.index), 1);
        this.renderSuppliersList();
      });
    });
  }

  renderRecap(body, footer) {
    const i = this.info;
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">📋</div>
        <h2 class="ob-title" id="ns-dialog-title">Récapitulatif</h2>
        <p class="ob-desc">Vérifiez les informations avant de créer le site</p>
        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-4);margin-top:var(--space-3);text-align:left;width:100%;max-width:380px;margin-left:auto;margin-right:auto">
          ${i.name ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Nom :</strong> ${escapeHtml(i.name)}</p>` : ''}
          ${i.type ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Type :</strong> ${escapeHtml(i.type)}</p>` : ''}
          ${i.address ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Adresse :</strong> ${escapeHtml(i.address)}</p>` : ''}
          ${i.city ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Ville :</strong> ${escapeHtml(i.city)} ${escapeHtml(i.postal_code || '')}</p>` : ''}
          ${i.phone ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Téléphone :</strong> ${escapeHtml(i.phone)}</p>` : ''}
          <p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Couverts :</strong> ${i.covers}</p>
          <p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Tables :</strong> ${this._tableCount()}</p>
          <p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Zones froides :</strong> ${this.zones.length}</p>
          <p style="font-size:var(--text-sm);margin-bottom:0"><strong>Fournisseurs :</strong> ${this.suppliers.filter(s => s.name && s.name.trim()).length}</p>
        </div>
      </div>
    `;
    footer.innerHTML = `
      <nav class="ob-buttons" aria-label="Navigation">
        <button class="btn btn-ghost ob-btn-prev" id="ns-prev" type="button">← Retour</button>
        <button class="btn btn-primary ob-btn-next" id="ns-create" type="button" style="min-width:180px">🚀 Créer l'établissement</button>
      </nav>
    `;
    document.getElementById('ns-prev').addEventListener('click', () => this.prev());
    document.getElementById('ns-create').addEventListener('click', () => this.submit());
  }

  _tableCount() {
    if (this.tableMode === 'quick') {
      return (parseInt(document.getElementById('ns-salle')?.value) || 0)
        + (parseInt(document.getElementById('ns-terrasse')?.value) || 0)
        + (parseInt(document.getElementById('ns-bar')?.value) || 0)
        + this.tables.length;
    }
    return this.tables.length;
  }

  collectInfo() {
    this.info = {
      name: (document.getElementById('ns-name')?.value || '').trim(),
      type: document.getElementById('ns-type')?.value || 'restaurant',
      address: (document.getElementById('ns-address')?.value || '').trim(),
      city: (document.getElementById('ns-city')?.value || '').trim(),
      postal_code: (document.getElementById('ns-postal')?.value || '').trim(),
      phone: (document.getElementById('ns-phone')?.value || '').trim(),
      covers: parseInt(document.getElementById('ns-covers')?.value) || 30
    };
  }

  collectTables() {
    if (this.tableMode === 'quick') {
      const salle = parseInt(document.getElementById('ns-salle')?.value) || 0;
      const terrasse = parseInt(document.getElementById('ns-terrasse')?.value) || 0;
      const bar = parseInt(document.getElementById('ns-bar')?.value) || 0;
      const seats = parseInt(document.getElementById('ns-seats')?.value) || 4;
      const out = [];
      let n = 1;
      for (let i = 0; i < salle; i++) out.push({ table_number: n++, zone: 'Salle', seats });
      for (let i = 0; i < terrasse; i++) out.push({ table_number: n++, zone: 'Terrasse', seats });
      for (let i = 0; i < bar; i++) out.push({ table_number: n++, zone: 'Bar', seats });
      this.tables = out;
    } else {
      const c = document.getElementById('ns-adv-tables');
      if (c) {
        c.querySelectorAll('input, select').forEach(el => {
          const idx = parseInt(el.dataset.index);
          const f = el.dataset.field;
          if (idx >= 0 && f && this.tables[idx]) {
            this.tables[idx][f] = f === 'zone' ? el.value : (parseInt(el.value) || 1);
          }
        });
      }
    }
  }

  renderNav(footer, showBack) {
    footer.innerHTML = `
      <nav class="ob-buttons" aria-label="Navigation">
        ${showBack ? '<button class="btn btn-ghost ob-btn-prev" id="ns-prev" type="button">← Retour</button>' : '<div></div>'}
        <button class="btn btn-primary ob-btn-next" id="ns-next" type="button">Suivant →</button>
      </nav>
    `;
    if (showBack) document.getElementById('ns-prev').addEventListener('click', () => this.prev());
    document.getElementById('ns-next').addEventListener('click', () => this.next());
  }

  next() {
    if (this.step === 1) {
      this.collectInfo();
      if (!this.info.name) {
        showToast('Nom requis', 'error');
        return;
      }
    }
    if (this.step === 2) this.collectTables();
    if (this.step < this.totalSteps) {
      this.direction = 'next';
      this.step++;
      this.renderStep();
    }
  }

  prev() {
    if (this.step === 1) this.collectInfo();
    if (this.step === 2) this.collectTables();
    if (this.step > 1) {
      this.direction = 'prev';
      this.step--;
      this.renderStep();
    }
  }

  async submit() {
    const btn = document.getElementById('ns-create');
    if (btn) { btn.disabled = true; btn.textContent = 'Création…'; }
    try {
      await API.request('/sites', {
        method: 'POST',
        body: {
          ...this.info,
          tables: this.tables,
          zones: this.zones,
          suppliers: this.suppliers.filter(s => s.name && s.name.trim())
        }
      });
      this.cancel();
      showToast('Établissement créé', 'success');
      if (this.onComplete) this.onComplete();
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Créer l\'établissement'; }
      showToast(e.message || 'Erreur', 'error');
    }
  }
}

function showAddSiteModal() {
  const wizard = new NewSiteWizard(() => loadMultiSite());
  wizard.show();
}

async function editSite(id) {
  try {
    const site = await API.request(`/sites/${id}`);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h2>Modifier ${escapeHtml(site.name)}</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="edit-site-name">Nom</label>
            <input type="text" class="form-control" id="edit-site-name" value="${escapeHtml(site.name || '')}" data-ui="custom">
          </div>
          <div class="form-group">
            <label for="edit-site-address">Adresse</label>
            <input type="text" class="form-control" id="edit-site-address" value="${escapeHtml(site.address || '')}" data-ui="custom">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <div class="form-group">
              <label for="edit-site-city">Ville</label>
              <input type="text" class="form-control" id="edit-site-city" value="${escapeHtml(site.city || '')}" data-ui="custom">
            </div>
            <div class="form-group">
              <label for="edit-site-phone">Téléphone</label>
              <input type="tel" class="form-control" id="edit-site-phone" value="${escapeHtml(site.phone || '')}" data-ui="custom">
            </div>
          </div>
          <div class="form-group">
            <label for="edit-site-covers">Couverts</label>
            <input type="number" class="form-control" id="edit-site-covers" value="${site.covers || 30}" data-ui="custom">
          </div>
          <div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
            <p class="text-secondary text-sm"><strong>${site.table_count || 0}</strong> tables · <strong>${site.staff_count || 0}</strong> membres d'équipe</p>
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
    showToast(e.message, 'error');
  }
}

async function updateSite(id) {
  try {
    await API.request(`/sites/${id}`, {
      method: 'PUT',
      body: {
        name: document.getElementById('edit-site-name').value,
        address: document.getElementById('edit-site-address').value || null,
        city: document.getElementById('edit-site-city').value || null,
        phone: document.getElementById('edit-site-phone').value || null,
        covers: parseInt(document.getElementById('edit-site-covers').value) || 30
      }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Site mis à jour', 'success');
    loadMultiSite();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
