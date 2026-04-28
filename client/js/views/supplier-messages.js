// ═══════════════════════════════════════════
// Supplier portal — Messages tab.
//
// Mirrors views/messages.js on the gérant side. Each conversation = one
// restaurant in the supplier identity (Mes clients sees the same set).
// Reuses _renderMessageBubbles() defined in views/messages.js — the bundle
// concatenates files in build.js JS_FILES order so messages.js loads first.
// ═══════════════════════════════════════════

let _supplierMsgPollTimer = null;
function _stopSupplierMsgPoll() {
  if (_supplierMsgPollTimer) { clearInterval(_supplierMsgPollTimer); _supplierMsgPollTimer = null; }
}

async function renderSupplierMessagesTab() {
  _stopSupplierMsgPoll();
  const content = document.getElementById('supplier-content');
  if (!content) return;

  // If we landed here from a quick-link (showSupplierMessageThread set
  // _pendingSupplierMessageRid), open the thread directly.
  if (_pendingSupplierMessageRid != null) {
    const rid = _pendingSupplierMessageRid;
    const ctx = _pendingSupplierMessageContext;
    _pendingSupplierMessageRid = null;
    _pendingSupplierMessageContext = null;
    return _renderSupplierMessageThread(rid, ctx);
  }

  content.innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Messages</h2>
      <p class="text-secondary" style="margin:var(--space-1) 0 0">Discutez avec vos restaurants clients.</p>
    </div>
    <div id="supplier-msg-list"><div class="loading"><div class="spinner"></div></div></div>
  `;

  let convs;
  try {
    convs = await API.getSupplierMessageConversations();
  } catch (e) {
    document.getElementById('supplier-msg-list').innerHTML =
      `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
    return;
  }
  refreshSupplierMessagesNavBadge();

  if (!convs.length) {
    document.getElementById('supplier-msg-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="message-square-off"></i></div>
        <p>Aucun client lié pour l'instant.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const fmtRelative = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'À l\'instant';
    if (diff < 3600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3600_000)} h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  document.getElementById('supplier-msg-list').innerHTML = `
    <ul class="msg-conv-list">
      ${convs.map(c => {
        const previewPrefix = c.last_message
          ? (c.last_sender_type === 'supplier' ? 'Vous : ' : '')
          : '';
        const preview = c.last_message
          ? escapeHtml(previewPrefix + c.last_message)
          : '<span class="text-tertiary">Aucun message — envoyez le premier.</span>';
        return `
          <li>
            <button class="msg-conv-item ${c.unread_count > 0 ? 'msg-conv-item--unread' : ''}"
                    data-rid="${c.restaurant_id}">
              <div class="msg-conv-item__avatar">${escapeHtml((c.restaurant_name || '?').charAt(0).toUpperCase())}</div>
              <div class="msg-conv-item__main">
                <div class="msg-conv-item__head">
                  <strong>${escapeHtml(c.restaurant_name || '—')}</strong>
                  <span class="text-tertiary text-sm">${fmtRelative(c.last_message_at)}</span>
                </div>
                <div class="msg-conv-item__preview">${preview}</div>
              </div>
              ${c.unread_count > 0
                ? `<span class="msg-conv-item__badge">${c.unread_count}</span>`
                : ''}
            </button>
          </li>`;
      }).join('')}
    </ul>
  `;

  document.querySelectorAll('#supplier-msg-list [data-rid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = Number(btn.dataset.rid);
      _renderSupplierMessageThread(rid);
    });
  });
}

let _pendingSupplierMessageRid = null;
let _pendingSupplierMessageContext = null;
// Public entry — used by supplier-orders.js "Contacter le restaurant" buttons.
// Switches the active tab to Messages (if not already) and opens the thread
// with optional related-context pre-filled.
function showSupplierMessageThread(restaurantId, context) {
  _pendingSupplierMessageRid = restaurantId;
  _pendingSupplierMessageContext = context || null;
  const tabs = document.querySelectorAll('.supplier-nav__tab');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'messages'));
  renderSupplierMessagesTab();
}

