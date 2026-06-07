'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Comptes de démonstration / test — liste partagée
// ═══════════════════════════════════════════════════════════════════════════
// Source de vérité unique pour les comptes démo/test, afin que le dashboard
// admin (qui les masque des listes et des stats) et le mailer de rétention (qui
// ne doit JAMAIS les relancer) appliquent EXACTEMENT la même exclusion. Avant,
// chaque module embarquait sa propre logique : le retention-mailer ne filtrait
// que les motifs « @test. » / « demo@ » et laissait passer marie@bistrot-marie.fr
// et kenji@sakura-paris.fr (comptes démo réels) → bounces sur des relances.
//
// On combine une liste explicite et des motifs pour attraper aussi les futurs
// comptes de test (n'importe quoi en @test.* ou demo@*).

const DEMO_EMAILS = [
  'demo@restosuite.fr',
  'marcdupontbrasserie@test.com',
  'marie@bistrot-marie.fr',
  'kenji@sakura-paris.fr',
];

// Vrai si `email` est un compte démo/test (liste explicite OU motif).
function isDemoEmail(email) {
  const e = (email || '').toLowerCase().trim();
  if (!e) return false;
  if (DEMO_EMAILS.includes(e)) return true;
  return e.includes('@test.') || e.startsWith('demo@');
}

// Condition SQL (positive) qui matche un compte démo à partir d'une colonne
// email, plus les paramètres associés. Même logique que isDemoEmail, côté base.
function demoMatchSql(col) {
  const placeholders = DEMO_EMAILS.map(() => '?').join(', ');
  return {
    sql: `(LOWER(${col}) IN (${placeholders}) OR LOWER(${col}) LIKE '%@test.%' OR LOWER(${col}) LIKE 'demo@%')`,
    params: DEMO_EMAILS.map(e => e.toLowerCase()),
  };
}

module.exports = { DEMO_EMAILS, isDemoEmail, demoMatchSql };
