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
      <h3 id="confirm-modal-title" style="margin-bottom:8px">${title}</h3>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:20px">${message}</p>
      <div class="actions-row" style="justify-content:center">
        <button class="${confirmClass}" id="confirm-yes">${confirmText}</button>
        <button class="btn btn-secondary" id="confirm-no">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const closeModal = () => overlay.remove();

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

// ─── Global: close topmost modal on ESC (fallback for modals without specific handler) ───
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const topModal = document.querySelector('.modal-overlay:last-of-type');
    if (topModal) {
      topModal.remove();
    }
  }
}, true);
