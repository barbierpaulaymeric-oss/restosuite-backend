// ═══════════════════════════════════════════
// AI Assistant — Full-featured chat with actions
// Replaces and upgrades ai-chef.js
// ═══════════════════════════════════════════

let _aiHistory = [];
let _aiLoading = false;

async function renderAIAssistant() {
  const app = document.getElementById('app');
  _aiHistory = [];
  _aiLoading = false;

  app.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 80px);max-width:900px;margin:0 auto;padding:var(--space-3)">
      <div class="view-header" style="flex-shrink:0;margin-bottom:var(--space-4)">
        <h1 style="display:flex;align-items:center;gap:8px;margin:0">
          <i data-lucide="brain" style="width:28px;height:28px;vertical-align:middle;margin-right:8px"></i>Assistant IA
        </h1>
        <p class="text-secondary" style="font-size:var(--text-sm);margin-top:4px">Chef expert · Recommandations intelligentes · Actions confirmées</p>
      </div>

      <div id="ai-messages" style="flex:1;overflow-y:auto;padding:var(--space-3) 0;display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-4)">
        <div class="ai-msg ai-msg--ai">
          <div class="ai-msg__avatar">🧠</div>
          <div class="ai-msg__bubble">
            <p>Bonjour ! Je suis votre <strong>Assistant IA</strong> RestoSuite.</p>
            <p style="margin-top:8px">Je connais vos fiches techniques, vos stocks, vos fournisseurs et vos données HACCP. Je peux vous aider et exécuter des actions avec votre confirmation.</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
              <button class="ai-suggestion" onclick="sendAISuggestion('Quel est mon food cost moyen et comment l\\'améliorer ?')"><i data-lucide="bar-chart-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Food cost</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Quels ingrédients sont en stock bas ?')"><i data-lucide="package" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Stock</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Optimise les marges de mes plats')"><i data-lucide="dollar-sign" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Marges</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Enregistre une température de 5°C en chambre froide')"><i data-lucide="thermometer" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>HACCP</button>
            </div>
          </div>
        </div>
      </div>

      <div style="flex-shrink:0;padding:var(--space-3);border:1px solid var(--border-light);border-radius:var(--radius-lg);background:var(--bg-sunken)">
        <form id="ai-form" style="display:flex;gap:var(--space-2)">
          <button type="button" class="btn" id="ai-voice-btn" style="padding:8px 12px;background:var(--bg-elevated);border:1px solid var(--border-light);color:var(--text-secondary)" title="Enregistrer au micro">
            <i data-lucide="mic" style="width:18px;height:18px"></i>
          </button>
          <input type="text" id="ai-input" class="input" placeholder="Posez votre question à l'Assistant IA…"
            style="flex:1;font-size:var(--text-base)" autocomplete="off">
          <button type="submit" class="btn btn-primary" id="ai-send-btn" style="padding:8px 16px">
            <i data-lucide="send" style="width:18px;height:18px"></i>
          </button>
        </form>
      </div>
    </div>

    <style>
      .ai-msg { display:flex;gap:10px;max-width:85%;animation:aiMessageSlide 0.3s ease-out }
      .ai-msg--user { align-self:flex-end;flex-direction:row-reverse }
      .ai-msg__avatar { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;background:var(--bg-sunken) }
      .ai-msg--user .ai-msg__avatar { background:var(--color-accent);color:white;font-size:1rem }
      .ai-msg__bubble { background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:12px 16px;font-size:var(--text-sm);line-height:1.6 }
      .ai-msg--user .ai-msg__bubble { background:var(--color-accent);color:white;border-color:transparent }
      .ai-msg__bubble p { margin:0 }
      .ai-msg__bubble p + p { margin-top:8px }
      .ai-msg__bubble strong { font-weight:600 }
      .ai-msg__bubble ul, .ai-msg__bubble ol { margin:8px 0;padding-left:20px }
      .ai-msg__bubble li { margin:4px 0 }

      .ai-action-card {
        background:var(--color-accent-light);
        border:1px solid var(--color-accent);
        border-radius:var(--radius-lg);
        padding:var(--space-3);
        margin:var(--space-2) 0;
      }

      .ai-action-title {
        font-weight:600;
        font-size:var(--text-sm);
        margin-bottom:var(--space-2);
        display:flex;align-items:center;gap:8px
      }

      .ai-action-buttons {
        display:flex;gap:var(--space-2);
        margin-top:var(--space-2)
      }

      .ai-action-buttons button {
        flex:1;padding:8px 12px;border-radius:var(--radius-md);border:none;cursor:pointer;font-size:var(--text-sm);font-weight:500;transition:all 0.2s
      }

      .ai-action-confirm {
        background:var(--color-accent);color:white
      }

      .ai-action-confirm:hover {
        background:var(--color-accent-hover);transform:translateY(-1px)
      }

      .ai-action-cancel {
        background:transparent;color:var(--color-accent);border:1px solid var(--color-accent)
      }

      .ai-action-cancel:hover {
        background:rgba(232,114,42,0.05)
      }

      .ai-suggestion { background:var(--bg-sunken);border:1px solid var(--border-light);border-radius:20px;padding:6px 12px;font-size:var(--text-xs);cursor:pointer;white-space:nowrap;color:var(--text-primary);transition:all 0.2s }
      .ai-suggestion:hover { background:var(--color-accent-light);border-color:var(--color-accent);color:var(--text-primary) }
      .ai-typing { display:flex;gap:4px;padding:8px 0 }
      .ai-typing span { width:8px;height:8px;border-radius:50%;background:var(--text-tertiary);animation:aiTyping 1.4s infinite }
      .ai-typing span:nth-child(2) { animation-delay:0.2s }
      .ai-typing span:nth-child(3) { animation-delay:0.4s }
      @keyframes aiTyping { 0%,60%,100%{opacity:0.3} 30%{opacity:1} }
      @keyframes aiMessageSlide { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:translateY(0) } }
    </style>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('ai-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('ai-input');
    const msg = input.value.trim();
    if (msg && !_aiLoading) {
      input.value = '';
      sendAIMessage(msg);
    }
  });

  document.getElementById('ai-voice-btn').addEventListener('click', toggleAIVoice);
}

