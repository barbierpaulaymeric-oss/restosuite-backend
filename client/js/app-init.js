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
    navigator.serviceWorker.register('/sw.js').catch(function() {});
    // Listen for the SW's "sw-update" broadcast (fired from sw.js's activate
    // handler when a new cache name takes over). When the user is sitting on
    // the page with the OLD JS still in memory, this is the only way to make
    // them pick up the freshly deployed bundle without a manual reload.
    // Once-per-session guard: if the user just reloaded, ignore further
    // messages until the next session-storage gap.
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event && event.data && event.data.type === 'sw-update') {
        // Per-cache-name flag (was: per-session, which blocked reloads for
        // every SW bump after the first one in a long-lived tab — that's
        // why "restaurant names on order cards" stayed broken across
        // v3/v4 deploys for returning users). Each new CACHE_NAME now
        // forces exactly one reload.
        var key = '_sw_update_reloaded_' + (event.data.cache || 'unknown');
        try {
          if (sessionStorage.getItem(key) === '1') return;
          sessionStorage.setItem(key, '1');
        } catch (e) { /* incognito etc. — fall through to reload anyway */ }
        // Defer briefly so any in-flight click handler completes.
        setTimeout(function() { window.location.reload(); }, 50);
      }
    });
  }
});
