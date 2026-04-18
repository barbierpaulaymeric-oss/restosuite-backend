# PostgreSQL & Redis Migration Plan

**Status:** planning only — **not** yet executed.
**Last updated:** 2026-04-18
**Trigger:** start the migration when any of these are true:
- \>50 concurrent users sustained, OR
- Sustained SQLite WAL contention visible in `perf_events`, OR
- Horizontal scaling needed (a second Render instance), OR
- Disaster-recovery RTO requirement drops below the nightly-backup window.

Until one of those trips, stay on better-sqlite3 + WAL. It is fast, boring,
and survives hundreds of QPS on a single Render instance.

---

## Part 1 — SQLite → PostgreSQL

### 1.1 What needs to change

| Area | better-sqlite3 today | PostgreSQL target | Notes |
|------|----------------------|-------------------|-------|
| Placeholders | `?` | `$1, $2, …` | Adapter can rewrite; or convert call sites. |
| Primary keys | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` (or `GENERATED ALWAYS AS IDENTITY`) | Use `BIGSERIAL` for append-only tables (audit_log). |
| Timestamps | `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` | Always use `TIMESTAMPTZ`; store UTC. |
| Booleans | `INTEGER` (0/1) | `BOOLEAN` | Review every column named `is_*`, `has_*`, `*_flag`. |
| `lastInsertRowid` | `db.run().lastInsertRowid` | `INSERT ... RETURNING id` | Adapter exposes as `result.lastInsertRowid`. |
| `LIMIT x OFFSET y` | ok | ok | No change. |
| `INSERT OR IGNORE` | sqlite-only | `INSERT ... ON CONFLICT DO NOTHING` | |
| `INSERT OR REPLACE` | sqlite-only | `INSERT ... ON CONFLICT (...) DO UPDATE SET ...` | |
| `strftime('%Y-%m-%d', ts)` | sqlite-only | `to_char(ts, 'YYYY-MM-DD')` or `date_trunc('day', ts)` | Grep for `strftime` — 10-20 uses expected. |
| JSON | `TEXT` + manual JSON.parse | `JSONB` | Optional; keep as TEXT for a faster cutover, migrate to JSONB later. |
| Transactions | `db.transaction(fn)()` sync | `BEGIN; … ; COMMIT;` on a dedicated client | Adapter's `transaction(fn)` hides this. |
| Concurrency | single writer, WAL readers | full MVCC | Most code assumes atomic reads after writes — fine under pg. |
| `pragma('foreign_keys = ON')` | sqlite-only | FKs always on in pg | Remove the pragma call in `db.js`. |
| Full-text search | `LIKE %x%` + indexes | `tsvector` + `GIN` | Defer; stay with `LIKE` until search is a bottleneck. |
| Audit-log hash chain | SHA-256 over canonicalRow (see `feedback_audit_log_hash_chain_pattern.md`) | identical — bytes in, bytes out | **Verify** the canonicalRow byte sequence is stable across drivers (type coercion can bite). |

### 1.2 Render plan

- **Target:** Render **Managed PostgreSQL** — start on the **Starter** plan
  (1 GB RAM / 10 GB storage). Upgrade to **Standard** once the DB exceeds
  ~8 GB or connection count saturates.
- **Region:** match the web service region (Oregon / Frankfurt) to avoid
  cross-region latency.
- **Connections:** pgbouncer is not included on Starter — use `pg.Pool`
  with `max` ≈ (Render instance count × 10) and monitor
  `pg_stat_activity`. Upgrade to Standard (which includes pooler) when
  instance count > 2.
- **Backups:** Render takes daily snapshots with 7-day retention on
  Starter, 30-day on Standard. Enable point-in-time recovery on Standard
  once live.

### 1.3 Data migration strategy

Cutover should be a **maintenance window**, not a trickle migration —
data volume at 50 users is small (< 500 MB). Plan ~30 min downtime.

1. **Dump.** Use [pgloader](https://pgloader.io/) — it reads a sqlite
   file directly and writes to pg, handling type mapping for us. Example:
   ```
   pgloader /data/restosuite.db postgresql://user:pass@host/restosuite
   ```
   Run this against a **copy** of production first; audit row counts
   table-by-table.
2. **Verify.** For each table: `SELECT COUNT(*)` on both sides, then
   `ORDER BY id LIMIT 100` diff for shape, then `ORDER BY id DESC LIMIT
   100` for tail.
3. **Replay audit log.** After pgloader, re-run the hash-chain
   verification (`GET /api/audit/verify`). Any break = stop and
   investigate before cutover.
4. **Flip.** Set `DATABASE_URL` env var on Render, redeploy. Keep the
   sqlite file for 30 days as a read-only escape hatch.
5. **Decommission.** After 30 days of clean pg operation, archive the
   `/data/restosuite.db` file to S3 and stop the WAL checkpoint cron.

### 1.4 Code migration path

The adapter at `server/db-adapter.js` is the seam. Migration order:

1. **Phase A (done).** Adapter ships; call sites unchanged. Zero risk.
2. **Phase B.** Convert route files from `require('./db')` to
   `require('./db-adapter')`, one file at a time. Pure refactor — still
   on sqlite.
3. **Phase C.** Rewrite the adapter internals to use `pg.Pool`. Flip the
   `DATABASE_URL` env to point at a local pg container; run the full
   test suite.
4. **Phase D.** Cutover in prod (§1.3).
5. **Phase E.** Remove the sqlite fallback branch from the adapter and
   delete `better-sqlite3` from dependencies.

### 1.5 Estimated effort

| Phase | Effort | Risk |
|-------|--------|------|
| A — adapter lands | 0.5 d (done) | none |
| B — callsite refactor (59 route files + internals) | 3–5 d | low (mechanical) |
| C — adapter rewrite + test suite green on pg | 2–4 d | medium (SQL dialect surprises) |
| D — production cutover | 0.5 d + 30 min window | medium (data loss if §1.3 not followed) |
| E — cleanup | 0.5 d | none |
| **Total** | **~7–10 dev-days** | **medium** |

Biggest risk: a few subtle SQL-dialect differences (date math, `INSERT
OR IGNORE`, JSON) that escape the test suite. Mitigation: run the test
suite against a real pg instance during Phase C before any production
traffic.

### 1.6 When to do it

**Start** the migration when sustained load crosses **50 concurrent
users** OR when you need a second Render web instance for HA. Do **not**
migrate speculatively — sqlite + WAL is more than enough headroom for
the current user base and eliminates a whole class of operational
concerns (no connection pool, no separate service to monitor, no
network round-trips).

---

## Part 2 — Redis for rate limiting

### 2.1 Why

Every `express-rate-limit` instance in this codebase uses the default
**in-memory** store. That is fine for a single Render web instance,
but breaks the moment we run two:

- Instance A sees 10 requests from IP X → no limit tripped.
- Instance B sees another 10 from IP X → no limit tripped.
- User has effectively doubled the rate limit by hitting a different
  instance.

The fix is a **shared** store — Redis is the standard choice.

### 2.2 Current limiters

All live in `server/app.js` (the testable entry point). `server/index.js`
has an older, slightly different set that should be kept in sync —
migrate both files.

| Limiter | File:line | Scope | Window | Max |
|---------|-----------|-------|--------|-----|
| `globalLimiter` | `server/app.js:98` | `/api/*` | 15 min | 200 |
| `aiLimiter` | `server/app.js:107` | `/api/ai/*` | 60 min | 30 |
| `authLimiter` | `server/app.js:116` | login/register/PIN/logout | 15 min | 20 |
| `adminLimiter` | `server/app.js:130` | `/api/admin/*` | 60 min | 30 |
| `staffAuthLimiter` | `server/index.js:116` | staff-login/staff-pin | 15 min | 20 |
| `supplierAuthLimiter` | `server/index.js:125` | supplier-portal | 15 min | 20 |

There is also a **custom** in-memory limiter in
`server/routes/public-api.js:63` (`rateLimitWindows = new Map()`) for
per-API-key throttling of the public REST surface. This needs to move
to Redis as well — same multi-instance issue.

Separate concern: the **PIN lockout** counter is **DB-backed** (see
`accounts.failed_pin_attempts` / `pin_locked_until`, 10 attempts / 30
min) and already survives multi-instance. Do not move that to Redis —
the DB is the right store for durable per-account counters.

### 2.3 Packages

- **[`ioredis`](https://www.npmjs.com/package/ioredis)** — Redis client
  with built-in sentinel/cluster support and good timeout/retry
  defaults. Preferred over the older `redis` package for this use case.
- **[`rate-limit-redis`](https://www.npmjs.com/package/rate-limit-redis)**
  — official `express-rate-limit` store backed by Redis.

### 2.4 Minimum Redis commands used

`rate-limit-redis` uses an atomic Lua script under the hood. In practice
the commands exercised are:
- `EVALSHA` (loaded Lua script doing `INCR` + `EXPIRE` atomically)
- `GET` / `TTL` (for header computation)
- `DEL` (used by `.resetKey()` in tests)
- `SCRIPT LOAD` (once on boot)

For the custom `public-api.js` limiter, when we port it to Redis, use:
- `INCR key` + `EXPIRE key windowSec NX` — sliding window counter
- Or `ZADD` + `ZREMRANGEBYSCORE` for a precise sliding log (heavier,
  only if burst precision matters — we don't need this today).

### 2.5 Migration sketch

```js
// server/lib/rate-limit-store.js (new file)
const Redis = require('ioredis');
const RedisStore = require('rate-limit-redis').default;

const redis = new Redis(process.env.REDIS_URL, {
  enableOfflineQueue: false,  // fail fast if Redis is down
  maxRetriesPerRequest: 2,
});

function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${prefix}:`,
  });
}

module.exports = { redis, makeStore };
```

Then in `app.js`, each limiter gains a `store`:
```js
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 100000 : 200,
  store: makeStore('global'),
  // ... rest unchanged
});
```

**Graceful fallback.** If `REDIS_URL` is unset, fall back to the default
in-memory store — keeps local dev and the test suite working without
Redis. Log a startup warning in production if `REDIS_URL` is unset.

### 2.6 Cost & hosting (Render)

- **Render Managed Redis — Starter:** **\$7 / month**, 25 MB, 50
  connections. Plenty for rate-limit counters (each counter is ~40 bytes;
  25 MB fits ~600k distinct keys — we will never approach that).
- **Render Managed Redis — Standard:** \$15 / month, 256 MB. Only
  worth it if Redis is used for session cache, BullMQ job queues, or
  the public-API sliding log.
- **Alternative (cheaper):** Upstash Redis serverless — pay per request,
  free tier covers < 10k commands/day. Good for staging; overkill to
  route production through it while we are also paying for Render.

### 2.7 Estimated effort

| Step | Effort |
|------|--------|
| Provision Render Redis + wire `REDIS_URL` | 0.5 h |
| Add `ioredis` + `rate-limit-redis`; ship `lib/rate-limit-store.js` | 2 h |
| Flip the 4 + 2 limiters in `app.js` / `index.js` | 1 h |
| Port `public-api.js` custom limiter to Redis | 2–3 h |
| Test under two-instance load (Render has free 2× dev instances) | 2 h |
| **Total** | **~1 dev-day** |

**Risk:** low. The only sharp edge is a Redis outage — with
`enableOfflineQueue: false` + the in-memory fallback, a Redis outage
degrades to per-instance limits rather than taking the site down.

### 2.8 When to do it

Do the Redis migration **before** scaling to a second web instance —
not after. Launching two instances with in-memory limiters silently
halves our effective rate limits, which is a security regression
(brute-force auth attempts get twice the budget).

Until we run > 1 instance, there is zero user-visible benefit to
migrating. Keep the current in-memory setup and the `\$7/month` in the
budget.
