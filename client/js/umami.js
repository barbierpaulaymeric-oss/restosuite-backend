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

  var script = document.createElement('script');
  script.defer = true;
  script.src = UMAMI_URL.replace(/\/+$/, '') + '/script.js';
  script.setAttribute('data-website-id', WEBSITE_ID);
  document.head.appendChild(script);
})();
