// ═══════════════════════════════════════════
// Service — Service sessions & configuration
// ═══════════════════════════════════════════

const express = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

// ─── GET /api/service/config ───
router.get('/config', requireAuth, (req, res) => {
  try {
    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const restaurant = get(
      'SELECT service_start, service_end, service_active FROM restaurants WHERE id = ?',
      [account.restaurant_id]
    );

    if (!restaurant) {
      return res.status(404).json({ error: 'Configuration de restaurant introuvable' });
    }

    res.json({
      service_start: restaurant.service_start,
      service_end: restaurant.service_end,
      service_active: restaurant.service_active
    });
  } catch (e) {
    console.error('GET /api/service/config error:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération de la configuration' });
  }
});

// ─── PUT /api/service/config ───
router.put('/config', requireAuth, (req, res) => {
  try {
    const { service_start, service_end } = req.body;

    if (!service_start || !service_end) {
      return res.status(400).json({ error: 'Les heures de service sont requises' });
    }

    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    run(
      'UPDATE restaurants SET service_start = ?, service_end = ? WHERE id = ?',
      [service_start, service_end, account.restaurant_id]
    );

    res.json({
      success: true,
      service_start,
      service_end
    });
  } catch (e) {
    console.error('PUT /api/service/config error:', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration' });
  }
});

// ─── POST /api/service/start ───
router.post('/start', requireAuth, (req, res) => {
  try {
    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    // Set service_active = 1
    run(
      'UPDATE restaurants SET service_active = 1 WHERE id = ?',
      [account.restaurant_id]
    );

    // Create new service_sessions row
    const result = run(
      `INSERT INTO service_sessions (restaurant_id, started_at, status)
       VALUES (?, datetime('now'), 'active')`,
      [account.restaurant_id]
    );

    const sessionId = result.lastInsertRowid;
    const session = get('SELECT * FROM service_sessions WHERE id = ?', [sessionId]);

    // Push : début de service → on alerte toute la cuisine (multi-device).
    // No-op si APNs n'est pas configuré côté serveur (env-gated).
    try {
      const { sendToRestaurant } = require('../lib/push-sender');
      sendToRestaurant(account.restaurant_id, {
        title: 'Service démarré',
        body: 'Le service vient de commencer. Bon service !',
        data: { kind: 'service_started', session_id: sessionId },
      }).catch((e) => console.warn('[push] service_started échoué:', e.message));
    } catch (e) { console.warn('[push] service_started wiring failed:', e.message); }

    res.json({
      success: true,
      session: {
        id: session.id,
        restaurant_id: session.restaurant_id,
        started_at: session.started_at,
        status: session.status
      }
    });
  } catch (e) {
    console.error('POST /api/service/start error:', e);
    res.status(500).json({ error: 'Erreur lors du démarrage du service' });
  }
});

// ─── POST /api/service/stop ───
router.post('/stop', requireAuth, (req, res) => {
  try {
    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    // Get the active session
    const activeSession = get(
      'SELECT * FROM service_sessions WHERE restaurant_id = ? AND status = ?',
      [account.restaurant_id, 'active']
    );

    if (!activeSession) {
      return res.status(404).json({ error: 'Aucune session de service active' });
    }

    // Set service_active = 0
    run(
      'UPDATE restaurants SET service_active = 0 WHERE id = ?',
      [account.restaurant_id]
    );

    // Calculate recap metrics from orders during this session
    const sessionOrders = all(
      `SELECT o.id, o.created_at, o.updated_at, o.total_cost, o.status, o.covers,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND restaurant_id = ?) as item_count
       FROM orders o
       WHERE o.restaurant_id = ? AND o.created_at >= ? AND o.status != 'annulé'`,
      [account.restaurant_id, account.restaurant_id, activeSession.started_at]
    );

    const totalOrders = sessionOrders.length;
    const totalItems = sessionOrders.reduce((sum, o) => sum + (o.item_count || 0), 0);
    const totalRevenue = sessionOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    const totalCovers = sessionOrders.reduce((sum, o) => sum + (o.covers || 0), 0);

    // Avg ticket time: from creation to last update (completion)
    const completedOrders = sessionOrders.filter(o => o.status === 'terminé');
    let avgTicketTimeMin = 0;
    if (completedOrders.length > 0) {
      const totalMinutes = completedOrders.reduce((sum, o) => {
        const diff = (new Date(o.updated_at) - new Date(o.created_at)) / 60000;
        return sum + diff;
      }, 0);
      avgTicketTimeMin = Math.round(totalMinutes / completedOrders.length);
    }

    // Get peak hour (hour with most orders)
    const peakHourResult = all(
      `SELECT strftime('%H', created_at) as hour, COUNT(*) as count
       FROM orders
       WHERE restaurant_id = ? AND created_at >= ? AND status != 'annulé'
       GROUP BY hour
       ORDER BY count DESC
       LIMIT 1`,
      [account.restaurant_id, activeSession.started_at]
    );

    const peakHour = peakHourResult.length > 0 ? peakHourResult[0].hour : null;

    // Update the session
    run(
      `UPDATE service_sessions
       SET ended_at = datetime('now'),
           total_orders = ?,
           total_items = ?,
           total_revenue = ?,
           total_covers = ?,
           avg_ticket_time_min = ?,
           peak_hour = ?,
           status = 'stopped'
       WHERE id = ? AND restaurant_id = ?`,
      [totalOrders, totalItems, totalRevenue, totalCovers, avgTicketTimeMin, peakHour, activeSession.id, account.restaurant_id]
    );

    const updatedSession = get(
      'SELECT * FROM service_sessions WHERE id = ? AND restaurant_id = ?',
      [activeSession.id, account.restaurant_id]
    );

    res.json({
      success: true,
      recap: {
        id: updatedSession.id,
        started_at: updatedSession.started_at,
        ended_at: updatedSession.ended_at,
        total_orders: updatedSession.total_orders,
        total_items: updatedSession.total_items,
        total_revenue: updatedSession.total_revenue,
        total_covers: updatedSession.total_covers,
        avg_ticket_time_min: updatedSession.avg_ticket_time_min,
        peak_hour: updatedSession.peak_hour,
        status: updatedSession.status
      }
    });
  } catch (e) {
    console.error('POST /api/service/stop error:', e);
    res.status(500).json({ error: 'Erreur lors de l\'arrêt du service' });
  }
});

// ─── GET /api/service/active ───
router.get('/active', requireAuth, (req, res) => {
  try {
    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const activeSession = get(
      'SELECT * FROM service_sessions WHERE restaurant_id = ? AND status = ?',
      [account.restaurant_id, 'active']
    );

    if (!activeSession) {
      return res.json({ session: null, metrics: null });
    }

    // Count pending orders
    const pendingOrders = get(
      `SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND status IN ('envoyé','en_cours')`,
      [account.restaurant_id]
    );

    // Calculate current session metrics
    const metrics = get(
      `SELECT
        COUNT(*) as total_orders,
        AVG(CAST((julianday('now') - julianday(created_at)) * 1440 AS FLOAT)) as avg_ticket_time_min
       FROM orders
       WHERE restaurant_id = ? AND created_at >= ? AND status != 'annulé'`,
      [account.restaurant_id, activeSession.started_at]
    );

    res.json({
      session: {
        id: activeSession.id,
        started_at: activeSession.started_at,
        status: activeSession.status
      },
      metrics: {
        pending_orders: pendingOrders?.count || 0,
        avg_ticket_time_min: metrics?.avg_ticket_time_min ? Math.round(metrics.avg_ticket_time_min) : 0,
        total_orders: metrics?.total_orders || 0
      }
    });
  } catch (e) {
    console.error('GET /api/service/active error:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération de la session active' });
  }
});

