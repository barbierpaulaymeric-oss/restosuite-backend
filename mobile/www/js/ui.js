// Helpers DOM + jeu d'icônes inline (aucune dépendance externe, marche hors-ligne).

/** Crée un élément. h('div', {class:'x', onclick:fn}, [children|string]) */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null && v !== false) {
      el.setAttribute(k, v === true ? '' : v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// ── Icônes (stroke = currentColor, style Lucide) ──────────────────
const PATHS = {
  service:    '<path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M4 11l1.5 8h13L20 11"/>',
  fiches:     '<path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v5h5M8 13h8M8 17h5"/>',
  haccp:      '<path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0z"/><path d="M10 9h4"/>',
  receptions: '<path d="M21 8 12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  commandes:  '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 13h11l2-9H6.5"/>',
  alto:       '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  mic:        '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  timer:      '<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6M19 5l-2 2"/>',
  thermometer:'<path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0z"/>',
  check:      '<path d="M20 6 9 17l-5-5"/>',
  checklist:  '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 1.5-2M4 12l1 1 1.5-2M4 18l1 1 1.5-2"/>',
  truck:      '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
  allergen:   '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  search:     '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  plus:       '<path d="M12 5v14M5 12h14"/>',
  refresh:    '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  logout:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  inbox:      '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6z"/>',
};

/** Renvoie un nœud SVG pour le nom donné. */
export function icon(name, size = 24) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = PATHS[name] || PATHS.service;
  return svg;
}

// ── Toast ─────────────────────────────────────────────────────────
let toastWrap;
export function toast(msg, kind = '') {
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toast-wrap' });
    document.body.append(toastWrap);
  }
  const t = h('div', { class: 'toast ' + kind }, msg);
  toastWrap.append(t);
  setTimeout(() => t.remove(), 2800);
}

/** État vide réutilisable pour les écrans en cours de construction. */
export function emptyState(iconName, title, sub) {
  return h('div', { class: 'empty' }, [
    h('div', { class: 'empty-icon' }, [icon(iconName, 64)]),
    h('h3', {}, title),
    sub ? h('p', {}, sub) : null,
  ]);
}