function sendAISuggestion(text) {
  if (!_aiLoading) sendAIMessage(text);
}

let _aiVoiceRecognition = null;

function toggleAIVoice() {
  const recognition = window.webkitSpeechRecognition || window.SpeechRecognition;
  if (!recognition) {
    showToast('Reconnaissance vocale non supportée', 'error');
    return;
  }

  if (_aiVoiceRecognition) {
    _aiVoiceRecognition.abort();
    _aiVoiceRecognition = null;
    document.getElementById('ai-voice-btn').style.opacity = '1';
    return;
  }

  _aiVoiceRecognition = new recognition();
  _aiVoiceRecognition.lang = 'fr-FR';
  _aiVoiceRecognition.continuous = false;
  _aiVoiceRecognition.interimResults = true;

  const btn = document.getElementById('ai-voice-btn');
  btn.style.opacity = '0.6';
  btn.style.background = 'var(--color-accent)';
  btn.style.color = 'white';

  let transcript = '';

  _aiVoiceRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        transcript += t + ' ';
      }
    }

    if (event.isFinal && transcript.trim()) {
      const input = document.getElementById('ai-input');
      input.value = transcript.trim();
      btn.style.opacity = '1';
      btn.style.background = '';
      btn.style.color = '';
      sendAIMessage(transcript.trim());
      _aiVoiceRecognition = null;
    }
  };

  _aiVoiceRecognition.onerror = (event) => {
    btn.style.opacity = '1';
    btn.style.background = '';
    btn.style.color = '';
    if (event.error !== 'no-speech') {
      showToast('Erreur vocale: ' + event.error, 'error');
    }
    _aiVoiceRecognition = null;
  };

  _aiVoiceRecognition.onend = () => {
    btn.style.opacity = '1';
    btn.style.background = '';
    btn.style.color = '';
    _aiVoiceRecognition = null;
  };

  _aiVoiceRecognition.start();
}