// ─── GET /api/service/recap/:id ───
router.get('/recap/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const session = get(
      'SELECT * FROM service_sessions WHERE id = ? AND restaurant_id = ?',
      [id, account.restaurant_id]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    res.json({
      recap: {
        id: session.id,
        restaurant_id: session.restaurant_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        scheduled_start: session.scheduled_start,
        scheduled_end: session.scheduled_end,
        total_orders: session.total_orders,
        total_items: session.total_items,
        total_revenue: session.total_revenue,
        total_covers: session.total_covers,
        avg_ticket_time_min: session.avg_ticket_time_min,
        peak_hour: session.peak_hour,
        status: session.status,
        recap_sent: session.recap_sent
      }
    });
  } catch (e) {
    console.error('GET /api/service/recap/:id error:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération du récapitulatif' });
  }
});

// ─── GET /api/service/floor ───
// Single round-trip endpoint for the salle view: returns active session,
// configured tables (from onboarding), all live orders for the restaurant,
// and a list of the recipes sellable on the carte.
router.get('/floor', requireAuth, (req, res) => {
  try {
    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }
    const rid = account.restaurant_id;

    const restaurant = get(
      'SELECT service_start, service_end, service_active FROM restaurants WHERE id = ?',
      [rid]
    );

    const session = get(
      'SELECT * FROM service_sessions WHERE restaurant_id = ? AND status = ?',
      [rid, 'active']
    );

    const tables = all(
      'SELECT id, table_number, zone, seats FROM tables WHERE restaurant_id = ? AND active = 1 ORDER BY zone, table_number',
      [rid]
    );

    // Live orders: anything not terminé/annulé
    const liveOrders = all(
      `SELECT o.*
       FROM orders o
       WHERE o.restaurant_id = ? AND o.status NOT IN ('terminé','annulé')
       ORDER BY o.created_at ASC`,
      [rid]
    );

    // Enrich with items
    const enriched = liveOrders.map(order => {
      const items = all(`
        SELECT oi.*, r.name as recipe_name, r.selling_price
        FROM order_items oi
        JOIN recipes r ON r.id = oi.recipe_id AND r.restaurant_id = ?
        WHERE oi.order_id = ? AND oi.restaurant_id = ?
      `, [rid, order.id, rid]);
      return { ...order, items };
    });

    res.json({
      service: {
        active: !!session,
        session: session ? {
          id: session.id,
          started_at: session.started_at,
          status: session.status
        } : null,
        config: {
          service_start: restaurant?.service_start || null,
          service_end: restaurant?.service_end || null
        }
      },
      tables,
      orders: enriched
    });
  } catch (e) {
    console.error('GET /api/service/floor error:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération du plan de salle' });
  }
});

// ─── GET /api/service/kds ───
// Kitchen display: orders sent to kitchen, grouped by lane
router.get('/kds', requireAuth, (req, res) => {
  try {
    const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
    if (!account || !account.restaurant_id) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }
    const rid = account.restaurant_id;

    // Orders that the kitchen cares about: envoyé (just received) + prêt (awaiting service pickup)
    const orders = all(
      `SELECT o.*
       FROM orders o
       WHERE o.restaurant_id = ? AND o.status IN ('envoyé','prêt')
       ORDER BY o.created_at ASC`,
      [rid]
    );

    const enriched = orders.map(order => {
      const items = all(`
        SELECT oi.*, r.name as recipe_name
        FROM order_items oi
        JOIN recipes r ON r.id = oi.recipe_id AND r.restaurant_id = ?
        WHERE oi.order_id = ? AND oi.restaurant_id = ? AND oi.status != 'annulé'
      `, [rid, order.id, rid]);
      return { ...order, items };
    });

    res.json({ orders: enriched });
  } catch (e) {
    console.error('GET /api/service/kds error:', e);
    res.status(500).json({ error: 'Erreur KDS' });
  }
});

module.exports = router;
