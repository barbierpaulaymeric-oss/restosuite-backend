'use strict';
// Tests métier des modules ES de l'app mobile (mobile/www/js) dans un VRAI
// navigateur : localStorage, événements online, fetch — sans device ni Capacitor.
// L'API prod (https://www.restosuite.fr/api) est interceptée par page.route :
// aucune requête ne sort. Les permissions caméra/micro natives ne sont pas
// testables ici : elles sont vérifiées via AndroidManifest/Info.plist (Phase 11).
const { test, expect } = require('@playwright/test');

const MOBILE_BASE = 'http://localhost:3106';
const API_GLOB = '**/www.restosuite.fr/api/**';

test.describe('modules mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Page hôte minimale du même origin que les modules.
    await page.goto(MOBILE_BASE + '/index.html');
    await page.evaluate(() => localStorage.clear());
  });

  test('router : route par défaut, navigation et query round-trip', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const router = await import('/js/router.js');
      const before = router.currentRoute().name;
      router.navigate('fiches', { q: 'tarte' });
      const after = router.currentRoute();
      return { before, name: after.name, q: after.query.get('q') };
    });
    expect(result.before).toBe('service');
    expect(result.name).toBe('fiches');
    expect(result.q).toBe('tarte');
  });

  test('store : cache offline round-trip et entrée corrompue', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const store = await import('/js/store.js');
      store.cacheSet('fiche-1', { name: 'Tarte', cost: 3.2 });
      const hit = store.cacheGet('fiche-1');
      localStorage.setItem('rs_cache_corrompu', '{pas du json');
      const corrupt = store.cacheGet('corrompu');
      return { value: hit && hit.value, hasTimestamp: !!(hit && hit.at), corrupt };
    });
    expect(result.value).toEqual({ name: 'Tarte', cost: 3.2 });
    expect(result.hasTimestamp).toBe(true);
    expect(result.corrupt).toBeNull();
  });

  test('auth : session, compte et déconnexion', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [auth, api] = await Promise.all([import('/js/auth.js'), import('/js/api.js')]);
      api.setToken('jwt-test');
      auth.setAccount && auth.setAccount({ id: 1, name: 'Chef' });
      const authedBefore = auth.isAuthed();
      auth.logout();
      return {
        authedBefore,
        authedAfter: auth.isAuthed(),
        tokenAfter: localStorage.getItem('restosuite_token'),
        accountAfter: auth.getAccount(),
      };
    });
    expect(result.authedBefore).toBe(true);
    expect(result.authedAfter).toBe(false);
    expect(result.tokenAfter).toBeNull();
    expect(result.accountAfter).toBeNull();
  });

  test('api : 401 avec token → session expirée + événement auth:expired', async ({ page }) => {
    await page.route(API_GLOB, (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"expired"}' })
    );
    const result = await page.evaluate(async () => {
      const api = await import('/js/api.js');
      api.setToken('jwt-perime');
      let expiredEvent = false;
      window.addEventListener('auth:expired', () => { expiredEvent = true; });
      let error = null;
      try { await api.API.get('/recipes'); } catch (e) { error = { code: e.code, message: e.message }; }
      return { error, expiredEvent, token: localStorage.getItem('restosuite_token') };
    });
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(result.expiredEvent).toBe(true);
    expect(result.token).toBeNull();
  });

  test('queue : réseau coupé → persistance, retour réseau → flush FIFO', async ({ page }) => {
    // Phase 1 : réseau mort — toutes les requêtes API échouent.
    await page.route(API_GLOB, (route) => route.abort('internetdisconnected'));

    const offline = await page.evaluate(async () => {
      const queue = await import('/js/queue.js');
      const r1 = await queue.queue.post('/haccp/temperatures', { zone: 'frigo 1', temp: 3 }, 'T° frigo 1');
      const r2 = await queue.queue.post('/haccp/temperatures', { zone: 'frigo 2', temp: 4 }, 'T° frigo 2');
      return { r1, r2, pending: queue.pendingCount(), raw: localStorage.getItem('rs_outbox_v1') };
    });
    expect(offline.r1).toEqual({ queued: true });
    expect(offline.r2).toEqual({ queued: true });
    expect(offline.pending).toBe(2);
    expect(offline.raw).toContain('frigo 1');

    // Phase 2 : le réseau revient — le serveur accepte, la file se vide en ordre.
    const served = [];
    await page.unroute(API_GLOB);
    await page.route(API_GLOB, async (route) => {
      served.push(JSON.parse(route.request().postData() || '{}').zone);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    const flushed = await page.evaluate(async () => {
      const queue = await import('/js/queue.js');
      return await queue.flush();
    });
    expect(flushed).toEqual({ flushed: 2, remaining: 0 });
    expect(served).toEqual(['frigo 1', 'frigo 2']); // FIFO
  });

  test('queue : une erreur métier (400) est droppée, pas bloquante', async ({ page }) => {
    await page.route(API_GLOB, (route) => route.abort('internetdisconnected'));
    await page.evaluate(async () => {
      const queue = await import('/js/queue.js');
      await queue.queue.post('/haccp/temperatures', { invalide: true }, 'op invalide');
      await queue.queue.post('/haccp/temperatures', { zone: 'ok', temp: 2 }, 'op valide');
    });

    await page.unroute(API_GLOB);
    let call = 0;
    await page.route(API_GLOB, (route) => {
      call++;
      route.fulfill({
        status: call === 1 ? 400 : 200,
        contentType: 'application/json',
        body: call === 1 ? '{"error":"payload invalide"}' : '{"ok":true}',
      });
    });

    const flushed = await page.evaluate(async () => (await import('/js/queue.js')).flush());
    // La 400 est droppée (loggée), la suivante passe : file vide, 1 seule réussie.
    expect(flushed).toEqual({ flushed: 1, remaining: 0 });
  });

  test('timers : création, décompte réel et arrêt', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const timers = await import('/js/timers.js');
      const id = timers.addTimer('Cuisson pâtes', 90);
      const t0 = timers.getTimers().find((t) => t.id === id);
      await new Promise((r) => setTimeout(r, 2100));
      const t1 = timers.getTimers().find((t) => t.id === id);
      timers.stopTimer(id);
      const gone = timers.getTimers().find((t) => t.id === id);
      return {
        total: t0.total, running: t0.running,
        remainingAfter: t1.remaining,
        clock: timers.fmtClock(90),
        removed: !gone || !gone.running,
      };
    });
    expect(result.total).toBe(90);
    expect(result.running).toBe(true);
    expect(result.remainingAfter).toBeLessThan(90);
    expect(result.clock).toBe('01:30');
    expect(result.removed).toBe(true);
  });
});
