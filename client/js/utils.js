// ═══════════════════════════════════════════
// Utility functions — shared across views
// ═══════════════════════════════════════════

function formatQuantity(qty, unit) {
  if (!qty && qty !== 0) return '—';
  unit = (unit || '').toLowerCase().trim();

  // Grammes → kg
  if ((unit === 'g' || unit === 'gr' || unit === 'grammes') && qty >= 1000) {
    return (qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1) + ' kg';
  }
  // Milligrammes → g
  if (unit === 'mg' && qty >= 1000) {
    return (qty / 1000).toFixed(1) + ' g';
  }
  // Millilitres → L
  if ((unit === 'ml' || unit === 'millilitres') && qty >= 1000) {
    return (qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1) + ' L';
  }
  // Centilitres → L
  if ((unit === 'cl' || unit === 'centilitres') && qty >= 100) {
    return (qty / 100).toFixed(qty % 100 === 0 ? 0 : 1) + ' L';
  }

  // Arrondir les décimales inutiles
  const rounded = Math.round(qty * 100) / 100;
  const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(rounded < 10 ? 1 : 0);
  return display + ' ' + unit;
}

// ─── Custom confirmation modal (replaces native confirm()) ───
function showConfirmModal(title, message, onConfirm, options = {}) {
  const confirmText = options.confirmText || 'Confirmer';
  const confirmClass = options.confirmClass || 'btn btn-danger';
  // Escape title/message to prevent XSS (callers pass user data like product names)
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeTitle = esc(title);
  const safeMessage = esc(message).replace(/\n/g, '<br>');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay confirm-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'confirm-modal-title');
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px;text-align:center">
      <div style="font-size:2rem;margin-bottom:12px">
        <i data-lucide="alert-triangle" style="width:40px;height:40px;color:var(--color-danger)"></i>
      </div>
      <h3 id="confirm-modal-title" style="margin-bottom:8px">${safeTitle}</h3>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:20px">${safeMessage}</p>
      <div class="actions-row" style="justify-content:center">
        <button class="${confirmClass}" id="confirm-yes">${esc(confirmText)}</button>
        <button class="btn btn-secondary" id="confirm-no">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  // Trap focus inside the modal and restore focus on close
  const releaseFocus = trapFocus(overlay);
  const closeModal = () => {
    try { releaseFocus(); } catch {}
    overlay.remove();
  };

  overlay.querySelector('#confirm-yes').onclick = () => {
    closeModal();
    onConfirm();
  };
  overlay.querySelector('#confirm-no').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // ESC key handler for this modal
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ─── Format date in French locale ───
function formatDateFR(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTimeFR(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Format an ISO date string (YYYY-MM-DD) to French DD/MM/YYYY for display ───
// Use for reading back an <input type="date"> .value (always YYYY-MM-DD per HTML
// spec) into French display format, independent of browser/OS locale.
function formatDateInput(dateStr) {
  if (!dateStr) return '';
  // Accept already-french (dd/mm/yyyy) or ISO (yyyy-mm-dd) or full ISO timestamps
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const m2 = String(dateStr).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) return dateStr;
  // Fallback: JS Date parse
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Global: close topmost modal on ESC (fallback for modals without specific handler) ───
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const topModal = document.querySelector('.modal-overlay:last-of-type');
    if (topModal) {
      topModal.remove();
    }
  }
}, true);

