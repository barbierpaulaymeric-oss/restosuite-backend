// HACCP — trois outils du quotidien en cuisine :
//   • Relevé de température (zone réelle + saisie pavé, validation 1 tap)
//   • Checklist du jour (nettoyage / contrôles cochables, progression)
//   • Minuteries de cuisson multiples
// API : /haccp/zones, /haccp/temperatures, /haccp/temperatures/today,
//       /haccp/cleaning/today, /haccp/cleaning/:id/done.
import { h, icon, emptyState, toast } from '../ui.js';
import { API } from '../api.js';
import { queue, subscribe as subscribeQueue } from '../queue.js';
import { getTimers, subscribe, addTimer, toggleTimer, stopTimer, dismissRing, fmtClock } from '../timers.js';

// File mémoire des relevés saisis offline pendant la session. On les affiche
// dans l'historique en jaune ("en attente d'envoi") tant que la queue n'a pas
// vidé, puis on rafraîchit depuis le serveur quand elle a flushé.
const PENDING_LOCAL = []; // {tempKey, zone_name, zone_id, temperature, is_alert, recorded_at}

function timeFR(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── Onglet T° ──────────────────────────────────────────────────
function TempEntry() {
  const wrap = h('div', {});
  let zones = [];
  let selected = null;

  // Le clavier numérique iOS n'expose pas le `-` ; on garde le signe dans un
  // bouton dédié (gros, à côté de la valeur — gants/mains mouillées).
  let negative = false;

  const valInput = h('input', {
    class: 'field', type: 'number', inputmode: 'decimal', step: '0.1', min: '-50', max: '300',
    placeholder: '°C',
    style: 'font-size:30px; text-align:center; height:88px; font-weight:800; flex:1',
  });

  const signBtn = h('button', {
    class: 'btn btn-ghost',
    style: 'width:auto; min-height:88px; padding:0 18px; font-size:28px; font-weight:800',
    'aria-label': 'Basculer signe positif / négatif',
    onclick: () => { negative = !negative; signBtn.textContent = negative ? '−' : '+'; signBtn.classList.toggle('btn-primary', negative); signBtn.classList.toggle('btn-ghost', !negative); },
  }, '+');

  const tempRow = h('div', { style: 'display:flex; gap:10px; align-items:stretch' }, [signBtn, valInput]);

  const zoneGrid = h('div', { class: 'zone-grid' });
  const history = h('div', {});

  const saveBtn = h('button', { class: 'btn btn-primary', onclick: save }, [icon('check', 22), 'Enregistrer']);

  function paintZones() {
    zoneGrid.replaceChildren(...zones.map((z) => {
      const b = h('button', { class: 'zone-btn' + (selected && selected.id === z.id ? ' sel' : ''), onclick: () => { selected = z; paintZones(); valInput.focus(); } }, [
        h('span', {}, z.name),
        h('span', { class: 'zb-range' }, `${z.min_temp}° / ${z.max_temp}°`),
      ]);
      return b;
    }));
  }

  function paintHistory(serverLogs) {
    // Merge : serveur + pending local (relevés saisis offline, pas encore
    // confirmés par le serveur). Les pendings sont affichés en jaune en haut
    // avec la mention « envoi en attente » pour que la cuisine voie immédia-
    // tement que c'est saisi mais non flushé.
    const pendings = PENDING_LOCAL.map((p) => ({ ...p, _pending: true }));
    const all = [...pendings.reverse(), ...serverLogs];
    if (!all.length) { history.replaceChildren(emptyState('thermometer', 'Aucun relevé aujourd\'hui', 'Sélectionnez une zone et saisissez la température.')); return; }
    history.replaceChildren(...all.map((l) => {
      const cls = 'temp-row' + (l._pending ? ' pending' : (l.is_alert ? ' alert' : ''));
      const label = l._pending
        ? 'envoi en attente'
        : (l.is_alert ? ' · HORS NORME' : '');
      return h('div', { class: cls }, [
        h('div', { class: 'tr-main' }, [
          h('div', { class: 'tr-zone' }, l.zone_name || 'Zone'),
          h('div', { class: 'tr-time' }, l._pending ? label : [timeFR(l.recorded_at), label].join('')),
        ]),
        h('div', { class: 'tr-val' + (l._pending ? ' pending' : (l.is_alert ? '' : ' ok')) }, fmtTemp(l.temperature) + '°'),
      ]);
    }));
  }

  function fmtTemp(n) { const r = Math.round(Number(n) * 10) / 10; return String(r).replace('.', ','); }

  let lastServerLogs = [];
  async function loadHistory() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const logs = await API.get('/haccp/temperatures?date=' + today);
      lastServerLogs = Array.isArray(logs) ? logs : [];
      // Une fois le serveur revenu : on peut supposer que les pendings dont la
      // même zone+température+minute existent côté serveur, on les retire. On
      // garde simple : si la queue est vide, on purge tous les pendings.
      paintHistory(lastServerLogs);
    } catch {
      // Hors-ligne : on affiche au moins les pendings.
      paintHistory(lastServerLogs);
    }
  }

  // Quand la queue passe à 0 = tout a été flushé → on purge les pendings et
  // on recharge l'historique côté serveur pour avoir les vraies entrées.
  const unsubQueue = subscribeQueue((items) => {
    if (items.length === 0 && PENDING_LOCAL.length > 0) {
      PENDING_LOCAL.length = 0;
      loadHistory();
    }
  });
  // Désabonne quand le nœud quitte le DOM.
  const moHaccp = new MutationObserver(() => { if (!document.body.contains(wrap)) { unsubQueue(); moHaccp.disconnect(); } });
  moHaccp.observe(document.body, { childList: true, subtree: true });

  async function save() {
    if (!selected) { toast('Choisissez une zone', 'error'); return; }
    let v = parseFloat((valInput.value || '').replace(',', '.'));
    if (isNaN(v)) { toast('Entrez une température', 'error'); return; }
    if (negative) v = -Math.abs(v);
    saveBtn.disabled = true;
    try {
      // queue.post : tente le réseau, met en file si hors-ligne (relevé conservé).
      const log = await queue.post('/haccp/temperatures', { zone_id: selected.id, temperature: v }, `T° ${selected.name} ${fmtTemp(v)}°`);
      if (log && log.queued) {
        // Offline : on affiche immédiatement le relevé en jaune dans l'historique.
        // Pré-calcul du is_alert avec les seuils LOCAUX (la zone le sait).
        const isAlert = (v < selected.min_temp) || (v > selected.max_temp);
        PENDING_LOCAL.push({
          tempKey: Date.now() + ':' + Math.random().toString(36).slice(2, 6),
          zone_id: selected.id,
          zone_name: selected.name,
          temperature: v,
          is_alert: isAlert ? 1 : 0,
          recorded_at: new Date().toISOString(),
        });
        toast(`${selected.name} : ${fmtTemp(v)}° en attente d'envoi`, 'warn');
      } else if (log && log.is_alert) {
        toast(`⚠ ${selected.name} HORS NORME : ${fmtTemp(v)}°`, 'error');
      } else {
        toast(`${selected.name} : ${fmtTemp(v)}° enregistré`, 'ok');
      }
      valInput.value = '';
      negative = false;
      signBtn.textContent = '+';
      signBtn.classList.remove('btn-primary');
      signBtn.classList.add('btn-ghost');
      // loadHistory tente le serveur ; si offline, paintHistory affichera quand
      // même les pendings via PENDING_LOCAL.
      loadHistory();
    } catch (e) {
      toast(e && e.message || 'Échec de l\'enregistrement', 'error');
    } finally { saveBtn.disabled = false; }
  }

  wrap.replaceChildren(
    h('div', { class: 'card' }, [
      h('div', { class: 'section-label', style: 'margin-top:0' }, 'Zone'),
      zoneGrid,
      h('div', { style: 'height:14px' }),
      tempRow,
      h('div', { style: 'height:12px' }),
      saveBtn,
    ]),
    h('div', { class: 'section-label' }, 'Relevés du jour'),
    history,
  );

  (async () => {
    try {
      zones = await API.get('/haccp/zones');
      zones = Array.isArray(zones) ? zones : [];
      if (!zones.length) { zoneGrid.replaceChildren(emptyState('thermometer', 'Aucune zone configurée', 'Créez vos enceintes (frigo, congélateur…) depuis l\'app web.')); }
      else { selected = zones[0]; paintZones(); }
    } catch (e) {
      zoneGrid.replaceChildren(emptyState('thermometer', 'Zones indisponibles', 'Connexion requise pour charger les enceintes.'));
    }
    loadHistory();
  })();

  return wrap;
}

