// ═══════════════════════════════════════════
// RestoSuite — Plan Gate Middleware
// Usage: router.use(planGate('essential'))
//
// Decision logic:
//   1. No req.user → 401
//   2. Active trial (< 60 days) → full access, skip plan check
//   3. Trial expired → read-only (GET only), regardless of plan
//   4. Paid/pro → check planRank(current) >= planRank(minPlan)
// ═══════════════════════════════════════════

const { get } = require('../db');
const { getAccountStatusById } = require('./trial');

const PLAN_ORDER = ['discovery', 'essential', 'professional', 'premium', 'enterprise'];

function planRank(plan) {
  const idx = PLAN_ORDER.indexOf(plan);
  return idx === -1 ? 0 : idx;
}

function planGate(minPlan) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Token requis' });

    // Check trial status first
    const trialStatus = getAccountStatusById(req.user.id);

    // Active trial → bypass plan check entirely
    if (trialStatus.status === 'trial') return next();

    // Trial expired → read-only regardless of plan
    if (trialStatus.status === 'expired') {
      if (req.method !== 'GET') {
        return res.status(403).json({
          error: 'Votre essai gratuit est terminé. Passez en Pro pour continuer.',
          code: 'TRIAL_EXPIRED',
        });
      }
      return next(); // GETs are allowed even on expired trial
    }

    // Paid/pro subscription → check plan rank
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