// ─── Global: auto-apply ARIA + focus-trap to every .modal-overlay inserted into DOM ───
// EVAL_ULTIMATE: only 6/129 modals had role=dialog + aria-modal + trapFocus.
// Rather than editing 129 call sites, this observer enforces the pattern on
// every modal overlay added to the DOM — WCAG 2.1 AA 4.1.2 compliant.
(function autoEnhanceModals() {
  function enhance(node) {
    if (!(node instanceof HTMLElement)) return;
    if (!node.classList || !node.classList.contains('modal-overlay')) return;
    if (node.__a11yEnhanced) return;
    node.__a11yEnhanced = true;

    if (!node.getAttribute('role')) node.setAttribute('role', 'dialog');
    if (!node.getAttribute('aria-modal')) node.setAttribute('aria-modal', 'true');

    // If the overlay or its inner .modal has a heading, label the dialog by it.
    if (!node.getAttribute('aria-labelledby') && !node.getAttribute('aria-label')) {
      const heading = node.querySelector('h1,h2,h3,h4,[data-modal-title]');
      if (heading) {
        if (!heading.id) heading.id = 'modal-title-' + Math.random().toString(36).slice(2, 9);
        node.setAttribute('aria-labelledby', heading.id);
      } else {
        node.setAttribute('aria-label', 'Boîte de dialogue');
      }
    }

    // Focus trap — stored on the node so it can be released on removal.
    try {
      node.__releaseFocus = trapFocus(node);
    } catch {}
  }

  function release(node) {
    if (!(node instanceof HTMLElement)) return;
    if (typeof node.__releaseFocus === 'function') {
      try { node.__releaseFocus(); } catch {}
      node.__releaseFocus = null;
    }
  }

  if (typeof MutationObserver === 'undefined' || !document.body) {
    // SSR / test env — skip.
    return;
  }

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        enhance(n);
        // Deep scan in case the overlay was inserted inside a wrapper
        n.querySelectorAll && n.querySelectorAll('.modal-overlay').forEach(enhance);
      });
      m.removedNodes && m.removedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        release(n);
        n.querySelectorAll && n.querySelectorAll('.modal-overlay').forEach(release);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Retroactively upgrade modals already in the DOM
  document.querySelectorAll('.modal-overlay').forEach(enhance);
})();

// ─── Global: auto-apply lang="fr" + FR placeholder to every <input type="date">
// Audit 2026-04-24 — some browsers (Chromium on macOS) render native date picker
// as mm/dd/yyyy regardless of <html lang="fr">. Setting lang on the input itself
// forces French rendering on supporting browsers; placeholder is defensive and
// appears in browsers that fall back to a text input (older WebViews).
(function autoEnhanceDateInputs() {
  function enhance(node) {
    if (!(node instanceof HTMLInputElement)) return;
    const t = node.type;
    if (t !== 'date' && t !== 'datetime-local' && t !== 'time') return;
    if (node.__frEnhanced) return;
    node.__frEnhanced = true;
    if (!node.hasAttribute('lang')) node.setAttribute('lang', 'fr');
    if (!node.hasAttribute('placeholder')) {
      node.setAttribute('placeholder', t === 'time' ? 'hh:mm' : (t === 'datetime-local' ? 'jj/mm/aaaa hh:mm' : 'jj/mm/aaaa'));
    }
  }
  function deepScan(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('input[type="date"], input[type="datetime-local"], input[type="time"]').forEach(enhance);
  }
  if (typeof MutationObserver === 'undefined' || !document.body) return;
  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach((n) => {
        if (n instanceof HTMLInputElement) enhance(n);
        else if (n instanceof HTMLElement) deepScan(n);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  deepScan(document);
})();

// ─── Focus-trap helper for modals ──────────────────────────────────────────
// Usage:
//   const release = trapFocus(modalOverlay);
//   // ...later when closing the modal:
//   release();
// Keeps keyboard focus inside `container` while open, remembers the previously
// focused element and restores it on release. Also focuses the first focusable
// child on entry.
function trapFocus(container) {
  if (!container) return () => {};
  const previouslyFocused = document.activeElement;
  const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
    'input:not([disabled])', 'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const getFocusable = () => Array.from(container.querySelectorAll(FOCUSABLE))
    .filter(el => el.offsetParent !== null || el === document.activeElement);

  const first = getFocusable()[0];
  if (first) {
    try { first.focus(); } catch {}
  }

  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  container.addEventListener('keydown', onKey);

  return function release() {
    container.removeEventListener('keydown', onKey);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try { previouslyFocused.focus(); } catch {}
    }
  };
}
