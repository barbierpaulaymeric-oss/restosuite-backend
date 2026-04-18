// ═══════════════════════════════════════════
// CRM — Programme de fidélité & clients
// ═══════════════════════════════════════════

async function renderCRM() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section role="region" aria-label="CRM et programme de fidélité">
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)" aria-label="Retour à la page Plus">
        <i data-lucide="arrow-left" style="width:16px;height:16px" aria-hidden="true"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="heart" style="width:28px;height:28px;color:#EC4899" aria-hidden="true"></i>
        CRM & Fidélité
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Gérez vos clients, points de fidélité et récompenses</p>
    </div>

    <div role="tablist" aria-label="Onglets CRM" style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <button role="tab" aria-selected="true" class="btn btn-primary crm-tab active" data-tab="customers" onclick="switchCrmTab('customers')">Clients</button>
      <button role="tab" aria-selected="false" class="btn btn-secondary crm-tab" data-tab="rewards" onclick="switchCrmTab('rewards')">Récompenses</button>
      <button role="tab" aria-selected="false" class="btn btn-secondary crm-tab" data-tab="stats" onclick="switchCrmTab('stats')">Statistiques</button>
    </div>

    <div id="crm-content" role="tabpanel" aria-live="polite" aria-busy="true">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
    </section>
  `;
  if (window.lucide) lucide.createIcons();
  await loadCrmCustomers();
}

function switchCrmTab(tab) {
  document.querySelectorAll('.crm-tab').forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    b.className = active ? 'btn btn-primary crm-tab active' : 'btn btn-secondary crm-tab';
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (tab === 'customers') loadCrmCustomers();
  else if (tab === 'rewards') loadCrmRewards();
  else loadCrmStats();
}

async function loadCrmCustomers() {
  const content = document.getElementById('crm-content');
  try {
    const customers = await API.request('/crm/customers');
    renderCrmCustomers(customers);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function renderCrmCustomers(customers) {
  const content = document.getElementById('crm-content');

  content.innerHTML = `
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);align-items:center">
      <label for="crm-search" class="visually-hidden">Rechercher un client</label>
      <input type="search" class="input" id="crm-search" placeholder="Rechercher un client…" aria-label="Rechercher un client" style="flex:1" oninput="searchCrmCustomers()">
      <button class="btn btn-primary btn-sm" onclick="showAddCustomer()" aria-label="Ajouter un nouveau client">
        <i data-lucide="user-plus" style="width:16px;height:16px" aria-hidden="true"></i> Ajouter
      </button>
    </div>

    ${customers.length === 0 ? `
      <div class="card" style="padding:var(--space-6);text-align:center">
        <p style="font-size:1.5rem">👥</p>
        <p class="text-secondary">Aucun client enregistré</p>
        <button class="btn btn-primary" style="margin-top:var(--space-3)" onclick="showAddCustomer()">Ajouter votre premier client</button>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:var(--space-2)" id="crm-list">
        ${customers.map(c => renderCustomerCard(c)).join('')}
      </div>
    `}
  `;
  if (window.lucide) lucide.createIcons();
}

function renderCustomerCard(c) {
  return `
    <div class="card" role="button" tabindex="0" aria-label="Détails du client ${escapeHtml(c.name)}" style="padding:var(--space-3);cursor:pointer" onclick="showCustomerDetail(${c.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showCustomerDetail(${c.id});}">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        ${renderAvatar(c.name, 40)}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <span style="font-weight:600">${escapeHtml(c.name)}</span>
            ${c.vip ? '<span style="font-size:var(--text-xs);background:linear-gradient(135deg,#F59E0B,#EF4444);color:white;padding:1px 6px;border-radius:8px;font-weight:700">VIP</span>' : ''}
          </div>
          <div class="text-secondary text-sm">
            ${c.total_visits} visite${c.total_visits > 1 ? 's' : ''} · ${(c.total_spent || 0).toFixed(0)}€ dépensés
            ${c.phone ? ` · ${c.phone}` : ''}
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
  const search = document.getElementById('crm-search').value.trim();
  try {
    const customers = await API.request(`/crm/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    const list = document.getElementById('crm-list');
    if (list) {
      list.innerHTML = customers.map(c => renderCustomerCard(c)).join('');
    }
  } catch {}
}

function showAddCustomer() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h2>Nouveau client</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
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
            <label class="label">Téléphone</label>
            <input type="tel" class="input" id="cust-phone" placeholder="06 12 34 56 78">
          </div>
        </div>
        <div class="form-group">
          <label class="label">Date d'anniversaire</label>
          <input type="date" class="input" id="cust-birthday">
        </div>
        <div class="form-group">
          <label class="label">Notes</label>
          <textarea class="input" id="cust-notes" rows="2" placeholder="Préférences, allergies, table préférée…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveCustomer()">Créer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('cust-name').focus();
}

async function saveCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) return showToast('Nom requis', 'error');

  try {
    await API.request('/crm/customers', {
      method: 'POST',
      body: {
        name,
        email: document.getElementById('cust-email').value || null,
        phone: document.getElementById('cust-phone').value || null,
        birthday: document.getElementById('cust-birthday').value || null,
        notes: document.getElementById('cust-notes').value || null
      }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Client créé', 'success');
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function showCustomerDetail(id) {
  try {
    const c = await API.request(`/crm/customers/${id}`);
    const rewards = await API.request('/crm/rewards');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h2 style="display:flex;align-items:center;gap:var(--space-2)">
            ${escapeHtml(c.name)} ${c.vip ? '<span style="font-size:var(--text-xs);background:linear-gradient(135deg,#F59E0B,#EF4444);color:white;padding:2px 8px;border-radius:8px">VIP</span>' : ''}
          </h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
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
              <div style="font-size:var(--text-xl);font-weight:700">${(c.total_spent || 0).toFixed(0)}€</div>
              <div class="text-secondary text-sm">Dépensé</div>
            </div>
          </div>

          <!-- Contact -->
          <div style="margin-bottom:var(--space-3)">
            ${c.email ? `<p class="text-secondary text-sm">📧 ${escapeHtml(c.email)}</p>` : ''}
            ${c.phone ? `<p class="text-secondary text-sm">📱 ${escapeHtml(c.phone)}</p>` : ''}
            ${c.birthday ? `<p class="text-secondary text-sm">🎂 ${c.birthday}</p>` : ''}
            ${c.notes ? `<p class="text-secondary text-sm">📝 ${escapeHtml(c.notes)}</p>` : ''}
          </div>

          <!-- Quick actions -->
          <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4)">
            <button class="btn btn-primary btn-sm" onclick="recordVisit(${c.id})">Enregistrer une visite</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleVip(${c.id}, ${c.vip ? 0 : 1})">${c.vip ? 'Retirer VIP' : 'Passer VIP'}</button>
          </div>

          <!-- Available rewards -->
          ${rewards.length > 0 ? `
          <h4 style="margin-bottom:var(--space-2)">Récompenses disponibles</h4>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-3)">
            ${rewards.filter(r => r.is_active).map(r => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2);background:var(--bg-sunken);border-radius:var(--radius-md)">
                <div>
                  <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(r.name)}</span>
                  <span class="text-secondary text-sm">(${r.points_required} pts)</span>
                </div>
                ${c.loyalty_points >= r.points_required ?
                  `<button class="btn btn-primary btn-sm" onclick="redeemReward(${c.id}, ${r.id})">Utiliser</button>` :
                  `<span class="text-secondary text-sm">${r.points_required - c.loyalty_points} pts manquants</span>`
                }
              </div>
            `).join('')}
          </div>
          ` : ''}

          <!-- Recent transactions -->
          ${c.transactions && c.transactions.length > 0 ? `
          <h4 style="margin-bottom:var(--space-2)">Dernières transactions</h4>
          <div style="font-size:var(--text-sm)">
            ${c.transactions.slice(0, 10).map(t => `
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-light)">
                <span class="text-secondary">${t.description || t.type}</span>
                <span style="font-weight:600;color:${t.points >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${t.points >= 0 ? '+' : ''}${t.points} pts</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function recordVisit(customerId) {
  const amount = prompt('Montant de l\'addition (€) :');
  if (amount === null) return;
  const val = parseFloat(amount) || 0;

  try {
    const result = await API.request(`/crm/customers/${customerId}/visit`, {
      method: 'POST',
      body: { amount: val }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast(`Visite enregistrée : +${result.points_earned} points`, 'success');
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function toggleVip(id, vip) {
  try {
    await API.request(`/crm/customers/${id}`, { method: 'PUT', body: { vip } });
    document.querySelector('.modal-overlay')?.remove();
    showToast(vip ? 'Client VIP !' : 'VIP retiré', 'success');
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function redeemReward(customerId, rewardId) {
  try {
    const result = await API.request(`/crm/customers/${customerId}/redeem/${rewardId}`, { method: 'POST' });
    document.querySelector('.modal-overlay')?.remove();
    showToast(result.message, 'success');
    loadCrmCustomers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Rewards Tab ───

async function loadCrmRewards() {
  const content = document.getElementById('crm-content');
  try {
    const rewards = await API.request('/crm/rewards');
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h3>Récompenses fidélité</h3>
        <button class="btn btn-primary btn-sm" onclick="showAddReward()">
          <i data-lucide="gift" style="width:16px;height:16px"></i> Ajouter
        </button>
      </div>

      ${rewards.length === 0 ? `
        <div class="card" style="padding:var(--space-4);text-align:center">
          <p class="text-secondary">Aucune récompense configurée</p>
          <p class="text-secondary text-sm">Créez des paliers pour motiver vos clients fidèles</p>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${rewards.map(r => `
            <div class="card" style="padding:var(--space-3)">
              <div style="display:flex;align-items:center;gap:var(--space-3)">
                <div style="width:48px;height:48px;border-radius:12px;background:rgba(236,72,153,0.1);display:flex;align-items:center;justify-content:center;font-size:1.5rem">🎁</div>
                <div style="flex:1">
                  <div style="font-weight:600">${escapeHtml(r.name)}</div>
                  <div class="text-secondary text-sm">${r.description || ''}</div>
                  <div class="text-secondary" style="font-size:10px">${r.times_redeemed} fois utilisée</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:var(--text-lg);font-weight:700;color:#EC4899">${r.points_required}</div>
                  <div class="text-secondary" style="font-size:10px">points</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function showAddReward() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:450px">
      <div class="modal-header">
        <h2>Nouvelle récompense</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom *</label>
          <input type="text" class="input" id="reward-name" placeholder="Ex: Dessert offert">
        </div>
        <div class="form-group">
          <label class="label">Description</label>
          <input type="text" class="input" id="reward-desc" placeholder="Détails de la récompense">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <div class="form-group">
            <label class="label">Points nécessaires *</label>
            <input type="number" class="input" id="reward-points" value="100" min="1">
          </div>
          <div class="form-group">
            <label class="label">Type</label>
            <select class="input" id="reward-type">
              <option value="discount">Réduction</option>
              <option value="free_item">Produit offert</option>
              <option value="percentage">% de réduction</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="saveReward()">Créer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function saveReward() {
  const name = document.getElementById('reward-name').value.trim();
  if (!name) return showToast('Nom requis', 'error');

  try {
    await API.request('/crm/rewards', {
      method: 'POST',
      body: {
        name,
        description: document.getElementById('reward-desc').value || null,
        points_required: parseInt(document.getElementById('reward-points').value) || 100,
        reward_type: document.getElementById('reward-type').value
      }
    });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Récompense créée', 'success');
    loadCrmRewards();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Stats Tab ───

async function loadCrmStats() {
  const content = document.getElementById('crm-content');
  try {
    const stats = await API.request('/crm/stats');
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
          <div style="font-size:var(--text-2xl);font-weight:700">${stats.avg_spent_per_customer.toFixed(0)}€</div>
          <div class="text-secondary text-sm">Dépense moy.</div>
        </div>
      </div>

      ${stats.top_spenders.length > 0 ? `
      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-3)">
        <h3 style="margin-bottom:var(--space-3)">Top clients</h3>
        ${stats.top_spenders.map((c, i) => `
          <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) 0;${i < stats.top_spenders.length - 1 ? 'border-bottom:1px solid var(--border-light)' : ''}">
            <span style="font-weight:700;min-width:20px;color:var(--text-tertiary)">${i + 1}</span>
            <span style="flex:1;font-weight:500">${escapeHtml(c.name)} ${c.vip ? '⭐' : ''}</span>
            <span class="text-secondary text-sm">${c.total_visits} visites</span>
            <span style="font-weight:600">${(c.total_spent || 0).toFixed(0)}€</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${stats.recent_visitors.length > 0 ? `
      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Dernières visites</h3>
        ${stats.recent_visitors.map(c => `
          <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;font-size:var(--text-sm)">
            <span style="flex:1;font-weight:500">${escapeHtml(c.name)} ${c.vip ? '⭐' : ''}</span>
            <span class="text-secondary">${c.last_visit ? new Date(c.last_visit).toLocaleDateString('fr-FR') : '-'}</span>
            <span style="color:#EC4899;font-weight:600">${c.loyalty_points} pts</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
    `;
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
