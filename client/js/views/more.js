class MoreView {
  render() {
    const app = document.getElementById('app');
    const account = getAccount();
    const isGerant = account && account.role === 'gerant';

    app.innerHTML = `
      <div class="view-header">
        ${account ? `
        <div class="more-user-info">
          ${renderAvatar(account.name, 48)}
          <div>
            <h1>${escapeHtml(account.name)}</h1>
            <p class="text-secondary text-sm">${account.role === 'gerant' ? '👑 Gérant — Accès complet' : '👤 Équipier'}</p>
          </div>
        </div>
        ` : `
        <h1>Plus</h1>
        `}
        <p class="text-secondary">Modules et paramètres</p>
      </div>

      ${isGerant ? `
      <div style="margin-bottom:var(--space-5)">
        <a href="#/team" class="more-card more-card--active" style="text-decoration:none;cursor:pointer;display:flex;flex-direction:column">
          <div class="more-card__icon" style="background: var(--color-info)">
            <i data-lucide="users"></i>
          </div>
          <div class="more-card__content">
            <h3>Gérer l'équipe</h3>
            <span class="badge badge--success">Actif</span>
          </div>
          <p class="text-secondary text-sm">Comptes, permissions, accès par rôle</p>
        </a>
      </div>
      ` : ''}

      <div class="more-grid">
        <div class="more-card more-card--active">
          <div class="more-card__icon" style="background: var(--color-accent)">
            <i data-lucide="clipboard-list"></i>
          </div>
          <div class="more-card__content">
            <h3>Fiches Techniques</h3>
            <span class="badge badge--success">Actif</span>
          </div>
          <p class="text-secondary text-sm">Saisie vocale, calcul des coûts, export PDF</p>
        </div>

        <a href="#/stock" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background: var(--color-accent)">
            <i data-lucide="warehouse"></i>
          </div>
          <div class="more-card__content">
            <h3>Stock & Réception</h3>
            <span class="badge badge--success">Actif</span>
          </div>
          <p class="text-secondary text-sm">Réception marchandise, suivi DLC, alertes stock bas</p>
        </a>

        <a href="#/ingredients" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background: var(--color-info)">
            <i data-lucide="package"></i>
          </div>
          <div class="more-card__content">
            <h3>Ingrédients</h3>
            <span class="badge badge--success">Actif</span>
          </div>
          <p class="text-secondary text-sm">Base de données ingrédients, allergènes, unités</p>
        </a>

        <a href="#/service" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background: var(--color-accent)">
            <i data-lucide="concierge-bell"></i>
          </div>
          <div class="more-card__content">
            <h3>Service (Salle)</h3>
            <span class="badge badge--success">Actif</span>
          </div>
          <p class="text-secondary text-sm">Prise de commande tablette, plan de salle, suivi service</p>
        </a>

        <a href="#/analytics" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background: var(--color-accent)">
            <i data-lucide="bar-chart-3"></i>
          </div>
          <div class="more-card__content">
            <h3>Analytics</h3>
            <span class="badge badge--success">Actif</span>
          </div>
          <p class="text-secondary text-sm">Food cost, marges, prédictions IA, insights fournisseurs</p>
        </a>

        <a href="#/haccp" class="more-card more-card--active" style="text-decoration:none;cursor:pointer">
          <div class="more-card__icon" style="background: var(--color-success)">
            <i data-lucide="shield-check"></i>
          </div>
          <div class="more-card__content">
            <h3>HACCP</h3>
            <span class="badge badge--success">Actif</span>
          </div>
          <p class="text-secondary text-sm">Relevés températures, plan de nettoyage, traçabilité, export PDF</p>
        </a>

        <div class="more-card more-card--coming">
          <div class="more-card__icon" style="background: var(--color-primary-light)">
            <i data-lucide="truck"></i>
          </div>
          <div class="more-card__content">
            <h3>Portail Fournisseur</h3>
            <span class="badge badge--warning">Bientôt</span>
          </div>
          <p class="text-secondary text-sm">Vos fournisseurs mettent à jour leurs catalogues et prix directement</p>
        </div>
      </div>

      <div class="section-title" style="margin-top: var(--space-6);">Préférences</div>
      <div class="setting-row">
        <span>🌙 Mode sombre</span>
        <label class="toggle">
          <input type="checkbox" id="themeToggle">
          <span class="toggle-slider"></span>
        </label>
      </div>

      ${isGerant ? `
      <div style="margin-top:var(--space-4);margin-bottom:var(--space-5)">
        <div class="card" style="padding:var(--space-4)">
          <h3 style="margin-bottom:var(--space-3)">🎁 Programme de parrainage</h3>
          <p class="text-secondary text-sm" style="margin-bottom:var(--space-3)">Partagez RestoSuite avec vos collègues !</p>
          <div id="referral-section">
            <p class="text-secondary text-sm">Chargement…</p>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="more-footer">
        <div style="text-align:center; margin-top: 2rem;">
          <button class="btn btn-secondary" id="btn-export-data" style="margin-bottom:1rem">
            <i data-lucide="download" style="width:18px;height:18px"></i> Exporter mes données
          </button>
          <br>
          <button class="btn btn-secondary" onclick="logout()" style="margin-bottom:1rem">
            <i data-lucide="log-out" style="width:18px;height:18px"></i> Se déconnecter
          </button>
          <p class="text-secondary text-sm">
            RestoSuite AI v1.0 — Votre cuisine tourne. Vos chiffres suivent.
          </p>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

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
          const today = new Date().toISOString().slice(0, 10);
          a.download = `restosuite-export-${today}.json`;
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

    // Referral section
    const referralSection = document.getElementById('referral-section');
    if (referralSection && account) {
      this.loadReferralData(account, referralSection);
    }
  }

  async loadReferralData(account, container) {
    try {
      const [codeRes, statsRes] = await Promise.all([
        fetch(`/api/referrals/my-code?account_id=${account.id}`),
        fetch(`/api/referrals/stats?account_id=${account.id}`)
      ]);
      const codeData = await codeRes.json();
      const statsData = await statsRes.json();

      const referralLink = `https://www.restosuite.fr/?ref=${codeData.code}`;

      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3);flex-wrap:wrap">
          <span class="text-sm">Votre code :</span>
          <code style="background:var(--bg-sunken);padding:6px 12px;border-radius:var(--radius-sm);font-weight:600;font-size:0.95rem">${escapeHtml(codeData.code)}</code>
          <button class="btn btn-sm btn-secondary" id="btn-copy-referral" style="padding:6px 12px;font-size:0.8rem">
            📋 Copier le lien
          </button>
        </div>
        <div class="text-secondary text-sm" style="margin-bottom:var(--space-2)">
          🎯 Parrainez un restaurateur → <strong>vous gagnez 1 mois gratuit</strong>
        </div>
        <div class="text-secondary text-sm" style="margin-bottom:var(--space-3)">
          🎁 Votre filleul gagne <strong>15 jours supplémentaires</strong>
        </div>
        <div class="text-sm">
          <span class="text-secondary">Parrainages effectués : </span><strong>${statsData.total_referrals}</strong>
          ${statsData.bonus_days > 0 ? ` · <span style="color:var(--color-success)">+${statsData.bonus_days} jours bonus</span>` : ''}
        </div>
      `;

      const copyBtn = document.getElementById('btn-copy-referral');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(referralLink);
            copyBtn.textContent = '✅ Copié !';
            setTimeout(() => { copyBtn.textContent = '📋 Copier le lien'; }, 2000);
          } catch (e) {
            // Fallback
            const input = document.createElement('input');
            input.value = referralLink;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            copyBtn.textContent = '✅ Copié !';
            setTimeout(() => { copyBtn.textContent = '📋 Copier le lien'; }, 2000);
          }
        });
      }
    } catch (e) {
      container.innerHTML = '<p class="text-secondary text-sm">Erreur lors du chargement du parrainage</p>';
    }
  }
}
