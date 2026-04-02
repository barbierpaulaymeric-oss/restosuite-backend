// ═══════════════════════════════════════════
// Referrals — Programme de parrainage
// ═══════════════════════════════════════════

const express = require('express');
const { all, get, run } = require('../db');
const router = express.Router();

// GET /api/referrals/my-code — get referral code for current user
router.get('/my-code', (req, res) => {
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'account_id requis' });
  }

  const account = get('SELECT id, name, referral_code, referral_bonus_days FROM accounts WHERE id = ?', [accountId]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  // Generate code if none exists
  if (!account.referral_code) {
    const code = generateReferralCode(account.name);
    run('UPDATE accounts SET referral_code = ? WHERE id = ?', [code, accountId]);
    account.referral_code = code;
  }

  res.json({
    code: account.referral_code,
    bonus_days: account.referral_bonus_days || 0
  });
});

// POST /api/referrals/apply — apply a referral code during signup
router.post('/apply', (req, res) => {
  const { referral_code, account_id } = req.body;

  if (!referral_code || !account_id) {
    return res.status(400).json({ error: 'referral_code et account_id requis' });
  }

  // Find referrer by code
  const referrer = get('SELECT id, referral_bonus_days FROM accounts WHERE referral_code = ?', [referral_code]);
  if (!referrer) {
    return res.status(404).json({ error: 'Code de parrainage invalide' });
  }

  // Can't refer yourself
  if (referrer.id === Number(account_id)) {
    return res.status(400).json({ error: 'Vous ne pouvez pas utiliser votre propre code' });
  }

  // Check if already referred
  const referred = get('SELECT referred_by FROM accounts WHERE id = ?', [account_id]);
  if (!referred) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }
  if (referred.referred_by) {
    return res.status(400).json({ error: 'Ce compte a déjà utilisé un code de parrainage' });
  }

  // Apply referral
  // Referrer gets 30 bonus days
  run('UPDATE accounts SET referral_bonus_days = COALESCE(referral_bonus_days, 0) + 30 WHERE id = ?', [referrer.id]);
  // Referred gets 15 bonus days
  run('UPDATE accounts SET referred_by = ?, referral_bonus_days = COALESCE(referral_bonus_days, 0) + 15 WHERE id = ?', [referral_code, account_id]);

  // Record the referral
  try {
    run(
      'INSERT INTO referrals (referrer_code, referrer_account_id, referred_account_id, status, completed_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
      [referral_code, referrer.id, account_id, 'completed']
    );
  } catch (e) {
    // Ignore duplicate entries
  }

  res.json({
    ok: true,
    message: 'Code de parrainage appliqué ! Vous bénéficiez de 15 jours supplémentaires.',
    bonus_days: 15
  });
});

// GET /api/referrals/stats — referral stats for current user
router.get('/stats', (req, res) => {
  const accountId = req.query.account_id;
  if (!accountId) {
    return res.status(400).json({ error: 'account_id requis' });
  }

  const account = get('SELECT referral_code, referral_bonus_days FROM accounts WHERE id = ?', [accountId]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const referrals = account.referral_code
    ? all('SELECT id, referred_account_id, status, completed_at FROM referrals WHERE referrer_code = ? ORDER BY completed_at DESC', [account.referral_code])
    : [];

  res.json({
    total_referrals: referrals.length,
    bonus_days: account.referral_bonus_days || 0,
    referrals
  });
});

function generateReferralCode(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

module.exports = router;
