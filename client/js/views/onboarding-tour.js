// ═══════════════════════════════════════════
// RestoSuite — Onboarding tour (first-login guided walkthrough)
// Shows a 5-step spotlight over the main nav items. Persisted via
// localStorage flag `restosuite_tour_v1_completed` so it runs once.
// Public API: startOnboardingTour(), maybeStartOnboardingTour()
// ═══════════════════════════════════════════

const TOUR_STORAGE_KEY = 'restosuite_tour_v1_completed';

const TOUR_STEPS = [
  {
    selector: '.nav-link[data-group="cuisine"]',
    title: 'Cuisine',
    body: 'Vos fiches techniques, ingrédients, stocks et réceptions. Tout ce que la brigade utilise au quotidien.',
    icon: '🍳',
  },
  {
    selector: '.nav-link[data-route="/haccp"]',
    title: 'HACCP',
    body: 'Températures, traçabilité, allergènes, nettoyage — votre classeur sanitaire DDPP numérique.',
    icon: '🛡️',
  },
  {
    selector: '.nav-link[data-group="pilotage"]',
    title: 'Pilotage',
    body: 'Analytics, menu engineering, prédictions IA et bilan carbone. Vos chiffres au clair.',
    icon: '📊',
  },
  {
    selector: '.nav-link[data-route="/ia"]',
    title: 'Alto, votre assistant IA',
    body: 'Génération de fiches, prise de notes vocales, suggestions de commandes — demandez, Alto exécute.',
    icon: '✨',
  },
  {
    selector: '.nav-link[data-group="config"]',
    title: 'Configuration',
    body: 'Équipe, fournisseurs, paramètres du restaurant. À paramétrer au calme quand vous avez un moment.',
    icon: '⚙️',
  },
];

function hasCompletedTour() {
  try { return localStorage.getItem(TOUR_STORAGE_KEY) === '1'; } catch { return false; }
}

function markTourCompleted() {
  try { localStorage.setItem(TOUR_STORAGE_KEY, '1'); } catch {}
}

// Only show the tour to the gérant, and only when we're on the main app
// (not redirected to /kitchen or /service), and only once.
function maybeStartOnboardingTour(account) {
  if (!account || account.role !== 'gerant') return;
  if (hasCompletedTour()) return;
  // Defer to next tick so the nav is mounted + icons are rendered.
  setTimeout(() => {
    // Re-check after async: account may have logged out in the meantime.
    if (!document.getElementById('nav')) return;
    startOnboardingTour();
  }, 500);
}

function startOnboardingTour() {
  // Remove any stale overlay from a previous aborted tour.
  const stale = document.getElementById('onboarding-tour-root');
  if (stale) stale.remove();

  // Only keep steps whose target is actually in the DOM (role-dependent nav).
  const visibleSteps = TOUR_STEPS.filter(s => document.querySelector(s.selector));
  if (visibleSteps.length === 0) {
    markTourCompleted();
    return;
  }

  const root = document.createElement('div');
  root.id = 'onboarding-tour-root';
  root.innerHTML = `
    <div class="tour-backdrop"></div>
    <div class="tour-spotlight"></div>
    <div class="tour-popover" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      <div class="tour-popover__step" id="tour-step-counter"></div>
      <h3 class="tour-popover__title" id="tour-title"></h3>
      <p class="tour-popover__body" id="tour-body"></p>
      <div class="tour-popover__dots" aria-hidden="true"></div>
      <div class="tour-popover__actions">
        <button type="button" class="tour-btn tour-btn--ghost" id="tour-skip">Passer</button>
        <button type="button" class="tour-btn tour-btn--primary" id="tour-next">Suivant</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  document.body.classList.add('tour-active');

  let idx = 0;

  const backdrop = root.querySelector('.tour-backdrop');
  const spotlight = root.querySelector('.tour-spotlight');
  const popover = root.querySelector('.tour-popover');
  const stepCounter = root.querySelector('#tour-step-counter');
  const titleEl = root.querySelector('#tour-title');
  const bodyEl = root.querySelector('#tour-body');
  const nextBtn = root.querySelector('#tour-next');
  const skipBtn = root.querySelector('#tour-skip');
  const dotsEl = root.querySelector('.tour-popover__dots');

  dotsEl.innerHTML = visibleSteps.map((_, i) => `<span class="tour-dot" data-i="${i}"></span>`).join('');

  function renderStep() {
    const step = visibleSteps[idx];
    const target = document.querySelector(step.selector);
    if (!target) { finish(); return; }

    const rect = target.getBoundingClientRect();
    const pad = 8;
    const x = rect.left - pad;
    const y = rect.top - pad;
    const w = rect.width + pad * 2;
    const h = rect.height + pad * 2;

    spotlight.style.left = x + 'px';
    spotlight.style.top = y + 'px';
    spotlight.style.width = w + 'px';
    spotlight.style.height = h + 'px';

    titleEl.textContent = `${step.icon} ${step.title}`;
    bodyEl.textContent = step.body;
    stepCounter.textContent = `Étape ${idx + 1} sur ${visibleSteps.length}`;
    nextBtn.textContent = (idx === visibleSteps.length - 1) ? 'Terminer' : 'Suivant';

    // Update dots
    dotsEl.querySelectorAll('.tour-dot').forEach((d, i) => {
      d.classList.toggle('tour-dot--active', i === idx);
    });

    // Position popover — try above the target first, fall back to below if no
    // room. On mobile (bottom nav), we'll always end up above.
    const popoverRect = popover.getBoundingClientRect();
    const popoverH = popoverRect.height || 180;
    const popoverW = popoverRect.width || 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top;
    if (rect.top > popoverH + 24) {
      top = rect.top - popoverH - 16;
    } else {
      top = rect.bottom + 16;
    }
    top = Math.max(16, Math.min(top, vh - popoverH - 16));

    let left = rect.left + rect.width / 2 - popoverW / 2;
    left = Math.max(16, Math.min(left, vw - popoverW - 16));

    popover.style.top = top + 'px';
    popover.style.left = left + 'px';

    // Focus the next button for keyboard users.
    nextBtn.focus();
  }

  function next() {
    if (idx < visibleSteps.length - 1) {
      idx++;
      renderStep();
    } else {
      finish();
    }
  }

  function finish() {
    markTourCompleted();
    document.body.classList.remove('tour-active');
    root.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
  }

  function onKey(e) {
    if (e.key === 'Escape') { finish(); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    }
  }

  function onResize() { renderStep(); }

  nextBtn.addEventListener('click', next);
  skipBtn.addEventListener('click', finish);
  backdrop.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);

  // First render — defer one frame so the popover's measured size is real.
  requestAnimationFrame(() => requestAnimationFrame(renderStep));
}

// Expose to global scope (IIFE-free bundle).
window.startOnboardingTour = startOnboardingTour;
window.maybeStartOnboardingTour = maybeStartOnboardingTour;
