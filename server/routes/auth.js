// ═══════════════════════════════════════════
// Auth — Email/Password + PIN login
// ═══════════════════════════════════════════

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { all, get, run } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'restosuite-dev-secret-2026';
const JWT_EXPIRY = '30d';

function generateToken(account) {
  return jwt.sign(
    { id: account.id, email: account.email, role: account.role, restaurant_id: account.restaurant_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// ─── Middleware: requireAuth ───
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// ─── POST /api/auth/register ───
router.post('/register', (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  // Validation
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'L\'email est requis' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
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
    const passwordHash = bcrypt.hashSync(password, 10);

    // Create restaurant (empty)
    const restaurantResult = run('INSERT INTO restaurants (name) VALUES (?)', ['Mon restaurant']);
    const restaurantId = restaurantResult.lastInsertRowid;

    // Set staff password if provided during registration
    if (req.body.staff_password && req.body.staff_password.trim()) {
      const staffHash = bcrypt.hashSync(req.body.staff_password.trim(), 10);
      run('UPDATE restaurants SET staff_password = ? WHERE id = ?', [staffHash, restaurantId]);
    }

    // Create owner account
    const permissions = JSON.stringify({
      view_recipes: true, view_costs: true, edit_recipes: true,
      view_suppliers: true, export_pdf: true
    });

    const accountResult = run(
      `INSERT INTO accounts (name, pin, role, permissions, email, password_hash, first_name, last_name, restaurant_id, onboarding_step, is_owner, trial_start)
       VALUES (?, ?, 'gerant', ?, ?, ?, ?, ?, ?, 0, 1, datetime('now'))`,
      [
        (first_name || '').trim() + (last_name ? ' ' + last_name.trim() : '') || email.split('@')[0],
        hashPin('0000'), // placeholder PIN
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
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const account = get('SELECT * FROM accounts WHERE email = ?', [email.trim().toLowerCase()]);
  if (!account) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  if (!account.password_hash || !bcrypt.compareSync(password, account.password_hash)) {
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
router.post('/pin-login', (req, res) => {
  const { pin } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN à 4 chiffres requis' });
  }

  const hashedPin = hashPin(pin);
  const account = get('SELECT * FROM accounts WHERE pin = ?', [hashedPin]);
  if (!account) {
    return res.status(401).json({ error: 'PIN incorrect' });
  }

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
// Staff enters the restaurant's shared password → gets list of team members
router.post('/staff-login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Mot de passe requis' });
  }

  // Find restaurant with matching staff_password
  // We hash the staff password too for security
  const restaurants = all('SELECT * FROM restaurants');
  let matchedRestaurant = null;

  for (const r of restaurants) {
    if (r.staff_password && bcrypt.compareSync(password, r.staff_password)) {
      matchedRestaurant = r;
      break;
    }
  }

  if (!matchedRestaurant) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

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
// Staff member enters their PIN after being selected from the team list
router.post('/staff-pin', (req, res) => {
  const { account_id, pin, is_creation } = req.body;

  if (!account_id || !pin) {
    return res.status(400).json({ error: 'Compte et PIN requis' });
  }
  if (!/^\d{4}$/.test(pin.toString())) {
    return res.status(400).json({ error: 'Le PIN doit être 4 chiffres' });
  }

  const account = get('SELECT * FROM accounts WHERE id = ?', [account_id]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const hashedPin = hashPin(pin);

  // First-time PIN creation
  if (is_creation) {
    // Only allow creation if no PIN is set yet
    if (account.pin && account.pin !== hashPin('0000')) {
      return res.status(400).json({ error: 'Un PIN existe déjà. Utilisez votre PIN actuel.' });
    }
    // Set the new PIN
    run('UPDATE accounts SET pin = ? WHERE id = ?', [hashedPin, account_id]);
  } else {
    // Normal PIN validation
    if (account.pin !== hashedPin) {
      return res.status(401).json({ error: 'PIN incorrect' });
    }
  }

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

// ─── PUT /api/auth/staff-password ───
// Gérant sets/changes the restaurant staff password
router.put('/staff-password', requireAuth, (req, res) => {
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

  const hashedPassword = bcrypt.hashSync(password, 10);
  run('UPDATE restaurants SET staff_password = ? WHERE id = ?', [hashedPassword, account.restaurant_id]);

  res.json({ success: true });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
