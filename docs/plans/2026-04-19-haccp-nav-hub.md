# HACCP Nav Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collapse the 20-item HACCP dropdown to 5 category headers, each linking to a hub page that shows its modules as cards; replace the 22-item horizontal subnav on every module page with a simple "← back to [Category]" breadcrumb.

**Architecture:** NAV_GROUPS.haccp switches from `subcategories` shape to flat `items` (5 entries). Five new hub routes (`/haccp/hub/*`) each render a card grid using the existing category data. Each module page's `${HACCP_SUBNAV_FULL}` is replaced by `${haccpBreadcrumb('category-key')}`. No backend changes.

**Tech Stack:** Vanilla JS (client/js/app.js + view files), Lucide icons, CSS custom properties (--color-primary, --color-accent, --bg-card, --text-primary).

---

### Task 1: Create the hub view file with data map + renderer + breadcrumb helper

**Files:**
- Create: `client/js/views/haccp-hub.js`

**Step 1: Create the file**

```js
// ═══════════════════════════════════════════
// HACCP Category Hubs — Routes #/haccp/hub/*
// ═══════════════════════════════════════════

const HACCP_HUB_CATEGORIES = {
  temperatures: {
    label: 'Températures',
    subtitle: 'Quotidien',
    icon: 'thermometer',
    hubRoute: '/haccp/hub/temperatures',
    items: [
      { label: 'Relevés du jour',       route: '/haccp/temperatures',      icon: 'thermometer' },
      { label: 'Cuisson (CCP2)',        route: '/haccp/cooking',            icon: 'flame' },
      { label: 'Refroidissement',       route: '/haccp/cooling',            icon: 'snowflake' },
      { label: 'Remise en température', route: '/haccp/reheating',          icon: 'microwave' },
    ],
  },
  hygiene: {
    label: 'Hygiène',
    subtitle: 'Quotidien / Hebdo',
    icon: 'spray-can',
    hubRoute: '/haccp/hub/hygiene',
    items: [
      { label: 'Plan de nettoyage',   route: '/haccp/cleaning',           icon: 'spray-can' },
      { label: 'Non-conformités',     route: '/haccp/non-conformities',   icon: 'alert-triangle' },
      { label: 'Actions correctives', route: '/haccp/corrective-actions', icon: 'wrench' },
    ],
  },
  tracabilite: {
    label: 'Traçabilité',
    subtitle: '',
    icon: 'package-check',
    hubRoute: '/haccp/hub/tracabilite',
    items: [
      { label: 'Réception (CCP1)',  route: '/stock/reception',          icon: 'package-plus' },
      { label: 'Traçabilité aval', route: '/traceability/downstream',  icon: 'package-check' },
      { label: 'Allergènes (INCO)', route: '/haccp/allergens',          icon: 'wheat-off' },
    ],
  },
  plan: {
    label: 'Plan HACCP',
    subtitle: 'Mensuel',
    icon: 'file-check',
    hubRoute: '/haccp/hub/plan',
    items: [
      { label: 'Plan formalisé',     route: '/haccp/plan',         icon: 'file-check' },
      { label: 'Étalonnage',         route: '/haccp/calibrations', icon: 'ruler' },
      { label: 'Formation personnel', route: '/haccp/training',    icon: 'graduation-cap' },
      { label: 'Santé personnel',    route: '/haccp/staff-health', icon: 'heart-pulse' },
    ],
  },
  autre: {
    label: 'Autre',
    subtitle: 'Ponctuel',
    icon: 'more-horizontal',
    hubRoute: '/haccp/hub/autre',
    items: [
      { label: 'Plats témoins',          route: '/haccp/witness-meals',  icon: 'archive' },
      { label: 'Huile de friture',       route: '/haccp/fryers',         icon: 'droplet' },
      { label: 'Lutte nuisibles',        route: '/haccp/pest-control',   icon: 'bug' },
      { label: 'Maintenance équipement', route: '/haccp/maintenance',    icon: 'wrench' },
      { label: 'Gestion des déchets',    route: '/haccp/waste',          icon: 'trash-2' },
      { label: 'Analyse d\'eau',         route: '/haccp/water',          icon: 'droplets' },
      { label: 'Audit PMS',              route: '/haccp/pms-audit',      icon: 'clipboard-check' },
      { label: 'TIAC',                   route: '/haccp/tiac',           icon: 'siren' },
      { label: 'Retrait / rappel',       route: '/haccp/recall',         icon: 'rotate-ccw' },
    ],
  },
};

// Map module routes → their parent category key (for breadcrumb)
const HACCP_ROUTE_TO_CATEGORY = {
  '/haccp/temperatures':      'temperatures',
  '/haccp/cooking':           'temperatures',
  '/haccp/cooling':           'temperatures',
  '/haccp/reheating':         'temperatures',
  '/haccp/cleaning':          'hygiene',
  '/haccp/non-conformities':  'hygiene',
  '/haccp/corrective-actions':'hygiene',
  '/stock/reception':         'tracabilite',
  '/traceability/downstream': 'tracabilite',
  '/haccp/allergens':         'tracabilite',
  '/haccp/allergens-plan':    'tracabilite',
  '/haccp/plan':              'plan',
  '/haccp/calibrations':      'plan',
  '/haccp/training':          'plan',
  '/haccp/staff-health':      'plan',
  '/haccp/witness-meals':     'autre',
  '/haccp/fryers':            'autre',
  '/haccp/pest-control':      'autre',
  '/haccp/maintenance':       'autre',
  '/haccp/waste':             'autre',
  '/haccp/water':             'autre',
  '/haccp/pms-audit':         'autre',
  '/haccp/tiac':              'autre',
  '/haccp/recall':            'autre',
};

/**
 * Returns the breadcrumb HTML for a module page.
 * categoryKey: one of 'temperatures'|'hygiene'|'tracabilite'|'plan'|'autre'
 * If omitted, auto-detects from current route.
 */
function haccpBreadcrumb(categoryKey) {
  const key = categoryKey || HACCP_ROUTE_TO_CATEGORY[location.hash.replace('#', '')] || null;
  if (!key) return '';
  const cat = HACCP_HUB_CATEGORIES[key];
  if (!cat) return '';
  return `<div class="haccp-breadcrumb">
    <a href="#${cat.hubRoute}" class="haccp-breadcrumb__back">
      <i data-lucide="chevron-left"></i>
      <span>${escapeHtml(cat.label)}</span>
    </a>
  </div>`;
}

async function renderHACCPHub(categoryKey) {
  const cat = HACCP_HUB_CATEGORIES[categoryKey];
  if (!cat) { location.hash = '#/haccp'; return; }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <div class="page-header__content">
        <div class="page-header__breadcrumb">
          <a href="#/haccp" class="breadcrumb-link">HACCP</a>
          <i data-lucide="chevron-right" style="width:14px;height:14px;color:var(--text-tertiary)"></i>
          <span>${escapeHtml(cat.label)}</span>
        </div>
        <h1 class="page-header__title">
          <i data-lucide="${cat.icon}"></i>
          ${escapeHtml(cat.label)}
          ${cat.subtitle ? `<span class="page-header__subtitle">${escapeHtml(cat.subtitle)}</span>` : ''}
        </h1>
      </div>
    </div>
    <div class="haccp-hub">
      <div class="haccp-hub__grid">
        ${cat.items.map(item => `
          <a href="#${item.route}" class="haccp-hub__card">
            <div class="haccp-hub__card-icon">
              <i data-lucide="${item.icon}"></i>
            </div>
            <span class="haccp-hub__card-label">${escapeHtml(item.label)}</span>
            <i data-lucide="chevron-right" class="haccp-hub__card-arrow"></i>
          </a>
        `).join('')}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [app] });
}
```

