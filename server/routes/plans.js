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

// Public pricing catalog — 3 plans only.
// - discovery = free 60-day trial (full access, no card, no plan selection)
// - professional = Pro at 39€/mois (all features)
// - enterprise = Entreprise sur devis (multi-site + API + SLA)
// Internal planGate() keeps the 5-rank PLAN_ORDER for back-compat with existing
// `planGate('essential')` / `planGate('premium')` calls in index.js — those
// are still satisfied by planRank('professional') ≥ planRank('essential').
const PLANS = [
  {
    id: 'discovery',
    name: 'Essai gratuit',
    price: 0,
    label: 'Gratuit',
    badge: null,
    description: '60 jours d\'accès complet, sans carte bancaire',
    features: [
      'Accès à toutes les fonctionnalités',
      'Fiches techniques illimitées',
      'Saisie vocale IA',
      'HACCP complet',
      'Multi-comptes',
      'Aucune carte bancaire requise',
    ],
  },
  {
    id: 'professional',
    name: 'Pro',
    price: 39,
    label: '39€/mois',
    badge: 'PRO',
    description: 'Tout ce qu\'il faut pour piloter votre restaurant',
    features: [
      'Fiches techniques illimitées',
      'Saisie vocale IA',
      'HACCP complet + plan formalisé',
      'Gestion fournisseurs & commandes',
      'CRM, fidélité, QR Codes',
      'Pilotage, analytics, menu engineering',
      'Prédictions IA & bilan carbone',
      'Exports PDF & support prioritaire',
    ],
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    price: null,
    label: 'Sur devis',
    badge: 'ENTERPRISE',
    description: 'Pour les groupes et chaînes de restauration',
    features: [
      'Tout le plan Pro, plus :',
      'Multi-établissements',
      'API publique',
      'SSO & authentification centralisée',
      'Support dédié + SLA garanti',
      'Intégrations sur mesure',
    ],
  },
];

// Allowed upgrade targets (public-facing). Legacy tier names
// ('essential', 'premium') are still recognised by planGate for back-compat,
// but cannot be chosen as a target via the UI — any paid plan is 'professional'.
const UPGRADE_TARGETS = ['discovery', 'professional', 'enterprise'];

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
// Accepts any recognised tier (including legacy 'essential'/'premium') so the
// internal planGate compat layer stays intact, but legacy names are rewritten
// to 'professional' before being persisted — we only store the 3 public tiers.
router.post('/upgrade', requireAuth, (req, res) => {
  if (req.user.role !== 'gerant') {
    return res.status(403).json({ error: 'Réservé au gérant' });
  }
  const { plan } = req.body;
  if (!plan || !PLAN_ORDER.includes(plan)) {
    return res.status(400).json({ error: 'Plan invalide', valid: UPGRADE_TARGETS });
  }
  if (!req.user.restaurant_id) {
    return res.status(400).json({ error: 'Aucun restaurant associé à ce compte' });
  }
  // Collapse legacy tiers into the single 'professional' plan.
  const storedPlan = (plan === 'essential' || plan === 'premium') ? 'professional' : plan;
  run('UPDATE restaurants SET plan = ? WHERE id = ?', [storedPlan, req.user.restaurant_id]);
  const planDetails = PLANS.find(p => p.id === storedPlan) || PLANS[0];
  res.json({ ok: true, plan: storedPlan, details: planDetails });
});

module.exports = router;