async function _renderSupplierMessageThread(restaurantId, context) {
  _stopSupplierMsgPoll();
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div class="msg-thread-shell">
      <header class="msg-thread__head">
        <button class="btn-icon msg-thread__back" id="supplier-msg-back" aria-label="Retour aux conversations">
          <i data-lucide="arrow-left" style="width:18px;height:18px"></i>
        </button>
        <div id="supplier-msg-title" class="msg-thread__title"><strong>Chargement…</strong></div>
      </header>
      <main class="msg-thread__body" id="supplier-msg-body">
        <div class="loading"><div class="spinner"></div></div>
      </main>
      <footer class="msg-thread__composer">
        <textarea id="supplier-msg-input" class="msg-thread__input"
                  placeholder="Écrivez votre message…"
                  rows="2" maxlength="2000"></textarea>
        <button class="msg-thread__send" id="supplier-msg-send" aria-label="Envoyer">
          <i data-lucide="send" style="width:18px;height:18px"></i>
        </button>
      </footer>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  const inputEl = document.getElementById('supplier-msg-input');
  const sendBtn = document.getElementById('supplier-msg-send');
  let pendingRelated = null;
  if (context && context.related_to && context.related_id) {
    pendingRelated = { related_to: context.related_to, related_id: Number(context.related_id) };
    const label = context.related_to === 'order' ? 'Commande' : (context.related_to === 'delivery' ? 'BL' : 'Élément');
    inputEl.value = `Concernant ${label} ${context.ref || `#${context.related_id}`} : `;
    setTimeout(() => {
      inputEl.focus();
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    }, 50);
  }

  document.getElementById('supplier-msg-back').addEventListener('click', renderSupplierMessagesTab);

  async function loadThread() {
    let data;
    try {
      data = await API.getSupplierMessageThread(restaurantId);
    } catch (e) {
      const errBody = document.getElementById('supplier-msg-body');
      if (errBody) errBody.innerHTML =
        `<p class="text-danger" style="padding:var(--space-4)">Erreur : ${escapeHtml(e.message)}</p>`;
      return;
    }
    const titleEl = document.getElementById('supplier-msg-title');
    if (titleEl) {
      titleEl.innerHTML = `
        <strong>${escapeHtml(data.restaurant.name || '—')}</strong>
        ${data.restaurant.city ? `<span class="text-secondary text-sm">· ${escapeHtml(data.restaurant.city)}</span>` : ''}
      `;
    }
    // mySide='supplier' so own bubbles align right.
    const msgBody = document.getElementById('supplier-msg-body');
    if (msgBody) _renderMessageBubbles('supplier-msg-body', data.messages, 'supplier');
    refreshSupplierMessagesNavBadge();
  }
  await loadThread();
  _supplierMsgPollTimer = setInterval(loadThread, 15_000);

  async function sendCurrent() {
    const text = inputEl.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      await API.sendSupplierMessage(restaurantId, text, pendingRelated || {});
      inputEl.value = '';
      pendingRelated = null;
      await loadThread();
    } catch (e) {
      showToast(e.message || 'Erreur envoi message', 'error');
    } finally {
      sendBtn.disabled = false;
    }
  }
  sendBtn.addEventListener('click', sendCurrent);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCurrent();
    }
  });
}

// Nav badge for the supplier portal's Messages tab.
async function refreshSupplierMessagesNavBadge() {
  if (typeof API.getSupplierMessageUnreadCount !== 'function') return;
  try {
    const { count } = await API.getSupplierMessageUnreadCount();
    const tab = document.querySelector('.supplier-nav__tab[data-tab="messages"]');
    if (!tab) return;
    let badge = tab.querySelector('.supplier-nav__badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'supplier-nav__badge';
        tab.appendChild(badge);
      }
      badge.textContent = String(count);
      badge.hidden = false;
    } else if (badge) {
      badge.hidden = true;
    }
  } catch (_) { /* offline / 401 — silent */ }
}