**Step 2: Verify the file was created correctly** (grep for renderHACCPHub)

Run: `grep -n "renderHACCPHub\|haccpBreadcrumb\|HACCP_HUB_CATEGORIES" client/js/views/haccp-hub.js | head -10`

---

### Task 2: Add hub CSS to style.css

**Files:**
- Modify: `client/css/style.css` (append to end)

**Step 1: Append hub + breadcrumb CSS**

```css
/* ─── HACCP Hub pages ─── */
.haccp-hub { padding: 0 16px 32px; max-width: 900px; margin: 0 auto; }
.haccp-hub__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 8px;
}
.haccp-hub__card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.haccp-hub__card:hover {
  background: var(--bg-tertiary);
  border-color: var(--color-accent);
  transform: translateY(-1px);
}
.haccp-hub__card-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-light);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  color: var(--color-accent);
}
.haccp-hub__card-icon i { width: 20px; height: 20px; }
.haccp-hub__card-label { flex: 1; font-weight: 500; font-size: 0.9rem; line-height: 1.3; }
.haccp-hub__card-arrow { width: 16px; height: 16px; color: var(--text-tertiary); flex-shrink: 0; }

/* ─── HACCP module breadcrumb (replaces 22-item subnav) ─── */
.haccp-breadcrumb {
  padding: 8px 16px 4px;
  margin-bottom: 4px;
}
.haccp-breadcrumb__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-accent);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  transition: color 0.15s;
}
.haccp-breadcrumb__back:hover { color: var(--color-accent-hover); }
.haccp-breadcrumb__back i { width: 16px; height: 16px; }

/* ─── page-header breadcrumb trail ─── */
.page-header__breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}
.breadcrumb-link {
  color: var(--color-accent);
  text-decoration: none;
}
.breadcrumb-link:hover { text-decoration: underline; }
.page-header__subtitle {
  font-family: var(--font-serif);
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 8px;
  vertical-align: middle;
}
```

