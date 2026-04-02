// ═══════════════════════════════════════════
// Onboarding Wizard — 5-step setup
// ═══════════════════════════════════════════

class OnboardingWizard {
  constructor(onComplete) {
    this.step = 1;
    this.totalSteps = 5;
    this.onComplete = onComplete;
    this.direction = 'next'; // 'next' | 'prev'
    this.featureSlide = 0;

    // Default zones
    this.zones = [
      { name: 'Frigo 1', min: 0, max: 4, enabled: true },
      { name: 'Frigo 2', min: 0, max: 4, enabled: true },
      { name: 'Congélateur', min: -25, max: -18, enabled: true },
      { name: 'Chambre froide', min: 0, max: 3, enabled: true },
    ];

    // Restaurant info
    this.restaurant = { name: '', type: '', covers: '', city: '' };
  }

  show() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    this.overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-progress">
          <div class="onboarding-progress-bar" id="ob-progress"></div>
        </div>
        <div class="onboarding-body" id="ob-body"></div>
        <div class="onboarding-footer" id="ob-footer"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    // Trigger entrance animation
    requestAnimationFrame(() => this.overlay.classList.add('visible'));
    this.renderStep();
  }

  renderStep() {
    const body = document.getElementById('ob-body');
    const footer = document.getElementById('ob-footer');
    const progress = document.getElementById('ob-progress');

    if (!body || !footer || !progress) return;

    progress.style.width = `${(this.step / this.totalSteps) * 100}%`;

    // Animate direction
    body.classList.remove('slide-in-left', 'slide-in-right');
    body.classList.add(this.direction === 'next' ? 'slide-in-right' : 'slide-in-left');

    switch (this.step) {
      case 1: this.renderWelcome(body, footer); break;
      case 2: this.renderRestaurant(body, footer); break;
      case 3: this.renderZones(body, footer); break;
      case 4: this.renderFeatures(body, footer); break;
      case 5: this.renderFinish(body, footer); break;
    }
  }

  renderWelcome(body, footer) {
    body.innerHTML = `
      <div class="ob-step ob-welcome">
        <div class="ob-icon"><img src="assets/logo.jpg" alt="RestoSuite" style="height: 64px; width: auto;"></div>
        <h2 class="ob-title">Bienvenue sur RestoSuite !</h2>
        <p class="ob-desc">Configurons votre restaurant en quelques minutes.</p>
      </div>
    `;
    footer.innerHTML = `
      <div class="ob-buttons">
        <div></div>
        <button class="btn btn-primary ob-btn-next" id="ob-next">Commencer →</button>
      </div>
    `;
    document.getElementById('ob-next').addEventListener('click', () => this.next());
  }

  renderRestaurant(body, footer) {
    const r = this.restaurant;
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">🏪</div>
        <h2 class="ob-title">Votre établissement</h2>
        <div class="ob-form">
          <div class="form-group">
            <label>Nom du restaurant</label>
            <input type="text" class="form-control" id="ob-rname" value="${escapeHtml(r.name)}" placeholder="ex: Chez Marcel">
          </div>
          <div class="form-group">
            <label>Type</label>
            <select class="form-control" id="ob-rtype">
              <option value="">— Choisir —</option>
              ${['Restaurant', 'Brasserie', 'Bistrot', 'Gastronomique', 'Fast-food', 'Traiteur', 'Autre']
                .map(t => `<option value="${t}" ${r.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Nombre de couverts</label>
            <input type="number" class="form-control" id="ob-rcovers" value="${r.covers}" placeholder="ex: 60" min="1">
          </div>
          <div class="form-group">
            <label>Ville</label>
            <input type="text" class="form-control" id="ob-rcity" value="${escapeHtml(r.city)}" placeholder="ex: Lyon">
          </div>
        </div>
      </div>
    `;
    footer.innerHTML = `
      <div class="ob-buttons">
        <button class="btn btn-ghost ob-btn-prev" id="ob-prev">← Retour</button>
        <button class="btn btn-primary ob-btn-next" id="ob-next">Suivant →</button>
      </div>
    `;
    document.getElementById('ob-prev').addEventListener('click', () => this.prev());
    document.getElementById('ob-next').addEventListener('click', () => {
      // Save form values
      this.restaurant.name = document.getElementById('ob-rname').value.trim();
      this.restaurant.type = document.getElementById('ob-rtype').value;
      this.restaurant.covers = document.getElementById('ob-rcovers').value;
      this.restaurant.city = document.getElementById('ob-rcity').value.trim();
      this.next();
    });
  }

  renderZones(body, footer) {
    body.innerHTML = `
      <div class="ob-step">
        <div class="ob-icon">🌡️</div>
        <h2 class="ob-title">Vos zones de température</h2>
        <p class="ob-desc">Pré-configurées pour le HACCP. Adaptez-les à votre cuisine.</p>
        <div class="ob-zones" id="ob-zones-list"></div>
        <button class="btn btn-ghost ob-add-zone" id="ob-add-zone">+ Ajouter une zone</button>
      </div>
    `;
    this.renderZonesList();

    document.getElementById('ob-add-zone').addEventListener('click', () => {
      this.zones.push({ name: 'Nouvelle zone', min: 0, max: 4, enabled: true });
      this.renderZonesList();
    });

    footer.innerHTML = `
      <div class="ob-buttons">
        <button class="btn btn-ghost ob-btn-prev" id="ob-prev">← Retour</button>
        <button class="btn btn-primary ob-btn-next" id="ob-next">Suivant →</button>
      </div>
    `;
    document.getElementById('ob-prev').addEventListener('click', () => this.prev());
    document.getElementById('ob-next').addEventListener('click', () => this.next());
  }

  renderZonesList() {
    const container = document.getElementById('ob-zones-list');
    if (!container) return;

    container.innerHTML = this.zones.map((z, i) => `
      <div class="ob-zone-row" data-index="${i}">
        <input type="text" class="ob-zone-name" value="${escapeHtml(z.name)}" data-field="name" data-index="${i}">
        <div class="ob-zone-range">
          <input type="number" class="ob-zone-input" value="${z.min}" data-field="min" data-index="${i}" step="1">
          <span class="ob-zone-sep">°C —</span>
          <input type="number" class="ob-zone-input" value="${z.max}" data-field="max" data-index="${i}" step="1">
          <span class="ob-zone-unit">°C</span>
        </div>
        <button class="ob-zone-delete" data-index="${i}" title="Supprimer">✕</button>
      </div>
    `).join('');

    // Bind change events
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.index);
        const field = input.dataset.field;
        if (field === 'name') this.zones[idx].name = input.value;
        else if (field === 'min') this.zones[idx].min = parseFloat(input.value);
        else if (field === 'max') this.zones[idx].max = parseFloat(input.value);
      });
    });

    // Bind delete
    container.querySelectorAll('.ob-zone-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.zones.splice(idx, 1);
        this.renderZonesList();
      });
    });
  }

  renderFeatures(body, footer) {
    const slides = [
      { icon: '🎤', title: 'Saisie Vocale', desc: 'Dictez vos recettes comme en cuisine. L\'IA comprend les termes culinaires.' },
      { icon: '📊', title: 'Food Cost Automatique', desc: 'Prix des ingrédients → coût matière → marge. Tout se calcule en temps réel.' },
      { icon: '🛡️', title: 'HACCP Intégré', desc: 'Relevés températures, plan de nettoyage, traçabilité. Prêt pour les contrôles.' },
      { icon: '📦', title: 'Gestion du Stock', desc: 'Réception marchandise, alertes stock bas, suivi DLC.' },
    ];

    const s = slides[this.featureSlide];

    body.innerHTML = `
      <div class="ob-step ob-features">
        <div class="ob-icon ob-icon--large">${s.icon}</div>
        <h2 class="ob-title">${s.title}</h2>
        <p class="ob-desc">${s.desc}</p>
        <div class="ob-dots">
          ${slides.map((_, i) => `<span class="ob-dot ${i === this.featureSlide ? 'active' : ''}" data-slide="${i}"></span>`).join('')}
        </div>
      </div>
    `;

    // Dot click handlers
    body.querySelectorAll('.ob-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        this.featureSlide = parseInt(dot.dataset.slide);
        this.renderFeatures(body, footer);
      });
    });

    footer.innerHTML = `
      <div class="ob-buttons">
        <button class="btn btn-ghost ob-btn-prev" id="ob-prev">← Retour</button>
        <button class="btn btn-primary ob-btn-next" id="ob-next">${this.featureSlide < slides.length - 1 ? 'Suivant →' : 'Suivant →'}</button>
      </div>
    `;
    document.getElementById('ob-prev').addEventListener('click', () => {
      if (this.featureSlide > 0) {
        this.featureSlide--;
        this.renderFeatures(body, footer);
      } else {
        this.prev();
      }
    });
    document.getElementById('ob-next').addEventListener('click', () => {
      if (this.featureSlide < slides.length - 1) {
        this.featureSlide++;
        this.renderFeatures(body, footer);
      } else {
        this.next();
      }
    });
  }

  renderFinish(body, footer) {
    body.innerHTML = `
      <div class="ob-step ob-finish">
        <div class="ob-icon">✅</div>
        <h2 class="ob-title">Votre restaurant est configuré !</h2>
        <p class="ob-desc">Commencez par créer votre première fiche technique.<br>Appuyez sur le micro et dictez votre recette.</p>
      </div>
    `;
    footer.innerHTML = `
      <div class="ob-buttons ob-buttons--finish">
        <button class="btn btn-primary ob-btn-next" id="ob-create">Créer ma première fiche →</button>
        <button class="btn btn-ghost" id="ob-explore">Explorer l'app →</button>
      </div>
    `;
    document.getElementById('ob-create').addEventListener('click', () => {
      this.complete();
      location.hash = '#/new';
    });
    document.getElementById('ob-explore').addEventListener('click', () => {
      this.complete();
      location.hash = '#/';
    });
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
    // Save restaurant info
    if (this.restaurant.name || this.restaurant.type) {
      localStorage.setItem('restosuite_restaurant', JSON.stringify(this.restaurant));
    }

    // Save zones (for future HACCP use)
    const enabledZones = this.zones.filter(z => z.enabled);
    if (enabledZones.length > 0) {
      localStorage.setItem('restosuite_zones', JSON.stringify(enabledZones));
    }

    // Mark onboarding as done
    localStorage.setItem('restosuite_onboarding_done', 'true');

    // Remove overlay with animation
    this.overlay.classList.remove('visible');
    setTimeout(() => {
      this.overlay.remove();
    }, 300);

    if (this.onComplete) this.onComplete();
  }
}

// Check if onboarding should show after gérant account creation
function shouldShowOnboarding() {
  return !localStorage.getItem('restosuite_onboarding_done');
}

function showOnboardingIfNeeded(callback) {
  if (shouldShowOnboarding()) {
    const wizard = new OnboardingWizard(callback);
    wizard.show();
    return true;
  }
  return false;
}