async function sendAIMessage(message) {
  if (_aiLoading) return;
  _aiLoading = true;

  const messagesEl = document.getElementById('ai-messages');
  const sendBtn = document.getElementById('ai-send-btn');
  const voiceBtn = document.getElementById('ai-voice-btn');
  if (sendBtn) sendBtn.disabled = true;
  if (voiceBtn) voiceBtn.disabled = true;

  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg ai-msg--user';
  userMsg.innerHTML = `
    <div class="ai-msg__avatar">👤</div>
    <div class="ai-msg__bubble">${escapeHtml(message)}</div>
  `;
  messagesEl.appendChild(userMsg);

  // Add typing indicator
  const typing = document.createElement('div');
  typing.className = 'ai-msg ai-msg--ai';
  typing.id = 'ai-typing';
  typing.innerHTML = `
    <div class="ai-msg__avatar">🧠</div>
    <div class="ai-msg__bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>
  `;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const result = await API.request('/ai/assistant', {
      method: 'POST',
      body: { message, conversation_history: _aiHistory }
    });

    _aiHistory.push({ role: 'user', text: message });
    _aiHistory.push({ role: 'model', text: result.reply });

    // Remove typing indicator
    typing.remove();

    // Add AI response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'ai-msg ai-msg--ai';
    aiMsg.innerHTML = `
      <div class="ai-msg__avatar">🧠</div>
      <div class="ai-msg__bubble">${formatAIReply(result.reply)}</div>
    `;
    messagesEl.appendChild(aiMsg);

    // Show actions if present
    if (result.actions && result.actions.length > 0) {
      for (const action of result.actions) {
        if (!action.requires_confirmation) continue;

        const actionEl = document.createElement('div');
        actionEl.className = 'ai-msg ai-msg--ai';
        actionEl.innerHTML = `
          <div class="ai-msg__avatar"></div>
          <div class="ai-action-card">
            <div class="ai-action-title">
              <i data-lucide="zap" style="width:16px;height:16px"></i> ${escapeHtml(action.description)}
            </div>
            <div class="ai-action-buttons">
              <button class="ai-action-confirm" onclick="confirmAIAction('${action.type}', '${btoa(JSON.stringify(action.params))}')">✓ Confirmer</button>
              <button class="ai-action-cancel" onclick="dismissAction(this)">✕ Annuler</button>
            </div>
          </div>
        `;
        messagesEl.appendChild(actionEl);
        if (window.lucide) lucide.createIcons();
      }
    }
  } catch (e) {
    typing.remove();
    const errMsg = document.createElement('div');
    errMsg.className = 'ai-msg ai-msg--ai';
    errMsg.innerHTML = `
      <div class="ai-msg__avatar">🧠</div>
      <div class="ai-msg__bubble" style="border-color:var(--color-danger)">
        <p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>
      </div>
    `;
    messagesEl.appendChild(errMsg);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
  _aiLoading = false;
  if (sendBtn) sendBtn.disabled = false;
  if (voiceBtn) voiceBtn.disabled = false;
  document.getElementById('ai-input')?.focus();
}

async function confirmAIAction(type, paramsBase64) {
  try {
    const params = JSON.parse(atob(paramsBase64));

    const messagesEl = document.getElementById('ai-messages');
    const loadingEl = document.createElement('div');
    loadingEl.className = 'ai-msg ai-msg--ai';
    loadingEl.innerHTML = `
      <div class="ai-msg__avatar">🧠</div>
      <div class="ai-msg__bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>
    `;
    messagesEl.appendChild(loadingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const result = await API.request('/ai/execute-action', {
      method: 'POST',
      body: { type, params }
    });

    loadingEl.remove();

    const resultMsg = document.createElement('div');
    resultMsg.className = 'ai-msg ai-msg--ai';
    if (result.success) {
      resultMsg.innerHTML = `
        <div class="ai-msg__avatar">✓</div>
        <div class="ai-msg__bubble" style="background:var(--color-success-light);border-color:var(--color-success)">
          <p style="color:var(--color-success);font-weight:500">${result.message}</p>
        </div>
      `;
    } else {
      resultMsg.innerHTML = `
        <div class="ai-msg__avatar">✕</div>
        <div class="ai-msg__bubble" style="border-color:var(--color-danger)">
          <p style="color:var(--color-danger)">${result.error || 'Impossible d\'exécuter l\'action'}</p>
        </div>
      `;
    }
    messagesEl.appendChild(resultMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

function dismissAction(btn) {
  btn.closest('.ai-action-card').parentElement.remove();
}

function formatAIReply(text) {
  // Basic markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.1);padding:2px 4px;border-radius:3px">$1</code>')
    .replace(/^### (.*$)/gm, '<h4 style="margin:12px 0 6px;font-size:var(--text-sm)">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 style="margin:12px 0 6px">$1</h3>')
    .replace(/^- (.*$)/gm, '<li style="margin-left:16px">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li style="margin-left:16px">$2</li>')
    .replace(/\n{2,}/g, '</p><p style="margin-top:8px">')
    .replace(/\n/g, '<br>');
}
