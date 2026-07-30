// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', function() {
  if (window.lucide) lucide.createIcons();
});

// Mobile menu toggle
var mobileToggle = document.getElementById('mobile-toggle');
var mobileMenu = document.getElementById('mobile-menu');

if (mobileToggle && mobileMenu) {
  mobileToggle.addEventListener('click', function() {
    var isOpen = mobileMenu.classList.toggle('open');
    mobileToggle.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
}

function closeMobile() {
  if (mobileMenu) mobileMenu.classList.remove('open');
  if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// FAQ accordion
function toggleFaq(btn) {
  var item = btn.parentElement;
  var wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(function(el) {
    el.classList.remove('open');
    el.querySelector('.faq-item__question').setAttribute('aria-expanded', 'false');
  });
  if (!wasOpen) {
    item.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

// Scroll reveal (IntersectionObserver)
var revealObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(function(el) { revealObserver.observe(el); });

// Fallback: force reveals visible after 2s
setTimeout(function() {
  document.querySelectorAll('.reveal').forEach(function(el) { el.classList.add('visible'); });
}, 2000);

// CTA S'abonner — parcours explicite, plus AUCUN appel Stripe depuis la landing
// (l'ancien POST /api/stripe/create-checkout non authentifié recevait un 401
// puis redirigeait silencieusement vers /app). Désormais :
//   - session existante → directement la page d'abonnement (#/subscribe) ;
//   - sinon → inscription (#register) avec intention « subscribe » mémorisée en
//     sessionStorage ; l'app reprend automatiquement vers #/subscribe après
//     inscription ou connexion (voir consumePostLoginIntent dans app.js).
// La création de la session Stripe Checkout n'a lieu QUE depuis la page
// authentifiée (views/subscribe.js), jamais d'ici.
var subscribeBtn = document.getElementById('subscribe-btn');
if (subscribeBtn) {
  subscribeBtn.addEventListener('click', function(e) {
    e.preventDefault();
    try { sessionStorage.setItem('rs_intent', 'subscribe'); } catch (err) {}
    var hasSession = false;
    try { hasSession = !!localStorage.getItem('restosuite_token'); } catch (err) {}
    window.location.href = hasSession ? '/app#/subscribe' : '/app#register';
  });
}

// Formulaire « Réserver une démo » — POST /api/demo (public). Validation légère
// côté client, erreurs visibles, bouton désactivé pendant l'envoi et réactivé
// en cas d'échec. L'accountId n'existe pas ici : c'est un prospect anonyme.
var demoForm = document.getElementById('demo-form');
if (demoForm) {
  demoForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var msg = document.getElementById('demo-form__msg');
    var btn = document.getElementById('demo-submit');
    var email = document.getElementById('demo-email').value.trim();
    var consent = document.getElementById('demo-consent').checked;

    function showMsg(text, kind) {
      msg.textContent = text;
      msg.className = kind === 'error' ? 'is-error' : 'is-success';
      msg.style.display = 'block';
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg('Merci d\'indiquer un email valide.', 'error');
      document.getElementById('demo-email').focus();
      return;
    }
    if (!consent) {
      showMsg('Merci de confirmer que nous pouvons vous recontacter.', 'error');
      return;
    }

    var payload = {
      first_name: document.getElementById('demo-firstname').value.trim(),
      last_name: document.getElementById('demo-lastname').value.trim(),
      restaurant: document.getElementById('demo-restaurant').value.trim(),
      phone: document.getElementById('demo-phone').value.trim(),
      email: email,
      website: document.getElementById('demo-website').value, // honeypot
      consent: true,
      source: 'landing'
    };

    btn.disabled = true;
    var originalText = btn.textContent;
    btn.textContent = 'Envoi…';
    msg.style.display = 'none';

    fetch('/api/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(res) {
      return res.json().then(function(data) { return { ok: res.ok, data: data }; });
    }).then(function(r) {
      if (r.ok) {
        demoForm.reset();
        showMsg((r.data && r.data.message) || 'Merci ! Nous vous recontactons très vite.', 'success');
        btn.textContent = 'Demande envoyée ✓';
        if (window.umami) { try { umami.track('demo_submitted'); } catch (err) {} }
      } else {
        showMsg((r.data && r.data.error) || 'Une erreur est survenue. Réessayez.', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }).catch(function() {
      showMsg('Impossible d\'envoyer la demande. Réessayez ou écrivez à contact@restosuite.fr.', 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    });
  });
}

// Migration service worker : les anciennes inscriptions avaient la portée « / »
// et contrôlaient la landing (rechargement forcé à chaque nouvelle version du
// cache). On les désenregistre ici ; le SW actuel est limité à /app et sera
// (ré)enregistré par app-init.js à la prochaine visite de l'application.
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    var rootScope = new URL('/', window.location.href).href;
    regs.forEach(function(reg) {
      if (reg.scope === rootScope) reg.unregister().catch(function() {});
    });
  }).catch(function() {});
}

// Sticky CTA: show only when hero CTA is not visible (mobile)
var heroActions = document.querySelector('.hero__actions');
var stickyCta = document.getElementById('sticky-cta');
if (heroActions && stickyCta) {
  var stickyObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        stickyCta.classList.remove('show');
      } else {
        stickyCta.classList.add('show');
      }
    });
  }, { threshold: 0 });
  stickyObserver.observe(heroActions);
}

