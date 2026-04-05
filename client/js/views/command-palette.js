// ═══════════════════════════════════════════
// Command Palette — Global Keyboard Navigation
// ═══════════════════════════════════════════

// Command palette state
let _commandPaletteOpen = false;
const _commands = [
  { name: 'Nouvelle fiche technique', icon: 'plus', hash: '#/new', category: 'Fiches' },
  { name: 'Ingrédients', icon: 'leaf', hash: '#/ingredients', category: 'Fiches' },
  { name: 'Stock', icon: 'warehouse', hash: '#/stock', category: 'Stock' },
  { name: 'HACCP', icon: 'shield-check', hash: '#/haccp', category: 'HACCP' },
  { name: 'Commandes fournisseurs', icon: 'clipboard-pen', hash: '#/orders', category: 'Commandes' },
  { name: 'Service (Salle)', icon: 'concierge-bell', hash: '#/service', category: 'Service' },
  { name: 'Cuisine', icon: 'chef-hat', hash: '#/kitchen', category: 'Service' },
  { name: 'Fournisseurs', icon: 'truck', hash: '#/suppliers', category: 'Fournisseurs' },
  { name: 'Analytics', icon: 'trending-up', hash: '#/analytics', category: 'Analytics' },
  { name: 'Scan facture', icon: 'camera', hash: '#/scan-invoice', category: 'Stock' },
  { name: 'Mercuriale', icon: 'bar-chart-3', hash: '#/mercuriale', category: 'Données' },
  { name: 'QR Codes', icon: 'qr-code', hash: '#/qrcodes', category: 'Outils' },
  { name: 'Équipe', icon: 'users', hash: '#/team', category: 'Paramètres' },
];

function toggleCommandPalette() {
  if (_commandPaletteOpen) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

function openCommandPalette() {
  if (_commandPaletteOpen) return;
  _commandPaletteOpen = true;

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'command-palette-backdrop';
  backdrop.className = 'command-palette-backdrop';
  backdrop.addEventListener('click', closeCommandPalette);

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'command-palette-modal';
  modal.className = 'command-palette-modal';

  modal.innerHTML = `
    <div class="command-palette-content">
      <div class="command-palette-search-wrapper">
        <svg class="command-palette-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          id="command-palette-input"
          class="command-palette-input"
          placeholder="Rechercher une action..."
          autocomplete="off"
        >
      </div>
      <div class="command-palette-list" id="command-palette-list">
        ${renderCommandGroups(_commands)}
      </div>
      <div class="command-palette-footer">
        <span class="command-palette-hint">⏎ Valider</span>
        <span class="command-palette-hint">⎋ Fermer</span>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const input = document.getElementById('command-palette-input');
  const list = document.getElementById('command-palette-list');

  // Focus input
  setTimeout(() => input.focus(), 50);

  // Handle input
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = _commands.filter(cmd =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );
    list.innerHTML = renderCommandGroups(filtered, query);
  });

  // Handle keyboard
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCommandPalette();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const selected = list.querySelector('.command-item.selected');
      if (selected) {
        const cmd = _commands.find(c => c.hash === selected.dataset.hash);
        if (cmd) {
          location.hash = cmd.hash;
          closeCommandPalette();
        }
      } else if (filtered.length > 0) {
        location.hash = filtered[0].hash;
        closeCommandPalette();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      navigateCommandList(1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      navigateCommandList(-1);
      e.preventDefault();
    }
  });

  // Click handlers
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.command-item');
    if (item) {
      location.hash = item.dataset.hash;
      closeCommandPalette();
    }
  });

  // Add click handler for list items to update selection
  updateCommandSelection();
}

function closeCommandPalette() {
  _commandPaletteOpen = false;
  const backdrop = document.getElementById('command-palette-backdrop');
  const modal = document.getElementById('command-palette-modal');

  if (backdrop) backdrop.remove();
  if (modal) modal.remove();
}

function renderCommandGroups(commands, query = '') {
  const groups = {};

  commands.forEach(cmd => {
    if (!groups[cmd.category]) {
      groups[cmd.category] = [];
    }
    groups[cmd.category].push(cmd);
  });

  return Object.entries(groups)
    .map(([category, cmds]) => `
      <div class="command-group">
        <div class="command-group-label">${escapeHtml(category)}</div>
        ${cmds.map((cmd, idx) => `
          <button
            class="command-item ${idx === 0 ? 'selected' : ''}"
            data-hash="${cmd.hash}"
            onclick="location.hash='${cmd.hash}'; closeCommandPalette();"
          >
            <svg class="command-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${getLucideIconPath(cmd.icon)}
            </svg>
            <span class="command-item-name">${escapeHtml(cmd.name)}</span>
            <span class="command-item-shortcut">${cmd.category}</span>
          </button>
        `).join('')}
      </div>
    `)
    .join('');
}

function navigateCommandList(direction) {
  const list = document.getElementById('command-palette-list');
  const items = list.querySelectorAll('.command-item');
  const selected = list.querySelector('.command-item.selected');

  if (!selected) {
    if (items.length > 0) items[0].classList.add('selected');
    return;
  }

  const currentIndex = Array.from(items).indexOf(selected);
  let nextIndex = currentIndex + direction;

  if (nextIndex < 0) nextIndex = items.length - 1;
  if (nextIndex >= items.length) nextIndex = 0;

  selected.classList.remove('selected');
  items[nextIndex].classList.add('selected');
  items[nextIndex].scrollIntoView({ block: 'nearest' });
}

function updateCommandSelection() {
  const list = document.getElementById('command-palette-list');
  const items = list.querySelectorAll('.command-item');
  items.forEach((item, idx) => {
    if (idx === 0) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

// Simple Lucide icon path mapping for common icons
function getLucideIconPath(icon) {
  const paths = {
    'plus': '<g><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></g>',
    'leaf': '<g><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 21 7.6 21 13a9 9 0 0 1-9 9c-1.8 0-3.5-.5-5-1.3"></path><path d="M11 13a3 3 0 1 1-3-3 3 3 0 0 1 3 3"></path></g>',
    'warehouse': '<g><path d="M12 3v8m0 8v2M3 10h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10zm9-7L3 10h18L12 3z"></path></g>',
    'shield-check': '<g><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="10 17 14 21 22 13"></polyline></g>',
    'clipboard-pen': '<g><rect x="3" y="3" width="15" height="15" rx="2" ry="2"></rect><path d="M10 12h4"></path><path d="M10 16h4"></path><line x1="12" y1="3" x2="12" y2="0"></line><path d="M20 10c.55-.5 1.45.5.5 1.5l-4 4"></path></g>',
    'truck': '<g><rect x="1" y="6" width="22" height="13" rx="2" ry="2"></rect><path d="M16 6v-2a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><circle cx="5.5" cy="19.5" r="2.5"></circle><circle cx="18.5" cy="19.5" r="2.5"></circle></g>',
    'trending-up': '<g><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></g>',
    'camera': '<g><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></g>',
    'bar-chart-3': '<g><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></g>',
    'qr-code': '<g><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></g>',
    'users': '<g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></g>',
  };
  return paths[icon] || '<circle cx="12" cy="12" r="10"></circle>';
}
