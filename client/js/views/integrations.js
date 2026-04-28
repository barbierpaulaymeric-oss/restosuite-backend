// ═══════════════════════════════════════════
// Intégrations & Réservations
// ═══════════════════════════════════════════

const PROVIDER_META = {
  thefork: { name: 'TheFork / LaFourchette', icon: '🍴', color: '#00B37E', desc: 'Synchronisation des réservations TheFork en temps réel' },
  pos_caisse: { name: 'Caisse / POS', icon: '💳', color: '#3B82F6', desc: 'Connectez votre système de caisse pour synchroniser les ventes' },
  comptabilite: { name: 'Comptabilité', icon: '📊', color: '#8B5CF6', desc: 'Export automatique vers votre logiciel comptable (Pennylane, Cegid…)' },
  deliveroo: { name: 'Deliveroo', icon: '🛵', color: '#00CCBC', desc: 'Recevez les commandes Deliveroo directement dans RestoSuite' },
  ubereats: { name: 'Uber Eats', icon: '🥡', color: '#06C167', desc: 'Recevez les commandes Uber Eats directement dans RestoSuite' }
};

async function renderIntegrations() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="plug" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Intégrations
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Connectez TheFork, votre caisse, livraison, comptabilité</p>
    </div>

    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4)">
      <button class="btn btn-primary integ-tab active" data-tab="integrations" onclick="switchIntegTab('integrations')">Intégrations</button>
      <button class="btn btn-secondary integ-tab" data-tab="reservations" onclick="switchIntegTab('reservations')">Réservations</button>
    </div>

    <div id="integ-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadIntegrations();
}

function switchIntegTab(tab) {
  document.querySelectorAll('.integ-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.className = b.classList.contains('active') ? 'btn btn-primary integ-tab active' : 'btn btn-secondary integ-tab';
  });
  if (tab === 'integrations') loadIntegrations();
  else loadReservations();
}