// ── Onglet Checklist ───────────────────────────────────────────
function Checklist() {
  const wrap = h('div', {}, [emptyState('checklist', 'Chargement de la checklist…')]);

  function paint(data) {
    const tasks = data.tasks || [];
    const total = data.total ?? tasks.length;
    const done = data.done ?? tasks.filter((t) => t.done_today).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    if (!tasks.length) { wrap.replaceChildren(emptyState('checklist', 'Aucune tâche aujourd\'hui', 'Les tâches HACCP du jour apparaîtront ici.')); return; }

    const bar = h('div', { class: 'progress-bar' });
    const meta = h('div', { class: 'progress-meta' }, [h('span', {}, `${done} / ${total} fait`), h('span', {}, pct + '%')]);
    const items = tasks.map((t) => renderItem(t));

    wrap.replaceChildren(
      h('div', { class: 'progress' }, [bar]),
      meta,
      ...items,
    );
    // Largeur posée juste après le montage : la transition CSS anime depuis 0,
    // mais l'état reste correct même si rAF est throttlé (onglet non focalisé).
    bar.style.width = pct + '%';

    function refreshProgress() {
      const d = tasks.filter((x) => x.done_today).length;
      const p = total ? Math.round((d / total) * 100) : 0;
      bar.style.width = p + '%';
      meta.replaceChildren(h('span', {}, `${d} / ${total} fait`), h('span', {}, p + '%'));
    }

    function renderItem(t) {
      const el = h('div', { class: 'check-item' + (t.done_today ? ' done' : ''), onclick: () => toggle() }, [
        h('div', { class: 'check-box' }, [icon('check', 20)]),
        h('div', { class: 'ci-main' }, [
          h('div', { class: 'ci-name' }, t.name || 'Tâche'),
          h('div', { class: 'ci-sub' }, [t.zone || 'Cuisine', t.frequency ? ' · ' + frequencyFR(t.frequency) : '', t.done_by ? ' · ' + t.done_by : ''].join('')),
        ]),
      ]);
      async function toggle() {
        if (t.done_today) { toast('Déjà validée aujourd\'hui', 'warn'); return; }
        // Validation optimiste : on coche tout de suite, on annule si l'API échoue.
        t.done_today = true; el.classList.add('done'); refreshProgress();
        try {
          const r = await queue.post('/haccp/cleaning/' + t.id + '/done', {}, 'Checklist: ' + (t.name || 'tâche'));
          toast(r && r.queued ? `${t.name} (en attente d\'envoi)` : `✓ ${t.name}`, r && r.queued ? 'warn' : 'ok');
        } catch (e) {
          t.done_today = false; el.classList.remove('done'); refreshProgress();
          toast('Échec', 'error');
        }
      }
      return el;
    }
  }

  (async () => {
    try {
      const data = await API.get('/haccp/cleaning/today');
      paint(data || { tasks: [] });
    } catch (e) {
      wrap.replaceChildren(emptyState('checklist', 'Checklist indisponible', 'Connexion requise pour charger les tâches du jour.'));
    }
  })();

  return wrap;
}

