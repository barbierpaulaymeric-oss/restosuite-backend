// ═══════════════════════════════════════════
// Floating AI Bubble — Voice + Chat
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

  // Create bubble container
  const container = document.createElement('div');
  container.id = 'floating-ai-bubble-container';
  container.innerHTML = `
    <style>
      #floating-ai-bubble-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        font-family: var(--font-sans);
      }

      .bubble-fab {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--color-accent);
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(232, 114, 42, 0.3);
        transition: all 0.2s;
        font-size: 1.5rem;
      }

      .bubble-fab:hover {
        background: var(--color-accent-hover);
        box-shadow: 0 6px 16px rgba(232, 114, 42, 0.4);
        transform: scale(1.05);
      }

      .bubble-fab.listening {
        animation: bubblePulse 1.5s infinite;
      }

      @keyframes bubblePulse {
        0%, 100% { box-shadow: 0 4px 12px rgba(232, 114, 42, 0.3); transform: scale(1); }
        50% { box-shadow: 0 4px 20px rgba(232, 114, 42, 0.6); transform: scale(1.08); }
      }

      .bubble-panel {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 320px;
        max-height: 500px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-light);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: bubbleSlideUp 0.2s ease-out;
      }

      @keyframes bubbleSlideUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .bubble-header {
        padding: var(--space-3);
        border-bottom: 1px solid var(--border-light);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .bubble-header h3 {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: 600;
      }

      .bubble-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bubble-messages {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .bubble-msg {
        font-size: var(--text-xs);
        line-height: 1.4;
        padding: 8px 10px;
        border-radius: 8px;
        max-width: 90%;
        word-wrap: break-word;
      }

      .bubble-msg.user {
        background: var(--color-accent);
        color: white;
        align-self: flex-end;
      }

      .bubble-msg.ai {
        background: var(--bg-sunken);
        color: var(--text-primary);
        align-self: flex-start;
      }

      .bubble-input-area {
        padding: var(--space-3);
        border-top: 1px solid var(--border-light);
        display: flex;
        gap: var(--space-2);
      }

      .bubble-voice-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--color-accent);
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s;
      }

      .bubble-voice-btn:hover {
        background: var(--color-accent-hover);
      }

      .bubble-voice-btn.recording {
        animation: voiceRecording 0.8s infinite;
      }

      @keyframes voiceRecording {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      .bubble-text-input {
        flex: 1;
        background: var(--bg-sunken);
        border: 1px solid var(--border-light);
        border-radius: 6px;
        padding: 6px 10px;
        color: var(--text-primary);
        font-size: var(--text-xs);
        font-family: var(--font-sans);
      }

      .bubble-text-input::placeholder {
        color: var(--text-tertiary);
      }

      .bubble-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--color-primary-light);
        border: none;
        color: var(--color-accent);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .bubble-send-btn:hover {
        background: var(--color-primary);
      }

      .bubble-transcript {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        padding: 8px;
        background: var(--bg-sunken);
        border-radius: 6px;
        margin-bottom: 8px;
      }

      .bubble-loading {
        display: flex;
        gap: 4px;
      }

      .bubble-loading span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--text-tertiary);
        animation: bubbleLoadingBounce 1s infinite;
      }

      .bubble-loading span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .bubble-loading span:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes bubbleLoadingBounce {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }

      @media (max-width: 640px) {
        #floating-ai-bubble-container {
          bottom: 10px;
          right: 10px;
        }

        .bubble-panel {
          width: calc(100vw - 20px);
          max-height: calc(100vh - 100px);
        }
      }
    </style>

    <button class="bubble-fab" id="bubble-fab" title="Assistant IA">🎤</button>
    <div class="bubble-panel" id="bubble-panel" style="display:none">
      <div class="bubble-header">
        <h3>Assistant IA</h3>
        <button class="bubble-close" id="bubble-close">✕</button>
      </div>
      <div class="bubble-messages" id="bubble-messages"></div>
      <div id="bubble-transcript" class="bubble-transcript" style="display:none"></div>
      <div class="bubble-input-area">
        <button class="bubble-voice-btn" id="bubble-voice-btn" title="Enregistrer au micro">🎤</button>
        <input type="text" class="bubble-text-input" id="bubble-text-input" placeholder="Votre question…" autocomplete="off">
        <button class="bubble-send-btn" id="bubble-send-btn" title="Envoyer">⬆</button>
      </div>
    </div>
  `;

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
  btn.classList.add('recording');
  _bubbleState.listening = true;

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
    if (event.error !== 'no-speech') {
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
  btn.classList.remove('recording');
  _bubbleState.listening = false;
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
    showBubbleMessage('Erreur : ' + e.message, 'ai');
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

    actionEl.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600">${escapeHtml(action.description)}</div>
      <div style="display: flex; gap: 6px">
        <button onclick="confirmBubbleAction('${action.type}', '${btoa(JSON.stringify(action.params))}'" style="flex: 1; padding: 4px 8px; background: var(--color-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--text-xs)">Confirmer</button>
        <button onclick="closeBubbleAction(this)" style="flex: 1; padding: 4px 8px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border-light); border-radius: 4px; cursor: pointer; font-size: var(--text-xs)">Annuler</button>
      </div>
    `;

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
