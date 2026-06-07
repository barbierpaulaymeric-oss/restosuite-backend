// Alto — assistant vocal omniprésent (dictée + recherche mains-libres).
// Utilise l'API Web Speech (SpeechRecognition) disponible dans la WebView ;
// la permission micro est déclarée côté natif (Info.plist / AndroidManifest).
import { h, icon, toast, emptyState } from '../ui.js';
import { navigate } from '../router.js';

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

export function AltoScreen() {
  return h('div', {}, [
    h('div', { class: 'screen-title' }, 'Alto'),
    h('p', { class: 'section-label', style: 'margin-top:-8px' }, 'Assistant vocal cuisine'),
    h('div', { class: 'quick-grid' }, [
      h('button', { class: 'quick-tile', onclick: () => startVoice('search') }, [h('div', { class: 'qt-icon' }, [icon('search', 26)]), h('div', {}, [h('div', { class: 'qt-label' }, 'Chercher une fiche')])]),
      h('button', { class: 'quick-tile', onclick: () => startVoice('command') }, [h('div', { class: 'qt-icon' }, [icon('thermometer', 26)]), h('div', {}, [h('div', { class: 'qt-label' }, 'Dicter un relevé')])]),
    ]),
    h('div', { style: 'height:16px' }),
    emptyState('alto', 'Dites une commande', 'Ex. « Cherche la fiche du tartare », « Relevé frigo 1 à 4 degrés ».'),
  ]);
}
