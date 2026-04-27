// ═══════════════════════════════════════════
// RestoSuite — Subscription Status
// GET /api/plans/current — current trial / subscription status
//
// Single paid plan model: free trial (60 days, full access) → 39€/mois Pro
// (full access). No tiers, no upgrade-without-payment endpoint.
// ═══════════════════════════════════════════

const express = require('express');
const { requireAuth } = require('./auth');
const { getAccountStatusById } = require('../middleware/trial');

const router = express.Router();

const PRO_PLAN = {
  id: 'pro',
  name: 'Pro',
  price: 39,
  currency: 'EUR',
  label: '39€/mois',
};

router.get('/current', requireAuth, (req, res) => {
  const accountStatus = getAccountStatusById(Number(req.user.id)) || { status: 'expired', daysLeft: 0, readOnly: true };
  res.json({
    status: accountStatus.status,             // 'pro' | 'trial' | 'expired'
    days_left: accountStatus.daysLeft || 0,
    read_only: !!accountStatus.readOnly,
    plan: PRO_PLAN,
  });
});

module.exports = router;
