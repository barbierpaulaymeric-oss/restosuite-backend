// Réception de marchandises — contrôle livraison vs commande (check en 2 taps).
import { h, icon, emptyState } from '../ui.js';

export function ReceptionsScreen() {
  return h('div', {}, [
    h('div', { class: 'screen-title' }, 'Réceptions'),
    h('button', { class: 'btn btn-primary', onclick: () => {/* TODO scan caméra BL */} }, [icon('receptions', 22), 'Scanner un bon de livraison']),
    h('div', { class: 'section-label' }, 'Livraisons attendues'),
    // TODO: GET /purchase-orders?status=sent → liste des commandes à réceptionner,
    // puis check ligne par ligne (reçu / manquant / non conforme) contre la commande.
    emptyState('truck', 'Aucune livraison en attente', 'Les commandes envoyées apparaîtront ici pour contrôle à réception.'),
  ]);
}
