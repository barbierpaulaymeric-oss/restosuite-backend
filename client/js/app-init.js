// Loading screen — runs immediately so the indicator is ready before
// app.bundle.js is parsed. Hides once /api/health responds ok.
(function() {
  var screen = document.getElementById('loading-screen');
  var bar = document.getElementById('loading-bar');
  var text = document.getElementById('loading-text');
  var messages = ['Chargement...', 'Préparation de votre espace...', 'Connexion au serveur...', 'Presque prêt...'];
  var progress = 0, msgIndex = 0, shown = false;

  // Only show loading screen if server takes > 2s to respond
  var showTimer = setTimeout(function() {
    screen.style.display = 'flex';
    shown = true;
  }, 2000);

  var interval = setInterval(function() {
    progress = Math.min(progress + Math.random() * 15, 90);
    bar.style.width = progress + '%';
    if (progress > 25 * (msgIndex + 1) && msgIndex < messages.length - 1) {
      msgIndex++;
      text.textContent = messages[msgIndex];
    }
  }, 800);

  function hideScreen() {
    clearTimeout(showTimer);
    clearInterval(interval);
    if (shown) {
      bar.style.width = '100%';
      text.textContent = 'C\'est parti !';
      setTimeout(function() {
        screen.style.opacity = '0';
        screen.style.transition = 'opacity 0.3s';
        setTimeout(function() { screen.remove(); }, 300);
      }, 400);
    } else {
      screen.remove();
    }
  }

  function checkServer() {
    fetch('/api/health')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === 'ok') { hideScreen(); }
        else { setTimeout(checkServer, 2000); }
      })
      .catch(function() { setTimeout(checkServer, 2000); });
  }

  setTimeout(checkServer, 1000);
})();

// Post-load: Lucide icons + service worker — deferred until DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  if (window.lucide) lucide.createIcons();
  if ('serviceWorker' in navigator) {
    // hadController AVANT l'enregistrement : null ⇒ première visite (aucun SW
    // ne contrôlait la page) ⇒ on n'affiche PAS la bannière de mise à jour
    // quand le tout premier SW s'active. Non-null ⇒ vraie mise à jour.
    var hadController = !!navigator.serviceWorker.controller;

    // Migration : les anciens SW étaient enregistrés avec la portée « / » et
    // contrôlaient donc AUSSI la landing publique (qui se rechargeait à chaque
    // activation — Lighthouse/LCP dégradés pour un premier visiteur). On les
    // désenregistre, puis on enregistre le SW avec une portée limitée à /app :
    // seule l'application est contrôlée, la landing et le blog ne le sont plus.
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      var rootScope = new URL('/', window.location.href).href;
      return Promise.all(regs
        .filter(function(r) { return r.scope === rootScope; })
        .map(function(r) { return r.unregister().catch(function() {}); }));
    }).catch(function() {}).then(function() {
      return navigator.serviceWorker.register('/sw.js', { scope: '/app' });
    }).catch(function() {});

    // "sw-update" est diffusé par sw.js à l'activation d'un nouveau cache.
    // On ne recharge PLUS d'office (un reload pendant une saisie HACCP perdait
    // le formulaire en cours) : on affiche une notification discrète et c'est
    // l'utilisateur qui choisit le moment du rechargement.
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event && event.data && event.data.type === 'sw-update') {
        if (!hadController) return; // première installation, rien à mettre à jour
        showSwUpdateBanner(event.data.cache || 'unknown');
      }
    });
  }
});

// Bannière « Une mise à jour est disponible » — DOM pur (pas de dépendance au
// bundle, ce fichier se charge avant lui). Une seule à la fois ; « Plus tard »
// est mémorisé par version de cache pour la durée de la session.
function showSwUpdateBanner(cacheName) {
  var dismissKey = '_sw_update_dismissed_' + cacheName;
  try { if (sessionStorage.getItem(dismissKey) === '1') return; } catch (e) {}
  if (document.getElementById('sw-update-banner')) return;

  var banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom, 0px));z-index:9998;display:flex;align-items:center;gap:12px;background:#0F2E26;color:#EAF6EF;padding:10px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:Inter,-apple-system,sans-serif;font-size:14px;max-width:calc(100vw - 24px);';

  var label = document.createElement('span');
  label.textContent = 'Une mise à jour est disponible.';

  var reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.textContent = 'Recharger';
  reloadBtn.style.cssText = 'background:#1F7A4D;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:600;font-size:14px;cursor:pointer;';
  reloadBtn.addEventListener('click', function() { window.location.reload(); });

  var laterBtn = document.createElement('button');
  laterBtn.type = 'button';
  laterBtn.textContent = 'Plus tard';
  laterBtn.setAttribute('aria-label', 'Reporter la mise à jour');
  laterBtn.style.cssText = 'background:transparent;color:#EAF6EF;border:none;padding:8px 6px;font-size:14px;cursor:pointer;opacity:0.8;';
  laterBtn.addEventListener('click', function() {
    try { sessionStorage.setItem(dismissKey, '1'); } catch (e) {}
    banner.remove();
  });

  banner.appendChild(label);
  banner.appendChild(reloadBtn);
  banner.appendChild(laterBtn);
  document.body.appendChild(banner);
}
