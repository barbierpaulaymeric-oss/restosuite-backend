'use strict';
// ═══════════════════════════════════════════
// Événements produit agrégés — funnel serveur (table product_events).
//
// Complète Umami (client, soumis au consentement) par des vérités serveur
// agrégeables : account_created, first_recipe, activated, checkout_started,
// paid… Volontairement minimal côté données : AUCUN email/nom/téléphone,
// uniquement des identifiants internes et une source d'acquisition courte.
// Best-effort : un échec d'insertion ne doit jamais casser l'appelant.
// ═══════════════════════════════════════════
const { run } = require('../db');

function recordProductEvent(event, { accountId = null, restaurantId = null, source = null } = {}) {
  try {
    run(
      'INSERT INTO product_events (event, account_id, restaurant_id, source) VALUES (?, ?, ?, ?)',
      [String(event).slice(0, 40), accountId, restaurantId, source ? String(source).slice(0, 80) : null]
    );
  } catch (e) {
    // best-effort — la mesure ne doit jamais faire échouer le parcours métier
  }
}

module.exports = { recordProductEvent };
