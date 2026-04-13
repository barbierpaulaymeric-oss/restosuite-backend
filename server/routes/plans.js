// ═══════════════════════════════════════════
// RestoSuite — Plans & Pricing
// GET  /api/plans           — liste des plans
// GET  /api/plans/current   — plan actuel du restaurant
// POST /api/plans/upgrade   — changer de plan (simulation, pas de paiement)
// ═══════════════════════════════════════════

const express = require('express');
const { get, run } = require('../db');
const { requireAuth } = require('./auth');
const { PLAN_ORDER } = require('../middleware/plan-gate');

const router = express.Router();

const PLANS = [
  {
    id: 'discovery',
    name: 'Discovery',
    price: 0,
    label: 'Gratuit',
    badge: null,
    description: 'Pour démarrer et tester la solution',
    features: [
      'Fiches techniques illimitées',
      'Gestion des ingrédients',
      'Stock & réception',
      'Tableau de bord basique',
    ],
  },
  {
    id: 'essential',
    name: 'Essential',
    price: 29,
    label: '29€/mois',
    badge: 'ESSENTIAL',
    description: 'Pour les restaurants qui s\'installent',
    features: [
      'Tout Discovery, plus :',
      'HACCP températures & nettoyage',
      'Gestion fournisseurs',
      'Commandes fournisseurs',
      'Bons de livraison',
      'CRM & fidélité',
      'QR Codes menu',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 59,
    label: '59€/mois',
    badge: 'PRO',
    description: 'Pour les restaurants en croissance',
    features: [
      'Tout Essential, plus :',
      'Plan HACCP formalisé',
      'BPH complet (formation, nuisibles, maintenance, déchets)',
      'Pilotage & analytics avancés',
      'Menu engineering',
      'Prédictions IA',
      'Assistant IA culinaire',
      'Bilan carbone',
      'Intégrations TPV',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 99,
    label: '99€/mois',
    badge: 'PREMIUM',
    description: 'Pour les restaurants exigeants',
    features: [
      'Tout Professional, plus :',
      'Traçabilité complète',
      'Procédures retrait & rappel',
      'Exports PDF & données',
      'Multi-sites',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    label: 'Sur devis',
    badge: 'ENTERPRISE',
    description: 'Pour les groupes de restauration',
    features: [
      'Tout Premium, plus :',
      'API publique',
      'SSO & authentification centralisée',
      'Support dédié',
      'SLA garanti',
      'Intégrations sur mesure',
    ],
  },
];

// GET /api/plans — liste publique des plans
router.get('/', (req, res) => {
  res.json({ items: PLANS });
});

// GET /api/plans/current — plan actuel du restaurant authentifié
router.get('/current', requireAuth, (req, res) => {
  const restaurant = req.user.restaurant_id
    ? get('SELECT id, name, plan FROM restaurants WHERE id = ?', [req.user.restaurant_id])
    : null;
  const currentPlan = restaurant ? (restaurant.plan || 'discovery') : 'discovery';
  const planDetails = PLANS.find(p => p.id === currentPlan) || PLANS[0];
  res.json({ plan: currentPlan, details: planDetails, restaurant: restaurant || null });
});

// POST /api/plans/upgrade — changer de plan (simulation sans paiement)
router.post('/upgrade', requireAuth, (req, res) => {
  if (req.user.role !== 'gerant') {
    return res.status(403).json({ error: 'Réservé au gérant' });
  }
  const { plan } = req.body;
  if (!plan || !PLAN_ORDER.includes(plan)) {
    return res.status(400).json({ error: 'Plan invalide', valid: PLAN_ORDER });
  }
  if (!req.user.restaurant_id) {
    return res.status(400).json({ error: 'Aucun restaurant associé à ce compte' });
  }
  run('UPDATE restaurants SET plan = ? WHERE id = ?', [plan, req.user.restaurant_id]);
  const planDetails = PLANS.find(p => p.id === plan) || PLANS[0];
  res.json({ ok: true, plan, details: planDetails });
});

module.exports = router;
