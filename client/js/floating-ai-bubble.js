// ═══════════════════════════════════════════
// Alto — Floating assistant bubble (voice + chat)
// Persistent across page navigation
// ═══════════════════════════════════════════

let _bubbleState = {
  visible: true,
  listening: false,
  transcript: '',
  aiResponse: '',
  history: []
};

function initFloatingAIBubble() {
  // Only init on app pages (not login/landing)
  const token = localStorage.getItem('restosuite_token');
  if (!token) return;

  // SVG icons (inline, no lucide dependency for the bubble itself)
  const ICON_MIC = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const ICON_STOP = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`;
  const ICON_SEND = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  // Create bubble container
  const container = document.createElement('div');
  container.id = 'floating-ai-bubble-container';
  container.innerHTML = `
    <style>
      #floating-ai-bubble-container {
        position: fixed;
        bottom: 88px;
        right: 20px;
        z-index: 1000;
        font-family: var(--font-sans);
      }
      @media (min-width: 768px) {
        #floating-ai-bubble-container { bottom: 24px; }
      }

      .bubble-fab {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #C45A18;
        border: none;
        color: #F7F5F2;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 20px rgba(196, 90, 24, 0.35);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .bubble-fab:hover {
        box-shadow: 0 10px 24px rgba(196, 90, 24, 0.45);
        transform: scale(1.06);
      }

      .bubble-fab:active { transform: scale(0.96); }

      .bubble-fab.listening::before,
      .bubble-fab.listening::after {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 2px solid #C45A18;
        animation: bubbleRingPulse 1.6s ease-out infinite;
        pointer-events: none;
      }
      .bubble-fab.listening::after { animation-delay: 0.8s; }

      @keyframes bubbleRingPulse {
        0%   { transform: scale(1);   opacity: 0.7; }
        100% { transform: scale(1.6); opacity: 0; }
      }

      .bubble-panel {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 340px;
        max-height: 520px;
        background: #1B2A4A;
        color: #F7F5F2;
        border: 1px solid rgba(247, 245, 242, 0.1);
        border-radius: 16px;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: bubbleSlideUp 0.2s ease-out;
      }

      @keyframes bubbleSlideUp {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0);   }
      }

      .bubble-header {
        padding: 14px 16px;
        border-bottom: 1px solid rgba(247, 245, 242, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: linear-gradient(180deg, rgba(196, 90, 24, 0.08), transparent);
      }

      .bubble-header h3 {
        margin: 0;
        font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
        font-size: 20px;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: #F7F5F2;
      }

      .bubble-header .bubble-title-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #C45A18;
        margin-left: 6px;
        vertical-align: 2px;
      }

      .bubble-close {
        background: none;
        border: none;
        color: rgba(247, 245, 242, 0.6);
        cursor: pointer;
        padding: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
      }
      .bubble-close:hover {
        background: rgba(247, 245, 242, 0.08);
        color: #F7F5F2;
      }

      .bubble-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .bubble-msg {
        font-size: 13px;
        line-height: 1.5;
        padding: 9px 12px;
        border-radius: 10px;
        max-width: 88%;
        word-wrap: break-word;
      }

      .bubble-msg.user {
        background: #C45A18;
        color: #F7F5F2;
        align-self: flex-end;
      }

      .bubble-msg.ai {
        background: rgba(247, 245, 242, 0.06);
        color: #F7F5F2;
        align-self: flex-start;
      }

      .bubble-input-area {
        padding: 12px;
        border-top: 1px solid rgba(247, 245, 242, 0.08);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .bubble-voice-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #C45A18;
        border: none;
        color: #F7F5F2;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s, transform 0.15s;
      }
      .bubble-voice-btn:hover { transform: scale(1.05); }

      .bubble-voice-btn.recording {
        background: #B91C1C;
        animation: voiceRecordingPulse 1s infinite;
      }

      @keyframes voiceRecordingPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.6); }
        50%      { box-shadow: 0 0 0 8px rgba(185, 28, 28, 0); }
      }

      .bubble-text-input {
        flex: 1;
        min-width: 0;
        background: rgba(247, 245, 242, 0.06);
        border: 1px solid rgba(247, 245, 242, 0.1);
        border-radius: 10px;
        padding: 9px 12px;
        color: #F7F5F2;
        font-size: 13px;
        font-family: var(--font-sans);
      }
      .bubble-text-input:focus {
        outline: none;
        border-color: rgba(196, 90, 24, 0.6);
      }
      .bubble-text-input::placeholder {
        color: rgba(247, 245, 242, 0.4);
      }

      .bubble-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(247, 245, 242, 0.08);
        border: none;
        color: #F7F5F2;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s;
      }
      .bubble-send-btn:hover { background: rgba(247, 245, 242, 0.14); }

      .bubble-transcript {
        font-size: 12px;
        color: rgba(247, 245, 242, 0.7);
        padding: 8px 12px;
        background: rgba(196, 90, 24, 0.1);
        border-left: 2px solid #C45A18;
        margin: 0 16px 8px;
        border-radius: 6px;
      }

      .bubble-loading {
        display: flex;
        gap: 4px;
      }
      .bubble-loading span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(247, 245, 242, 0.5);
        animation: bubbleLoadingBounce 1s infinite;
      }
      .bubble-loading span:nth-child(2) { animation-delay: 0.15s; }
      .bubble-loading span:nth-child(3) { animation-delay: 0.3s; }

      @keyframes bubbleLoadingBounce {
        0%, 100% { opacity: 0.3; transform: translateY(0); }
        50%      { opacity: 1;   transform: translateY(-2px); }
      }

      @media (max-width: 640px) {
        #floating-ai-bubble-container {
          bottom: 88px;
          right: 12px;
        }
        .bubble-panel {
          width: calc(100vw - 24px);
          max-height: calc(100vh - 180px);
        }
      }
    </style>

    <button class="bubble-fab" id="bubble-fab" aria-label="Alto — assistant culinaire" title="Alto — assistant culinaire">
      ${ICON_MIC}
    </button>
    <div class="bubble-panel" id="bubble-panel" style="display:none" role="dialog" aria-label="Alto assistant">
      <div class="bubble-header">
        <h3>Alto<span class="bubble-title-dot" aria-hidden="true"></span></h3>
        <button class="bubble-close" id="bubble-close" aria-label="Fermer">${ICON_CLOSE}</button>
      </div>
      <div class="bubble-messages" id="bubble-messages"></div>
      <div id="bubble-transcript" class="bubble-transcript" style="display:none"></div>
      <div class="bubble-input-area">
        <button class="bubble-voice-btn" id="bubble-voice-btn" aria-label="Enregistrer au micro" title="Parler à Alto">${ICON_MIC}</button>
        <input type="text" class="bubble-text-input" id="bubble-text-input" placeholder="Parlez à Alto…" autocomplete="off">
        <button class="bubble-send-btn" id="bubble-send-btn" aria-label="Envoyer" title="Envoyer">${ICON_SEND}</button>
      </div>
    </div>
  `;
  // Stash icons for runtime swap (mic ↔ stop when recording)
  container._icons = { mic: ICON_MIC, stop: ICON_STOP, close: ICON_CLOSE, send: ICON_SEND };

  document.body.appendChild(container);

  // Event listeners
  document.getElementById('bubble-fab').addEventListener('click', toggleBubblePanel);
  document.getElementById('bubble-close').addEventListener('click', closeBubblePanel);
  document.getElementById('bubble-voice-btn').addEventListener('click', toggleVoiceRecording);
  document.getElementById('bubble-send-btn').addEventListener('click', sendBubbleMessage);
  document.getElementById('bubble-text-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBubbleMessage();
    }
  });

  // Load history from localStorage
  const savedHistory = localStorage.getItem('bubble_chat_history');
  if (savedHistory) {
    try {
      _bubbleState.history = JSON.parse(savedHistory);
      renderBubbleMessages();
    } catch (e) {
      console.warn('Could not load bubble history:', e);
    }
  }
}

function toggleBubblePanel() {
  const panel = document.getElementById('bubble-panel');
  const fab = document.getElementById('bubble-fab');
  const visible = panel.style.display !== 'none';

  if (visible) {
    closeBubblePanel();
  } else {
    panel.style.display = 'flex';
    fab.classList.add('expanded');
    setTimeout(() => document.getElementById('bubble-text-input')?.focus(), 100);
  }
}

function closeBubblePanel() {
  const panel = document.getElementById('bubble-panel');
  const fab = document.getElementById('bubble-fab');
  panel.style.display = 'none';
  fab.classList.remove('expanded');
}

function toggleVoiceRecording() {
  const recognition = window.webkitSpeechRecognition || window.SpeechRecognition;
  if (!recognition) {
    alert('Reconnaissance vocale non supportée par votre navigateur');
    return;
  }

  if (_bubbleState.listening) {
    stopVoiceRecording();
    return;
  }

  const rec = new recognition();
  rec.lang = 'fr-FR';
  rec.continuous = true;
  rec.interimResults = true;

  const btn = document.getElementById('bubble-voice-btn');
  const fab = document.getElementById('bubble-fab');
  const container = document.getElementById('floating-ai-bubble-container');
  btn.classList.add('recording');
  if (fab) fab.classList.add('listening');
  // Swap mic icon for stop icon while recording
  if (container && container._icons) btn.innerHTML = container._icons.stop;
  btn.setAttribute('aria-label', 'Arrêter');
  btn.title = 'Arrêter';
  _bubbleState.listening = true;
  _bubbleState.recognition = rec;

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        _bubbleState.transcript += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    const transcriptEl = document.getElementById('bubble-transcript');
    if (_bubbleState.transcript || interim) {
      transcriptEl.textContent = (_bubbleState.transcript + interim).trim();
      transcriptEl.style.display = 'block';
    }
  };

  rec.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showBubbleMessage('Erreur reconnaissance vocale: ' + event.error, 'ai');
    }
    stopVoiceRecording();
  };

  rec.onend = () => {
    stopVoiceRecording();
    if (_bubbleState.transcript.trim()) {
      sendBubbleMessage(_bubbleState.transcript.trim());
      _bubbleState.transcript = '';
      document.getElementById('bubble-transcript').style.display = 'none';
    }
  };

  rec.start();
}

function stopVoiceRecording() {
  const btn = document.getElementById('bubble-voice-btn');
  const fab = document.getElementById('bubble-fab');
  const container = document.getElementById('floating-ai-bubble-container');
  if (btn) {
    btn.classList.remove('recording');
    if (container && container._icons) btn.innerHTML = container._icons.mic;
    btn.setAttribute('aria-label', 'Enregistrer au micro');
    btn.title = 'Parler à Alto';
  }
  if (fab) fab.classList.remove('listening');
  _bubbleState.listening = false;
  if (_bubbleState.recognition) {
    try { _bubbleState.recognition.stop(); } catch (_) {}
    _bubbleState.recognition = null;
  }
}

async function sendBubbleMessage(msg) {
  let message = msg || document.getElementById('bubble-text-input')?.value?.trim();
  if (!message) return;

  document.getElementById('bubble-text-input').value = '';

  // Add user message
  showBubbleMessage(message, 'user');
  _bubbleState.history.push({ role: 'user', text: message });

  // Show loading
  const messagesEl = document.getElementById('bubble-messages');
  const loadingEl = document.createElement('div');
  loadingEl.className = 'bubble-msg ai';
  loadingEl.innerHTML = '<div class="bubble-loading"><span></span><span></span><span></span></div>';
  loadingEl.id = 'bubble-loading';
  messagesEl.appendChild(loadingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const result = await API.request('/ai/assistant', {
      method: 'POST',
      body: {
        message,
        conversation_history: _bubbleState.history
      }
    });

    loadingEl.remove();

    if (result.reply) {
      showBubbleMessage(result.reply, 'ai');
      _bubbleState.history.push({ role: 'model', text: result.reply });

      // Show actions if present
      if (result.actions && result.actions.length > 0) {
        showBubbleActions(result.actions);
      }

      // Save history
      localStorage.setItem('bubble_chat_history', JSON.stringify(_bubbleState.history));
    }
  } catch (e) {
    loadingEl.remove();
    showBubbleMessage('Alto est temporairement indisponible. Veuillez réessayer dans quelques instants.', 'ai');
    console.error('[Alto/bubble] Error:', e.message);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showBubbleMessage(text, role) {
  const messagesEl = document.getElementById('bubble-messages');
  const msgEl = document.createElement('div');
  msgEl.className = `bubble-msg ${role}`;
  msgEl.textContent = text;
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showBubbleActions(actions) {
  const messagesEl = document.getElementById('bubble-messages');

  for (const action of actions) {
    if (!action.requires_confirmation) continue;

    const actionEl = document.createElement('div');
    actionEl.style.cssText = `
      background: var(--color-accent-light);
      border: 1px solid var(--color-accent);
      border-radius: 8px;
      padding: 10px;
      margin: 4px 0;
      font-size: var(--text-xs);
    `;

    // PENTEST_REPORT C7.1: the original inline onclick interpolated action.type and
    // the base64 params directly inside single-quote-delimited HTML attributes,
    // with a broken unclosed `'` that widened the break-out surface further.
    // Bind handlers programmatically so user/model-influenced strings never touch
    // the attribute parser.
    actionEl.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600">${escapeHtml(action.description)}</div>
      <div style="display: flex; gap: 6px">
        <button class="bubble-action-confirm" type="button" style="flex: 1; padding: 4px 8px; background: var(--color-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--text-xs)">Confirmer</button>
        <button class="bubble-action-cancel" type="button" style="flex: 1; padding: 4px 8px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border-light); border-radius: 4px; cursor: pointer; font-size: var(--text-xs)">Annuler</button>
      </div>
    `;
    const confirmBtn = actionEl.querySelector('.bubble-action-confirm');
    const cancelBtn = actionEl.querySelector('.bubble-action-cancel');
    const capturedAction = { type: String(action.type || ''), params: action.params };
    confirmBtn.addEventListener('click', () => {
      confirmBubbleAction(capturedAction.type, btoa(JSON.stringify(capturedAction.params)));
    });
    cancelBtn.addEventListener('click', () => closeBubbleAction(cancelBtn));

    messagesEl.appendChild(actionEl);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function confirmBubbleAction(type, paramsBase64) {
  try {
    const params = JSON.parse(atob(paramsBase64));
    const result = await API.request('/ai/execute-action', {
      method: 'POST',
      body: { type, params }
    });

    if (result.success) {
      showBubbleMessage('✓ ' + result.message, 'ai');
    } else {
      showBubbleMessage('Erreur : ' + (result.error || 'Impossible d\'exécuter l\'action'), 'ai');
    }
  } catch (e) {
    showBubbleMessage('Erreur : ' + e.message, 'ai');
  }

  const messagesEl = document.getElementById('bubble-messages');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function closeBubbleAction(btn) {
  btn.closest('div').remove();
}

function renderBubbleMessages() {
  const messagesEl = document.getElementById('bubble-messages');
  messagesEl.innerHTML = '';

  for (const msg of _bubbleState.history) {
    const msgEl = document.createElement('div');
    msgEl.className = `bubble-msg ${msg.role}`;
    msgEl.textContent = msg.text;
    messagesEl.appendChild(msgEl);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Initialize on page load (but only if logged in)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => initFloatingAIBubble(), 500);
});
