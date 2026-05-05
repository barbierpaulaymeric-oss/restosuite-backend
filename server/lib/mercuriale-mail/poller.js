'use strict';

// setInterval poller for the email-based mercuriale flow. Started from
// server/index.js after app.listen — never started in test mode (the test
// helper loads app.js, not index.js). Env-gated: silent no-op if
// MERCURIALE_EMAIL or MERCURIALE_PASSWORD is unset, so dev machines without
// the secret don't error on boot.

const { runInboundCycle } = require('./index');

let _timer = null;

function startPoller({ intervalMs } = {}) {
  if (_timer) return _timer;
  if (!process.env.MERCURIALE_EMAIL || !process.env.MERCURIALE_PASSWORD) {
    console.log('📧 Mercuriale poller: disabled (MERCURIALE_EMAIL/PASSWORD not set)');
    return null;
  }
  const ms = Number(intervalMs)
    || Number(process.env.MERCURIALE_POLL_INTERVAL_MS)
    || 5 * 60 * 1000;
  console.log(`📧 Mercuriale poller: enabled, interval ${ms}ms`);

  const tick = async () => {
    try {
      const r = await runInboundCycle();
      if (r.processed > 0) {
        console.log(
          `📧 Mercuriale poll: processed=${r.processed} matched=${r.matched} items=${r.items_upserted}`
            + (r.errors.length ? ` errors=${r.errors.length}` : '')
        );
      }
    } catch (e) {
      console.warn('📧 Mercuriale poll error:', e.message);
    }
  };

  _timer = setInterval(tick, ms);
  if (typeof _timer.unref === 'function') _timer.unref();
  // Run one cycle immediately so the first poll doesn't wait the full interval.
  tick().catch(() => {});
  return _timer;
}

function stopPoller() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { startPoller, stopPoller };