function frequencyFR(f) { return f === 'daily' ? 'Quotidien' : f === 'weekly' ? 'Hebdo' : f === 'monthly' ? 'Mensuel' : f; }

// ── Onglet Minuteries ──────────────────────────────────────────
const PRESETS = [
  { label: '5 min', s: 300 }, { label: '10 min', s: 600 },
  { label: '15 min', s: 900 }, { label: '30 min', s: 1800 },
];

function Timers() {
  const nameInput = h('input', { class: 'field', placeholder: 'Nom (ex. Fond de veau)', style: 'margin-bottom:10px' });
  const list = h('div', {});

  function start(seconds) {
    addTimer(nameInput.value.trim() || 'Minuteur', seconds);
    nameInput.value = '';
  }

  function customStart() {
    const raw = prompt('Durée en minutes :', '20');
    if (raw == null) return;
    const min = parseFloat(String(raw).replace(',', '.'));
    if (isNaN(min) || min <= 0) { toast('Durée invalide', 'error'); return; }
    start(Math.round(min * 60));
  }

  function paint(timers) {
    if (!timers.length) { list.replaceChildren(emptyState('timer', 'Aucune minuterie', 'Nommez puis lancez un minuteur avec un preset ci-dessus.')); return; }
    list.replaceChildren(...timers.map((t) => h('div', { class: 'timer-card' + (t.ringing ? ' ringing' : '') }, [
      h('div', { class: 'tc-top' }, [
        h('div', { class: 'tc-name' }, t.name),
        h('div', { class: 'tc-time' }, fmtClock(t.remaining)),
      ]),
      h('div', { class: 'tc-actions' },
        t.ringing
          ? [h('button', { class: 'btn btn-primary', onclick: () => dismissRing(t.id) }, [icon('check', 20), 'Arrêter l\'alarme'])]
          : [
              h('button', { class: 'btn btn-ghost', onclick: () => toggleTimer(t.id) }, t.running ? 'Pause' : 'Reprendre'),
              h('button', { class: 'btn btn-ghost', onclick: () => stopTimer(t.id) }, 'Supprimer'),
            ]
      ),
    ])));
  }

  const wrap = h('div', {}, [
    h('div', { class: 'card' }, [
      h('div', { class: 'section-label', style: 'margin-top:0' }, 'Nouvelle minuterie'),
      nameInput,
      h('div', { class: 'timer-presets' }, [
        ...PRESETS.map((p) => h('button', { class: 'btn btn-ghost preset-btn', onclick: () => start(p.s) }, p.label)),
        h('button', { class: 'btn btn-primary preset-btn', onclick: customStart }, '+'),
      ]),
    ]),
    h('div', { class: 'section-label' }, 'En cours'),
    list,
  ]);

  // S'abonne au store global ; se désabonne quand le nœud quitte le DOM.
  const unsub = subscribe(paint);
  paint(getTimers());
  const obs = new MutationObserver(() => { if (!document.body.contains(wrap)) { unsub(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  return wrap;
}

export function HaccpScreen(query) {
  let tab = query.get('tab') || (query.get('action') === 'new-temp' ? 'temp' : query.get('action') === 'timer' ? 'timer' : 'temp');

  const content = h('div', {});
  function paintTab() {
    seg.querySelectorAll('.seg-btn').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('btn-primary', on);
      b.classList.toggle('btn-ghost', !on);
    });
    content.replaceChildren(tab === 'temp' ? TempEntry() : tab === 'checklist' ? Checklist() : Timers());
  }

  // Onglets internes : libellés seuls (les icônes les feraient déborder de leur
  // 1/3 de colonne sur les petits iPhone — « Minuterie » est large).
  const seg = h('div', { class: 'quick-grid', style: 'grid-template-columns:1fr 1fr 1fr' }, [
    h('button', { class: 'btn seg-btn', 'data-tab': 'temp', onclick: () => { tab = 'temp'; paintTab(); } }, 'T°'),
    h('button', { class: 'btn seg-btn', 'data-tab': 'checklist', onclick: () => { tab = 'checklist'; paintTab(); } }, 'Checklist'),
    h('button', { class: 'btn seg-btn', 'data-tab': 'timer', onclick: () => { tab = 'timer'; paintTab(); } }, 'Minuterie'),
  ]);

  const root = h('div', {}, [
    h('div', { class: 'screen-title' }, 'HACCP'),
    seg,
    h('div', { style: 'height:16px' }),
    content,
  ]);

  paintTab();
  return root;
}
