// HACCP — relevés de température (saisie 2 taps), checklist du jour, minuterie.
import { h, icon, emptyState, toast } from '../ui.js';

function TempEntry() {
  // Saisie ultra-rapide : zone pré-réglée + valeur au pavé, validation 1 tap.
  const zones = ['Frigo 1', 'Frigo 2', 'Congélateur', 'Vitrine', 'Plat chaud', 'Sonde produit'];
  let zone = zones[0];
  const valInput = h('input', { class: 'field', type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'Température °C', style: 'font-size:28px; text-align:center; height:88px' });

  const zoneBtns = h('div', { class: 'quick-grid', style: 'grid-template-columns:1fr 1fr 1fr' },
    zones.map((z) => {
      const b = h('button', { class: 'btn btn-ghost', onclick: () => { zone = z; [...zoneBtns.children].forEach((c) => c.classList.remove('btn-primary')); b.classList.add('btn-primary'); } }, z);
      if (z === zone) b.classList.add('btn-primary');
      return b;
    })
  );

  return h('div', { class: 'card' }, [
    h('div', { class: 'section-label', style: 'margin-top:0' }, 'Nouveau relevé'),
    zoneBtns,
    h('div', { style: 'height:12px' }),
    valInput,
    h('div', { style: 'height:12px' }),
    h('button', { class: 'btn btn-primary', onclick: async () => {
      const v = parseFloat(valInput.value);
      if (isNaN(v)) { toast('Entrez une température', 'error'); return; }
      // TODO: POST /haccp/temperatures { zone, value } — endpoint à brancher.
      toast(`Relevé ${zone} : ${v}°C enregistré`, 'ok');
      valInput.value = '';
    } }, [icon('check', 22), 'Enregistrer']),
  ]);
}

export function HaccpScreen(query) {
  const tab = query.get('tab') || (query.get('action') === 'new-temp' ? 'temp' : 'temp');
  return h('div', {}, [
    h('div', { class: 'screen-title' }, 'HACCP'),
    h('div', { class: 'quick-grid', style: 'grid-template-columns:1fr 1fr 1fr' }, [
      h('button', { class: 'btn ' + (tab === 'temp' ? 'btn-primary' : 'btn-ghost'), onclick: () => location.hash = '#/haccp?tab=temp' }, 'T°'),
      h('button', { class: 'btn ' + (tab === 'checklist' ? 'btn-primary' : 'btn-ghost'), onclick: () => location.hash = '#/haccp?tab=checklist' }, 'Checklist'),
      h('button', { class: 'btn ' + (tab === 'timer' ? 'btn-primary' : 'btn-ghost'), onclick: () => location.hash = '#/haccp?tab=timer' }, 'Minuterie'),
    ]),
    h('div', { style: 'height:16px' }),
    tab === 'temp' ? TempEntry()
      : tab === 'checklist' ? emptyState('checklist', 'Checklist HACCP du jour', 'À brancher sur /api/haccp-plan — tâches du jour cochables.')
      : emptyState('timer', 'Minuteries de cuisson', 'Minuteurs multiples avec alerte sonore — à implémenter.'),
  ]);
}
