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

// Stripe checkout (subscribe button)
var subscribeBtn = document.getElementById('subscribe-btn');
if (subscribeBtn) {
  subscribeBtn.addEventListener('click', function(e) {
    e.preventDefault();
    subscribeBtn.textContent = 'Redirection vers le paiement...';
    subscribeBtn.style.pointerEvents = 'none';
    fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: null })
    }).then(function(res) {
      return res.json();
    }).then(function(data) {
      window.location.href = data.url || '/app';
    }).catch(function() {
      window.location.href = '/app';
    });
  });
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
    header.style.background = window.scrollY > 20 ? '#0F1723' : 'rgba(15, 23, 35, 0.98)';
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

// Cookie banner
(function() {
  var consent = localStorage.getItem('rs_cookie_consent');
  if (!consent) {
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'flex';
  }
})();

function cookieChoice(accepted) {
  localStorage.setItem('rs_cookie_consent', accepted ? 'accepted' : 'refused');
  var banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}
