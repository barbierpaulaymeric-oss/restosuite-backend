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

        <div class="more-card more-card--coming">
          <div class="more-card__icon" style="background: var(--color-primary-light)">
            <i data-lucide="shopping-cart"></i>
          </div>
          <div class="more-card__content">
            <h3>Commandes</h3>
            <span class="badge badge--warning">Bientôt</span>
          </div>
          <p class="text-secondary text-sm">Prise de commande tablette, tickets cuisine, suivi service</p>
        </div>

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

      <div class="more-footer">
        <div style="text-align:center; margin-top: 2rem;">
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
  }
}
