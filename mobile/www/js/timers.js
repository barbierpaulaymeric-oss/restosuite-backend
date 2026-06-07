// Minuteries de cuisson — état global (singleton) pour que les minuteurs
// continuent de tourner même quand on quitte l'écran HACCP. Aucune API : tout
// est local. Alarme = bip Web Audio + vibration + toast, déclenchée même hors écran.
import { toast } from './ui.js';

let seq = 1;
const timers = []; // { id, name, total, remaining, running, ringing }
const listeners = new Set();
let ticker = null;
let audioCtx = null;
let beepInterval = null;

function emit() { for (const fn of listeners) fn(getTimers()); }

export function getTimers() {
  // Copie défensive (l'UI ne mute jamais l'état directement).
  return timers.map((t) => ({ ...t }));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    let changed = false;
    for (const t of timers) {
      if (t.running && t.remaining > 0) {
        t.remaining -= 1;
        changed = true;
        if (t.remaining === 0) { t.running = false; t.ringing = true; fireAlarm(t); }
      }
    }
    if (changed) emit();
  }, 1000);
}

function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.18;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {}
}

function fireAlarm(t) {
  toast(`⏰ Minuterie « ${t.name} » terminée`, 'ok');
  try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch {}
  beep();
  // Bip répété tant qu'au moins une minuterie sonne (acquittée par l'utilisateur).
  if (!beepInterval) beepInterval = setInterval(() => {
    if (timers.some((x) => x.ringing)) beep();
    else { clearInterval(beepInterval); beepInterval = null; }
  }, 1500);
}

export function addTimer(name, seconds) {
  if (!seconds || seconds <= 0) return null;
  const t = { id: seq++, name: name || 'Minuteur', total: seconds, remaining: seconds, running: true, ringing: false };
  timers.push(t);
  ensureTicker();
  // Débloque l'audio (politique navigateur : nécessite un geste utilisateur).
  try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume && audioCtx.resume(); } catch {}
  emit();
  return t.id;
}

export function toggleTimer(id) {
  const t = timers.find((x) => x.id === id);
  if (!t || t.remaining === 0) return;
  t.running = !t.running;
  emit();
}

export function stopTimer(id) {
  const i = timers.findIndex((x) => x.id === id);
  if (i === -1) return;
  timers.splice(i, 1);
  if (!timers.some((x) => x.ringing) && beepInterval) { clearInterval(beepInterval); beepInterval = null; }
  emit();
}

export function dismissRing(id) {
  const t = timers.find((x) => x.id === id);
  if (t) t.ringing = false;
  if (!timers.some((x) => x.ringing) && beepInterval) { clearInterval(beepInterval); beepInterval = null; }
  emit();
}

export function fmtClock(secs) {
  const s = Math.max(0, secs | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}
