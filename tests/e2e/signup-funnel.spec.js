'use strict';
// Smoke tests — funnel inscription → activation → intention d'abonnement.
const { test, expect } = require('@playwright/test');

test.describe.configure({ mode: 'serial' });

function uniqueEmail(tag) {
  return `e2e-${tag}-${Date.now()}@example.test`;
}

// Inscription minimale (2026-07-30) : nom du restaurant, email, mot de passe,
// confirmation, CGV. Plus de prénom/nom, plus de wizard 7 étapes forcé.
async function fillRegisterForm(page, email) {
  await expect(page.locator('#reg-restaurant-name')).toBeVisible();
  await page.locator('#reg-restaurant-name').fill('Le Bistrot E2E');
  await page.locator('#reg-email').fill(email);
  await page.locator('#reg-password').fill('MotDePasse1');
  await page.locator('#reg-password2').fill('MotDePasse1');
  // La checkbox native est recouverte par une coche stylisée (data-ui=custom)
  // qui intercepte les pointer events — force le clic sur l'input lui-même.
  await page.locator('#reg-terms').check({ force: true });
  await expect(page.locator('#reg-submit')).toBeEnabled();
  await page.locator('#reg-submit').click();
}

test('inscription minimale depuis le CTA landing → application directe (sans wizard)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'parcours vérifié en desktop');
  await page.goto('/');
  await page.locator('.hero__actions a.btn--primary').click();

  await fillRegisterForm(page, uniqueEmail('signup'));

  // L'app démarre DIRECTEMENT (plus de wizard) : nav visible + session persistée.
  await expect(page.locator('#nav')).toBeVisible({ timeout: 15000 });
  // Le hero « premier jour » invite à créer la première fiche (preuve qu'on va
  // directement au dashboard, sans wizard).
  await expect(page.locator('#first-day-heading')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#first-day-heading')).toContainText('première fiche');
  const token = await page.evaluate(() => localStorage.getItem('restosuite_token'));
  expect(token).toBeTruthy();
});

test('connexion d\'un compte existant → application directe', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'parcours vérifié en desktop');
  const email = uniqueEmail('login');
  const res = await request.post('/api/auth/register', {
    data: { email, password: 'MotDePasse1', restaurant_name: 'Resto Login', accepted_terms: true },
  });
  expect(res.ok()).toBeTruthy();

  await page.goto('/app');
  await page.locator('#btn-restaurant').click();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill('MotDePasse1');
  await page.locator('#login-submit').click();

  // onboarding_step=7 dès l'inscription → pas de wizard, l'app démarre.
  await expect(page.locator('#nav')).toBeVisible({ timeout: 15000 });
});

test('intention S\'abonner : reprise après inscription + erreur Stripe visible', async ({ page, isMobile }) => {
  test.skip(isMobile, 'parcours vérifié en desktop');
  await page.goto('/');

  // Clic sur le CTA tarif → aucune requête Stripe ne doit partir de la landing.
  const stripeCalls = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/stripe/')) stripeCalls.push(req.url());
  });
  await page.locator('#subscribe-btn').click();
  expect(stripeCalls).toEqual([]);

  // → inscription (intention mémorisée), app directe, reprise vers #/subscribe.
  await fillRegisterForm(page, uniqueEmail('subintent'));
  await expect(page.locator('#subscribe-now')).toBeVisible({ timeout: 15000 });
  expect(page.url()).toContain('#/subscribe');

  // Stripe est volontairement non configuré côté serveur E2E : l'erreur doit
  // être VISIBLE (plus de redirection silencieuse) et le bouton réactivé.
  await page.locator('#subscribe-now').click();
  await expect(page.locator('#subscribe-error')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#subscribe-now')).toBeEnabled();
  expect(page.url()).toContain('/app'); // toujours dans l'app, pas de redirect sauvage
});

test('CTA blog → inscription avec attribution d\'article', async ({ page, isMobile }) => {
  test.skip(isMobile, 'parcours vérifié en desktop');
  await page.goto('/blog/calcul-food-cost.html');
  const headerCta = page.locator('a.blog-header__cta');
  await expect(headerCta).toHaveAttribute('href', /src=blog&article=calcul-food-cost&pos=header#register/);
  await headerCta.click();
  await expect(page.locator('#reg-email')).toBeVisible({ timeout: 15000 });
});
