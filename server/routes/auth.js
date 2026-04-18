// ═══════════════════════════════════════════
// Auth — Email/Password + PIN login
// ═══════════════════════════════════════════

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { all, get, run } = require('../db');

const router = express.Router();
// No hardcoded fallback — app.js/index.js fail-close on startup if JWT_SECRET is
// unset (except NODE_ENV=test, where tests/helpers/env.js sets a stable value).
// Read lazily so tests can set process.env.JWT_SECRET before routes run.
function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not configured');
  return s;
}
const JWT_EXPIRY = '30d';

// ─── JWT revocation (blacklist) ───
// A token is identified by its `jti` claim (issued at registration / login) and stays
// in the blacklist until its natural `exp`. Cleanup runs opportunistically on every
// check (cheap index scan).
try {
  run(`CREATE TABLE IF NOT EXISTS jwt_blacklist (
    jti TEXT PRIMARY KEY,
    account_id INTEGER,
    expires_at INTEGER NOT NULL,
    revoked_at TEXT DEFAULT (datetime('now'))
  )`);
  run(`CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_exp ON jwt_blacklist(expires_at)`);
} catch {}

function isTokenRevoked(jti) {
  if (!jti) return false;
  try {
    const row = get('SELECT jti, expires_at FROM jwt_blacklist WHERE jti = ?', [jti]);
    if (!row) return false;
    // If the blacklisted entry has expired naturally, clean it up and allow.
    if (row.expires_at && row.expires_at * 1000 < Date.now()) {
      try { run('DELETE FROM jwt_blacklist WHERE jti = ?', [jti]); } catch {}
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// PIN brute-force protection
const pinAttempts = new Map(); // restaurantId -> { count, lastAttempt }
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkPinLockout(identifier) {
  const attempt = pinAttempts.get(identifier);
  if (!attempt) return { locked: false };

  const now = Date.now();
  const timeSinceLastAttempt = now - attempt.lastAttempt;

  if (timeSinceLastAttempt > PIN_LOCKOUT_MS) {
    pinAttempts.delete(identifier);
    return { locked: false };
  }

  if (attempt.count >= PIN_MAX_ATTEMPTS) {
    const remainingMs = PIN_LOCKOUT_MS - timeSinceLastAttempt;
    return { locked: true, remainingMs };
  }

  return { locked: false };
}

function recordPinAttempt(identifier, success) {
  if (success) {
    pinAttempts.delete(identifier);
    return;
  }

  const attempt = pinAttempts.get(identifier) || { count: 0, lastAttempt: Date.now() };
  attempt.count += 1;
  attempt.lastAttempt = Date.now();
  pinAttempts.set(identifier, attempt);
}

// ── Per-account DB-persisted PIN lockout ──
// The in-memory map above is keyed per IP+account, so a botnet can
// parallelise brute force across many IPs. These helpers persist the
// counter on the accounts row itself (`failed_pin_attempts`, `pin_locked_until`)
// so the limit is global per account across all instances/IPs.
const PER_ACCOUNT_MAX = 10;
const PER_ACCOUNT_LOCK_MS = 30 * 60 * 1000; // 30 minutes

function checkAccountPinLock(accountId) {
  try {
    const row = get('SELECT failed_pin_attempts, pin_locked_until FROM accounts WHERE id = ?', [accountId]);
    if (!row) return { locked: false };
    if (row.pin_locked_until) {
      const until = new Date(row.pin_locked_until).getTime();
      if (Number.isFinite(until) && until > Date.now()) {
        return { locked: true, remainingMs: until - Date.now() };
      }
      // Lock expired — reset counters opportunistically.
      try {
        run('UPDATE accounts SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = ?', [accountId]);
      } catch {}
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}

function recordAccountPinAttempt(accountId, success) {
  if (!accountId) return;
  try {
    if (success) {
      run('UPDATE accounts SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = ?', [accountId]);
      return;
    }
    const row = get('SELECT failed_pin_attempts FROM accounts WHERE id = ?', [accountId]);
    if (!row) return;
    const next = (row.failed_pin_attempts || 0) + 1;
    if (next >= PER_ACCOUNT_MAX) {
      const lockUntil = new Date(Date.now() + PER_ACCOUNT_LOCK_MS).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
      run('UPDATE accounts SET failed_pin_attempts = ?, pin_locked_until = ? WHERE id = ?', [next, lockUntil, accountId]);
    } else {
      run('UPDATE accounts SET failed_pin_attempts = ? WHERE id = ?', [next, accountId]);
    }
  } catch {}
}

function generateToken(account) {
  // Include a unique jti so individual tokens can be revoked without rotating JWT_SECRET.
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    { id: account.id, email: account.email, role: account.role, restaurant_id: account.restaurant_id, jti },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}

function hashPin(pin) {
  return bcrypt.hash(pin, 10);
}

function verifyPin(pin, hash) {
  return bcrypt.compare(pin, hash);
}

// ─── Middleware: requireAuth ───
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Token révoqué' });
    }
    req.user = decoded;
    req.token = token;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// ─── POST /api/auth/register ───
router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  // Validation
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'L\'email est requis' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins une majuscule' });
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins un chiffre' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  // Check if email already exists
  const existing = get('SELECT id FROM accounts WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // Create restaurant (empty)
    const restaurantResult = run('INSERT INTO restaurants (name) VALUES (?)', ['Mon restaurant']);
    const restaurantId = restaurantResult.lastInsertRowid;

    // Set staff password if provided during registration
    if (req.body.staff_password && req.body.staff_password.trim()) {
      const staffHash = await bcrypt.hash(req.body.staff_password.trim(), 10);
      run('UPDATE restaurants SET staff_password = ? WHERE id = ?', [staffHash, restaurantId]);
    }

    // Create owner account
    const permissions = JSON.stringify({
      view_recipes: true, view_costs: true, edit_recipes: true,
      view_suppliers: true, export_pdf: true
    });

    // IMPORTANT: pin=NULL (not hash('0000')). A default PIN combined with the
    // is_creation staff-pin branch let unauthenticated attackers claim any
    // freshly-registered account (PENTEST_REPORT C2.1). The owner sets their
    // PIN from an authenticated session later.
    const accountResult = run(
      `INSERT INTO accounts (name, pin, role, permissions, email, password_hash, first_name, last_name, restaurant_id, onboarding_step, is_owner, trial_start)
       VALUES (?, NULL, 'gerant', ?, ?, ?, ?, ?, ?, 0, 1, datetime('now'))`,
      [
        (first_name || '').trim() + (last_name ? ' ' + last_name.trim() : '') || email.split('@')[0],
        permissions,
        email.trim().toLowerCase(),
        passwordHash,
        (first_name || '').trim(),
        (last_name || '').trim(),
        restaurantId
      ]
    );

    const accountId = accountResult.lastInsertRowid;
    const account = get('SELECT * FROM accounts WHERE id = ?', [accountId]);

    const token = generateToken(account);

    res.json({
      token,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        first_name: account.first_name,
        last_name: account.last_name,
        onboarding_step: account.onboarding_step,
        is_owner: account.is_owner,
        permissions: JSON.parse(account.permissions)
      },
      restaurant: { id: restaurantId, name: 'Mon restaurant' }
    });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// ─── POST /api/auth/login ───
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const account = get('SELECT * FROM accounts WHERE email = ?', [email.trim().toLowerCase()]);
  if (!account) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  if (!account.password_hash || !(await bcrypt.compare(password, account.password_hash))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  // Update last_login
  run('UPDATE accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [account.id]);

  const token = generateToken(account);

  // Get restaurant info
  const restaurant = account.restaurant_id
    ? get('SELECT * FROM restaurants WHERE id = ?', [account.restaurant_id])
    : null;

  res.json({
    token,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      first_name: account.first_name,
      last_name: account.last_name,
      onboarding_step: account.onboarding_step,
      is_owner: account.is_owner,
      permissions: JSON.parse(account.permissions)
    },
    restaurant
  });
});

// ─── POST /api/auth/pin-login ───
// PIN lookup MUST be scoped by restaurant_id to prevent cross-tenant collisions:
// without scoping, a PIN like 1234 set by tenant A would match tenant B's user
// with the same PIN. Caller must supply restaurant_id (typically obtained via
// /staff-login first).
router.post('/pin-login', async (req, res) => {
  const { pin, restaurant_id } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN à 4 chiffres requis' });
  }
  if (!restaurant_id) {
    return res.status(400).json({ error: 'restaurant_id requis (passez par /staff-login)' });
  }

  // Check for brute-force lockout — keyed per IP + restaurant to prevent global DoS
  const lockoutKey = `pin_login:${req.ip}:${restaurant_id}`;
  const lockoutCheck = checkPinLockout(lockoutKey);
  if (lockoutCheck.locked) {
    const minutesRemaining = Math.ceil(lockoutCheck.remainingMs / 60000);
    return res.status(429).json({ error: `Trop de tentatives. Veuillez réessayer dans ${minutesRemaining} minutes.` });
  }

  // Scope PIN lookup to a single restaurant — prevents cross-tenant collisions.
  const accounts = all(
    'SELECT * FROM accounts WHERE pin IS NOT NULL AND pin != ? AND restaurant_id = ?',
    ['', restaurant_id]
  );
  let account = null;
  for (const acc of accounts) {
    if (await verifyPin(pin, acc.pin)) {
      account = acc;
      break;
    }
  }

  if (!account) {
    recordPinAttempt(lockoutKey, false);
    // We don't know which account they were aiming at here (multi-match).
    return res.status(401).json({ error: 'PIN incorrect' });
  }

  // Per-account lock (survives IP rotation / multi-instance deploys)
  const acctLock = checkAccountPinLock(account.id);
  if (acctLock.locked) {
    const minutesRemaining = Math.ceil(acctLock.remainingMs / 60000);
    return res.status(429).json({ error: `Compte verrouillé. Réessayez dans ${minutesRemaining} minutes.` });
  }

  // Record successful attempt
  recordPinAttempt(lockoutKey, true);
  recordAccountPinAttempt(account.id, true);

  // Update last_login
  run('UPDATE accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [account.id]);

  const token = generateToken(account);
  const restaurant = account.restaurant_id
    ? get('SELECT * FROM restaurants WHERE id = ?', [account.restaurant_id])
    : null;

  res.json({
    token,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      first_name: account.first_name,
      last_name: account.last_name,
      onboarding_step: account.onboarding_step,
      is_owner: account.is_owner,
      permissions: JSON.parse(account.permissions)
    },
    restaurant
  });
});

// ─── GET /api/auth/me ───
router.get('/me', requireAuth, (req, res) => {
  const account = get('SELECT * FROM accounts WHERE id = ?', [req.user.id]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const restaurant = account.restaurant_id
    ? get('SELECT * FROM restaurants WHERE id = ?', [account.restaurant_id])
    : null;

  res.json({
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      first_name: account.first_name,
      last_name: account.last_name,
      phone: account.phone,
      onboarding_step: account.onboarding_step,
      is_owner: account.is_owner,
      permissions: JSON.parse(account.permissions)
    },
    restaurant
  });
});

// ─── POST /api/auth/staff-login ───
// Staff enters the restaurant's name + shared password → gets list of team members.
// restaurant_name is required to avoid the O(N-tenants × bcrypt) event-loop DoS
// (PENTEST_REPORT C2.4). If the name is omitted the request is refused.
router.post('/staff-login', async (req, res) => {
  const { password, restaurant_name } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Mot de passe requis' });
  }
  if (!restaurant_name || typeof restaurant_name !== 'string' || !restaurant_name.trim()) {
    return res.status(400).json({ error: 'Nom du restaurant requis' });
  }

  // Per-IP lockout to blunt distributed restaurant-name enumeration.
  const staffLoginKey = `staff_login:${req.ip}`;
  const lock = checkPinLockout(staffLoginKey);
  if (lock.locked) {
    const minutesRemaining = Math.ceil(lock.remainingMs / 60000);
    return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${minutesRemaining} minutes.` });
  }

  // Case-insensitive exact match on the restaurant name — one row (or none) per request,
  // then a single bcrypt.compare. Event-loop cost is constant, not O(tenants).
  const matchedRestaurant = get(
    'SELECT * FROM restaurants WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
    [restaurant_name]
  );

  const ok = matchedRestaurant && matchedRestaurant.staff_password
    ? await bcrypt.compare(password, matchedRestaurant.staff_password)
    : false;

  if (!ok) {
    recordPinAttempt(staffLoginKey, false);
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  recordPinAttempt(staffLoginKey, true);

  // Return the list of team members for this restaurant (exclude gerant and fournisseur)
  const members = all(
    `SELECT id, name, role, CASE WHEN pin IS NOT NULL AND pin != '' THEN 1 ELSE 0 END as has_pin FROM accounts
     WHERE restaurant_id = ? AND role NOT IN ('gerant', 'fournisseur')
     ORDER BY name ASC`,
    [matchedRestaurant.id]
  );

  res.json({
    restaurant_id: matchedRestaurant.id,
    restaurant_name: matchedRestaurant.name || 'Mon restaurant',
    members
  });
});

// ─── POST /api/auth/staff-pin ───
// Staff member enters their PIN after being selected from the team list.
// PIN *creation* is handled by the authenticated route below (/staff-pin/create),
// not here, to prevent unauthenticated takeover of accounts without a PIN
// (PENTEST_REPORT C2.1, C2.3).
router.post('/staff-pin', async (req, res) => {
  const { account_id, pin } = req.body;

  if (!account_id || !pin) {
    return res.status(400).json({ error: 'Compte et PIN requis' });
  }
  if (!/^\d{4}$/.test(pin.toString())) {
    return res.status(400).json({ error: 'Le PIN doit être 4 chiffres' });
  }

  // Brute-force protection — keyed per IP + account to prevent targeted DoS
  const staffLockoutKey = `staff_pin:${req.ip}:${account_id}`;
  const staffLockout = checkPinLockout(staffLockoutKey);
  if (staffLockout.locked) {
    const minutesRemaining = Math.ceil(staffLockout.remainingMs / 60000);
    return res.status(429).json({ error: `Trop de tentatives. Veuillez réessayer dans ${minutesRemaining} minutes.` });
  }

  // Per-account lock — survives IP rotation (distributed brute-force).
  const acctLock = checkAccountPinLock(account_id);
  if (acctLock.locked) {
    const minutesRemaining = Math.ceil(acctLock.remainingMs / 60000);
    return res.status(429).json({ error: `Compte verrouillé. Réessayez dans ${minutesRemaining} minutes.` });
  }

  const account = get('SELECT * FROM accounts WHERE id = ?', [account_id]);
  if (!account) {
    recordPinAttempt(staffLockoutKey, false);
    return res.status(401).json({ error: 'PIN incorrect' });
  }

  // Normal PIN validation — no "creation" branch. If the account has no PIN yet,
  // login is refused; the owner must set the PIN via /staff-pin/create while
  // holding an authenticated session.
  if (!account.pin || !(await verifyPin(pin, account.pin))) {
    recordPinAttempt(staffLockoutKey, false);
    recordAccountPinAttempt(account_id, false);
    return res.status(401).json({ error: 'PIN incorrect' });
  }
  recordPinAttempt(staffLockoutKey, true);
  recordAccountPinAttempt(account_id, true);

  // Update last_login
  run('UPDATE accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [account_id]);

  // Generate JWT token
  const token = generateToken(account);

  res.json({
    token,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      first_name: account.first_name,
      last_name: account.last_name,
      onboarding_step: account.onboarding_step,
      is_owner: account.is_owner,
      permissions: JSON.parse(account.permissions)
    }
  });
});

// ─── POST /api/auth/staff-pin/create — authenticated PIN set-up ───
// Used by:
//   (a) a gérant setting their own PIN after registering with password, and
//   (b) a gérant provisioning a PIN for any account in their restaurant.
// An équipier/cuisinier may only set their own PIN, and only if it's not set yet.
// This replaces the legacy unauthenticated `is_creation:true` flag.
router.post('/staff-pin/create', requireAuth, async (req, res) => {
  const { account_id, pin } = req.body;
  if (!account_id || !/^\d{4}$/.test((pin || '').toString())) {
    return res.status(400).json({ error: 'PIN à 4 chiffres requis' });
  }

  const target = get('SELECT * FROM accounts WHERE id = ?', [account_id]);
  if (!target) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  // Cross-tenant guard — treat as 404 to avoid ID enumeration
  if (target.restaurant_id !== req.user.restaurant_id) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const caller = req.user;
  const isSelf = caller.id === target.id;
  const isGerant = caller.role === 'gerant';

  // Only gérants may set a PIN on behalf of another account. Non-gérants may
  // only set their OWN PIN, and only when none is set yet (first-time creation).
  if (!isGerant) {
    if (!isSelf) {
      return res.status(403).json({ error: 'Seul un gérant peut créer le PIN d\'un autre membre' });
    }
    if (target.pin) {
      return res.status(400).json({ error: 'Un PIN existe déjà. Demandez au gérant de le réinitialiser.' });
    }
  }

  const hashedPin = await hashPin(pin);
  run('UPDATE accounts SET pin = ? WHERE id = ?', [hashedPin, account_id]);

  res.json({ ok: true });
});

// ─── PUT /api/auth/staff-password ───
// Gérant sets/changes the restaurant staff password
router.put('/staff-password', requireAuth, async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 4 caractères' });
  }

  // Get the user's restaurant
  const account = get('SELECT * FROM accounts WHERE id = ?', [req.user.id]);
  if (!account || account.role !== 'gerant') {
    return res.status(403).json({ error: 'Réservé au gérant' });
  }
  if (!account.restaurant_id) {
    return res.status(400).json({ error: 'Aucun restaurant associé' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  run('UPDATE restaurants SET staff_password = ? WHERE id = ?', [hashedPassword, account.restaurant_id]);

  res.json({ success: true });
});

// ─── POST /api/auth/logout — Revoke the current token (JWT blacklist) ───
router.post('/logout', requireAuth, (req, res) => {
  try {
    const { jti, exp } = req.user || {};
    if (jti && exp) {
      run(
        'INSERT OR IGNORE INTO jwt_blacklist (jti, account_id, expires_at) VALUES (?, ?, ?)',
        [jti, req.user.id, exp]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Logout error:', e);
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.getJwtSecret = getJwtSecret;
// Legacy export kept as a getter for routes/accounts.js and supplier-portal.js that
// destructure `JWT_SECRET`; resolving lazily returns the current process.env value
// and throws if unset (fail-closed per PENTEST_REPORT C8.2).
Object.defineProperty(module.exports, 'JWT_SECRET', {
  get: () => getJwtSecret(),
  enumerable: true,
});
