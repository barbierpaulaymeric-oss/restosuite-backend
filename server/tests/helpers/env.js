// Runs before each test file (jest setupFiles).
// Must set env vars before any module is required.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'restosuite-dev-secret-2026';
process.env.NODE_ENV = 'test';

// ─── Isolation des secrets locaux ───
// server/.env (chargé par dotenv au require d'app.js) contient de VRAIES clés
// (Gemini, Stripe). dotenv n'écrase jamais une variable déjà présente dans
// process.env, et ce fichier s'exécute avant tout require — poser '' ici
// garantit donc que les tests ne consomment aucun quota et ne dépendent pas du
// réseau, sur toutes les machines. Un test qui veut une clé (mockée) la pose
// explicitement en tête de son propre fichier (ex. tests/ai-contract.test.js).
process.env.GEMINI_API_KEY = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.STRIPE_PRICE_ID = '';
process.env.SENTRY_DSN = '';
process.env.MERCURIALE_EMAIL = '';
process.env.MERCURIALE_PASSWORD = '';

// ─── Garde réseau ───
// Défense en profondeur : même si un chemin de code atteint fetch() malgré les
// clés vides, aucune requête ne doit sortir vers Internet pendant les tests.
// Les tests qui mockent fetch (jest.spyOn/global.fetch = …) remplacent ce garde.
const _realFetch = global.fetch;
global.fetch = function guardedTestFetch(input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || String(input || '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/.test(url)) {
    return _realFetch(input, init);
  }
  return Promise.reject(new Error(`Requête réseau externe bloquée en test: ${url.slice(0, 120)}`));
};