// Header background on scroll
var header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', function() {
    header.style.background = window.scrollY > 20 ? '#FAF8F5' : 'rgba(250,248,245,0.98)';
  }, { passive: true });
}

// Hero video — auto-play + click to play/pause
var heroVideoWrapper = document.getElementById('hero-video-wrapper');
var heroVideo = document.getElementById('hero-video');

if (heroVideoWrapper && heroVideo) {
  var videoObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && heroVideo.paused) {
        heroVideo.play().then(function() {
          heroVideoWrapper.classList.add('playing');
        }).catch(function() {});
      } else if (!entry.isIntersecting) {
        heroVideo.pause();
        heroVideoWrapper.classList.remove('playing');
      }
    });
  }, { threshold: 0.4 });
  videoObserver.observe(heroVideoWrapper);

  heroVideoWrapper.addEventListener('click', function() {
    if (heroVideo.paused) {
      heroVideo.play().then(function() {
        heroVideoWrapper.classList.add('playing');
      }).catch(function() {});
    } else {
      heroVideo.pause();
      heroVideoWrapper.classList.remove('playing');
    }
  });

  heroVideo.addEventListener('play', function() { heroVideoWrapper.classList.add('playing'); });
  heroVideo.addEventListener('pause', function() { heroVideoWrapper.classList.remove('playing'); });
}

// Cookie banner — show on first visit. Deferred to DOMContentLoaded because this
// script tag sits just ABOVE the #cookie-banner markup in the DOM, so the element
// does not exist yet at parse time (it never showed before this guard).
function rsInitCookieBanner() {
  if (localStorage.getItem('rs_cookie_consent')) return; // visitor already chose
  var banner = document.getElementById('cookie-banner');
  if (!banner) return;
  // Afficher APRÈS le chargement des fontes : ancré en bas, le bandeau voyait
  // son texte se re-wrapper à l'arrivée d'Inter → son bord haut bougeait
  // (layout shift mesuré par Lighthouse). Filet 1,5 s si les fontes traînent.
  var shown = false;
  var reveal = function() {
    if (shown) return;
    shown = true;
    banner.style.display = 'flex';
  };
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(reveal).catch(reveal);
    setTimeout(reveal, 1500);
  } else {
    reveal();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', rsInitCookieBanner);
} else {
  rsInitCookieBanner();
}

function cookieChoice(accepted) {
  localStorage.setItem('rs_cookie_consent', accepted ? 'accepted' : 'refused');
  var banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
  // On acceptance, load audience measurement immediately (umami.js self-gates on
  // the same rs_cookie_consent flag, so this is the only place it gets kicked off
  // without waiting for the next page load). On refusal: nothing loads.
  if (accepted) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = '/js/umami.js';
    document.head.appendChild(s);
  }
}
