// ═══════════════════════════════════════════
// Trial Logic — 60-day free trial, then read-only
// ═══════════════════════════════════════════

const { get } = require('../db');

const TRIAL_DAYS = 60;

/**
 * Determine account status based on trial + subscription.
 * @param {object} account - Account row from DB
 * @param {object|null} subscription - Subscription row from DB
 * @returns {{ status: 'pro'|'trial'|'expired', daysLeft: number, readOnly: boolean }}
 */
function getAccountStatus(account, subscription) {
  // Active subscription → pro
  if (subscription && subscription.status === 'active') {
    return { status: 'pro', daysLeft: 0, readOnly: false };
  }

  // Trial calculation
  const trialStart = new Date(account.trial_start || account.created_at);
  const now = new Date();
  const daysSinceStart = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
  const daysLeft = TRIAL_DAYS - daysSinceStart;

  if (daysLeft > 0) {
    return { status: 'trial', daysLeft, readOnly: false };
  }

  // Trial expired → read-only
  return { status: 'expired', daysLeft: 0, readOnly: true };
}

/**
 * Fetch account status by account ID.
 * @param {number} accountId
 * @returns {{ status: 'pro'|'trial'|'expired', daysLeft: number, readOnly: boolean }}
 */
function getAccountStatusById(accountId) {
  const account = get('SELECT * FROM accounts WHERE id = ?', [accountId]);
  if (!account) return { status: 'expired', daysLeft: 0, readOnly: true };

  const subscription = get(
    'SELECT * FROM subscriptions WHERE account_id = ? ORDER BY created_at DESC LIMIT 1',
    [accountId]
  );

  return getAccountStatus(account, subscription);
}

/**
 * Express middleware: block write operations if trial expired.
 * Expects account ID in req.body.account_id, req.query.account_id,
 * or req.headers['x-account-id'].
 */
function requireWriteAccess(req, res, next) {
  const accountId = req.body?.account_id || req.query?.account_id || req.headers['x-account-id'];

  // No account ID → let through (will be caught by other auth if needed)
  if (!accountId) return next();

  const status = getAccountStatusById(Number(accountId));

  if (status.readOnly) {
    return res.status(403).json({
      error: 'Votre essai gratuit est terminé. Passez en Pro pour continuer.',
      code: 'TRIAL_EXPIRED'
    });
  }

  // Attach status to request for downstream use
  req.accountStatus = status;
  next();
}

module.exports = { getAccountStatus, getAccountStatusById, requireWriteAccess, TRIAL_DAYS };
