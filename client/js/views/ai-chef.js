// ═══════════════════════════════════════════
// Alto (legacy /chef view) — contextual chat variant
// Kept for the legacy /chef route (redirected to /ia by router)
// ═══════════════════════════════════════════

let _chefHistory = [];
let _chefLoading = false;

async function renderAIChef() {
  const app = document.getElementById('app');
  _chefHistory = [];
  _chefLoading = false;

  app.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 80px);max-width:800px;margin:0 auto">
      <div class="view-header" style="flex-shrink:0;padding-bottom:var(--space-3)">
        <a href="#/" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Accueil
        </a>
        <h1 style="display:flex;align-items:center;gap:8px">
          <i data-lucide="sparkles" style="width:28px;height:28px;vertical-align:middle;margin-right:8px"></i>Alto
        </h1>
        <p class="text-secondary" style="font-size:var(--text-sm)">Assistant culinaire intelligent qui connaît votre restaurant</p>
      </div>

      <div id="chef-messages" style="flex:1;overflow-y:auto;padding:var(--space-3) 0;display:flex;flex-direction:column;gap:var(--space-3)">
        <div class="chef-msg chef-msg--ai">
          <div class="chef-msg__avatar">✨</div>
          <div class="chef-msg__bubble">
            <p>Bonjour ! Je suis <strong>Alto</strong>, votre assistant culinaire intelligent.</p>
            <p style="margin-top:8px">Je connais vos fiches techniques, vos stocks, vos fournisseurs et vos données HACCP. Posez-moi vos questions !</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
              <button class="chef-suggestion" onclick="sendChefSuggestion('Quel est mon food cost moyen et comment l\\'améliorer ?')"><i data-lucide="bar-chart-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Food cost</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Quels ingrédients sont en stock bas ?')"><i data-lucide="package" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Stock bas</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Analyse mes pertes sur les 30 derniers jours')"><i data-lucide="trending-down" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Pertes</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Quels plats ont la meilleure marge ?')"><i data-lucide="dollar-sign" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Marges</button>
              <button class="chef-suggestion" onclick="sendChefSuggestion('Donne-moi des conseils HACCP pour cette semaine')"><i data-lucide="shield" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>HACCP</button>
            </div>
          </div>
        </div>
      </div>

      <div style="flex-shrink:0;padding:var(--space-3) 0;border-top:1px solid var(--border-light)">
        <form id="chef-form" style="display:flex;gap:var(--space-2)">
          <input type="text" id="chef-input" class="input" placeholder="Posez votre question à Alto…"
            style="flex:1;font-size:var(--text-base)" autocomplete="off">
          <button type="submit" class="btn btn-primary" id="chef-send-btn" style="padding:8px 16px">
            <i data-lucide="send" style="width:18px;height:18px"></i>
          </button>
        </form>
      </div>
    </div>

    <style>
      .chef-msg { display:flex;gap:10px;max-width:90% }
      .chef-msg--user { align-self:flex-end;flex-direction:row-reverse }
      .chef-msg__avatar { width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;background:var(--bg-sunken) }
      .chef-msg--user .chef-msg__avatar { background:var(--color-accent);color:white;font-size:0.8rem }
      .chef-msg__bubble { background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:12px 16px;font-size:var(--text-sm);line-height:1.6 }
      .chef-msg--user .chef-msg__bubble { background:var(--color-accent);color:white;border-color:transparent }
      .chef-msg__bubble p { margin:0 }
      .chef-msg__bubble p + p { margin-top:8px }
      .chef-msg__bubble strong { font-weight:600 }
      .chef-msg__bubble ul, .chef-msg__bubble ol { margin:8px 0;padding-left:20px }
      .chef-msg__bubble li { margin:4px 0 }
      .chef-suggestion { background:var(--bg-sunken);border:1px solid var(--border-light);border-radius:20px;padding:6px 12px;font-size:var(--text-xs);cursor:pointer;white-space:nowrap }
      .chef-suggestion:hover { background:var(--color-accent-light);border-color:var(--color-accent) }
      .chef-typing { display:flex;gap:4px;padding:8px 0 }
      .chef-typing span { width:8px;height:8px;border-radius:50%;background:var(--text-tertiary);animation:chefTyping 1.4s infinite }
      .chef-typing span:nth-child(2) { animation-delay:0.2s }
      .chef-typing span:nth-child(3) { animation-delay:0.4s }
      @keyframes chefTyping { 0%,60%,100%{opacity:0.3} 30%{opacity:1} }
    </style>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('chef-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chef-input');
    const msg = input.value.trim();
    if (msg && !_chefLoading) {
      input.value = '';
      sendChefMessage(msg);
    }
  });
}

function sendChefSuggestion(text) {
  if (!_chefLoading) sendChefMessage(text);
}

async function sendChefMessage(message) {
  if (_chefLoading) return;
  _chefLoading = true;

  const messagesEl = document.getElementById('chef-messages');
  const sendBtn = document.getElementById('chef-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'chef-msg chef-msg--user';
  userMsg.innerHTML = `
    <div class="chef-msg__avatar">Moi</div>
    <div class="chef-msg__bubble">${escapeHtml(message)}</div>
  `;
  messagesEl.appendChild(userMsg);

  // Add typing indicator
  const typing = document.createElement('div');
  typing.className = 'chef-msg chef-msg--ai';
  typing.id = 'chef-typing';
  typing.innerHTML = `
    <div class="chef-msg__avatar">✨</div>
    <div class="chef-msg__bubble"><div class="chef-typing"><span></span><span></span><span></span></div></div>
  `;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const result = await API.request('/ai/chef', {
      method: 'POST',
      body: { message, conversation_history: _chefHistory }
    });

    _chefHistory.push({ role: 'user', text: message });
    _chefHistory.push({ role: 'model', text: result.reply });

    // Remove typing indicator
    typing.remove();

    // Add AI response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'chef-msg chef-msg--ai';
    aiMsg.innerHTML = `
      <div class="chef-msg__avatar">✨</div>
      <div class="chef-msg__bubble">${formatChefReply(result.reply)}</div>
    `;
    messagesEl.appendChild(aiMsg);
  } catch (e) {
    typing.remove();
    const errMsg = document.createElement('div');
    errMsg.className = 'chef-msg chef-msg--ai';
    errMsg.innerHTML = `
      <div class="chef-msg__avatar">✨</div>
      <div class="chef-msg__bubble">
        <p>Alto est temporairement indisponible. Veuillez réessayer dans quelques instants.</p>
      </div>
    `;
    messagesEl.appendChild(errMsg);
    console.error('[Alto/chef] Error:', e.message);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
  _chefLoading = false;
  if (sendBtn) sendBtn.disabled = false;
  document.getElementById('chef-input')?.focus();
}

function formatChefReply(text) {
  // Basic markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:2px 4px;border-radius:3px">$1</code>')
    .replace(/^### (.*$)/gm, '<h4 style="margin:12px 0 6px;font-size:var(--text-sm)">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 style="margin:12px 0 6px">$1</h3>')
    .replace(/^- (.*$)/gm, '<li style="margin-left:16px">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li style="margin-left:16px">$2</li>')
    .replace(/\n{2,}/g, '</p><p style="margin-top:8px">')
    .replace(/\n/g, '<br>');
}
