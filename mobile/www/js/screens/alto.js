// Alto — assistant vocal omniprésent (dictée + recherche mains-libres) +
// interface de chat (texte ou voix) branchée sur POST /api/ai/chef.
//
// En natif iOS : on utilise le plugin Capacitor SpeechRecognition (Apple Speech
// Framework) — WKWebView fait planter `webkitSpeechRecognition` silencieusement
// sur de nombreux iPhone (timeout immédiat, no-speech). En web/preview ou si le
// plugin n'est pas disponible, on retombe sur Web Speech API.
//
// UX : un overlay plein écran avec pulse pendant l'écoute + état "réflexion"
// après capture. Bouton Annuler à tout moment.
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

function webSpeechErrorMsg(err) {
  switch (err) {
    case 'no-speech': return 'Je n\'ai pas entendu — parlez plus fort ou plus près du micro';
    case 'audio-capture': return 'Micro inaccessible — vérifiez les autorisations';
    case 'not-allowed':
    case 'service-not-allowed': return 'Dictée refusée — Réglages → RestoSuite Cuisine → Micro + Reconnaissance vocale';
    case 'network': return 'Réseau requis pour la dictée — vérifiez votre connexion';
    case 'aborted': return null;
    default: return 'Dictée indisponible (' + err + ')';
  }
}

// ── Overlay d'écoute / réflexion ─────────────────────────────────
function openVoiceModal({ onCancel }) {
  const stateEl = h('div', { class: 'voice-state' }, 'À l\'écoute…');
  const subEl = h('div', { class: 'voice-sub' }, 'Parlez normalement, je vous écoute');
  const pulse = h('div', { class: 'voice-pulse' }, [icon('mic', 56)]);
  const cancelBtn = h('button', { class: 'btn btn-ghost', onclick: () => onCancel && onCancel() }, 'Annuler');
  const modal = h('div', { class: 'voice-modal' }, [
    pulse, stateEl, subEl,
    h('div', { class: 'voice-actions' }, [cancelBtn]),
  ]);
  document.body.append(modal);

  return {
    el: modal,
    setHeard(text) {
      stateEl.textContent = 'Entendu';
      subEl.textContent = text || '';
    },
    setThinking() {
      modal.classList.add('thinking');
      stateEl.textContent = 'Alto réfléchit…';
      subEl.textContent = '';
      pulse.replaceChildren(h('div', { class: 'voice-thinking-dots' }, [
        h('span', {}), h('span', {}), h('span', {}),
      ]));
    },
    setError(msg) {
      modal.classList.remove('thinking');
      stateEl.textContent = 'Erreur';
      subEl.textContent = msg || 'Erreur inconnue';
      pulse.style.background = 'var(--danger)';
    },
    close() { modal.remove(); },
  };
}

/**
 * Lance une écoute vocale.
 * @param {'search'|'command'|'chat'} mode
 * @param {(text:string)=>void} [onResult]
 */
export async function startVoice(mode = 'command', onResult) {
  const native = getNativeSR();
  let cancelled = false;

  const modal = openVoiceModal({
    onCancel: () => {
      cancelled = true;
      if (native && native.stop) { native.stop().catch(() => {}); }
      modal.close();
    },
  });

  function deliver(text) {
    if (cancelled) return;
    modal.setHeard(text);
    setTimeout(() => modal.close(), 600);
    if (!text) return;
    if (onResult) return onResult(text);
    if (mode === 'search') {
      navigate('fiches');
      setTimeout(() => { const f = document.querySelector('input[type="search"]'); if (f) { f.value = text; f.dispatchEvent(new Event('input')); } }, 60);
    } else {
      toast('Entendu : ' + text, 'ok');
    }
  }

  function failClose(msg) {
    if (cancelled) return;
    modal.setError(msg);
    setTimeout(() => modal.close(), 2200);
    if (msg) toast(msg, 'error');
  }

  // ── Voie 1 : plugin natif (iOS / Android) ────────────────────────
  if (native) {
    try {
      const perms = await native.checkPermissions().catch(() => ({}));
      if (perms.speechRecognition !== 'granted') {
        const r = await native.requestPermissions().catch(() => ({}));
        if (r.speechRecognition && r.speechRecognition !== 'granted') {
          return failClose('Dictée refusée — Réglages → RestoSuite Cuisine → Micro + Reconnaissance vocale');
        }
      }
      const avail = await native.available().catch(() => ({ available: false }));
      if (!avail.available) return failClose('Reconnaissance vocale indisponible sur cet appareil');

      // Watchdog : si rien ne revient en 15s, on coupe proprement.
      const watchdog = setTimeout(() => {
        if (cancelled) return;
        try { native.stop && native.stop(); } catch {}
        failClose('Je n\'ai rien entendu — réessayez plus près du micro');
      }, 15000);

      const result = await native.start({
        language: 'fr-FR',
        maxResults: 1,
        prompt: '',
        partialResults: false,
        popup: false,
      });
      clearTimeout(watchdog);
      const matches = (result && result.matches) || [];
      const text = (matches[0] || '').trim();
      if (!text) return failClose('Je n\'ai rien entendu');
      deliver(text);
      return;
    } catch (e) {
      return failClose('Dictée échouée (' + ((e && e.message) || 'inconnu') + ')');
    }
  }

  // ── Voie 2 : fallback Web Speech (preview navigateur) ────────────
  const rec = getRecognition();
  if (!rec) return failClose('Dictée non disponible sur cet appareil');

  // Watchdog identique côté Web Speech (souvent silencieux).
  const watchdog = setTimeout(() => {
    try { rec.stop(); } catch {}
    failClose('Je n\'ai rien entendu — réessayez');
  }, 15000);

  rec.onresult = (e) => {
    clearTimeout(watchdog);
    deliver(e.results[0][0].transcript.trim());
  };
  rec.onerror = (e) => {
    clearTimeout(watchdog);
    const msg = webSpeechErrorMsg(e && e.error);
    failClose(msg);
  };
  rec.onend = () => clearTimeout(watchdog);
  try { rec.start(); } catch { failClose('Micro occupé'); }
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
