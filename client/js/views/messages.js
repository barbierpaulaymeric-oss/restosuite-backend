// ═══════════════════════════════════════════
// Restaurant ↔ supplier messaging — restaurant side.
//
// Two views:
//   - Conversation list (/#/messages): one row per supplier with last
//     message preview, unread badge, last activity timestamp.
//   - Thread (/#/messages/:supplierId): chat view, message bubbles, input
//     bar at the bottom. Polls /thread every 15s while open so incoming
//     supplier replies appear without a manual refresh.
//
// CSS lives in client/css/style.css under the .msg-* prefix (external CSS
// only per CSP3 style-src-elem 'self').
// ═══════════════════════════════════════════

let _messagesPollTimer = null;
let _messagesNavBadgeTimer = null;

function _stopMessagesPoll() {
  if (_messagesPollTimer) { clearInterval(_messagesPollTimer); _messagesPollTimer = null; }
}

async function renderMessagesConversations() {
  _stopMessagesPoll();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <h1>Messages</h1>
      <p class="page-header__sub">Discutez avec vos fournisseurs.</p>
    </div>
    <div id="msg-conv-list"><div class="loading"><div class="spinner"></div></div></div>
  `;

  let convs;
  try {
    convs = await API.getMessageConversations();
  } catch (e) {
    // 401 here used to trigger the global cleanup-and-reload via api.js,
    // logging the user out on their FIRST navigation to /messages.
    // getMessageConversations now opts out of that path; this catch
    // resolves the 401 by probing /auth/me — if the cookie is genuinely
    // dead, the api.js layer's normal handling will logout (correct
    // behaviour). Otherwise we retry the conversations call once: a
    // transient 401 self-heals without forcing the user to reload.
    const msg = String(e && e.message || '');
    const host = document.getElementById('msg-conv-list');
    if (msg === '401') {
      try {
        // Probe the canonical "is my session valid" endpoint. /auth/me uses
        // the strict 401 path — a real expired session takes the user to
        // /login automatically here, which is the right outcome.
        await API.getMe();
        // Session is valid → the 401 above was transient. Retry once.
        try {
          convs = await API.getMessageConversations();
        } catch (e2) {
          host.innerHTML = `
            <div class="empty-state" role="alert">
              <div class="empty-icon"><i data-lucide="server-crash"></i></div>
              <p>Service de messagerie temporairement indisponible.</p>
              <p class="text-secondary text-sm">Votre session est valide — réessayez dans un instant.</p>
              <div class="actions-row" style="justify-content:center;gap:var(--space-3);margin-top:var(--space-3)">
                <button class="btn btn-primary" id="msg-retry-btn">Réessayer</button>
                <a href="#/" class="btn btn-secondary">Retour</a>
              </div>
            </div>`;
          if (window.lucide) lucide.createIcons();
          const retry = document.getElementById('msg-retry-btn');
          if (retry) retry.addEventListener('click', () => renderMessagesConversations());
          return;
        }
        // Retry succeeded — fall through to the normal render path below.
      } catch (_meErr) {
        // /auth/me triggered the global cleanup; the page is reloading.
        return;
      }
    } else {
      host.innerHTML = `<p class="text-danger">Erreur : ${escapeHtml(msg)}</p>`;
      return;
    }
  }
  // Refresh the nav badge once we hit this view (we may have just marked a
  // thread read elsewhere).
  refreshMessagesNavBadge();

  if (!convs.length) {
    document.getElementById('msg-conv-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="message-square-off"></i></div>
        <p>Aucun fournisseur enregistré.</p>
        <p class="text-secondary text-sm">Ajoutez vos fournisseurs dans Opérations → Fournisseurs pour commencer une discussion.</p>
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

  document.getElementById('msg-conv-list').innerHTML = `
    <ul class="msg-conv-list">
      ${convs.map(c => {
        const previewPrefix = c.last_message
          ? (c.last_sender_type === 'restaurant' ? 'Vous : ' : '')
          : '';
        const preview = c.last_message
          ? escapeHtml(previewPrefix + c.last_message)
          : '<span class="text-tertiary">Aucun message — démarrez la conversation.</span>';
        return `
          <li>
            <a href="#/messages/${c.supplier_id}" class="msg-conv-item ${c.unread_count > 0 ? 'msg-conv-item--unread' : ''}">
              <div class="msg-conv-item__avatar">${escapeHtml((c.supplier_name || '?').charAt(0).toUpperCase())}</div>
              <div class="msg-conv-item__main">
                <div class="msg-conv-item__head">
                  <strong>${escapeHtml(c.supplier_name || '—')}</strong>
                  <span class="text-tertiary text-sm">${fmtRelative(c.last_message_at)}</span>
                </div>
                <div class="msg-conv-item__preview">${preview}</div>
              </div>
              ${c.unread_count > 0
                ? `<span class="msg-conv-item__badge">${c.unread_count}</span>`
                : ''}
            </a>
          </li>`;
      }).join('')}
    </ul>
  `;
}

async function renderMessagesThread(supplierId) {
  _stopMessagesPoll();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="msg-thread-shell">
      <header class="msg-thread__head">
        <a href="#/messages" class="btn-icon msg-thread__back" aria-label="Retour aux conversations">
          <i data-lucide="arrow-left" style="width:18px;height:18px"></i>
        </a>
        <div id="msg-thread-title" class="msg-thread__title">
          <strong>Chargement…</strong>
        </div>
      </header>
      <main class="msg-thread__body" id="msg-thread-body">
        <div class="loading"><div class="spinner"></div></div>
      </main>
      <footer class="msg-thread__composer">
        <textarea id="msg-thread-input" class="msg-thread__input"
                  placeholder="Écrivez votre message…"
                  rows="2" maxlength="2000"></textarea>
        <button class="msg-thread__send" id="msg-thread-send" aria-label="Envoyer">
          <i data-lucide="send" style="width:18px;height:18px"></i>
        </button>
      </footer>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  const inputEl = document.getElementById('msg-thread-input');
  const sendBtn = document.getElementById('msg-thread-send');

  // If the URL hash carried context (e.g. ?related_to=order&related_id=42),
  // pre-fill a contextual line. We support this via location.hash query-string
  // since the Router only takes the path part.
  let pendingRelated = null;
  try {
    const hash = String(window.location.hash || '');
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const qs = new URLSearchParams(hash.slice(qIdx + 1));
      const rt = qs.get('related_to');
      const rid = qs.get('related_id');
      const ref = qs.get('ref');
      if (rt && rid) {
        pendingRelated = { related_to: rt, related_id: Number(rid) };
        const label = rt === 'order' ? 'Commande' : (rt === 'delivery' ? 'BL' : 'Élément');
        inputEl.value = `Concernant ${label} ${ref || `#${rid}`} : `;
        // Auto-focus + place cursor at the end so the chef can type.
        setTimeout(() => {
          inputEl.focus();
          inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
        }, 50);
      }
    }
  } catch (_) { /* url parsing edge case — ignore */ }

  async function loadThread() {
    // The 15s poller can fire after the user has navigated away — bail if the
    // thread DOM is gone. Without these guards the poll throws TypeError on
    // null.innerHTML and pollutes the error log.
    let data;
    try {
      data = await API.getMessageThread(supplierId);
    } catch (e) {
      // Same recoverable-401 pattern as renderMessagesConversations — never
      // auto-logout from a thread page. The poller (15s setInterval) keeps
      // retrying so a transient blip self-heals without UI churn.
      const msg = String(e && e.message || '');
      const body = document.getElementById('msg-thread-body');
      if (!body) return;
      if (msg === '401') {
        body.innerHTML = `
          <div class="empty-state" role="alert" style="padding:var(--space-5)">
            <p>Impossible de charger la conversation.</p>
            <a href="#/messages" class="btn btn-secondary" style="margin-top:var(--space-3)">Retour aux conversations</a>
          </div>`;
        return;
      }
      body.innerHTML = `<p class="text-danger" style="padding:var(--space-4)">Erreur : ${escapeHtml(msg)}</p>`;
      return;
    }
    const titleEl = document.getElementById('msg-thread-title');
    if (!titleEl || !document.getElementById('msg-thread-body')) return;
    titleEl.innerHTML = `
      <strong>${escapeHtml(data.supplier.name || '—')}</strong>
      ${data.supplier.contact_name ? `<span class="text-secondary text-sm">· ${escapeHtml(data.supplier.contact_name)}</span>` : ''}
    `;
    _renderMessageBubbles('msg-thread-body', data.messages, 'restaurant');
    refreshMessagesNavBadge();
  }

  await loadThread();
  // Poll every 15s for incoming messages while the thread is open.
  _messagesPollTimer = setInterval(loadThread, 15_000);

  async function sendCurrent() {
    const text = inputEl.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      await API.sendMessage(supplierId, text, pendingRelated || {});
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
    // Shift+Enter = newline; plain Enter = send (matches Slack/WhatsApp).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCurrent();
    }
  });
}

// Shared bubble renderer — used by both restaurant and supplier views.
// `mySide` is the sender_type whose bubbles align right (sent).
function _renderMessageBubbles(hostId, messages, mySide) {
  const host = document.getElementById(hostId);
  if (!host) return;
  if (!messages.length) {
    host.innerHTML = `<p class="text-secondary" style="padding:var(--space-5);text-align:center">Aucun message. Lancez la conversation ci-dessous.</p>`;
    return;
  }
  const fmtTimeOnly = (s) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  const fmtDateOnly = (s) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yest = new Date(today.getTime() - 86_400_000);
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    if (dayStart.getTime() === today.getTime()) return 'Aujourd\'hui';
    if (dayStart.getTime() === yest.getTime()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
  };
  const contextBadge = (m) => {
    if (!m.related_to || !m.related_id) return '';
    const label = m.related_to === 'order'    ? `Commande #${m.related_id}`
                : m.related_to === 'delivery' ? `BL #${m.related_id}`
                : m.related_to === 'product'  ? `Produit #${m.related_id}`
                : `Réf #${m.related_id}`;
    return `<span class="msg-context-badge">${escapeHtml(label)}</span>`;
  };

  // Build the HTML, inserting a date separator when the day changes.
  let html = '';
  let prevDate = null;
  for (const m of messages) {
    const dayKey = String(m.created_at || '').slice(0, 10);
    if (dayKey !== prevDate) {
      html += `<div class="msg-date-sep"><span>${escapeHtml(fmtDateOnly(m.created_at))}</span></div>`;
      prevDate = dayKey;
    }
    const isMine = m.sender_type === mySide;
    const sideClass = isMine ? 'msg-bubble--mine' : 'msg-bubble--theirs';
    const status = isMine
      ? (m.read_at ? 'Lu' : 'Envoyé')
      : '';
    html += `
      <div class="msg-row ${isMine ? 'msg-row--mine' : 'msg-row--theirs'}">
        <div class="msg-bubble ${sideClass}">
          ${!isMine ? `<div class="msg-bubble__sender">${escapeHtml(m.sender_name || '')}</div>` : ''}
          ${contextBadge(m)}
          <div class="msg-bubble__text">${escapeHtml(m.message).replace(/\n/g, '<br>')}</div>
          <div class="msg-bubble__meta">
            <span class="msg-bubble__time">${fmtTimeOnly(m.created_at)}</span>
            ${status ? `<span class="msg-bubble__status">${status}</span>` : ''}
          </div>
        </div>
      </div>`;
  }
  host.innerHTML = html;
  // Scroll to bottom on update so newest message is visible.
  host.scrollTop = host.scrollHeight;
}

// Nav badge helpers — refresh the unread count on the Messages nav item.
async function refreshMessagesNavBadge() {
  if (typeof API.getMessageUnreadCount !== 'function') return;
  try {
    const { count } = await API.getMessageUnreadCount();
    _setMessagesNavBadge(count);
  } catch (_) { /* offline / 401 — silent */ }
}
function _setMessagesNavBadge(count) {
  const links = document.querySelectorAll('a[data-route="/messages"]');
  links.forEach(a => {
    let badge = a.querySelector('.nav-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        a.appendChild(badge);
      }
      badge.textContent = String(count);
    } else if (badge) {
      badge.remove();
    }
  });
}
function startMessagesNavBadgePolling() {
  if (_messagesNavBadgeTimer) return;
  refreshMessagesNavBadge();
  _messagesNavBadgeTimer = setInterval(refreshMessagesNavBadge, 60_000);
}
