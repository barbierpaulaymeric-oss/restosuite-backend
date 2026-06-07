// Routeur hash minimal. Chaque route = fonction (params) -> Node.
const routes = {};
let onChange = null;

export function defineRoutes(map) { Object.assign(routes, map); }
export function onRouteChange(fn) { onChange = fn; }

export function currentRoute() {
  const hash = (location.hash || '#/').replace(/^#\/?/, '');
  const [path, query] = hash.split('?');
  return { name: path || 'service', query: new URLSearchParams(query || '') };
}

export function navigate(name, query) {
  const q = query ? '?' + new URLSearchParams(query).toString() : '';
  location.hash = '#/' + name + q;
}

export function renderCurrent(container) {
  const { name, query } = currentRoute();
  const view = routes[name] || routes['service'];
  container.replaceChildren(view(query));
  if (onChange) onChange(name);
  container.scrollTop = 0;
}

export function startRouter(container) {
  window.addEventListener('hashchange', () => renderCurrent(container));
  renderCurrent(container);
}