---

### Task 3: Update NAV_GROUPS.haccp in app.js

**Files:**
- Modify: `client/js/app.js`

**Step 1: Replace the `haccp` entry in NAV_GROUPS**

Old (lines ~57–109):
```js
haccp: {
  label: 'HACCP',
  subcategories: [
    { label: 'Températures (quotidien)', items: [...] },
    ...
  ]
},
```

New:
```js
haccp: {
  label: 'HACCP',
  items: [
    { label: 'Températures',  route: '/haccp/hub/temperatures', icon: 'thermometer',   roles: ['gerant','cuisinier'] },
    { label: 'Hygiène',       route: '/haccp/hub/hygiene',      icon: 'spray-can',     roles: ['gerant','cuisinier'] },
    { label: 'Traçabilité',   route: '/haccp/hub/tracabilite',  icon: 'package-check', roles: ['gerant','cuisinier'] },
    { label: 'Plan HACCP',    route: '/haccp/hub/plan',         icon: 'file-check',    roles: ['gerant','cuisinier'] },
    { label: 'Autre',         route: '/haccp/hub/autre',        icon: 'more-horizontal',roles: ['gerant','cuisinier'] },
  ]
},
```

**Step 2: Add hub routes to ROUTE_TO_GROUP** (after the existing `/haccp/recall` entry)

```js
'/haccp/hub/temperatures': 'haccp',
'/haccp/hub/hygiene':      'haccp',
'/haccp/hub/tracabilite':  'haccp',
'/haccp/hub/plan':         'haccp',
'/haccp/hub/autre':        'haccp',
```

**Step 3: Add Router.add entries** (after the existing HACCP routes block)

```js
Router.add(/^\/haccp\/hub\/temperatures$/, () => renderHACCPHub('temperatures'));
Router.add(/^\/haccp\/hub\/hygiene$/,      () => renderHACCPHub('hygiene'));
Router.add(/^\/haccp\/hub\/tracabilite$/,  () => renderHACCPHub('tracabilite'));
Router.add(/^\/haccp\/hub\/plan$/,         () => renderHACCPHub('plan'));
Router.add(/^\/haccp\/hub\/autre$/,        () => renderHACCPHub('autre'));
```

---

### Task 4: Remove HACCP_SUBNAV_FULL from haccp-dashboard.js

**Files:**
- Modify: `client/js/views/haccp-dashboard.js`

