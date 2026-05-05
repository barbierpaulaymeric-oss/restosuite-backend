#!/usr/bin/env node
'use strict';

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { get, run } = require('../db');

const RESTAURANT_NAME = 'TestRestoSuite';
const EMAIL = process.argv[2] || 'barbierpaulaymeric@gmail.com';

function genPassword() {
  return crypto.randomBytes(12).toString('base64url') + 'A1!';
}

function main() {
  let restaurant = get('SELECT id FROM restaurants WHERE name = ?', [RESTAURANT_NAME]);
  let restaurantId;
  if (restaurant) {
    restaurantId = restaurant.id;
    console.log(`↻ Restaurant "${RESTAURANT_NAME}" exists (id=${restaurantId})`);
  } else {
    const info = run(
      `INSERT INTO restaurants (name, type, city, postal_code, covers, plan)
       VALUES (?, 'restaurant', 'Paris', '75001', 30, 'pro')`,
      [RESTAURANT_NAME]
    );
    restaurantId = Number(info.lastInsertRowid);
    console.log(`✓ Created restaurant id=${restaurantId}`);
  }

  const existing = get('SELECT id FROM accounts WHERE email = ?', [EMAIL]);
  const password = genPassword();
  const hash = bcrypt.hashSync(password, 10);
  const perms = JSON.stringify({
    view_recipes: true, edit_recipes: true, view_costs: true,
    view_suppliers: true, export_pdf: true,
  });

  if (existing) {
    run(
      `UPDATE accounts
          SET password_hash = ?, restaurant_id = ?, role = 'gerant',
              is_owner = 1, trial_start = datetime('now'),
              onboarding_step = 10, permissions = ?,
              first_name = COALESCE(first_name, 'Test'),
              last_name = COALESCE(last_name, 'User'),
              name = COALESCE(name, 'Test User')
        WHERE id = ?`,
      [hash, restaurantId, perms, existing.id]
    );
    console.log(`↻ Reset password for existing account id=${existing.id}`);
  } else {
    run(
      `INSERT INTO accounts
         (name, pin, role, permissions, email, password_hash,
          first_name, last_name, restaurant_id, onboarding_step, is_owner, trial_start)
       VALUES (?, NULL, 'gerant', ?, ?, ?, 'Test', 'User', ?, 10, 1, datetime('now'))`,
      ['Test User', perms, EMAIL, hash, restaurantId]
    );
    console.log(`✓ Created account email=${EMAIL}`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Test account ready');
  console.log('═══════════════════════════════════════════');
  console.log(`  Restaurant: ${RESTAURANT_NAME} (id=${restaurantId})`);
  console.log(`  Email:      ${EMAIL}`);
  console.log(`  Password:   ${password}`);
  console.log(`  Role:       gerant (owner, full perms, fresh 60-day trial)`);
  console.log('═══════════════════════════════════════════\n');
}

main();
