// ═══════════════════════════════════════════
// RestoSuite — Plan Gate Middleware
// Usage: router.use(planGate('essential'))
// ═══════════════════════════════════════════

const { get } = require('../db');

const PLAN_ORDER = ['discovery', 'essential', 'professional', 'premium', 'enterprise'];

function planRank(plan) {
  const idx = PLAN_ORDER.indexOf(plan);
  return idx === -1 ? 0 : idx;
}

function planGate(minPlan) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Token requis' });

    const restaurant = req.user.restaurant_id
      ? get('SELECT plan FROM restaurants WHERE id = ?', [req.user.restaurant_id])
      : null;
    const currentPlan = restaurant ? (restaurant.plan || 'discovery') : 'discovery';

    if (planRank(currentPlan) < planRank(minPlan)) {
      return res.status(403).json({
        error: `Cette fonctionnalité nécessite le plan ${minPlan} ou supérieur`,
        code: 'PLAN_REQUIRED',
        required: minPlan,
        current: currentPlan,
      });
    }
    next();
  };
}

module.exports = { planGate, PLAN_ORDER, planRank };
