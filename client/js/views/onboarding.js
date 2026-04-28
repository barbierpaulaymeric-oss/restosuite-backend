// ═══════════════════════════════════════════
// Onboarding Wizard — 7-step server-side
// ═══════════════════════════════════════════

class OnboardingWizard {
  constructor(onComplete) {
    this.step = 1;
    this.totalSteps = 7;
    this.onComplete = onComplete;
    this.direction = 'next';
    this.data = {}; // cached server data

    // Local state for step 3
    this.tables = [];
    this.tableMode = 'quick'; // 'quick' | 'advanced'

    // Local state for step 4
    this.members = [];
    this.staffPassword = '';

    // Local state for step 5
    this.zones = [
      { name: 'Frigo 1', type: 'fridge', min_temp: 0, max_temp: 4 },
      { name: 'Frigo 2', type: 'fridge', min_temp: 0, max_temp: 4 },
      { name: 'Congélateur', type: 'freezer', min_temp: -25, max_temp: -18 },
      { name: 'Chambre froide', type: 'cold_room', min_temp: 0, max_temp: 3 },
    ];

    // Local state for step 6
    this.suppliers = [];
  }

  async show() {
    // Fetch current status from server
    try {
      this.data = await API.getOnboardingStatus();
      if (this.data.current_step > 0 && this.data.current_step < 7) {
        this.step = this.data.current_step + 1;
      }
      // Pre-populate zones from server if available
      if (this.data.zones && this.data.zones.length > 0) {
        this.zones = this.data.zones.map(z => ({
          name: z.name, type: z.type, min_temp: z.min_temp, max_temp: z.max_temp
        }));
      }
      if (this.data.tables && this.data.tables.length > 0) {
        this.tables = this.data.tables;
      }
      if (this.data.suppliers && this.data.suppliers.length > 0) {
        this.suppliers = this.data.suppliers.map(s => ({
          name: s.name, contact: s.contact || '', phone: s.phone || '', email: s.email || ''
        }));
      }
    } catch (e) {
      console.warn('Could not fetch onboarding status:', e);
    }

    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'ob-dialog-title');
    this.overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-progress" role="progressbar" aria-label="Progression de la configuration" aria-valuemin="0" aria-valuemax="7" aria-valuenow="${this.step}">
          <div class="onboarding-progress-bar" id="ob-progress"></div>
        </div>
        <div class="onboarding-body" id="ob-body" aria-live="polite"></div>
        <div class="onboarding-footer" id="ob-footer"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add('visible'));
    this.renderStep();
  }

  renderStep() {
    const body = document.getElementById('ob-body');
    const footer = document.getElementById('ob-footer');
    const progress = document.getElementById('ob-progress');

    if (!body || !footer || !progress) return;

    progress.style.width = `${(this.step / this.totalSteps) * 100}%`;
    const progressWrap = progress.parentElement;
    if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(this.step));
    body.classList.remove('slide-in-left', 'slide-in-right');
    body.classList.add(this.direction === 'next' ? 'slide-in-right' : 'slide-in-left');

    switch (this.step) {
      case 1: this.renderStep1(body, footer); break;
      case 2: this.renderStep2(body, footer); break;
      case 3: this.renderStep3(body, footer); break;
      case 4: this.renderStep4(body, footer); break;
      case 5: this.renderStep5(body, footer); break;
      case 6: this.renderStep6(body, footer); break;
      case 7: this.renderStep7(body, footer); break;
    }
  }

  // ─── Step 1: Mon profil ───
  renderStep1(body, footer) {
    const acc = this.data.account || {};
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">👤</div>
        <h2 class="ob-title" id="ob-dialog-title">Mon profil</h2>
        <p class="ob-desc">Vos informations personnelles</p>
        <div class="ob-form">
          <div class="form-group">
            <label for="ob-firstname">Prénom</label>
            <input type="text" class="form-control" id="ob-firstname" value="${escapeHtml(acc.first_name || '')}" placeholder="Prénom" autocomplete="given-name" data-ui="custom">
          </div>
          <div class="form-group">
            <label for="ob-lastname">Nom</label>
            <input type="text" class="form-control" id="ob-lastname" value="${escapeHtml(acc.last_name || '')}" placeholder="Nom" autocomplete="family-name" data-ui="custom">
          </div>
          <div class="form-group">
            <label for="ob-phone">Téléphone</label>
            <input type="tel" class="form-control" id="ob-phone" value="${escapeHtml(acc.phone || '')}" placeholder="06 12 34 56 78" autocomplete="tel" data-ui="custom">
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
        <div class="ob-icon" aria-hidden="true">🏪</div>
        <h2 class="ob-title" id="ob-dialog-title">Mon restaurant</h2>
        <p class="ob-desc">Les informations de votre établissement</p>
        <div class="ob-form">
          <div class="form-group">
            <label for="ob-rname">Nom du restaurant</label>
            <input type="text" class="form-control" id="ob-rname" value="${escapeHtml(r.name || '')}" placeholder="Chez Marcel" data-ui="custom">
          </div>
          <div class="form-group">
            <label for="ob-rtype">Type d'établissement</label>
            <select class="form-control" id="ob-rtype" data-ui="custom">
              <option value="">— Choisir —</option>
              ${['brasserie', 'gastro', 'fast-food', 'pizzeria', 'bar', 'traiteur', 'boulangerie', 'autre']
                .map(t => `<option value="${t}" ${r.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="ob-raddress">Adresse</label>
            <input type="text" class="form-control" id="ob-raddress" value="${escapeHtml(r.address || '')}" placeholder="12 rue de la Paix" autocomplete="street-address" data-ui="custom">
          </div>
          <div style="display:flex;gap:var(--space-3)">
            <div class="form-group" style="flex:2">
              <label for="ob-rcity">Ville</label>
              <input type="text" class="form-control" id="ob-rcity" value="${escapeHtml(r.city || '')}" placeholder="Lyon" autocomplete="address-level2" data-ui="custom">
            </div>
            <div class="form-group" style="flex:1">
              <label for="ob-rpostal">Code postal</label>
              <input type="text" class="form-control" id="ob-rpostal" value="${escapeHtml(r.postal_code || '')}" placeholder="69001" maxlength="5" inputmode="numeric" autocomplete="postal-code" data-ui="custom">
            </div>
          </div>
          <div style="display:flex;gap:var(--space-3)">
            <div class="form-group" style="flex:1">
              <label for="ob-rphone">Téléphone</label>
              <input type="tel" class="form-control" id="ob-rphone" value="${escapeHtml(r.phone || '')}" placeholder="04 78 00 00 00" data-ui="custom">
            </div>
            <div class="form-group" style="flex:1">
              <label for="ob-rcovers">Nombre de couverts</label>
              <input type="number" class="form-control" id="ob-rcovers" value="${r.covers || 30}" placeholder="30" min="1" inputmode="numeric" data-ui="custom">
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
        <div class="ob-icon" aria-hidden="true">🪑</div>
        <h2 class="ob-title" id="ob-dialog-title">Ma salle</h2>
        <p class="ob-desc">Configurez vos tables par zone</p>
        <div class="ob-form">
          <div role="tablist" aria-label="Mode de configuration des tables" style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4)">
            <button class="btn ${this.tableMode === 'quick' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="ob-mode-quick" role="tab" aria-selected="${this.tableMode === 'quick'}">Rapide</button>
            <button class="btn ${this.tableMode === 'advanced' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="ob-mode-advanced" role="tab" aria-selected="${this.tableMode === 'advanced'}">Avancé</button>
          </div>
          <div id="ob-tables-content" role="region" aria-label="Configuration des tables"></div>
        </div>
      </div>
    `;

    document.getElementById('ob-mode-quick').addEventListener('click', () => {
      this.tableMode = 'quick';
      this.renderTablesContent();
    });
    document.getElementById('ob-mode-advanced').addEventListener('click', () => {
      this.tableMode = 'advanced';
      this.renderTablesContent();
    });

    this.renderTablesContent();
    this.renderNavButtons(footer, true);
  }

  renderTablesContent() {
    const container = document.getElementById('ob-tables-content');
    if (!container) return;

    if (this.tableMode === 'quick') {
      container.innerHTML = `
        <div class="form-group">
          <label for="ob-salle-count">Salle — nombre de tables</label>
          <input type="number" class="form-control" id="ob-salle-count" value="${this._countZone('Salle')}" min="0" placeholder="0" inputmode="numeric" data-ui="custom">
        </div>
        <div class="form-group">
          <label for="ob-terrasse-count">Terrasse — nombre de tables</label>
          <input type="number" class="form-control" id="ob-terrasse-count" value="${this._countZone('Terrasse')}" min="0" placeholder="0" inputmode="numeric" data-ui="custom">
        </div>
        <div class="form-group">
          <label for="ob-bar-count">Bar — nombre de tables</label>
          <input type="number" class="form-control" id="ob-bar-count" value="${this._countZone('Bar')}" min="0" placeholder="0" inputmode="numeric" data-ui="custom">
        </div>
        <div class="form-group">
          <label for="ob-seats-default">Couverts par table (par défaut)</label>
          <input type="number" class="form-control" id="ob-seats-default" value="4" min="1" inputmode="numeric" data-ui="custom">
        </div>
      `;
    } else {
      container.innerHTML = `
        <div id="ob-adv-tables" role="list" aria-label="Tables configurées">
          ${this.tables.map((t, i) => this._renderTableRow(t, i)).join('')}
        </div>
        <button class="btn btn-ghost" id="ob-add-table" style="margin-top:var(--space-3)" aria-label="Ajouter une nouvelle table">+ Ajouter une table</button>
      `;

      document.getElementById('ob-add-table').addEventListener('click', () => {
        const nextNum = this.tables.length > 0 ? Math.max(...this.tables.map(t => t.table_number)) + 1 : 1;
        this.tables.push({ table_number: nextNum, zone: 'Salle', seats: 4 });
        this.renderTablesContent();
      });

      container.querySelectorAll('.ob-table-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          this.tables.splice(parseInt(btn.dataset.index), 1);
          this.renderTablesContent();
        });
      });
    }
  }

  _countZone(zone) {
    return this.tables.filter(t => t.zone === zone).length;
  }

  _renderTableRow(t, i) {
    return `
      <div role="listitem" style="display:flex;gap:var(--space-2);align-items:center;margin-bottom:var(--space-2)">
        <input type="number" class="form-control" style="width:60px" value="${t.table_number}" data-index="${i}" data-field="table_number" min="1" aria-label="Numéro de table" inputmode="numeric" data-ui="custom">
        <select class="form-control" style="flex:1" data-index="${i}" data-field="zone" aria-label="Zone" data-ui="custom">
          ${['Salle', 'Terrasse', 'Bar', 'Privé'].map(z => `<option value="${z}" ${t.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
        </select>
        <input type="number" class="form-control" style="width:60px" value="${t.seats}" data-index="${i}" data-field="seats" min="1" placeholder="4" aria-label="Couverts" inputmode="numeric" data-ui="custom">
        <button class="ob-table-delete" data-index="${i}" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:18px" aria-label="Supprimer la table ${t.table_number}">✕</button>
      </div>
    `;
  }

  _collectTablesFromQuick() {
    const salleCount = parseInt(document.getElementById('ob-salle-count')?.value) || 0;
    const terrasseCount = parseInt(document.getElementById('ob-terrasse-count')?.value) || 0;
    const barCount = parseInt(document.getElementById('ob-bar-count')?.value) || 0;
    const seats = parseInt(document.getElementById('ob-seats-default')?.value) || 4;

    const tables = [];
    let num = 1;
    for (let i = 0; i < salleCount; i++) tables.push({ table_number: num++, zone: 'Salle', seats });
    for (let i = 0; i < terrasseCount; i++) tables.push({ table_number: num++, zone: 'Terrasse', seats });
    for (let i = 0; i < barCount; i++) tables.push({ table_number: num++, zone: 'Bar', seats });
    return tables;
  }

  _collectTablesFromAdvanced() {
    const container = document.getElementById('ob-adv-tables');
    if (!container) return this.tables;

    container.querySelectorAll('input, select').forEach(el => {
      const idx = parseInt(el.dataset.index);
      const field = el.dataset.field;
      if (idx >= 0 && field && this.tables[idx]) {
        this.tables[idx][field] = field === 'zone' ? el.value : parseInt(el.value) || 1;
      }
    });
    return this.tables;
  }

  // ─── Step 4: Mon équipe ───
  renderStep4(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">👥</div>
        <h2 class="ob-title" id="ob-dialog-title">Mon équipe</h2>
        <p class="ob-desc">Ajoutez les membres de votre staff</p>

        <aside role="note" style="padding:var(--space-3);background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:var(--space-4);text-align:left">
          <div style="display:flex;align-items:flex-start;gap:var(--space-3)">
            <span style="font-size:1.3rem;line-height:1" aria-hidden="true">💡</span>
            <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5">
              <strong style="color:var(--text-primary)">Comment ça marche ?</strong><br>
              Votre staff se connecte avec le <strong>mot de passe équipe</strong> défini à l'inscription, puis sélectionne son nom et crée son <strong>code PIN personnel</strong> à sa première connexion.
            </div>
          </div>
        </aside>

        <h3 id="ob-members-heading" style="font-size:var(--text-base);margin-bottom:var(--space-2)">Membres de l'équipe</h3>
        <p style="font-size:var(--text-sm);color:var(--text-tertiary);margin-bottom:var(--space-3)">Ajoutez vos membres avec leur nom et rôle. Vous pourrez en ajouter d'autres plus tard.</p>
        <div id="ob-members-list" role="list" aria-labelledby="ob-members-heading"></div>
        <button class="btn btn-ghost" id="ob-add-member" style="margin-top:var(--space-3)" aria-label="Ajouter un nouveau membre à l'équipe">+ Ajouter un membre</button>
      </div>
    `;

    this.renderMembersList();

    document.getElementById('ob-add-member').addEventListener('click', () => {
      this.members.push({ name: '', role: 'cuisinier' });
      this.renderMembersList();
    });

    this.renderNavButtons(footer, true);
  }

  renderMembersList() {
    const container = document.getElementById('ob-members-list');
    if (!container) return;

    if (this.members.length === 0) {
      container.innerHTML = '<p style="color:var(--text-tertiary);font-size:var(--text-sm);text-align:center;padding:var(--space-4)">Aucun membre ajouté. Vous pourrez en ajouter plus tard.</p>';
      return;
    }

    container.innerHTML = this.members.map((m, i) => `
      <div role="listitem" style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <strong style="font-size:var(--text-sm)" id="ob-member-label-${i}">Membre ${i + 1}</strong>
          <button class="ob-member-delete" data-index="${i}" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:16px" aria-label="Supprimer le membre ${i + 1}">✕</button>
        </div>
        <div class="form-group" style="margin-bottom:var(--space-2)">
          <label for="ob-member-name-${i}" class="visually-hidden">Nom du membre ${i + 1}</label>
          <input type="text" id="ob-member-name-${i}" class="form-control" placeholder="Nom / surnom" value="${escapeHtml(m.name)}" data-index="${i}" data-field="name" data-ui="custom">
        </div>
        <div style="display:flex;gap:var(--space-2)">
          <label for="ob-member-role-${i}" class="visually-hidden">Rôle du membre ${i + 1}</label>
          <select id="ob-member-role-${i}" class="form-control ob-role-select" data-index="${i}" data-field="role" style="flex:1" data-ui="custom">
            <option value="cuisinier" ${m.role === 'cuisinier' ? 'selected' : ''}>👨‍🍳 Cuisinier</option>
            <option value="serveur" ${m.role === 'serveur' ? 'selected' : ''}>🍽️ Serveur</option>
            <option value="__custom__" ${!['cuisinier','serveur'].includes(m.role) && m.role ? 'selected' : ''}>✏️ Personnalisé…</option>
          </select>
          <input type="text" class="form-control ob-custom-role" data-index="${i}" data-field="custom_role" placeholder="Ex: Pâtissier" aria-label="Rôle personnalisé"
                 value="${escapeHtml(!['cuisinier','serveur','equipier',''].includes(m.role) ? m.role : '')}"
                 style="flex:1;${['cuisinier','serveur','equipier',''].includes(m.role) ? 'display:none' : ''}" data-ui="custom">
        </div>
      </div>
    `).join('');

    // Bind changes
    container.querySelectorAll('.ob-role-select').forEach(el => {
      el.addEventListener('change', () => {
        const idx = parseInt(el.dataset.index);
        const customInput = container.querySelector(`.ob-custom-role[data-index="${idx}"]`);
        if (el.value === '__custom__') {
          customInput.style.display = '';
          customInput.focus();
          this.members[idx].role = customInput.value || '';
        } else {
          customInput.style.display = 'none';
          this.members[idx].role = el.value;
        }
      });
    });
    container.querySelectorAll('.ob-custom-role').forEach(el => {
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.index);
        if (idx >= 0 && this.members[idx]) {
          this.members[idx].role = el.value;
        }
      });
    });
    container.querySelectorAll('input[data-field="name"]').forEach(el => {
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.index);
        if (idx >= 0 && this.members[idx]) {
          this.members[idx].name = el.value;
        }
      });
    });

    container.querySelectorAll('.ob-member-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        this.members.splice(parseInt(btn.dataset.index), 1);
        this.renderMembersList();
      });
    });
  }

  // ─── Step 5: Mes zones froides ───
  renderStep5(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">🌡️</div>
        <h2 class="ob-title" id="ob-dialog-title">Mes zones froides</h2>
        <p class="ob-desc">Configurez vos zones de température pour le HACCP</p>
        <div class="ob-zones" id="ob-zones-list" role="list" aria-label="Zones de température"></div>
        <button class="btn btn-ghost" id="ob-add-zone" style="margin-top:var(--space-3)" aria-label="Ajouter une nouvelle zone de température">+ Ajouter une zone</button>
      </div>
    `;

    this.renderZonesList();

    document.getElementById('ob-add-zone').addEventListener('click', () => {
      this.zones.push({ name: 'Nouvelle zone', type: 'fridge', min_temp: 0, max_temp: 4 });
      this.renderZonesList();
    });

    this.renderNavButtons(footer, true);
  }

  renderZonesList() {
    const container = document.getElementById('ob-zones-list');
    if (!container) return;

    container.innerHTML = this.zones.map((z, i) => `
      <div class="ob-zone-row" data-index="${i}" role="listitem">
        <input type="text" class="ob-zone-name" value="${escapeHtml(z.name)}" data-field="name" data-index="${i}" aria-label="Nom de la zone ${i + 1}" data-ui="custom">
        <div class="ob-zone-range">
          <input type="number" class="ob-zone-input" value="${z.min_temp}" data-field="min_temp" data-index="${i}" step="1" aria-label="Température minimum" inputmode="numeric" data-ui="custom">
          <span class="ob-zone-sep" aria-hidden="true">°C —</span>
          <input type="number" class="ob-zone-input" value="${z.max_temp}" data-field="max_temp" data-index="${i}" step="1" aria-label="Température maximum" inputmode="numeric" data-ui="custom">
          <span class="ob-zone-unit" aria-hidden="true">°C</span>
        </div>
        <button class="ob-zone-delete" data-index="${i}" title="Supprimer" aria-label="Supprimer la zone ${escapeHtml(z.name)}">✕</button>
      </div>
    `).join('');

    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.index);
        const field = input.dataset.field;
        if (field === 'name') this.zones[idx].name = input.value;
        else if (field === 'min_temp') this.zones[idx].min_temp = parseFloat(input.value);
        else if (field === 'max_temp') this.zones[idx].max_temp = parseFloat(input.value);
      });
    });

    container.querySelectorAll('.ob-zone-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        this.zones.splice(parseInt(btn.dataset.index), 1);
        this.renderZonesList();
      });
    });
  }

  // ─── Step 6: Mes fournisseurs ───
  renderStep6(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon" aria-hidden="true">🚚</div>
        <h2 class="ob-title" id="ob-dialog-title">Mes fournisseurs</h2>
        <p class="ob-desc">Ajoutez vos fournisseurs habituels (optionnel)</p>
        <div id="ob-suppliers-list" role="list" aria-label="Fournisseurs"></div>
        <button class="btn btn-ghost" id="ob-add-supplier" style="margin-top:var(--space-3)" aria-label="Ajouter un nouveau fournisseur">+ Ajouter un fournisseur</button>
      </div>
    `;

    this.renderSuppliersList();

    document.getElementById('ob-add-supplier').addEventListener('click', () => {
      this.suppliers.push({ name: '', contact: '', phone: '', email: '' });
      this.renderSuppliersList();
    });

    this.renderNavButtons(footer, true);
  }

  renderSuppliersList() {
    const container = document.getElementById('ob-suppliers-list');
    if (!container) return;

    if (this.suppliers.length === 0) {
      container.innerHTML = '<p style="color:var(--text-tertiary);font-size:var(--text-sm);text-align:center;padding:var(--space-4)">Aucun fournisseur ajouté. Vous pourrez en ajouter plus tard.</p>';
      return;
    }

    container.innerHTML = this.suppliers.map((s, i) => `
      <div role="listitem" style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <strong style="font-size:var(--text-sm)" id="ob-supplier-label-${i}">Fournisseur ${i + 1}</strong>
          <button class="ob-supplier-delete" data-index="${i}" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:16px" aria-label="Supprimer le fournisseur ${i + 1}">✕</button>
        </div>
        <div class="form-group" style="margin-bottom:var(--space-2)">
          <label for="ob-supplier-name-${i}" class="visually-hidden">Nom du fournisseur ${i + 1}</label>
          <input type="text" id="ob-supplier-name-${i}" class="form-control" placeholder="Nom de l'entreprise" value="${escapeHtml(s.name)}" data-index="${i}" data-field="name" data-ui="custom">
        </div>
        <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)">
          <input type="text" class="form-control" placeholder="Contact" value="${escapeHtml(s.contact)}" data-index="${i}" data-field="contact" style="flex:1" aria-label="Personne de contact" data-ui="custom">
          <input type="tel" class="form-control" placeholder="Téléphone" value="${escapeHtml(s.phone)}" data-index="${i}" data-field="phone" style="flex:1" aria-label="Téléphone" data-ui="custom">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <input type="email" class="form-control" placeholder="Email" value="${escapeHtml(s.email)}" data-index="${i}" data-field="email" aria-label="Email" data-ui="custom">
        </div>
      </div>
    `).join('');

    container.querySelectorAll('input').forEach(el => {
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.index);
        const field = el.dataset.field;
        if (idx >= 0 && field && this.suppliers[idx]) {
          this.suppliers[idx][field] = el.value;
        }
      });
    });

    container.querySelectorAll('.ob-supplier-delete').forEach(btn => {
      btn.addEventListener('click', () => {
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
      <div class="ob-step ob-finish" role="status" aria-live="polite">
        <div class="ob-icon" style="font-size:4rem" aria-hidden="true">🎉</div>
        <h2 class="ob-title" id="ob-dialog-title">Votre restaurant est configuré !</h2>
        <p class="ob-desc">Tout est prêt. Commencez à utiliser RestoSuite.</p>

        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-4);margin-top:var(--space-4);text-align:left;width:100%">
          <h3 style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-3)"><i data-lucide="clipboard-list" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Récapitulatif</h3>
          ${r.name ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Restaurant :</strong> ${escapeHtml(r.name)}</p>` : ''}
          ${r.city ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Ville :</strong> ${escapeHtml(r.city)}</p>` : ''}
          ${this.tables.length ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Tables :</strong> ${this.tables.length}</p>` : ''}
          ${this.members.length ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Équipe :</strong> ${this.members.length} membre(s)</p>` : ''}
          ${this.zones.length ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-1)"><strong>Zones froides :</strong> ${this.zones.length}</p>` : ''}
        </div>
      </div>
    `;

    footer.innerHTML = `
      <div class="ob-buttons ob-buttons--finish">
        <button class="btn btn-primary ob-btn-next" id="ob-finish" style="min-width:250px;padding:14px" aria-label="Terminer et accéder à l'application">
          <span aria-hidden="true">🚀</span> Accéder à RestoSuite
        </button>
      </div>
    `;

    document.getElementById('ob-finish').addEventListener('click', async () => {
      try {
        await API.saveOnboardingStep(7, {});
      } catch (e) { /* proceed anyway */ }
      this.complete();
    });
  }

  // ─── Navigation buttons ───
  renderNavButtons(footer, showBack) {
    footer.innerHTML = `
      <nav class="ob-buttons" aria-label="Navigation de la configuration">
        ${showBack ? '<button class="btn btn-ghost ob-btn-prev" id="ob-prev" aria-label="Retour à l\'étape précédente">← Retour</button>' : '<div></div>'}
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-ghost" id="ob-skip" aria-label="Passer cette étape">Passer</button>
          <button class="btn btn-primary ob-btn-next" id="ob-next" aria-label="Enregistrer et passer à l'étape suivante">Suivant →</button>
        </div>
      </nav>
    `;

    if (showBack) {
      document.getElementById('ob-prev').addEventListener('click', () => this.prev());
    }
    document.getElementById('ob-skip').addEventListener('click', () => this.skip());
    document.getElementById('ob-next').addEventListener('click', () => this.saveAndNext());
  }

  async saveAndNext() {
    const nextBtn = document.getElementById('ob-next');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = '...'; }

    try {
      await this.saveCurrentStep();
      this.next();
    } catch (e) {
      console.error('Save step error:', e);
      if (typeof showToast === 'function') showToast(e.message || 'Erreur de sauvegarde', 'error');
    } finally {
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Suivant →'; }
    }
  }

  async saveCurrentStep() {
    switch (this.step) {
      case 1: {
        const firstName = document.getElementById('ob-firstname')?.value || '';
        const lastName = document.getElementById('ob-lastname')?.value || '';
        const phone = document.getElementById('ob-phone')?.value || '';
        await API.saveOnboardingStep(1, { first_name: firstName, last_name: lastName, phone });
        // Update local data
        this.data.account = { ...this.data.account, first_name: firstName, last_name: lastName, phone };
        break;
      }
      case 2: {
        const data = {
          name: document.getElementById('ob-rname')?.value || '',
          type: document.getElementById('ob-rtype')?.value || '',
          address: document.getElementById('ob-raddress')?.value || '',
          city: document.getElementById('ob-rcity')?.value || '',
          postal_code: document.getElementById('ob-rpostal')?.value || '',
          phone: document.getElementById('ob-rphone')?.value || '',
          covers: parseInt(document.getElementById('ob-rcovers')?.value) || 30
        };
        await API.saveOnboardingStep(2, data);
        this.data.restaurant = { ...this.data.restaurant, ...data };
        break;
      }
      case 3: {
        if (this.tableMode === 'quick') {
          this.tables = this._collectTablesFromQuick();
        } else {
          this.tables = this._collectTablesFromAdvanced();
        }
        await API.saveOnboardingStep(3, { tables: this.tables });
        break;
      }
      case 4: {
        // Collect from DOM
        const container = document.getElementById('ob-members-list');
        if (container) {
          container.querySelectorAll('input, select').forEach(el => {
            const idx = parseInt(el.dataset.index);
            const field = el.dataset.field;
            if (idx >= 0 && field && this.members[idx]) {
              this.members[idx][field] = el.value;
            }
          });
        }
        const validMembers = this.members.filter(m => m.name && m.name.trim());
        await API.saveOnboardingStep(4, { members: validMembers });
        break;
      }
      case 5: {
        await API.saveOnboardingStep(5, { zones: this.zones });
        break;
      }
      case 6: {
        // Collect from DOM
        const container = document.getElementById('ob-suppliers-list');
        if (container) {
          container.querySelectorAll('input').forEach(el => {
            const idx = parseInt(el.dataset.index);
            const field = el.dataset.field;
            if (idx >= 0 && field && this.suppliers[idx]) {
              this.suppliers[idx][field] = el.value;
            }
          });
        }
        const validSuppliers = this.suppliers.filter(s => s.name && s.name.trim());
        await API.saveOnboardingStep(6, { suppliers: validSuppliers });
        break;
      }
    }
  }

  async skip() {
    // Save the step marker without data
    try {
      await API.saveOnboardingStep(this.step, this.step === 3 ? { tables: [] } : {});
    } catch (e) { /* continue anyway */ }
    this.next();
  }

  next() {
    if (this.step < this.totalSteps) {
      this.direction = 'next';
      this.step++;
      this.renderStep();
    }
  }

  prev() {
    if (this.step > 1) {
      this.direction = 'prev';
      this.step--;
      this.renderStep();
    }
  }

  complete() {
    // Update stored account with onboarding_step = 7
    try {
      const stored = JSON.parse(localStorage.getItem('restosuite_account') || '{}');
      stored.onboarding_step = 7;
      localStorage.setItem('restosuite_account', JSON.stringify(stored));
    } catch (e) { /* ignore */ }

    // Remove overlay with animation
    this.overlay.classList.remove('visible');
    setTimeout(() => {
      this.overlay.remove();
    }, 300);

    if (this.onComplete) this.onComplete();
  }
}

// Legacy compat
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
