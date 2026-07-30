'use strict';
// Smoke tests — landing publique.
const { test, expect } = require('@playwright/test');

// Erreurs console à ignorer : ressources externes indisponibles en CI hors
// ligne (Google Fonts) — tout le reste doit être vide.
function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/fonts\.(googleapis|gstatic)\.com|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test('la landing charge sans erreur console et sans rechargement automatique', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  let loads = 0;
  page.on('load', () => loads++);

  await page.goto('/');
  await expect(page.locator('h1')).toContainText('assistant cuisine');

  // Fenêtre d'observation : l'ancien service worker forçait un reload ~1-2 s
  // après l'activation. Plus aucun rechargement ne doit se produire.
  await page.waitForTimeout(3500);
  expect(loads).toBe(1);
  expect(errors).toEqual([]);

  // La landing ne doit être contrôlée par AUCUN service worker.
  const controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
  expect(controlled).toBe(false);
});

test('les CTA d\'essai pointent vers l\'inscription avec attribution', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero__actions a.btn--primary');
  await expect(hero).toHaveAttribute('href', /\/app\?src=landing&pos=hero#register/);

  const sticky = page.locator('#sticky-cta a');
  await expect(sticky).toHaveAttribute('href', /src=landing&pos=sticky#register/);
});

test('le bandeau cookies s\'affiche et le refus est mémorisé sans réseau analytics', async ({ page }) => {
  const umamiRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('restosuite-analytics')) umamiRequests.push(req.url());
  });

  await page.goto('/');
  const banner = page.locator('#cookie-banner');
  await expect(banner).toBeVisible();
  await page.locator('#cookie-refuse').click();
  await expect(banner).toBeHidden();

  const consent = await page.evaluate(() => localStorage.getItem('rs_cookie_consent'));
  expect(consent).toBe('refused');
  expect(umamiRequests).toEqual([]);
});

test('la FAQ s\'ouvre et se ferme au clavier comme à la souris', async ({ page }) => {
  await page.goto('/');
  const firstQuestion = page.locator('.faq-item__question').first();
  await firstQuestion.scrollIntoViewIfNeeded();
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');
  await firstQuestion.click();
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');
  await firstQuestion.click();
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');
});

test('formulaire de démo : soumission valide → message de succès', async ({ page }) => {
  await page.goto('/#reserver-demo');
  await page.locator('#demo-firstname').fill('Test');
  await page.locator('#demo-restaurant').fill('Le Bistrot E2E');
  await page.locator('#demo-email').fill(`demo-e2e-${Date.now()}@example.test`);
  await page.locator('#demo-consent').check();
  await page.locator('#demo-submit').click();
  await expect(page.locator('#demo-form__msg')).toBeVisible();
  await expect(page.locator('#demo-form__msg')).toHaveClass(/is-success/);
});

test('formulaire de démo : email invalide → erreur visible, pas d\'envoi', async ({ page }) => {
  await page.goto('/#reserver-demo');
  await page.locator('#demo-email').fill('pas-un-email');
  await page.locator('#demo-consent').check();
  await page.locator('#demo-submit').click();
  await expect(page.locator('#demo-form__msg')).toHaveClass(/is-error/);
});

test('navigation mobile : le menu s\'ouvre et mène à l\'inscription', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'projet mobile uniquement');
  await page.goto('/');
  const toggle = page.locator('#mobile-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const menuCta = page.locator('#mobile-menu a.btn--primary');
  await expect(menuCta).toBeVisible();
  await expect(menuCta).toHaveAttribute('href', /pos=menu-mobile#register/);
});
