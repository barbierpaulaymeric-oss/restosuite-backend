'use strict';
// Smoke tests E2E (Playwright) — parcours critiques du funnel.
// Lancer : npm run test:e2e   (installe d'abord : npx playwright install chromium)
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3105',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/e2e-server.js',
      port: 3105,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      // Sert mobile/www pour tester les modules ES de l'app Capacitor dans un
      // vrai navigateur (tests/e2e/mobile-modules.spec.js).
      command: 'node scripts/mobile-static-server.js',
      port: 3106,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
});
