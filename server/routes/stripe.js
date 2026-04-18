const express = require('express');
const router = express.Router();
const { get, run } = require('../db');
const { requireAuth } = require('./auth');

// Stripe is lazy-loaded to avoid crash if not installed yet
let stripe;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// ─────────────────────────────────────────────
// POST /api/stripe/webhook (PUBLIC — Stripe signature verification)
// Stripe webhook to handle subscription events
// ─────────────────────────────────────────────
// Idempotency table — dedupes Stripe's intentional retries and any replayed events
// that pass signature verification (PENTEST_REPORT C3.1). INSERT OR IGNORE is
// cheap; bail with 200 if we've already processed this event_id.
try {
  run(`CREATE TABLE IF NOT EXISTS processed_stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT,
    received_at TEXT DEFAULT (datetime('now'))
  )`);
} catch {}

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  let event;

  // Fail-closed in ALL non-test environments (PENTEST_REPORT C3.2). A dev/staging
  // deploy without STRIPE_WEBHOOK_SECRET previously parsed raw JSON with no
  // signature check — attackers forged checkout.session.completed events.
  const IS_TEST = process.env.NODE_ENV === 'test';
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      if (!IS_TEST) {
        console.error('WEBHOOK REJECTED: STRIPE_WEBHOOK_SECRET must be set');
        return res.status(400).json({ error: 'Webhook secret not configured' });
      }
      // In the test env only, parse the raw body so unit tests can exercise the
      // handler without mounting a real Stripe signing secret.
      event = JSON.parse(req.body.toString());
    } else {
      event = s.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency gate — dedupe on event.id
  if (event && event.id) {
    try {
      const ins = run(
        'INSERT OR IGNORE INTO processed_stripe_events (event_id, event_type) VALUES (?, ?)',
        [event.id, event.type || null]
      );
      if (ins && ins.changes === 0) {
        // Already processed — ack so Stripe stops retrying.
        return res.json({ received: true, duplicate: true });
      }
    } catch (e) {
      // If the idempotency insert fails, surface 500 so Stripe retries rather
      // than double-applying on the second pass.
      console.error('Stripe event idempotency insert failed:', e.message);
      return res.status(500).json({ error: 'Idempotency store unavailable' });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const accountId = session.metadata?.account_id;
        if (accountId && session.subscription) {
          const subscription = await s.subscriptions.retrieve(session.subscription);
          upsertSubscription(accountId, session.customer, session.subscription, subscription);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const accountId = subscription.metadata?.account_id;
        if (accountId) {
          upsertSubscription(
            accountId,
            subscription.customer,
            subscription.id,
            subscription
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          run(
            'UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?',
            ['past_due', subId]
          );
        }
        break;
      }
    }
  } catch (err) {
    // Roll back the idempotency claim so Stripe retries per its documented policy
    // (PENTEST_REPORT C5.2). Previously returned 200 on failure → Stripe saw
    // success, never retried, and DB state diverged from Stripe's view.
    console.error('Webhook processing error:', err);
    try {
      if (event && event.id) {
        run('DELETE FROM processed_stripe_events WHERE event_id = ?', [event.id]);
      }
    } catch {}
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
});

// ─── Auth middleware: all routes below require authentication ───
router.use(requireAuth);

// ─────────────────────────────────────────────
// POST /api/stripe/create-checkout
// Creates a Stripe Checkout session for subscription
// ─────────────────────────────────────────────
router.post('/create-checkout', async (req, res) => {
  try {
    const s = getStripe();
    if (!s || !process.env.STRIPE_PRICE_ID) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Stripe keys are not set up yet. Please configure STRIPE_SECRET_KEY and STRIPE_PRICE_ID in .env'
      });
    }

    // IMPORTANT: identify the subscriber from the authenticated session, NOT from
    // req.body.accountId (PENTEST_REPORT C5.1). Previously an attacker could
    // trigger a Checkout for a victim's account and poison their subscription row
    // on the resulting webhook.
    const accountId = req.user && req.user.id;
    if (!accountId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    // Check if account exists
    const account = get('SELECT * FROM accounts WHERE id = ?', [accountId]);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if already subscribed
    const sub = get('SELECT * FROM subscriptions WHERE account_id = ?', [accountId]);
    if (sub && sub.status === 'active') {
      return res.json({
        message: 'Already subscribed',
        status: 'active'
      });
    }

    // Create or get Stripe customer
    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const customer = await s.customers.create({
        name: account.name,
        metadata: { account_id: String(accountId) }
      });
      customerId = customer.id;
    }

    // Create checkout session
    const origin = `${req.protocol}://${req.get('host')}`;
    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      success_url: `${origin}/app?subscription=success`,
      cancel_url: `${origin}/app?subscription=cancelled`,
      metadata: { account_id: String(accountId) },
      subscription_data: {
        metadata: { account_id: String(accountId) }
      }
    });

    // Upsert subscription record with customer id
    const existing = get('SELECT id FROM subscriptions WHERE account_id = ?', [accountId]);
    if (existing) {
      run('UPDATE subscriptions SET stripe_customer_id = ? WHERE account_id = ?', [customerId, accountId]);
    } else {
      run(
        'INSERT INTO subscriptions (account_id, stripe_customer_id, status, plan) VALUES (?, ?, ?, ?)',
        [accountId, customerId, 'free', 'free']
      );
    }

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ─────────────────────────────────────────────
// GET /api/stripe/status/:accountId
// Check subscription status for an account
// ─────────────────────────────────────────────
router.get('/status/:accountId', (req, res) => {
  const targetId = parseInt(req.params.accountId, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'accountId invalide' });
  }

  // Authorize: caller must be the target account, or a gérant of the same tenant.
  const callerId = parseInt(req.user.id, 10);
  const callerRole = req.user.role;
  const callerRestaurantId = req.user.restaurant_id;

  const target = get('SELECT id, restaurant_id FROM accounts WHERE id = ?', [targetId]);
  if (!target) return res.status(404).json({ error: 'Compte introuvable' });

  const isSelf = callerId === targetId;
  const isSameTenantGerant =
    callerRole === 'gerant' &&
    callerRestaurantId != null &&
    callerRestaurantId === target.restaurant_id;

  if (!isSelf && !isSameTenantGerant) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const sub = get('SELECT * FROM subscriptions WHERE account_id = ?', [targetId]);

  if (!sub) {
    return res.json({
      plan: 'free',
      status: 'free',
      canCreate: true,
      limit: 5
    });
  }

  // Recipe count scoped to target's tenant (prevents cross-tenant leakage via count).
  const rid = target.restaurant_id;
  const recipeCount = rid
    ? (get('SELECT COUNT(*) as count FROM recipes WHERE restaurant_id = ?', [rid])?.count || 0)
    : 0;
  const isFree = sub.plan === 'free' || sub.status !== 'active';
  const limit = isFree ? 5 : Infinity;
  const canCreate = recipeCount < limit;

  res.json({
    plan: sub.plan,
    status: sub.status,
    canCreate,
    limit: isFree ? 5 : null,
    currentCount: recipeCount,
    currentPeriodEnd: sub.current_period_end
  });
});

// ─────────────────────────────────────────────
// Helper: upsert subscription record
// ─────────────────────────────────────────────
function upsertSubscription(accountId, customerId, subscriptionId, subscription) {
  const status = subscription.status; // active, canceled, past_due, etc.
  const plan = status === 'active' ? 'pro' : 'free';
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const existing = get('SELECT id FROM subscriptions WHERE account_id = ?', [accountId]);
  if (existing) {
    run(
      `UPDATE subscriptions
       SET stripe_customer_id = ?, stripe_subscription_id = ?, status = ?, plan = ?, current_period_end = ?
       WHERE account_id = ?`,
      [customerId, subscriptionId, status, plan, periodEnd, accountId]
    );
  } else {
    run(
      `INSERT INTO subscriptions (account_id, stripe_customer_id, stripe_subscription_id, status, plan, current_period_end)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [accountId, customerId, subscriptionId, status, plan, periodEnd]
    );
  }

  console.log(`📦 Subscription updated: account=${accountId} plan=${plan} status=${status}`);
}

module.exports = router;