**Step 1:** Remove the `HACCP_SUBNAV_ITEMS`, `HACCP_SUBNAV_FULL` constant definitions (lines 6–44 approx.) and every `${HACCP_SUBNAV_FULL}` interpolation in the dashboard template.

The dashboard is the top-level `/haccp` page — it doesn't need a back-link. Just delete the subnav block.

---

### Task 5: Replace ${HACCP_SUBNAV_FULL} in all module files

**Files (23 files):**

Category **temperatures**: haccp-temperatures.js, haccp-cooking.js, haccp-cooling.js, haccp-reheating.js
→ Replace `${HACCP_SUBNAV_FULL}` with `${haccpBreadcrumb('temperatures')}`

Category **hygiene**: haccp-cleaning.js, haccp-non-conformities.js, corrective-actions.js
→ Replace `${HACCP_SUBNAV_FULL}` with `${haccpBreadcrumb('hygiene')}`

Category **tracabilite**: haccp-traceability.js, haccp-allergens.js, haccp-allergens-plan.js
→ Replace `${HACCP_SUBNAV_FULL}` with `${haccpBreadcrumb('tracabilite')}`

Category **plan**: haccp-plan.js, haccp-calibrations.js, haccp-training.js, haccp-staff-health.js
→ Replace `${HACCP_SUBNAV_FULL}` with `${haccpBreadcrumb('plan')}`

Category **autre**: haccp-witness-meals.js, haccp-fryers.js, haccp-pest-control.js, haccp-maintenance.js, haccp-waste.js, haccp-water.js, haccp-pms-audit.js, haccp-tiac.js, haccp-recall.js
→ Replace `${HACCP_SUBNAV_FULL}` with `${haccpBreadcrumb('autre')}`

**NOTE:** Each file uses `${HACCP_SUBNAV_FULL}` exactly once. Do a simple string replace.

---

### Task 6: Wire haccp-hub.js into esbuild entry

**Files:**
- Modify: build script / entry point to include the new view file

**Step 1:** Check how view files are included:

Run: `grep -n "haccp-dashboard\|haccp-temperatures" client/js/app.js | head -5`

If views are imported via `// @import` or similar, add `haccp-hub.js` the same way.
If they are concatenated in a build step, find the build config.

Run: `cat package.json | grep -A5 '"build"'`

---

### Task 7: Run tests

Run: `cd /Users/Alfred/.openclaw/workspace/projects/restosuite/.claude/worktrees/friendly-robinson/server && npm test 2>&1 | tail -20`

Expected: all tests pass (362/362 or similar). Fix any failures before proceeding.

---

### Task 8: Rebuild bundle

Run the build command to regenerate `app.bundle.js` with the new file.

---

### Task 9: Commit and push

```bash
cd /Users/Alfred/.openclaw/workspace/projects/restosuite/.claude/worktrees/friendly-robinson
git add client/js/views/haccp-hub.js client/js/app.js client/css/style.css \
        client/js/views/haccp-dashboard.js \
        client/js/views/haccp-temperatures.js client/js/views/haccp-cooking.js \
        client/js/views/haccp-cooling.js client/js/views/haccp-reheating.js \
        client/js/views/haccp-cleaning.js client/js/views/haccp-non-conformities.js \
        client/js/views/corrective-actions.js \
        client/js/views/haccp-traceability.js client/js/views/haccp-allergens.js \
        client/js/views/haccp-allergens-plan.js \
        client/js/views/haccp-plan.js client/js/views/haccp-calibrations.js \
        client/js/views/haccp-training.js client/js/views/haccp-staff-health.js \
        client/js/views/haccp-witness-meals.js client/js/views/haccp-fryers.js \
        client/js/views/haccp-pest-control.js client/js/views/haccp-maintenance.js \
        client/js/views/haccp-waste.js client/js/views/haccp-water.js \
        client/js/views/haccp-pms-audit.js client/js/views/haccp-tiac.js \
        client/js/views/haccp-recall.js \
        client/app.bundle.js docs/plans/2026-04-19-haccp-nav-hub.md
git commit -m "feat(nav,haccp): collapse dropdown to 5 category hubs + breadcrumb nav"
git push
```