async function loadIntegrations() {
  const content = document.getElementById('integ-content');
  try {
    const data = await API.request('/integrations');
    renderIntegrationsList(data);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function renderIntegrationsList(integrations) {
  const content = document.getElementById('integ-content');

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${integrations.map(integ => {
        const meta = PROVIDER_META[integ.provider] || { name: integ.provider, icon: '🔌', color: '#666', desc: '' };
        const enabled = integ.enabled;
        const statusLabel = enabled ? 'Connecté' : integ.has_credentials ? 'Configuré (désactivé)' : 'Non configuré';
        const statusColor = enabled ? 'var(--color-success)' : integ.has_credentials ? 'var(--color-warning)' : 'var(--text-tertiary)';

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
              ${integ.last_sync ? `<p class="text-secondary" style="font-size:10px;margin:4px 0 0">Dernière synchro : ${new Date(integ.last_sync).toLocaleString('fr-FR')}</p>` : ''}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="configureIntegration('${integ.provider}')" style="flex-shrink:0">
              ${enabled ? 'Gérer' : 'Configurer'}
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="card" style="padding:var(--space-3);margin-top:var(--space-4);background:rgba(59,130,246,0.05);border-color:rgba(59,130,246,0.2)">
      <p class="text-secondary text-sm" style="margin:0">
        💡 <strong>TheFork :</strong> RestoSuite s'intègre avec TheFork pour synchroniser vos réservations automatiquement.
        Contactez votre account manager TheFork pour obtenir vos clés API, puis configurez-les ici.
      </p>
    </div>
  `;
}

function configureIntegration(provider) {
  const meta = PROVIDER_META[provider] || { name: provider };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h2>Configurer ${meta.name}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Clé API</label>
          <input type="text" class="input" id="integ-api-key" placeholder="Votre clé API ${meta.name}" data-ui="custom">
        </div>
        <div class="form-group">
          <label class="label">Secret API (optionnel)</label>
          <input type="password" class="input" id="integ-api-secret" placeholder="Secret ou token" data-ui="custom">
        </div>
        <div class="form-group">
          <label class="label">URL Webhook (optionnel)</label>
          <input type="url" class="input" id="integ-webhook" placeholder="https://..." data-ui="custom">
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:var(--space-2)">
          <label class="toggle">
            <input type="checkbox" id="integ-enabled" checked>
            <span class="toggle-slider"></span>
          </label>
          <span>Activer l'intégration</span>
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
  try {
    await API.request(`/integrations/${provider}`, {
      method: 'PUT',
      body: {
        api_key: document.getElementById('integ-api-key').value || null,
        api_secret: document.getElementById('integ-api-secret').value || null,
        webhook_url: document.getElementById('integ-webhook').value || null,
        enabled: document.getElementById('integ-enabled').checked ? 1 : 0
      }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Intégration sauvegardée', 'success');
    loadIntegrations();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Reservations Tab ───

async function loadReservations() {
  const content = document.getElementById('integ-content');
  content.innerHTML = '<div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>';

  try {
    const today = new Date().toISOString().split('T')[0];
    const [reservations, stats] = await Promise.all([
      API.request(`/integrations/reservations?date=${today}`),
      API.request('/integrations/reservations/stats')
    ]);
    renderReservationsList(reservations, stats, today);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function renderReservationsList(reservations, stats, date) {
  const content = document.getElementById('integ-content');

  content.innerHTML = `
    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700">${stats.today_count}</div>
        <div class="text-secondary text-sm">Résa. aujourd'hui</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700">${stats.today_covers}</div>
        <div class="text-secondary text-sm">Couverts prévus</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700">${stats.week_count}</div>
        <div class="text-secondary text-sm">Cette semaine</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-2xl);font-weight:700;color:${stats.no_show_rate_pct > 10 ? 'var(--color-danger)' : 'var(--color-success)'}">${stats.no_show_rate_pct}%</div>
        <div class="text-secondary text-sm">No-show (30j)</div>
      </div>
    </div>

    <!-- Date selector + Add -->
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);align-items:center">
      <input type="date" id="resa-date" class="input" value="${date}" style="width:auto" onchange="changeResaDate()">
      <div style="flex:1"></div>
      <button class="btn btn-primary btn-sm" onclick="showAddReservation()">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Nouvelle résa.
      </button>
    </div>

    <!-- Reservations list -->
    ${reservations.length === 0 ? `
      <div class="card" style="padding:var(--space-4);text-align:center">
        <p class="text-secondary">Aucune réservation pour cette date</p>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${reservations.map(r => `
          <div class="card" style="padding:var(--space-3)">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div style="text-align:center;min-width:48px">
                <div style="font-size:var(--text-lg);font-weight:700">${r.reservation_time.slice(0, 5)}</div>
              </div>
              <div style="flex:1">
                <div style="font-weight:600">${escapeHtml(r.customer_name)}</div>
                <div class="text-secondary text-sm">
                  ${r.party_size} couvert${r.party_size > 1 ? 's' : ''}
                  ${r.table_number ? ` · Table ${r.table_number}` : ''}
                  ${r.source !== 'manual' ? ` · <span style="color:${r.source === 'thefork' ? '#00B37E' : 'var(--color-info)'}">via ${r.source}</span>` : ''}
                </div>
                ${r.notes ? `<div class="text-secondary" style="font-size:10px;margin-top:2px">${escapeHtml(r.notes)}</div>` : ''}
              </div>
              <div style="display:flex;gap:4px">
                <span style="padding:2px 8px;border-radius:12px;font-size:var(--text-xs);font-weight:600;background:${r.status === 'confirmed' ? 'rgba(22,163,74,0.1);color:#16A34A' : r.status === 'seated' ? 'rgba(59,130,246,0.1);color:#3B82F6' : r.status === 'completed' ? 'rgba(107,114,128,0.1);color:#6B7280' : 'rgba(239,68,68,0.1);color:#EF4444'}">${r.status === 'confirmed' ? 'Confirmé' : r.status === 'seated' ? 'Installé' : r.status === 'completed' ? 'Terminé' : 'Annulé'}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
  if (window.lucide) lucide.createIcons();
}

async function changeResaDate() {
  const date = document.getElementById('resa-date').value;
  const content = document.getElementById('integ-content');
  try {
    const [reservations, stats] = await Promise.all([
      API.request(`/integrations/reservations?date=${date}`),
      API.request('/integrations/reservations/stats')
    ]);
    renderReservationsList(reservations, stats, date);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function showAddReservation() {
  const date = document.getElementById('resa-date')?.value || new Date().toISOString().split('T')[0];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h2>Nouvelle réservation</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom du client *</label>
          <input type="text" class="input" id="resa-name" placeholder="Nom" required data-ui="custom">
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
            <input type="number" class="input" id="resa-party" value="2" min="1" max="50" data-ui="custom">
          </div>
          <div class="form-group">
            <label class="label">Téléphone</label>
            <input type="tel" class="input" id="resa-phone" placeholder="06..." data-ui="custom">
          </div>
        </div>
        <div class="form-group">
          <label class="label">Notes</label>
          <textarea class="input" id="resa-notes" rows="2" placeholder="Anniversaire, allergies, chaise bébé…" data-ui="custom"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveReservation()">Créer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('resa-name').focus();
}

async function saveReservation() {
  const name = document.getElementById('resa-name').value.trim();
  if (!name) return showToast('Nom requis', 'error');

  try {
    await API.request('/integrations/reservations', {
      method: 'POST',
      body: {
        customer_name: name,
        reservation_date: document.getElementById('resa-date-input').value,
        reservation_time: document.getElementById('resa-time').value,
        party_size: parseInt(document.getElementById('resa-party').value) || 2,
        customer_phone: document.getElementById('resa-phone').value || null,
        notes: document.getElementById('resa-notes').value || null,
        source: 'manual'
      }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Réservation créée', 'success');
    loadReservations();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
