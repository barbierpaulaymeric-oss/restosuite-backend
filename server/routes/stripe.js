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
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = s.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      // In dev without webhook secret, parse body directly
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
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
    console.error('Webhook processing error:', err);
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

    const { accountId } = req.body;

    if (!accountId) {
      // If no account, redirect to app for login first
      return res.json({ url: '/app' });
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
  const { accountId } = req.params;
  const sub = get('SELECT * FROM subscriptions WHERE account_id = ?', [accountId]);

  if (!sub) {
    return res.json({
      plan: 'free',
      status: 'free',
      canCreate: true,
      limit: 5
    });
  }

  // Count recipes for this account (all recipes for now — later filter by account)
  const recipeCount = get('SELECT COUNT(*) as count FROM recipes')?.count || 0;
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
