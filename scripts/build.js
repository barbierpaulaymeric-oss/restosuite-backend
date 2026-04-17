#!/usr/bin/env node
// ═══════════════════════════════════════════
// RestoSuite — esbuild bundle script
// Concatène les 34+ fichiers JS globaux en un seul app.bundle.js
// ═══════════════════════════════════════════

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Ordre de chargement identique à celui de index.html
// (les fichiers globaux doivent être chargés dans le bon ordre)
const JS_FILES = [
  'js/api.js',
  'js/utils.js',
  'js/views/dashboard.js',
  'js/views/recipe-detail.js',
  'js/views/recipe-form.js',
  'js/views/ingredients.js',
  'js/views/stock-dashboard.js',
  'js/views/stock-reception.js',
  'js/views/stock-movements.js',
  'js/views/stock-variance.js',
  'js/views/suppliers.js',
  'js/views/haccp-dashboard.js',
  'js/views/haccp-temperatures.js',
  'js/views/haccp-calibrations.js',
  'js/views/haccp-cleaning.js',
  'js/views/haccp-traceability.js',
  'js/views/haccp-cooling.js',
  'js/views/haccp-reheating.js',
  'js/views/haccp-fryers.js',
  'js/views/haccp-non-conformities.js',
  'js/views/haccp-allergens.js',
  'js/views/haccp-allergens-plan.js',
  'js/views/haccp-water.js',
  'js/views/haccp-pms-audit.js',
  'js/views/haccp-tiac.js',
  'js/views/haccp-staff-health.js',
  'js/views/settings-sanitary.js',
  'js/views/haccp-plan.js',
  'js/views/haccp-recall.js',
  'js/views/haccp-training.js',
  'js/views/haccp-pest-control.js',
  'js/views/haccp-maintenance.js',
  'js/views/haccp-waste.js',
  'js/views/corrective-actions.js',
  'js/views/traceability-downstream.js',
  'js/views/fabrication-diagrams.js',
  'js/views/pms-export.js',
  'js/views/orders.js',
  'js/views/service.js',
  'js/views/kitchen.js',
  'js/views/analytics.js',
  'js/views/health-dashboard.js',
  'js/views/more.js',
  'js/views/onboarding.js',
  'js/views/login.js',
  'js/views/supplier-login.js',
  'js/views/supplier-catalog.js',
  'js/views/supplier-delivery.js',
  'js/views/deliveries.js',
  'js/views/supplier-portal-manage.js',
  'js/views/team.js',
  'js/views/subscribe.js',
  'js/views/scan-invoice.js',
  'js/views/mercuriale.js',
  'js/views/import-mercuriale.js',
  'js/views/ai-chef.js',
  'js/views/ai-assistant.js',
  'js/views/menu-engineering.js',
  'js/views/carbon.js',
  'js/views/integrations.js',
  'js/views/multi-site.js',
  'js/views/predictions.js',
  'js/views/crm.js',
  'js/views/api-keys.js',
  'js/views/qrcodes.js',
  'js/views/plans.js',
  'js/views/command-palette.js',
  'js/views/errors-log.js',
  'js/views/admin.js',
  'js/floating-ai-bubble.js',
  'js/router.js',
  'js/app.js',
];

const CLIENT_DIR = path.join(__dirname, '..', 'client');
const OUT_FILE = path.join(CLIENT_DIR, 'js', 'app.bundle.js');

function concatSources() {
  const parts = JS_FILES.map((relPath) => {
    const fullPath = path.join(CLIENT_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  ⚠ Fichier manquant : ${relPath}`);
      return '';
    }
    return `\n/* ── ${relPath} ── */\n` + fs.readFileSync(fullPath, 'utf8');
  });
  return parts.join('\n');
}

async function build() {
  const startTime = Date.now();
  const source = concatSources();

  try {
    const result = await esbuild.transform(source, {
      loader: 'js',
      minify: false,   // pas de minification — préserve les noms de fonctions globales
      sourcemap: false,
      target: ['es2017'],
    });

    fs.writeFileSync(OUT_FILE, result.code, 'utf8');

    const sizeKB = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
    const elapsed = Date.now() - startTime;
    console.log(`✓ Bundle généré : client/js/app.bundle.js (${sizeKB} KB) en ${elapsed}ms`);

    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.warn('  ⚠', w.text));
    }
  } catch (err) {
    console.error('✗ Erreur de build :', err.message || err);
    process.exit(1);
  }
}

async function watch() {
  console.log('👁  Watch mode — en attente de changements dans client/js/...');
  await build();

  const chokidar = (() => {
    try { return require('chokidar'); } catch { return null; }
  })();

  if (chokidar) {
    chokidar.watch(path.join(CLIENT_DIR, 'js', '**', '*.js'), {
      ignored: OUT_FILE,
      ignoreInitial: true,
    }).on('all', async (event, filePath) => {
      console.log(`  → ${event}: ${path.relative(CLIENT_DIR, filePath)}`);
      await build();
    });
  } else {
    // Fallback sans chokidar : polling basique
    let lastMtimes = {};
    const checkFiles = () => {
      let changed = false;
      JS_FILES.forEach((relPath) => {
        const fullPath = path.join(CLIENT_DIR, relPath);
        try {
          const mtime = fs.statSync(fullPath).mtimeMs;
          if (lastMtimes[relPath] && lastMtimes[relPath] !== mtime) {
            console.log(`  → modifié: ${relPath}`);
            changed = true;
          }
          lastMtimes[relPath] = mtime;
        } catch {}
      });
      if (changed) build();
    };
    JS_FILES.forEach((relPath) => {
      const fullPath = path.join(CLIENT_DIR, relPath);
      try { lastMtimes[relPath] = fs.statSync(fullPath).mtimeMs; } catch {}
    });
    setInterval(checkFiles, 1000);
  }
}

if (isWatch) {
  watch();
} else {
  build();
}
