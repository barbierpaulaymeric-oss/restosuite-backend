// ═══════════════════════════════════════════
// Supplier portal — Notifications page.
//
// Reads /api/supplier-portal/notifications/me. Each row shows type+restaurant+
// message+date with a mark-read button (unread rows only). "Tout marquer lu"
// clears the badge in one shot. After any mutation we refresh the unread
// count so the nav badge stays in sync.
// ═══════════════════════════════════════════

async function renderSupplierNotificationsTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-4)">
      <div>
        <h2 style="margin:0;font-size:var(--text-xl)">Notifications</h2>
        <p class="text-secondary" style="margin:var(--space-1) 0 0">Alertes commandes, mises à jour fournisseur.</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="supplier-notif-mark-all">
        <i data-lucide="check-check" style="width:16px;height:16px"></i> Tout marquer lu
      </button>
    </div>
    <div id="supplier-notif-body"><div class="loading"><div class="spinner"></div></div></div>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('supplier-notif-mark-all').addEventListener('click', async () => {
    try {
      await API.markAllSupplierMyNotificationsRead();
      showToast('Toutes les notifications marquées comme lues', 'success');
      if (typeof refreshSupplierOrdersBadge === 'function') refreshSupplierOrdersBadge();
      renderSupplierNotificationsTab();
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    }
  });

  const body = document.getElementById('supplier-notif-body');
  let notifs;
  try {
    notifs = await API.getSupplierMyNotifications();
  } catch (e) {
    body.innerHTML = `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
    return;
  }

  if (!notifs.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="bell-off"></i></div>
        <p>Aucune notification pour l'instant.</p>
        <p class="text-secondary text-sm">Vous serez alerté ici quand un restaurant passera commande.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const TYPE_ICON = {
    order_created:   'shopping-cart',
    order_confirmed: 'check-circle',
    order_cancelled: 'x-circle',
    default:         'bell',
  };

  body.innerHTML = `
    <ul class="supplier-notif-list">
      ${notifs.map(n => `
        <li class="supplier-notif-item ${n.read ? '' : 'supplier-notif-item--unread'}">
          <div class="supplier-notif-icon">
            <i data-lucide="${TYPE_ICON[n.type] || TYPE_ICON.default}" style="width:18px;height:18px"></i>
          </div>
          <div class="supplier-notif-main">
            <div class="supplier-notif-message">${escapeHtml(n.message || n.type || '')}</div>
            <div class="text-secondary text-sm">
              ${escapeHtml(n.restaurant_name || '—')} · ${fmtDate(n.created_at)}
            </div>
          </div>
          ${n.read
            ? `<span class="text-tertiary text-sm">Lue</span>`
            : `<button class="btn btn-secondary btn-sm supplier-notif-read-btn" data-id="${n.id}">
                 <i data-lucide="check" style="width:14px;height:14px"></i> Lue
               </button>`
          }
        </li>
      `).join('')}
    </ul>
  `;
  if (window.lucide) lucide.createIcons();

  body.querySelectorAll('.supplier-notif-read-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      try {
        await API.markSupplierMyNotificationRead(id);
        if (typeof refreshSupplierOrdersBadge === 'function') refreshSupplierOrdersBadge();
        renderSupplierNotificationsTab();
      } catch (e) {
        showToast(e.message || 'Erreur', 'error');
      }
    });
  });
}
