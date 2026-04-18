// ═══════════════════════════════════════════
// /api/ai/execute-action — apply a user-confirmed Alto action
// /api/ai/reject-action  — log a rejected action for learning
//
// execute-action is role-gated (isActionAllowedForRole) and tenant-scoped on
// every FK lookup. Every successful insert feeds the audit log and the
// ai_learning table (personalization signal).
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const {
  get, run,
  writeAudit, isActionAllowedForRole, writeLearning,
} = require('./ai-core');

const router = Router();

// ═══════════════════════════════════════════
// POST /api/ai/execute-action — Execute a confirmed action
// ═══════════════════════════════════════════
router.post('/execute-action', async (req, res) => {
  const { type, params } = req.body;
  const user = req.user;
  const rid = req.user.restaurant_id;

  if (!type || !params) {
    return res.status(400).json({ error: 'type et params requis' });
  }

  // C-3 fix: role-gate before executing. Previously only the /assistant response
  // was filtered; this endpoint bypassed role restrictions entirely.
  if (!isActionAllowedForRole(type, user.role)) {
    return res.status(403).json({ error: 'Action non autorisée pour ce rôle' });
  }

  try {
    let result = null;

    switch (type) {
      case 'add_ingredient': {
        // Add ingredient to a recipe
        const { recipe_id, ingredient_id, gross_quantity, unit, notes } = params;
        if (!recipe_id || !ingredient_id) {
          return res.status(400).json({ error: 'recipe_id et ingredient_id requis' });
        }
        // Verify recipe & ingredient belong to caller tenant
        const recipeOk = get('SELECT id FROM recipes WHERE id = ? AND restaurant_id = ?', [recipe_id, rid]);
        const ingOk = get('SELECT id FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredient_id, rid]);
        if (!recipeOk || !ingOk) return res.status(404).json({ error: 'recipe ou ingredient introuvable' });
        const info = run(
          'INSERT INTO recipe_ingredients (restaurant_id, recipe_id, ingredient_id, gross_quantity, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [rid, recipe_id, ingredient_id, gross_quantity || 0, unit || 'g', notes || '']
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'recipe_ingredients', record_id: info.lastInsertRowid, action: 'create', new_values: { recipe_id, ingredient_id, gross_quantity, unit, notes, via: 'alto' } });
        result = { success: true, message: 'Ingrédient ajouté' };
        break;
      }

      case 'modify_ingredient': {
        // Update ingredient in recipe
        const { recipe_id, ingredient_id, changes } = params;
        if (!recipe_id || !ingredient_id) {
          return res.status(400).json({ error: 'recipe_id et ingredient_id requis' });
        }
        const setClauses = [];
        const values = [];
        for (const [key, value] of Object.entries(changes)) {
          if (['gross_quantity', 'net_quantity', 'unit', 'notes'].includes(key)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
          }
        }
        if (setClauses.length > 0) {
          values.push(recipe_id, ingredient_id, rid);
          run(
            `UPDATE recipe_ingredients SET ${setClauses.join(', ')} WHERE recipe_id = ? AND ingredient_id = ? AND restaurant_id = ?`,
            values
          );
          writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'recipe_ingredients', record_id: null, action: 'update', new_values: { recipe_id, ingredient_id, changes, via: 'alto' } });
        }
        result = { success: true, message: 'Ingrédient modifié' };
        break;
      }

      case 'remove_ingredient': {
        const { recipe_id, ingredient_id } = params;
        if (!recipe_id || !ingredient_id) {
          return res.status(400).json({ error: 'recipe_id et ingredient_id requis' });
        }
        run('DELETE FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ? AND restaurant_id = ?', [recipe_id, ingredient_id, rid]);
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'recipe_ingredients', record_id: null, action: 'delete', old_values: { recipe_id, ingredient_id, via: 'alto' } });
        result = { success: true, message: 'Ingrédient supprimé' };
        break;
      }

      case 'create_recipe': {
        const { name, category, portions, selling_price, recipe_type } = params;
        if (!name) return res.status(400).json({ error: 'name requis' });
        const info = run(
          'INSERT INTO recipes (restaurant_id, name, category, portions, selling_price, recipe_type) VALUES (?, ?, ?, ?, ?, ?)',
          [rid, name, category || 'plat', portions || 1, selling_price || 0, recipe_type || 'plat']
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'recipes', record_id: info.lastInsertRowid, action: 'create', new_values: { name, category, portions, selling_price, recipe_type, via: 'alto' } });
        result = { success: true, message: 'Fiche créée', recipe_id: info.lastInsertRowid };
        break;
      }

      case 'modify_recipe': {
        const { recipe_id, changes } = params;
        if (!recipe_id) return res.status(400).json({ error: 'recipe_id requis' });
        const setClauses = [];
        const values = [];
        for (const [key, value] of Object.entries(changes)) {
          if (['name', 'category', 'portions', 'selling_price', 'recipe_type', 'description'].includes(key)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
          }
        }
        if (setClauses.length > 0) {
          values.push(recipe_id, rid);
          run(`UPDATE recipes SET ${setClauses.join(', ')} WHERE id = ? AND restaurant_id = ?`, values);
          writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'recipes', record_id: recipe_id, action: 'update', new_values: { changes, via: 'alto' } });
        }
        result = { success: true, message: 'Fiche modifiée' };
        break;
      }

      case 'delete_recipe': {
        const { recipe_id } = params;
        if (!recipe_id) return res.status(400).json({ error: 'recipe_id requis' });
        // Delete recipe_ingredients first (FK constraint)
        run('DELETE FROM recipe_ingredients WHERE recipe_id = ? AND restaurant_id = ?', [recipe_id, rid]);
        run('DELETE FROM recipes WHERE id = ? AND restaurant_id = ?', [recipe_id, rid]);
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'recipes', record_id: recipe_id, action: 'delete', old_values: { recipe_id, via: 'alto' } });
        result = { success: true, message: 'Fiche supprimée' };
        break;
      }

      case 'add_supplier': {
        const { name, email, phone } = params;
        if (!name) return res.status(400).json({ error: 'name requis' });
        const info = run(
          'INSERT INTO suppliers (restaurant_id, name, email, phone) VALUES (?, ?, ?, ?)',
          [rid, name, email || null, phone || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'suppliers', record_id: info.lastInsertRowid, action: 'create', new_values: { name, email, phone, via: 'alto' } });
        result = { success: true, message: 'Fournisseur créé', supplier_id: info.lastInsertRowid };
        break;
      }

      case 'create_order': {
        const { supplier_id, ingredient_id, quantity, unit, notes } = params;
        if (!supplier_id || !ingredient_id) {
          return res.status(400).json({ error: 'supplier_id et ingredient_id requis' });
        }
        // Verify supplier & ingredient belong to caller tenant
        const supOk = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplier_id, rid]);
        const ingOk = get('SELECT id FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredient_id, rid]);
        if (!supOk || !ingOk) return res.status(404).json({ error: 'supplier ou ingredient introuvable' });
        const info = run(
          'INSERT INTO orders (restaurant_id, supplier_id, ingredient_id, quantity, unit, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [rid, supplier_id, ingredient_id, quantity || 0, unit || 'kg', 'pending', notes || '']
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'orders', record_id: info.lastInsertRowid, action: 'create', new_values: { supplier_id, ingredient_id, quantity, unit, via: 'alto' } });
        result = { success: true, message: 'Commande créée', order_id: info.lastInsertRowid };
        break;
      }

      case 'record_temperature': {
        // Accepts either an explicit zone_id, or a free-form location/zone_name
        // (e.g. "frigo 1", "chambre froide"). We resolve by case-insensitive name match
        // within the caller's tenant, falling back to LIKE %name%.
        const { zone_id, location, zone_name, temperature, notes, thermometer_id } = params;
        if (temperature === undefined || temperature === null) {
          return res.status(400).json({ error: 'temperature requis' });
        }
        let zone = null;
        if (zone_id) {
          zone = get('SELECT id, min_temp, max_temp, name FROM temperature_zones WHERE id = ? AND restaurant_id = ?', [zone_id, rid]);
        } else {
          const needle = (zone_name || location || '').trim();
          if (!needle) return res.status(400).json({ error: 'zone_id, zone_name ou location requis' });
          zone = get('SELECT id, min_temp, max_temp, name FROM temperature_zones WHERE restaurant_id = ? AND LOWER(name) = LOWER(?)', [rid, needle]);
          if (!zone) {
            zone = get("SELECT id, min_temp, max_temp, name FROM temperature_zones WHERE restaurant_id = ? AND LOWER(name) LIKE LOWER(?) LIMIT 1", [rid, `%${needle}%`]);
          }
          if (!zone) return res.status(404).json({ error: `Zone de température introuvable: ${needle}` });
        }
        const temp = Number(temperature);
        const isAlert = (temp < zone.min_temp || temp > zone.max_temp) ? 1 : 0;
        const info = run(
          'INSERT INTO temperature_logs (restaurant_id, zone_id, temperature, recorded_by, thermometer_id, notes, is_alert) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [rid, zone.id, temp, user.id || null, thermometer_id || null, notes || '', isAlert]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'temperature_logs', record_id: info.lastInsertRowid, action: 'create', new_values: { zone_id: zone.id, zone_name: zone.name, temperature: temp, is_alert: isAlert, via: 'alto' } });
        result = { success: true, message: `Température enregistrée (${zone.name}: ${temp}°C)`, record_id: info.lastInsertRowid, is_alert: !!isAlert };
        break;
      }

      case 'record_loss': {
        const { ingredient_id, quantity, reason, notes } = params;
        if (!ingredient_id || !quantity) {
          return res.status(400).json({ error: 'ingredient_id et quantity requis' });
        }
        const ingOk = get('SELECT id, default_unit FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredient_id, rid]);
        if (!ingOk) return res.status(404).json({ error: 'ingredient introuvable' });
        const info = run(
          'INSERT INTO stock_movements (restaurant_id, ingredient_id, quantity, unit, movement_type, reason, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [rid, ingredient_id, -Math.abs(quantity), ingOk.default_unit || 'g', 'perte', reason || notes || '', new Date().toISOString()]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'stock_movements', record_id: info.lastInsertRowid, action: 'create', new_values: { ingredient_id, quantity: -Math.abs(quantity), movement_type: 'perte', reason, via: 'alto' } });
        result = { success: true, message: 'Perte enregistrée' };
        break;
      }

      case 'record_waste': {
        const { ingredient_id, quantity, reason, notes } = params;
        if (!ingredient_id || !quantity) {
          return res.status(400).json({ error: 'ingredient_id et quantity requis' });
        }
        const ingOk = get('SELECT id, default_unit FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredient_id, rid]);
        if (!ingOk) return res.status(404).json({ error: 'ingredient introuvable' });
        const info = run(
          'INSERT INTO stock_movements (restaurant_id, ingredient_id, quantity, unit, movement_type, reason, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [rid, ingredient_id, -Math.abs(quantity), ingOk.default_unit || 'g', 'dechet', reason || notes || '', new Date().toISOString()]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'stock_movements', record_id: info.lastInsertRowid, action: 'create', new_values: { ingredient_id, quantity: -Math.abs(quantity), movement_type: 'dechet', reason, via: 'alto' } });
        result = { success: true, message: 'Déchet enregistré' };
        break;
      }

      case 'modify_supplier_price': {
        const { supplier_id, ingredient_id, price, unit } = params;
        if (!supplier_id || !ingredient_id || price === undefined) {
          return res.status(400).json({ error: 'supplier_id, ingredient_id et price requis' });
        }
        const supOk = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplier_id, rid]);
        const ingOk = get('SELECT id FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredient_id, rid]);
        if (!supOk || !ingOk) return res.status(404).json({ error: 'supplier ou ingredient introuvable' });
        run(
          'INSERT OR REPLACE INTO supplier_prices (restaurant_id, supplier_id, ingredient_id, price, unit, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
          [rid, supplier_id, ingredient_id, price, unit || 'kg', new Date().toISOString()]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'supplier_prices', record_id: null, action: 'update', new_values: { supplier_id, ingredient_id, price, unit, via: 'alto' } });
        result = { success: true, message: 'Prix mis à jour' };
        break;
      }

      // ─── HACCP températures & CCP ───
      case 'record_cooking': {
        const { product_name, measured_temperature, target_temperature, recipe_id, batch_number, operator, notes, thermometer_id } = params;
        if (!product_name || measured_temperature === undefined) {
          return res.status(400).json({ error: 'product_name et measured_temperature requis' });
        }
        if (recipe_id) {
          const rOk = get('SELECT id FROM recipes WHERE id = ? AND restaurant_id = ?', [recipe_id, rid]);
          if (!rOk) return res.status(404).json({ error: 'recipe introuvable' });
        }
        const target = target_temperature !== undefined ? Number(target_temperature) : 75;
        const measured = Number(measured_temperature);
        const isCompliant = measured >= target ? 1 : 0;
        const now = new Date();
        const info = run(
          `INSERT INTO cooking_records
             (restaurant_id, recipe_id, product_name, batch_number, cooking_date,
              target_temperature, measured_temperature, is_compliant, thermometer_id, operator, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, recipe_id || null, product_name, batch_number || null, now.toISOString().slice(0, 10),
           target, measured, isCompliant, thermometer_id || null, operator || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'cooking_records', record_id: info.lastInsertRowid, action: 'create', new_values: { product_name, measured_temperature: measured, target_temperature: target, is_compliant: isCompliant, via: 'alto' } });
        result = { success: true, message: `Cuisson enregistrée (${measured}°C, ${isCompliant ? 'conforme' : 'NON-conforme'})`, record_id: info.lastInsertRowid, is_compliant: !!isCompliant };
        break;
      }

      case 'record_cooling': {
        const { product_name, quantity, unit, start_time, temp_start, time_at_63c, time_at_10c, notes } = params;
        if (!product_name || temp_start === undefined) {
          return res.status(400).json({ error: 'product_name et temp_start requis' });
        }
        const startIso = start_time || new Date().toISOString();
        // Compliance: 63°C → <10°C en <2h (7200000 ms)
        let isCompliant = null;
        if (time_at_63c && time_at_10c) {
          const delta = new Date(time_at_10c).getTime() - new Date(time_at_63c).getTime();
          isCompliant = delta > 0 && delta <= 2 * 60 * 60 * 1000 ? 1 : 0;
        }
        const info = run(
          `INSERT INTO cooling_logs
             (restaurant_id, product_name, quantity, unit, start_time, temp_start, time_at_63c, time_at_10c, is_compliant, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, product_name, quantity || null, unit || 'kg', startIso, Number(temp_start),
           time_at_63c || null, time_at_10c || null, isCompliant, notes || null, user.id || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'cooling_logs', record_id: info.lastInsertRowid, action: 'create', new_values: { product_name, temp_start, is_compliant: isCompliant, via: 'alto' } });
        result = { success: true, message: 'Refroidissement enregistré', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_reheating': {
        const { product_name, quantity, unit, start_time, temp_start, time_at_63c, notes } = params;
        if (!product_name || temp_start === undefined) {
          return res.status(400).json({ error: 'product_name et temp_start requis' });
        }
        const startIso = start_time || new Date().toISOString();
        // Compliance: atteindre ≥63°C en <1h (3600000 ms)
        let isCompliant = null;
        if (time_at_63c) {
          const delta = new Date(time_at_63c).getTime() - new Date(startIso).getTime();
          isCompliant = delta > 0 && delta <= 60 * 60 * 1000 ? 1 : 0;
        }
        const info = run(
          `INSERT INTO reheating_logs
             (restaurant_id, product_name, quantity, unit, start_time, temp_start, time_at_63c, is_compliant, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, product_name, quantity || null, unit || 'kg', startIso, Number(temp_start),
           time_at_63c || null, isCompliant, notes || null, user.id || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'reheating_logs', record_id: info.lastInsertRowid, action: 'create', new_values: { product_name, temp_start, is_compliant: isCompliant, via: 'alto' } });
        result = { success: true, message: 'Remise en T° enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_fryer_check': {
        const { fryer_id, fryer_name, action_type, polar_value, notes } = params;
        if (!action_type) return res.status(400).json({ error: 'action_type requis' });
        let fryer = null;
        if (fryer_id) {
          fryer = get('SELECT id, name FROM fryers WHERE id = ? AND restaurant_id = ?', [fryer_id, rid]);
        } else if (fryer_name) {
          fryer = get("SELECT id, name FROM fryers WHERE restaurant_id = ? AND LOWER(name) = LOWER(?)", [rid, fryer_name.trim()]);
          if (!fryer) fryer = get("SELECT id, name FROM fryers WHERE restaurant_id = ? AND LOWER(name) LIKE LOWER(?) LIMIT 1", [rid, `%${fryer_name.trim()}%`]);
        }
        if (!fryer) return res.status(404).json({ error: 'Friteuse introuvable' });
        const info = run(
          `INSERT INTO fryer_checks (restaurant_id, fryer_id, action_type, polar_value, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [rid, fryer.id, action_type, polar_value !== undefined ? Number(polar_value) : null, notes || null, user.id || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'fryer_checks', record_id: info.lastInsertRowid, action: 'create', new_values: { fryer_id: fryer.id, fryer_name: fryer.name, action_type, polar_value, via: 'alto' } });
        result = { success: true, message: `Contrôle friteuse enregistré (${fryer.name})`, record_id: info.lastInsertRowid };
        break;
      }

      case 'record_thermometer_calibration': {
        const { thermometer_id, reference_temperature, measured_temperature, tolerance, calibrated_by, certificate_reference, notes, next_calibration_date } = params;
        if (!thermometer_id || reference_temperature === undefined || measured_temperature === undefined) {
          return res.status(400).json({ error: 'thermometer_id, reference_temperature et measured_temperature requis' });
        }
        const therm = get('SELECT id, name, location FROM thermometers WHERE id = ? AND restaurant_id = ?', [thermometer_id, rid]);
        if (!therm) return res.status(404).json({ error: 'thermomètre introuvable' });
        const tol = tolerance !== undefined ? Number(tolerance) : 0.5;
        const ref = Number(reference_temperature);
        const meas = Number(measured_temperature);
        const deviation = +(meas - ref).toFixed(2);
        const isCompliant = Math.abs(deviation) <= tol ? 1 : 0;
        const today = new Date().toISOString().slice(0, 10);
        const info = run(
          `INSERT INTO thermometer_calibrations
             (restaurant_id, thermometer_id, thermometer_name, thermometer_location, calibration_date, next_calibration_date,
              reference_temperature, measured_temperature, deviation, is_compliant, tolerance, calibrated_by, certificate_reference, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, String(therm.id), therm.name, therm.location, today, next_calibration_date || null,
           ref, meas, deviation, isCompliant, tol, calibrated_by || null, certificate_reference || null, notes || null]
        );
        run('UPDATE thermometers SET last_calibration_date = ?, next_calibration_date = COALESCE(?, next_calibration_date) WHERE id = ? AND restaurant_id = ?', [today, next_calibration_date || null, therm.id, rid]);
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'thermometer_calibrations', record_id: info.lastInsertRowid, action: 'create', new_values: { thermometer_id: therm.id, deviation, is_compliant: isCompliant, via: 'alto' } });
        result = { success: true, message: `Étalonnage enregistré (écart ${deviation}°C, ${isCompliant ? 'conforme' : 'NON-conforme'})`, record_id: info.lastInsertRowid };
        break;
      }

      // ─── HACCP nettoyage & traçabilité ───
      case 'record_cleaning': {
        const { task_id, task_name, notes } = params;
        let task = null;
        if (task_id) {
          task = get('SELECT id, name FROM cleaning_tasks WHERE id = ? AND restaurant_id = ?', [task_id, rid]);
        } else if (task_name) {
          task = get("SELECT id, name FROM cleaning_tasks WHERE restaurant_id = ? AND LOWER(name) = LOWER(?)", [rid, task_name.trim()]);
          if (!task) task = get("SELECT id, name FROM cleaning_tasks WHERE restaurant_id = ? AND LOWER(name) LIKE LOWER(?) LIMIT 1", [rid, `%${task_name.trim()}%`]);
        }
        if (!task) return res.status(404).json({ error: 'Tâche de nettoyage introuvable' });
        const info = run(
          'INSERT INTO cleaning_logs (restaurant_id, task_id, completed_by, notes) VALUES (?, ?, ?, ?)',
          [rid, task.id, user.id || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'cleaning_logs', record_id: info.lastInsertRowid, action: 'create', new_values: { task_id: task.id, task_name: task.name, via: 'alto' } });
        result = { success: true, message: `Nettoyage enregistré (${task.name})`, record_id: info.lastInsertRowid };
        break;
      }

      case 'record_traceability_in': {
        const { product_name, supplier, batch_number, dlc, temperature_at_reception, quantity, unit, notes } = params;
        if (!product_name) return res.status(400).json({ error: 'product_name requis' });
        const info = run(
          `INSERT INTO traceability_logs
             (restaurant_id, product_name, supplier, batch_number, dlc, temperature_at_reception, quantity, unit, received_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, product_name, supplier || null, batch_number || null, dlc || null,
           temperature_at_reception !== undefined ? Number(temperature_at_reception) : null,
           quantity !== undefined ? Number(quantity) : null, unit || 'kg', user.id || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'traceability_logs', record_id: info.lastInsertRowid, action: 'create', new_values: { product_name, supplier, batch_number, via: 'alto' } });
        result = { success: true, message: 'Réception tracée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_traceability_out': {
        const { product_name, batch_number, production_date, destination_type, destination_name, quantity, unit, dispatch_date, dispatch_time, temperature_at_dispatch, responsible_person, notes } = params;
        if (!product_name || !destination_type) {
          return res.status(400).json({ error: 'product_name et destination_type requis' });
        }
        const info = run(
          `INSERT INTO downstream_traceability
             (restaurant_id, product_name, batch_number, production_date, destination_type, destination_name,
              quantity, unit, dispatch_date, dispatch_time, temperature_at_dispatch, responsible_person, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, product_name, batch_number || null, production_date || null, destination_type, destination_name || null,
           quantity !== undefined ? Number(quantity) : null, unit || 'kg',
           dispatch_date || new Date().toISOString().slice(0, 10), dispatch_time || null,
           temperature_at_dispatch !== undefined ? Number(temperature_at_dispatch) : null,
           responsible_person || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'downstream_traceability', record_id: info.lastInsertRowid, action: 'create', new_values: { product_name, destination_type, batch_number, via: 'alto' } });
        result = { success: true, message: 'Expédition tracée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_witness_meal': {
        const { meal_date, meal_type, service_type, samples, storage_temperature, storage_location, kept_until, operator, notes, quantity_per_sample } = params;
        if (!meal_date || !meal_type || !kept_until) {
          return res.status(400).json({ error: 'meal_date, meal_type et kept_until requis' });
        }
        const info = run(
          `INSERT INTO witness_meals
             (restaurant_id, meal_date, meal_type, service_type, samples, storage_temperature, storage_location,
              kept_until, quantity_per_sample, operator, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, meal_date, meal_type, service_type || null,
           samples ? (typeof samples === 'string' ? samples : JSON.stringify(samples)) : null,
           storage_temperature !== undefined ? Number(storage_temperature) : null,
           storage_location || null, kept_until, quantity_per_sample || '100g minimum',
           operator || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'witness_meals', record_id: info.lastInsertRowid, action: 'create', new_values: { meal_date, meal_type, kept_until, via: 'alto' } });
        result = { success: true, message: 'Plat témoin enregistré', record_id: info.lastInsertRowid };
        break;
      }

      // ─── Non-conformités & actions correctives ───
      case 'record_non_conformity': {
        const { title, description, category, severity, corrective_action } = params;
        if (!title) return res.status(400).json({ error: 'title requis' });
        const info = run(
          `INSERT INTO non_conformities
             (restaurant_id, title, description, category, severity, corrective_action, detected_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [rid, title, description || null, category || 'autre', severity || 'mineure',
           corrective_action || null, user.id || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'non_conformities', record_id: info.lastInsertRowid, action: 'create', new_values: { title, severity, category, via: 'alto' } });
        result = { success: true, message: 'Non-conformité enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_corrective_action': {
        const { category, trigger_description, action_taken, responsible_person, started_at, completed_at, status, notes, related_record_id, related_record_type } = params;
        if (!category || !action_taken) {
          return res.status(400).json({ error: 'category et action_taken requis' });
        }
        const info = run(
          `INSERT INTO corrective_actions_log
             (restaurant_id, category, trigger_description, action_taken, responsible_person,
              started_at, completed_at, status, notes, related_record_id, related_record_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, category, trigger_description || null, action_taken, responsible_person || null,
           started_at || new Date().toISOString(), completed_at || null, status || 'en_cours',
           notes || null, related_record_id || null, related_record_type || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'corrective_actions_log', record_id: info.lastInsertRowid, action: 'create', new_values: { category, action_taken, status, via: 'alto' } });
        result = { success: true, message: 'Action corrective enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      // ─── BPH / managérial ───
      case 'record_training': {
        const { employee_name, training_topic, trainer, training_date, next_renewal_date, duration_hours, certificate_ref, status, notes } = params;
        if (!employee_name || !training_topic || !training_date) {
          return res.status(400).json({ error: 'employee_name, training_topic et training_date requis' });
        }
        const info = run(
          `INSERT INTO training_records
             (restaurant_id, employee_name, training_topic, trainer, training_date,
              next_renewal_date, duration_hours, certificate_ref, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, employee_name, training_topic, trainer || null, training_date,
           next_renewal_date || null, duration_hours !== undefined ? Number(duration_hours) : null,
           certificate_ref || null, status || 'réalisé', notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'training_records', record_id: info.lastInsertRowid, action: 'create', new_values: { employee_name, training_topic, training_date, via: 'alto' } });
        result = { success: true, message: 'Formation enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_pest_control': {
        const { provider_name, contract_ref, visit_date, next_visit_date, findings, actions_taken, bait_stations_count, status, report_ref } = params;
        if (!visit_date) return res.status(400).json({ error: 'visit_date requis' });
        const info = run(
          `INSERT INTO pest_control
             (restaurant_id, provider_name, contract_ref, visit_date, next_visit_date,
              findings, actions_taken, bait_stations_count, status, report_ref)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, provider_name || null, contract_ref || null, visit_date, next_visit_date || null,
           findings || null, actions_taken || null,
           bait_stations_count !== undefined ? Number(bait_stations_count) : 0,
           status || 'conforme', report_ref || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'pest_control', record_id: info.lastInsertRowid, action: 'create', new_values: { visit_date, status, via: 'alto' } });
        result = { success: true, message: 'Visite nuisibles enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_equipment_maintenance': {
        const { equipment_name, equipment_type, location, last_maintenance_date, next_maintenance_date, maintenance_type, provider, cost, status, notes } = params;
        if (!equipment_name) return res.status(400).json({ error: 'equipment_name requis' });
        const info = run(
          `INSERT INTO equipment_maintenance
             (restaurant_id, equipment_name, equipment_type, location, last_maintenance_date,
              next_maintenance_date, maintenance_type, provider, cost, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, equipment_name, equipment_type || 'autre', location || null,
           last_maintenance_date || null, next_maintenance_date || null,
           maintenance_type || 'préventive', provider || null,
           cost !== undefined ? Number(cost) : null, status || 'à_jour', notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'equipment_maintenance', record_id: info.lastInsertRowid, action: 'create', new_values: { equipment_name, status, via: 'alto' } });
        result = { success: true, message: 'Maintenance enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_staff_health': {
        const { account_id, staff_name, record_type, date_record, date_expiry, notes } = params;
        if (!staff_name || !record_type || !date_record) {
          return res.status(400).json({ error: 'staff_name, record_type et date_record requis' });
        }
        const info = run(
          `INSERT INTO staff_health_records
             (restaurant_id, account_id, staff_name, record_type, date_record, date_expiry, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [rid, account_id || null, staff_name, record_type, date_record, date_expiry || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'staff_health_records', record_id: info.lastInsertRowid, action: 'create', new_values: { staff_name, record_type, date_record, via: 'alto' } });
        result = { success: true, message: 'Entrée santé personnel enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_recall': {
        const { product_name, lot_number, reason, severity, status, actions_taken, quantity_affected, quantity_unit, supplier_id } = params;
        if (!product_name) return res.status(400).json({ error: 'product_name requis' });
        if (supplier_id) {
          const supOk = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplier_id, rid]);
          if (!supOk) return res.status(404).json({ error: 'supplier introuvable' });
        }
        const info = run(
          `INSERT INTO recall_procedures
             (restaurant_id, product_name, lot_number, reason, severity, status, actions_taken,
              quantity_affected, quantity_unit, supplier_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, product_name, lot_number || null, reason || 'sanitaire', severity || 'majeur',
           status || 'alerte', actions_taken || null,
           quantity_affected !== undefined ? Number(quantity_affected) : null,
           quantity_unit || 'kg', supplier_id || null, user.id || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'recall_procedures', record_id: info.lastInsertRowid, action: 'create', new_values: { product_name, severity, status, via: 'alto' } });
        result = { success: true, message: 'Procédure de rappel ouverte', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_tiac': {
        const { date_incident, description, nb_personnes, symptomes, aliments_suspects, mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut } = params;
        if (!date_incident || !description) {
          return res.status(400).json({ error: 'date_incident et description requis' });
        }
        const info = run(
          `INSERT INTO tiac_procedures
             (restaurant_id, date_incident, description, nb_personnes, symptomes, aliments_suspects,
              mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, date_incident, description,
           nb_personnes !== undefined ? Number(nb_personnes) : 0,
           symptomes || null, aliments_suspects || null, mesures_conservatoires || null,
           declaration_ars ? 1 : 0, plats_temoins_conserves ? 1 : 0,
           contact_ddpp || null, statut || 'en_cours']
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'tiac_procedures', record_id: info.lastInsertRowid, action: 'create', new_values: { date_incident, nb_personnes, statut, via: 'alto' } });
        result = { success: true, message: 'TIAC enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_water_analysis': {
        const { analysis_date, analysis_type, provider, results, conformity, next_analysis_date, report_ref, water_source, treatment, notes } = params;
        if (!analysis_date) return res.status(400).json({ error: 'analysis_date requis' });
        const info = run(
          `INSERT INTO water_management
             (restaurant_id, analysis_date, analysis_type, provider, results, conformity,
              next_analysis_date, report_ref, water_source, treatment, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, analysis_date, analysis_type || 'complète', provider || null, results || null,
           conformity === undefined ? 1 : (conformity ? 1 : 0),
           next_analysis_date || null, report_ref || null, water_source || 'réseau public',
           treatment || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'water_management', record_id: info.lastInsertRowid, action: 'create', new_values: { analysis_date, analysis_type, conformity, via: 'alto' } });
        result = { success: true, message: 'Analyse eau enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_pms_audit': {
        const { audit_date, auditor_name, audit_type, scope, findings, overall_score, status, next_audit_date, notes } = params;
        if (!audit_date || !auditor_name) {
          return res.status(400).json({ error: 'audit_date et auditor_name requis' });
        }
        const info = run(
          `INSERT INTO pms_audits
             (restaurant_id, audit_date, auditor_name, audit_type, scope, findings,
              overall_score, status, next_audit_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, audit_date, auditor_name, audit_type || 'interne', scope || 'complet',
           findings ? (typeof findings === 'string' ? findings : JSON.stringify(findings)) : null,
           overall_score !== undefined ? Number(overall_score) : null,
           status || 'planifié', next_audit_date || null, notes || null]
        );
        writeAudit({ restaurant_id: rid, account_id: user.id, table_name: 'pms_audits', record_id: info.lastInsertRowid, action: 'create', new_values: { audit_date, auditor_name, status, via: 'alto' } });
        result = { success: true, message: 'Audit PMS enregistré', record_id: info.lastInsertRowid };
        break;
      }

      default:
        return res.status(400).json({ error: `Action non reconnue: ${type}` });
    }

    // Log confirmed action to ai_learning (personalization signal)
    writeLearning({
      restaurant_id: rid,
      account_id: user.id,
      action_type: type,
      outcome: 'confirmed',
      user_message: req.body?.user_message || null,
      action_params: params,
      feedback_notes: null,
    });

    res.json(result);
  } catch (e) {
    console.error('Execute action error:', e);
    res.status(500).json({ error: 'Erreur exécution action' });
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/reject-action — Log a rejected action for learning
// ═══════════════════════════════════════════
router.post('/reject-action', (req, res) => {
  const { type, params, reason, user_message } = req.body || {};
  const user = req.user;
  if (!type) return res.status(400).json({ error: 'type requis' });
  try {
    writeLearning({
      restaurant_id: user.restaurant_id,
      account_id: user.id,
      action_type: type,
      outcome: 'rejected',
      user_message: user_message || null,
      action_params: params || null,
      feedback_notes: reason || null,
    });
    res.json({ success: true });
  } catch (e) {
    console.error('Reject action error:', e);
    res.status(500).json({ error: 'Erreur enregistrement rejet' });
  }
});

module.exports = router;
