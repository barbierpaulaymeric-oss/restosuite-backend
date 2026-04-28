// ═══════════════════════════════════════════
// Alto — Assistant culinaire intelligent (Alto by RestoSuite)
// Full-featured chat with actions (replaces and upgrades ai-chef.js)
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
          <i data-lucide="sparkles" style="width:28px;height:28px;vertical-align:middle;margin-right:8px" aria-hidden="true"></i>Alto
        </h1>
        <p class="text-secondary" style="font-size:var(--text-sm);margin-top:4px">Assistant culinaire intelligent · Voix &amp; texte · Actions confirmées</p>
      </div>

      <div id="ai-messages" role="log" aria-live="polite" aria-label="Conversation avec Alto"
           style="flex:1;overflow-y:auto;padding:var(--space-3) 0;display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-4)">
        <div class="ai-msg ai-msg--ai">
          <div class="ai-msg__avatar" aria-hidden="true">✨</div>
          <div class="ai-msg__bubble">
            <p>Bonjour ! Je suis <strong>Alto</strong>, votre assistant culinaire intelligent.</p>
            <p style="margin-top:8px">Parlez-moi ou écrivez&nbsp;: je peux enregistrer vos relevés HACCP (températures, nettoyages, cuissons, refroidissements, non-conformités, plats témoins, traçabilité…), gérer vos stocks et commandes, ou analyser vos données. Vous validez, j’exécute.</p>
            <div role="group" aria-label="Suggestions de requêtes" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
              <button class="ai-suggestion" onclick="sendAISuggestion('Frigo 1 à 3,2°C, frigo 2 à 4°C, chambre froide à -18°C')"><i data-lucide="thermometer" style="width:14px;height:14px;vertical-align:middle;margin-right:4px" aria-hidden="true"></i>Relevé T° groupé</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('J\\'ai nettoyé les plans de travail, la trancheuse et les frigos')"><i data-lucide="sparkles" style="width:14px;height:14px;vertical-align:middle;margin-right:4px" aria-hidden="true"></i>Nettoyages</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Refroidissement blanquette, départ 72°C, arrivée 8°C en 1h45')"><i data-lucide="snowflake" style="width:14px;height:14px;vertical-align:middle;margin-right:4px" aria-hidden="true"></i>Refroidissement</button>
              <button class="ai-suggestion" onclick="sendAISuggestion('Quel est mon food cost moyen ?')"><i data-lucide="bar-chart-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px" aria-hidden="true"></i>Food cost</button>
            </div>
          </div>
        </div>
      </div>

      <div style="flex-shrink:0;padding:var(--space-3);border:1px solid var(--border-light);border-radius:var(--radius-lg);background:var(--bg-sunken)">
        <form id="ai-form" role="search" aria-label="Envoyer un message à Alto" style="display:flex;gap:var(--space-2)">
          <label for="ai-input" class="visually-hidden">Message à Alto</label>
          <button type="button" class="btn" id="ai-voice-btn" aria-label="Dicter au micro" aria-pressed="false"
                  style="padding:8px 12px;background:var(--bg-elevated);border:1px solid var(--border-light);color:var(--text-secondary)" title="Enregistrer au micro">
            <i data-lucide="mic" style="width:18px;height:18px" aria-hidden="true"></i>
          </button>
          <input type="text" id="ai-input" class="input" placeholder="Parlez à Alto ou écrivez votre demande…"
            aria-label="Message à Alto"
            style="flex:1;font-size:var(--text-base)" autocomplete="off" data-ui="custom">
          <button type="submit" class="btn btn-primary" id="ai-send-btn" aria-label="Envoyer le message" style="padding:8px 16px">
            <i data-lucide="send" style="width:18px;height:18px" aria-hidden="true"></i>
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
    const btn = document.getElementById('ai-voice-btn');
    btn.style.opacity = '1';
    btn.setAttribute('aria-pressed', 'false');
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
  btn.setAttribute('aria-pressed', 'true');

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
      btn.setAttribute('aria-pressed', 'false');
      sendAIMessage(transcript.trim());
      _aiVoiceRecognition = null;
    }
  };

  _aiVoiceRecognition.onerror = (event) => {
    btn.style.opacity = '1';
    btn.style.background = '';
    btn.style.color = '';
    btn.setAttribute('aria-pressed', 'false');
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showToast('Erreur vocale: ' + event.error, 'error');
    }
    _aiVoiceRecognition = null;
  };

  _aiVoiceRecognition.onend = () => {
    btn.style.opacity = '1';
    btn.style.background = '';
    btn.style.color = '';
    btn.setAttribute('aria-pressed', 'false');
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
  userMsg.setAttribute('role', 'listitem');
  userMsg.innerHTML = `
    <div class="ai-msg__avatar" aria-hidden="true">👤</div>
    <div class="ai-msg__bubble"><span class="visually-hidden">Vous : </span>${escapeHtml(message)}</div>
  `;
  messagesEl.appendChild(userMsg);

  // Add typing indicator
  const typing = document.createElement('div');
  typing.className = 'ai-msg ai-msg--ai';
  typing.id = 'ai-typing';
  typing.setAttribute('aria-label', 'Alto rédige une réponse');
  typing.innerHTML = `
    <div class="ai-msg__avatar" aria-hidden="true">✨</div>
    <div class="ai-msg__bubble"><div class="ai-typing" aria-hidden="true"><span></span><span></span><span></span></div></div>
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
    aiMsg.setAttribute('role', 'listitem');
    aiMsg.innerHTML = `
      <div class="ai-msg__avatar" aria-hidden="true">✨</div>
      <div class="ai-msg__bubble"><span class="visually-hidden">Alto : </span>${formatAIReply(result.reply)}</div>
    `;
    messagesEl.appendChild(aiMsg);

    // Show actions if present
    if (result.actions && result.actions.length > 0) {
      for (const action of result.actions) {
        if (!action.requires_confirmation) continue;

        const actionEl = document.createElement('div');
        actionEl.className = 'ai-msg ai-msg--ai';
        actionEl.setAttribute('role', 'region');
        actionEl.setAttribute('aria-label', 'Action proposée par Alto');
        // PENTEST_REPORT C7.1: action.type and the base64 params were interpolated
        // raw into onclick="..." with single-quote delimiters. A model-controlled
        // string containing `'` could break out and execute arbitrary JS.
        // escapeHtml now covers both quote variants; we also build the element
        // and bind the handler programmatically so there's no HTML-string sink
        // for the action payload at all.
        actionEl.innerHTML = `
          <div class="ai-msg__avatar" aria-hidden="true"></div>
          <div class="ai-action-card">
            <div class="ai-action-title">
              <i data-lucide="zap" style="width:16px;height:16px" aria-hidden="true"></i> ${escapeHtml(action.description)}
            </div>
            <div class="ai-action-buttons" role="group" aria-label="Valider ou annuler l'action">
              <button class="ai-action-confirm" aria-label="Confirmer l'action" type="button">✓ Confirmer</button>
              <button class="ai-action-cancel" aria-label="Annuler l'action" type="button">✕ Annuler</button>
            </div>
          </div>
        `;
        const confirmBtn = actionEl.querySelector('.ai-action-confirm');
        const cancelBtn = actionEl.querySelector('.ai-action-cancel');
        const capturedAction = { type: String(action.type || ''), params: action.params };
        confirmBtn.addEventListener('click', () => {
          confirmAIAction(capturedAction.type, btoa(JSON.stringify(capturedAction.params)));
        });
        cancelBtn.addEventListener('click', () => dismissAction(cancelBtn));
        messagesEl.appendChild(actionEl);
        if (window.lucide) lucide.createIcons();
      }
    }
  } catch (e) {
    typing.remove();
    const errMsg = document.createElement('div');
    errMsg.className = 'ai-msg ai-msg--ai';
    errMsg.setAttribute('role', 'alert');
    errMsg.innerHTML = `
      <div class="ai-msg__avatar" aria-hidden="true">✨</div>
      <div class="ai-msg__bubble">
        <p>Alto est temporairement indisponible. Veuillez réessayer dans quelques instants.</p>
      </div>
    `;
    messagesEl.appendChild(errMsg);
    console.error('[Alto/assistant] Error:', e.message);
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
      <div class="ai-msg__avatar">✨</div>
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
    // PENTEST_REPORT C7.3: escape server-returned strings before innerHTML to
    // prevent XSS when the backend surfaces model-influenced content.
    if (result.success) {
      resultMsg.innerHTML = `
        <div class="ai-msg__avatar">✓</div>
        <div class="ai-msg__bubble" style="background:var(--color-success-light);border-color:var(--color-success)">
          <p style="color:var(--color-success);font-weight:500">${escapeHtml(result.message)}</p>
        </div>
      `;
    } else {
      resultMsg.innerHTML = `
        <div class="ai-msg__avatar">✕</div>
        <div class="ai-msg__bubble" style="border-color:var(--color-danger)">
          <p style="color:var(--color-danger)">${escapeHtml(result.error || 'Impossible d\'exécuter l\'action')}</p>
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
  // PENTEST_REPORT C7.2: escape first, THEN apply markdown substitutions. The
  // previous version fed raw model output (attacker-influenceable via prompt
  // injection) straight into innerHTML → stored XSS + JWT exfil from localStorage.
  const safe = escapeHtml(text || '');
  return safe
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
