// ═══════════════════════════════════════════
// Login / Role Selection
// ═══════════════════════════════════════════

class LoginView {
  constructor() {
    this.screen = 'landing'; // 'landing' | 'restaurant'
  }

  render() {
    const app = document.getElementById('app');
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';

    if (this.screen === 'restaurant') {
      this.renderRestaurantSelect(app);
    } else {
      this.renderLanding(app);
    }
  }

  renderLanding(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content">
          <div class="login-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" class="login-logo-svg">
              <path d="M40 6 L74 40 L40 74 L6 40 Z" fill="#E8722A" />
              <path d="M40 6 L24 24 L40 20 L56 24 Z" fill="#1B2A4A" />
              <path d="M6 40 L24 24 L40 20 L56 24 L74 40" fill="none" stroke="#1B2A4A" stroke-width="3" />
            </svg>
          </div>
          <h1 class="login-title">Resto<span class="text-accent">Suite</span> <span class="login-ai-badge">AI</span></h1>
          <p class="login-tagline">Votre cuisine tourne. Vos chiffres suivent.</p>

          <div class="login-buttons">
            <button class="login-btn login-btn--restaurant" id="btn-restaurant">
              <span class="login-btn__icon">🍽️</span>
              <span class="login-btn__text">
                <span class="login-btn__label">Restaurant</span>
                <span class="login-btn__sub">Gérer vos fiches et votre cuisine</span>
              </span>
            </button>
            <button class="login-btn login-btn--fournisseur" id="btn-fournisseur">
              <span class="login-btn__icon">🚚</span>
              <span class="login-btn__text">
                <span class="login-btn__label">Fournisseur</span>
                <span class="login-btn__sub">Catalogue et tarifs</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-restaurant').addEventListener('click', () => {
      this.screen = 'restaurant';
      this.render();
    });

    document.getElementById('btn-fournisseur').addEventListener('click', () => {
      this.selectRole('fournisseur');
    });
  }

  renderRestaurantSelect(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content">
          <button class="login-back" id="login-back">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
            Retour
          </button>
          <h2 class="login-subtitle">Qui êtes-vous ?</h2>
          <p class="login-tagline">Sélectionnez votre profil d'accès</p>

          <div class="login-buttons">
            <button class="login-btn login-btn--gerant" id="btn-gerant">
              <span class="login-btn__icon-lucide"><i data-lucide="crown"></i></span>
              <span class="login-btn__text">
                <span class="login-btn__label">Gérant</span>
                <span class="login-btn__sub">Accès complet — fiches, prix, fournisseurs</span>
              </span>
            </button>
            <button class="login-btn login-btn--equipier" id="btn-equipier">
              <span class="login-btn__icon-lucide"><i data-lucide="users"></i></span>
              <span class="login-btn__text">
                <span class="login-btn__label">Équipier</span>
                <span class="login-btn__sub">Consultation des fiches et ingrédients</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('login-back').addEventListener('click', () => {
      this.screen = 'landing';
      this.render();
    });

    document.getElementById('btn-gerant').addEventListener('click', () => {
      this.selectRole('gerant');
    });

    document.getElementById('btn-equipier').addEventListener('click', () => {
      this.selectRole('equipier');
    });
  }

  selectRole(role) {
    localStorage.setItem('restosuite_role', role);

    if (role === 'fournisseur') {
      this.renderFournisseurPage();
      return;
    }

    // Show nav and boot the app
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = '';
    bootApp(role);
  }

  renderFournisseurPage() {
    const app = document.getElementById('app');
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';

    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content">
          <div class="login-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" class="login-logo-svg" style="height:60px">
              <path d="M40 6 L74 40 L40 74 L6 40 Z" fill="#E8722A" />
              <path d="M40 6 L24 24 L40 20 L56 24 Z" fill="#1B2A4A" />
              <path d="M6 40 L24 24 L40 20 L56 24 L74 40" fill="none" stroke="#1B2A4A" stroke-width="3" />
            </svg>
          </div>
          <div class="fournisseur-coming">
            <i data-lucide="construction" style="width:48px;height:48px;color:var(--color-warning)"></i>
            <h2>Portail Fournisseur</h2>
            <p class="text-secondary">Bientôt disponible</p>
            <p class="text-secondary text-sm" style="max-width:320px;margin:0 auto">
              Vous pourrez bientôt mettre à jour vos catalogues et tarifs directement depuis cette interface.
            </p>
            <button class="btn btn-secondary" id="fournisseur-back" style="margin-top:1.5rem">
              <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Changer de profil
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('fournisseur-back').addEventListener('click', () => {
      localStorage.removeItem('restosuite_role');
      document.body.className = '';
      this.screen = 'landing';
      this.render();
    });
  }
}

// ─── Role utility ───
function getRole() {
  return localStorage.getItem('restosuite_role');
}

function applyRole(role) {
  document.body.className = role ? `role-${role}` : '';
}

function logout() {
  localStorage.removeItem('restosuite_role');
  document.body.className = '';
  location.hash = '';
  location.reload();
}
