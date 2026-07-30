'use strict';
// Non-régression XSS : les données utilisateur rendues via innerHTML doivent
// être échappées. On teste le helper escapeHtml (contrat de sortie) chargé
// depuis le bundle réel, sur les vecteurs des sinks corrigés.
const { test, expect } = require('@playwright/test');

test.describe('escapeHtml — non-régression XSS', () => {
  test.beforeEach(async ({ page }) => {
    // La SPA charge le bundle où escapeHtml est défini (client/js/api.js).
    await page.goto('http://localhost:3105/app');
    await page.waitForFunction(() => typeof window.escapeHtml === 'function', { timeout: 15000 });
  });

  test('neutralise les balises et les guillemets (contexte texte + attribut)', async ({ page }) => {
    const out = await page.evaluate(() => {
      const f = window.escapeHtml;
      return {
        script: f('<script>alert(1)</script>'),
        img: f('<img src=x onerror=alert(1)>'),
        attr: f('" onmouseover="alert(1)'),
        singleQuote: f("');alert(1);//"),
        number: f(42),
        nullVal: f(null),
        undef: f(undefined),
        amp: f('Ben & Jerry'),
      };
    });
    expect(out.script).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out.img).not.toContain('<');
    expect(out.img).not.toContain('>');
    expect(out.attr).not.toContain('"');
    expect(out.singleQuote).not.toContain("'");
    expect(out.number).toBe('42');
    expect(out.nullVal).toBe('');
    expect(out.undef).toBe('');
    expect(out.amp).toBe('Ben &amp; Jerry');
  });

  test('une charge XSS rendue dans une cellule reste inerte (pas de nœud script)', async ({ page }) => {
    const executed = await page.evaluate(() => {
      window.__xssFired = false;
      const payload = '<img src=x onerror="window.__xssFired=true">';
      const cell = document.createElement('div');
      // Simule un sink corrigé : donnée passée par escapeHtml avant innerHTML.
      cell.innerHTML = `<td class="mono">${window.escapeHtml(payload)}</td>`;
      document.body.appendChild(cell);
      return new Promise((resolve) => setTimeout(() => resolve({
        fired: window.__xssFired,
        hasImg: !!cell.querySelector('img'),
        text: cell.textContent,
      }), 100));
    });
    expect(executed.fired).toBe(false);
    expect(executed.hasImg).toBe(false); // la charge est du texte, pas un élément
    expect(executed.text).toContain('<img');
  });
});
