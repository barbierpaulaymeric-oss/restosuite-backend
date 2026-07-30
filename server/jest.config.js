'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/helpers/env.js'],
  // Runs after the test framework is installed, so jest.retryTimes is available.
  setupFilesAfterEnv: ['./tests/helpers/retry.js'],
  testTimeout: 15000,
  verbose: true,
  // forceExit retiré (2026-07-30) : la suite sort proprement maintenant que les
  // clés externes sont neutralisées dans tests/helpers/env.js (plus de sockets
  // keep-alive Gemini/Stripe). Si un hang réapparaît, diagnostiquer avec
  // --detectOpenHandles plutôt que de remettre le contournement.
};
