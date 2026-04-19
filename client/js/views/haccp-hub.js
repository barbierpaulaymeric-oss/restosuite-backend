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
      { label: 'Relevés du jour',       route: '/haccp/temperatures', icon: 'thermometer' },
      { label: 'Cuisson (CCP2)',        route: '/haccp/cooking',      icon: 'flame' },
      { label: 'Refroidissement',       route: '/haccp/cooling',      icon: 'snowflake' },
      { label: 'Remise en température', route: '/haccp/reheating',    icon: 'microwave' },
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
      { label: 'Réception (CCP1)',   route: '/stock/reception',          icon: 'package-plus' },
      { label: 'Traçabilité aval',   route: '/traceability/downstream',  icon: 'package-check' },
      { label: 'Allergènes (INCO)',  route: '/haccp/allergens',          icon: 'wheat-off' },
    ],
  },
  plan: {
    label: 'Plan HACCP',
    subtitle: 'Mensuel',
    icon: 'file-check',
    hubRoute: '/haccp/hub/plan',
    items: [
      { label: 'Plan formalisé',      route: '/haccp/plan',         icon: 'file-check' },
      { label: 'Étalonnage',          route: '/haccp/calibrations', icon: 'ruler' },
      { label: 'Formation personnel', route: '/haccp/training',     icon: 'graduation-cap' },
      { label: 'Santé personnel',     route: '/haccp/staff-health', icon: 'heart-pulse' },
    ],
  },
  autre: {
    label: 'Autre',
    subtitle: 'Ponctuel',
    icon: 'more-horizontal',
    hubRoute: '/haccp/hub/autre',
    items: [
      { label: 'Plats témoins',          route: '/haccp/witness-meals', icon: 'archive' },
      { label: 'Huile de friture',       route: '/haccp/fryers',        icon: 'droplet' },
      { label: 'Lutte nuisibles',        route: '/haccp/pest-control',  icon: 'bug' },
      { label: 'Maintenance équipement', route: '/haccp/maintenance',   icon: 'wrench' },
      { label: 'Gestion des déchets',    route: '/haccp/waste',         icon: 'trash-2' },
      { label: "Analyse d'eau",          route: '/haccp/water',         icon: 'droplets' },
      { label: 'Audit PMS',              route: '/haccp/pms-audit',     icon: 'clipboard-check' },
      { label: 'TIAC',                   route: '/haccp/tiac',          icon: 'siren' },
      { label: 'Retrait / rappel',       route: '/haccp/recall',        icon: 'rotate-ccw' },
    ],
  },
};

// Map module routes → their parent category key (for breadcrumb auto-detect)
const HACCP_ROUTE_TO_CATEGORY = {
  '/haccp/temperatures':       'temperatures',
  '/haccp/cooking':            'temperatures',
  '/haccp/cooling':            'temperatures',
  '/haccp/reheating':          'temperatures',
  '/haccp/cleaning':           'hygiene',
  '/haccp/non-conformities':   'hygiene',
  '/haccp/corrective-actions': 'hygiene',
  '/stock/reception':          'tracabilite',
  '/traceability/downstream':  'tracabilite',
  '/haccp/allergens':          'tracabilite',
  '/haccp/allergens-plan':     'tracabilite',
  '/haccp/plan':               'plan',
  '/haccp/calibrations':       'plan',
  '/haccp/training':           'plan',
  '/haccp/staff-health':       'plan',
  '/haccp/witness-meals':      'autre',
  '/haccp/fryers':             'autre',
  '/haccp/pest-control':       'autre',
  '/haccp/maintenance':        'autre',
  '/haccp/waste':              'autre',
  '/haccp/water':              'autre',
  '/haccp/pms-audit':          'autre',
  '/haccp/tiac':               'autre',
  '/haccp/recall':             'autre',
};

/**
 * Returns the breadcrumb HTML for a module page.
 * Pass the category key explicitly, or omit to auto-detect from the current route.
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
          ${escapeHtml(cat.label)}${cat.subtitle ? ` <span class="page-header__subtitle">${escapeHtml(cat.subtitle)}</span>` : ''}
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
          </a>`).join('')}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [app] });
}
