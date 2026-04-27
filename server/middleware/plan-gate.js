// ═══════════════════════════════════════════
// RestoSuite — Access Gate Middleware
// Usage: router.use(requireActiveOrTrial)
//
// Single paid plan model:
//   1. No req.user → 401
//   2. Active subscription (status=pro) → full access
//   3. Active trial (status=trial) → full access
//   4. Trial expired (status=expired) → read-only (GET/HEAD only)
// ═══════════════════════════════════════════

const { getAccountStatusById } = require('./trial');

function requireActiveOrTrial(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Token requis' });

    const accountStatus = getAccountStatusById(Number(req.user.id));

    if (accountStatus.status === 'pro' || accountStatus.status === 'trial') {
      return next();
    }

    // status === 'expired' → read-only
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(403).json({
        error: 'Votre essai gratuit est terminé. Passez en Pro pour continuer.',
        code: 'TRIAL_EXPIRED',
        daysLeft: 0,
      });
    }
    return next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireActiveOrTrial };
