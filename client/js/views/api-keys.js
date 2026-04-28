// ═══════════════════════════════════════════
// API Keys Management — Gestion des clés API
// ═══════════════════════════════════════════

async function renderAPIKeys() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/more" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="key" style="width:28px;height:28px;color:var(--color-accent)"></i>
        API Publique
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Gérez vos clés API pour intégrer RestoSuite avec vos outils</p>
    </div>
    <div id="apikeys-content">
      <div style="text-align:center;padding:var(--space-6)"><div class="loading-spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadAPIKeys();
}

async function loadAPIKeys() {
  const content = document.getElementById('apikeys-content');
  try {
    const [keys, docs] = await Promise.all([
      API.request('/public/keys'),
      API.request('/public/docs')
    ]);
    renderAPIKeysContent(keys, docs);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function renderAPIKeysContent(keys, docs) {
  const content = document.getElementById('apikeys-content');

  content.innerHTML = `
    <!-- API Documentation -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Documentation API</h3>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-3)">
        Base URL : <code style="background:var(--bg-sunken);padding:2px 6px;border-radius:4px">/api/public/v1</code> ·
        Auth : Header <code style="background:var(--bg-sunken);padding:2px 6px;border-radius:4px">X-API-Key</code>
      </p>
      <div style="overflow-x:auto">
        <table class="table" style="font-size:var(--text-sm)">
          <thead>
            <tr><th>Méthode</th><th>Endpoint</th><th>Description</th><th>Permission</th></tr>
          </thead>
          <tbody>
            ${docs.endpoints.map(e => `
              <tr>
                <td><span style="padding:2px 6px;border-radius:4px;font-size:var(--text-xs);font-weight:600;background:${e.method === 'GET' ? 'rgba(22,163,74,0.1);color:#16A34A' : 'rgba(59,130,246,0.1);color:#3B82F6'}">${e.method}</span></td>
                <td><code style="font-size:var(--text-xs)">${e.path}</code></td>
                <td>${e.description}</td>
                <td><span class="text-secondary text-sm">${e.permission}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- API Keys -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <h3>Clés API</h3>
      <button class="btn btn-primary btn-sm" onclick="showCreateAPIKey()">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Nouvelle clé
      </button>
    </div>

    ${keys.length === 0 ? `
      <div class="card" style="padding:var(--space-4);text-align:center">
        <p class="text-secondary">Aucune clé API créée</p>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${keys.map(k => `
          <div class="card" style="padding:var(--space-3)">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div style="flex:1">
                <div style="font-weight:600">${escapeHtml(k.key_name)}</div>
                <code style="font-size:var(--text-xs);background:var(--bg-sunken);padding:2px 6px;border-radius:4px">${k.api_key.slice(0, 12)}…${k.api_key.slice(-4)}</code>
                <div class="text-secondary" style="font-size:10px;margin-top:4px">
                  ${k.permissions.join(', ')} · ${k.request_count} requêtes
                  ${k.last_used ? ` · Dernière utilisation : ${new Date(k.last_used).toLocaleDateString('fr-FR')}` : ''}
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="copyAPIKey('${k.api_key}')">Copier</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--color-danger)" onclick="deleteAPIKey(${k.id})">Supprimer</button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
  if (window.lucide) lucide.createIcons();
}

function showCreateAPIKey() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:450px">
      <div class="modal-header">
        <h2>Nouvelle clé API</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="label">Nom de la clé *</label>
          <input type="text" class="input" id="key-name" placeholder="Ex: Site web, Caisse, TheFork" data-ui="custom">
        </div>
        <div class="form-group">
          <label class="label">Permissions</label>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <label style="display:flex;align-items:center;gap:var(--space-2)">
              <input type="checkbox" value="read" checked disabled data-ui="custom"> Lecture (toujours actif)
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2)">
              <input type="checkbox" id="perm-write" value="write" data-ui="custom"> Écriture (créer des commandes)
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" onclick="createAPIKey()">Générer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('key-name').focus();
}

async function createAPIKey() {
  const name = document.getElementById('key-name').value.trim();
  if (!name) return showToast('Nom requis', 'error');

  const perms = ['read'];
  if (document.getElementById('perm-write').checked) perms.push('write');

  try {
    const result = await API.request('/public/keys', {
      method: 'POST',
      body: { key_name: name, permissions: perms }
    });
    document.querySelector('.modal-overlay')?.remove();

    // Show the key (only time it's visible in full)
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h2>Clé API créée</h2>
        </div>
        <div class="modal-body">
          <p style="color:var(--color-warning);font-weight:600;margin-bottom:var(--space-3)">
            Copiez cette clé maintenant — elle ne sera plus affichée en entier.
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
    showToast(e.message, 'error');
  }
}

function copyAPIKey(key) {
  navigator.clipboard.writeText(key).then(() => {
    showToast('Clé copiée', 'success');
  }).catch(() => {
    showToast('Erreur copie', 'error');
  });
}

async function deleteAPIKey(id) {
  showConfirmModal('Supprimer la clé', 'Cette action est irréversible. Les intégrations utilisant cette clé ne fonctionneront plus.', async () => {
    try {
      await API.request(`/public/keys/${id}`, { method: 'DELETE' });
      showToast('Clé supprimée', 'success');
      loadAPIKeys();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
}
