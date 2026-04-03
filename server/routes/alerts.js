const { Router } = require('express');
const { all, get } = require('../db');
const router = Router();

router.get('/daily-summary', (req, res) => {
  // 1. DLC alerts (≤ 3 days)
  const dlcAlerts = all(`
    SELECT product_name, batch_number, dlc, supplier,
      CAST(julianday(dlc) - julianday('now') AS INTEGER) as days_remaining
    FROM traceability_logs 
    WHERE dlc IS NOT NULL AND julianday(dlc) - julianday('now') <= 3 AND julianday(dlc) - julianday('now') >= 0
    ORDER BY dlc ASC
  `);
  
  // 2. Stock bas
  const lowStock = all(`
    SELECT s.*, i.name as ingredient_name, i.default_unit
    FROM stock s JOIN ingredients i ON i.id = s.ingredient_id
    WHERE s.quantity <= s.min_quantity AND s.min_quantity > 0
  `);
  
  // 3. Livraisons en attente
  const pendingDeliveries = all(`
    SELECT dn.*, s.name as supplier_name,
      (SELECT COUNT(*) FROM delivery_note_items WHERE delivery_note_id = dn.id) as item_count
    FROM delivery_notes dn
    LEFT JOIN suppliers s ON s.id = dn.supplier_id
    WHERE dn.status = 'pending'
    ORDER BY dn.created_at DESC
  `);
  
  // 4. Températures hors seuil (24h)
  const tempAlerts = all(`
    SELECT tl.*, tz.name as zone_name, tz.min_temp, tz.max_temp
    FROM temperature_logs tl
    JOIN temperature_zones tz ON tz.id = tl.zone_id
    WHERE tl.recorded_at >= datetime('now', '-24 hours')
    AND (tl.temperature < tz.min_temp OR tl.temperature > tz.max_temp)
    ORDER BY tl.recorded_at DESC
  `);
  
  res.json({
    dlc_alerts: dlcAlerts,
    low_stock: lowStock,
    pending_deliveries: pendingDeliveries,
    temp_alerts: tempAlerts,
    summary: {
      critical: dlcAlerts.filter(a => a.days_remaining <= 0).length + tempAlerts.length,
      warnings: dlcAlerts.filter(a => a.days_remaining > 0).length + lowStock.length,
      pending: pendingDeliveries.length
    }
  });
});

router.get('/critical', (req, res) => {
  const critical = all(`
    SELECT product_name, batch_number, dlc, 'dlc_expired' as type
    FROM traceability_logs 
    WHERE dlc IS NOT NULL AND julianday(dlc) <= julianday('now')
    UNION ALL
    SELECT tz.name || ': ' || tl.temperature || '°C' as product_name, NULL, NULL, 'temp_alert' as type
    FROM temperature_logs tl
    JOIN temperature_zones tz ON tz.id = tl.zone_id
    WHERE tl.recorded_at >= datetime('now', '-2 hours')
    AND (tl.temperature < tz.min_temp OR tl.temperature > tz.max_temp)
  `);
  res.json(critical);
});

module.exports = router;
