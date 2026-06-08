// Alto — assistant vocal omniprésent (dictée + recherche mains-libres) +
// interface de chat (texte ou voix) branchée sur POST /api/ai/chef.
//
// En natif iOS : on utilise le plugin Capacitor SpeechRecognition (Apple Speech
// Framework) — WKWebView fait planter `webkitSpeechRecognition` silencieusement
// sur de nombreux iPhone (timeout immédiat, no-speech). En web/preview ou si le
// plugin n'est pas disponible, on retombe sur Web Speech API.
import { h, icon, toast } from '../ui.js';
import { navigate } from '../router.js';
import { API } from '../api.js';

function getNativeSR() {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
  return (C.Plugins && C.Plugins.SpeechRecognition) || null;
}

function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'fr-FR';
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

// Traduit le code d'erreur Web Speech en message lisible.
function webSpeechErrorMsg(err) {
  switch (err) {
    case 'no-speech': return 'Je n\'ai pas entendu — parlez plus fort ou plus près du micro';
    case 'audio-capture': return 'Micro inaccessible — vérifiez les autorisations';
    case 'not-allowed':
    case 'service-not-allowed': return 'Dictée refusée — Réglages → RestoSuite Cuisine → Micro + Reconnaissance vocale';
    case 'network': return 'Réseau requis pour la dictée — vérifiez votre connexion';
    case 'aborted': return null; // toggle stop, pas d'erreur à afficher
    default: return 'Dictée indisponible (' + err + ')';
  }
}

/**
 * Lance une écoute vocale.
 * @param {'search'|'command'|'chat'} mode  'search' route vers les fiches avec le terme dicté.
 * @param {(text:string)=>void} [onResult]
 */
export async function startVoice(mode = 'command', onResult) {
  const native = getNativeSR();
  const micBtn = document.querySelector('.mic-btn');
  micBtn && micBtn.classList.add('listening');

  function deliver(text) {
    micBtn && micBtn.classList.remove('listening');
    if (!text) return;
    if (onResult) return onResult(text);
    if (mode === 'search') {
      navigate('fiches');
      setTimeout(() => { const f = document.querySelector('input[type="search"]'); if (f) { f.value = text; f.dispatchEvent(new Event('input')); } }, 60);
    } else toast('Entendu : ' + text, 'ok');
  }

  // ── Voie 1 : plugin natif (iOS / Android) ──────────────────────────
  if (native) {
    try {
      // Demande explicite des permissions (micro + reconnaissance vocale iOS).
      const perms = await native.checkPermissions().catch(() => ({}));
      if (perms.speechRecognition !== 'granted') {
        const r = await native.requestPermissions().catch(() => ({}));
        if (r.speechRecognition && r.speechRecognition !== 'granted') {
          micBtn && micBtn.classList.remove('listening');
          toast('Dictée refusée — Réglages → RestoSuite Cuisine → Micro + Reconnaissance vocale', 'error');
          return;
        }
      }
      const avail = await native.available().catch(() => ({ available: false }));
      if (!avail.available) {
        micBtn && micBtn.classList.remove('listening');
        toast('Reconnaissance vocale indisponible sur cet appareil', 'error');
        return;
      }

      toast('Parlez…');
      const result = await native.start({
        language: 'fr-FR',
        maxResults: 1,
        prompt: '',
        partialResults: false,
        popup: false,
      });
      const matches = (result && result.matches) || [];
      deliver((matches[0] || '').trim());
      return;
    } catch (e) {
      micBtn && micBtn.classList.remove('listening');
      toast('Dictée échouée (' + ((e && e.message) || 'inconnu') + ')', 'error');
      return;
    }
  }

  // ── Voie 2 : fallback Web Speech (preview navigateur) ──────────────
  const rec = getRecognition();
  if (!rec) { micBtn && micBtn.classList.remove('listening'); toast('Dictée non disponible sur cet appareil', 'error'); return; }

  toast('Parlez…');
  rec.onresult = (e) => deliver(e.results[0][0].transcript.trim());
  rec.onerror = (e) => {
    micBtn && micBtn.classList.remove('listening');
    const msg = webSpeechErrorMsg(e && e.error);
    if (msg) toast(msg, 'error');
  };
  rec.onend = () => micBtn && micBtn.classList.remove('listening');
  try { rec.start(); } catch { micBtn && micBtn.classList.remove('listening'); toast('Micro occupé', 'error'); }
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
