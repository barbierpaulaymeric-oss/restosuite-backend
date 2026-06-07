// Alto — assistant vocal omniprésent (dictée + recherche mains-libres) +
// interface de chat (texte ou voix) branchée sur POST /api/ai/chef.
// Utilise l'API Web Speech (SpeechRecognition) disponible dans la WebView ;
// la permission micro est déclarée côté natif (Info.plist / AndroidManifest).
import { h, icon, toast } from '../ui.js';
import { navigate } from '../router.js';
import { API } from '../api.js';

function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'fr-FR';
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

/**
 * Lance une écoute vocale.
 * @param {'search'|'command'} mode  'search' route vers les fiches avec le terme dicté.
 * @param {(text:string)=>void} [onResult]
 */
export function startVoice(mode = 'command', onResult) {
  const rec = getRecognition();
  if (!rec) { toast('Dictée non disponible sur cet appareil', 'error'); return; }

  const micBtn = document.querySelector('.mic-btn');
  micBtn && micBtn.classList.add('listening');
  toast('Parlez…');

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript.trim();
    if (onResult) return onResult(text);
    if (mode === 'search') { navigate('fiches'); setTimeout(() => { const f = document.querySelector('input[type="search"]'); if (f) { f.value = text; f.dispatchEvent(new Event('input')); } }, 60); }
    else toast('Entendu : ' + text, 'ok');
  };
  rec.onerror = () => toast('Je n\'ai pas entendu', 'error');
  rec.onend = () => micBtn && micBtn.classList.remove('listening');
  try { rec.start(); } catch { toast('Micro occupé', 'error'); }
}

// Suggestions rapides — pré-remplissent la saisie, le chef complète le nom du plat.
const QUICK_PROMPTS = [
  'Food cost du ',
  'Allergènes du ',
  'Recette ',
];

export function AltoScreen() {
  // Historique conversationnel envoyé à l'API (format { role, text }).
  const history = [];

  const thread = h('div', { class: 'chat-thread' });

  function scrollToEnd() {
    // Le conteneur de scroll est .app-main ; on défile après le rendu.
    requestAnimationFrame(() => {
      const main = document.querySelector('.app-main');
      if (main) main.scrollTop = main.scrollHeight;
    });
  }

  function bubble(role, text) {
    return h('div', { class: 'chat-row ' + role }, [
      h('div', { class: 'chat-bubble ' + role }, text),
    ]);
  }

  function addMessage(role, text) {
    thread.append(bubble(role, text));
    scrollToEnd();
  }

  function typingIndicator() {
    const el = h('div', { class: 'chat-row alto' }, [
      h('div', { class: 'chat-bubble alto typing' }, [
        h('span', { class: 'dot' }), h('span', { class: 'dot' }), h('span', { class: 'dot' }),
      ]),
    ]);
    thread.append(el);
    scrollToEnd();
    return el;
  }

  async function send(text) {
    const msg = (text || '').trim();
    if (!msg) return;
    input.value = '';
    addMessage('user', msg);
    history.push({ role: 'user', text: msg });

    const typing = typingIndicator();
    sendBtn.disabled = true;
    try {
      const data = await API.post('/ai/chef', { message: msg, conversation_history: history.slice(-10) });
      typing.remove();
      const reply = (data && data.reply) ? data.reply : 'Je n\'ai pas pu répondre.';
      addMessage('alto', reply);
      history.push({ role: 'model', text: reply });
    } catch (e) {
      typing.remove();
      const offline = e && e.code === 'NETWORK';
      addMessage('alto', offline ? 'Hors-ligne — Alto a besoin d\'une connexion.' : 'Erreur — réessayez dans un instant.');
    } finally {
      sendBtn.disabled = false;
    }
  }

  const input = h('input', {
    class: 'field', type: 'text', placeholder: 'Posez votre question à Alto…',
    onkeydown: (e) => { if (e.key === 'Enter') send(input.value); },
  });
  const micBtn = h('button', { class: 'chat-mic', 'aria-label': 'Dictée', onclick: () => startVoice('chat', (t) => { input.value = t; send(t); }) }, [icon('mic', 24)]);
  const sendBtn = h('button', { class: 'chat-send', 'aria-label': 'Envoyer', onclick: () => send(input.value) }, [icon('check', 24)]);

  const chips = h('div', { class: 'chat-chips' }, QUICK_PROMPTS.map((p) =>
    h('button', { class: 'chip', onclick: () => { input.value = p; input.focus(); } }, p)
  ));

  // Message d'accueil.
  addMessage('alto', 'Bonjour 👋 Je suis Alto, votre assistant cuisine. Posez-moi une question sur vos plats, food cost, allergènes ou recettes.');

  return h('div', { class: 'chat-screen' }, [
    h('div', { class: 'chat-head' }, [
      h('div', { class: 'screen-title', style: 'margin:0' }, 'Alto'),
      h('p', { class: 'section-label', style: 'margin:2px 0 0' }, 'Assistant cuisine'),
    ]),
    thread,
    chips,
    h('div', { class: 'chat-input-bar' }, [input, micBtn, sendBtn]),
  ]);
}
