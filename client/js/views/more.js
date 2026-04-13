class MoreView {
  render() {
    const app = document.getElementById('app');
    const account = getAccount();
    const role = account ? account.role : getRole();
    const isGerant = role === 'gerant';
    const showAdvanced = localStorage.getItem('restosuite_show_advanced') === 'true';

    app.innerHTML = `
      <div class="view-header">
        ${account ? `
        <div class="more-user-info">
          ${renderAvatar(account.name, 48)}
          <div>
            <h1>${escapeHtml(account.name)}</h1>
            <p class="text-secondary text-sm">${role === 'gerant' ? '👑 Gérant — Accès complet' : role === 'cuisinier' ? '👨‍🍳 Cuisinier' : role === 'salle' ? '🍽️ Salle' : '👤 Équipier'}</p>
          </div>
        </div>
        ` : `<h1>Paramètres</h1>`}
        <p class="text-secondary">Paramètres & configuration</p>
      </div>

      ${isGerant ? `
      <div style="margin-bottom:var(--space-4)">
        <a href="#/team" class="more-card more-card--active" style="text-decoration:none;cursor:pointer;display:flex;flex-direction:column">
          <div class="more-card__icon" style="background:var(--color-info)"><i data-lucide="users"></i></div>
          <div class="more-card__content"><h3>Gérer l'équipe</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">Comptes, permissions, accès par rôle</p>
        </a>
      </div>
      ` : ''}

      <div class="section-title" style="margin-top:var(--space-2);margin-bottom:var(--space-2);">⚙️ Configuration</div>
      <div class="more-grid">
        ${isGerant ? `
        <a href="#/integrations" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:#00B37E"><i data-lucide="plug"></i></div>
          <div class="more-card__content"><h3>Intégrations</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">TheFork, caisse, livraison, réservations</p>
        </a>
        <a href="#/qrcodes" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:var(--color-accent)"><i data-lucide="qr-code"></i></div>
          <div class="more-card__content"><h3>QR Codes Menu</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">Menu digital, commande client par QR code</p>
        </a>
        <a href="#/crm" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:#EC4899"><i data-lucide="heart"></i></div>
          <div class="more-card__content"><h3>CRM & Fidélité</h3><span class="badge badge--success">Actif</span></div>
          <p class="text-secondary text-sm">Clients, fidélité, VIP</p>
        </a>
        <a href="#/errors-log" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background:#DC2626"><i data-lucide="bug"></i></div>
          <div class="more-card__content"><h3>Journal d'erreurs</h3><span class="badge badge--error">Tech</span></div>
          <p class="text-secondary text-sm">Erreurs serveur et client en temps réel</p>
        </a>
        ` : ''}
      </div>

      ${isGerant ? `
      <div style="margin:var(--space-5) 0 var(--space-3)">
        <button id="btn-toggle-advanced" class="btn btn-secondary" style="width:100%;justify-content:center;gap:var(--space-2)">
          <i data-lucide="${showAdvanced ? 'eye-off' : 'eye'}" style="width:16px;height:16px"></i>
          ${showAdvanced ? 'Masquer les modules avancés' : 'Afficher les modules avancés'}
        </button>
      </div>
      <div id="advanced-modules" style="display:${showAdvanced ? 'block' : 'none'}">
        <div class="section-title" style="margin-bottom:var(--space-2);">🔬 Modules avancés</div>
        <div class="more-grid">
          <a href="#/multi-site" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:var(--color-info)"><i data-lucide="building-2"></i></div>
            <div class="more-card__content"><h3>Multi-Sites</h3><span class="badge badge--info">Avancé</span></div>
            <p class="text-secondary text-sm">Gérez plusieurs établissements</p>
          </a>
          <a href="#/api-keys" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:var(--color-primary)"><i data-lucide="key"></i></div>
            <div class="more-card__content"><h3>API Publique</h3><span class="badge badge--info">Avancé</span></div>
            <p class="text-secondary text-sm">Clés API, intégrations externes</p>
          </a>
          <a href="#/carbon" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:#16A34A"><i data-lucide="leaf"></i></div>
            <div class="more-card__content"><h3>Bilan Carbone</h3><span class="badge badge--info">Avancé</span></div>
            <p class="text-secondary text-sm">Empreinte CO₂ par recette, notation A→E</p>
          </a>
          <a href="#/supplier-portal" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
            <div class="more-card__icon" style="background:var(--color-primary-light)"><i data-lucide="truck"></i></div>
            <div class="more-card__content"><h3>Portail Fournisseur</h3><span class="badge badge--info">Avancé</span></div>
            <p class="text-secondary text-sm">Fournisseurs mettent à jour leurs catalogues</p>
          </a>
        </div>
      </div>
      ` : ''}

      <div class="section-title" style="margin-top:var(--space-6);">Préférences</div>
      <div class="setting-row">
        <span>🌙 Mode sombre</span>
        <label class="toggle">
          <input type="checkbox" id="themeToggle">
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="more-footer">
        <div style="text-align:center;margin-top:2rem">
          <button class="btn btn-secondary" id="btn-export-data" style="margin-bottom:1rem">
            <i data-lucide="download" style="width:18px;height:18px"></i> Exporter mes données
          </button>
          <br>
          <button class="btn btn-secondary" onclick="logout()" style="margin-bottom:1rem">
            <i data-lucide="log-out" style="width:18px;height:18px"></i> Se déconnecter
          </button>
          <p class="text-secondary text-sm">RestoSuite v1.0 — Votre cuisine tourne. Vos chiffres suivent.</p>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Advanced modules toggle
    const toggleBtn = document.getElementById('btn-toggle-advanced');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const newVal = localStorage.getItem('restosuite_show_advanced') !== 'true';
        localStorage.setItem('restosuite_show_advanced', String(newVal));
        new MoreView().render();
      });
    }

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.checked = document.documentElement.getAttribute('data-theme') !== 'light';
      themeToggle.addEventListener('change', () => {
        const theme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('restosuite_theme', theme);
      });
    }

    // RGPD data export
    const exportBtn = document.getElementById('btn-export-data');
    if (exportBtn && account) {
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i data-lucide="loader" style="width:18px;height:18px"></i> Export en cours…';
        try {
          const res = await fetch(`/api/accounts/${account.id}/export`);
          if (!res.ok) throw new Error('Erreur export');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `restosuite-export-${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Données exportées ✓', 'success');
        } catch (e) {
          showToast('Erreur lors de l\'export', 'error');
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<i data-lucide="download" style="width:18px;height:18px"></i> Exporter mes données';
          if (window.lucide) lucide.createIcons();
        }
      });
    }
  }
}
