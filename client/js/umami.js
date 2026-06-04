/**
 * RestoSuite — chargeur Umami (analytics self-hosted, RGPD-friendly, sans cookie).
 *
 * POUR ACTIVER : une fois Umami déployé sur Render et le site « restosuite.fr »
 * créé dans le dashboard Umami, remplacer les deux constantes ci-dessous par :
 *   - UMAMI_URL    : l'URL du service Render (ex. https://restosuite-analytics.onrender.com)
 *   - WEBSITE_ID   : l'identifiant du site fourni par Umami (UUID, ex. 1a2b3c4d-...)
 *
 * C'est le SEUL fichier à modifier : il est chargé par la landing, le blog et l'app.
 * Tant que les placeholders ne sont pas remplacés, le script ne charge rien
 * (aucune requête réseau cassée).
 */
(function () {
  'use strict';

  var UMAMI_URL = 'https://restosuite-analytics.onrender.com';
  var WEBSITE_ID = 'd90b73e4-de98-40eb-9deb-46e9c3258af9';

  // Pas encore configuré → on ne charge rien.
  if (UMAMI_URL.indexOf('PLACEHOLDER') !== -1 || WEBSITE_ID.indexOf('PLACEHOLDER') !== -1) {
    return;
  }

  var SCRIPT_SRC = UMAMI_URL.replace(/\/+$/, '') + '/script.js';
  var MAX_RETRIES = 2;     // tentatives supplémentaires après le 1er échec
  var RETRY_DELAY = 5000;  // 5 s — laisse le temps au service Render de se réveiller

  // Render (plan Starter) peut renvoyer un 503 le temps de sortir de veille :
  // le <script> échoue alors silencieusement et le tracking est perdu.
  // On réessaie donc jusqu'à MAX_RETRIES fois avant d'abandonner.
  function loadScript(attempt) {
    var script = document.createElement('script');
    script.defer = true;
    script.async = true;
    // Cache-buster sur les retries pour éviter qu'un 503 reste en cache.
    script.src = attempt > 0 ? SCRIPT_SRC + '?retry=' + attempt : SCRIPT_SRC;
    script.setAttribute('data-website-id', WEBSITE_ID);
    script.onerror = function () {
      script.parentNode && script.parentNode.removeChild(script);
      if (attempt < MAX_RETRIES) {
        setTimeout(function () { loadScript(attempt + 1); }, RETRY_DELAY);
      }
    };
    document.head.appendChild(script);
  }

  loadScript(0);
})();
