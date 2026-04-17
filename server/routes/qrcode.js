const { Router } = require('express');
const QRCode = require('qrcode');
const { all, get } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// ═══════════════════════════════════════════
// GET /api/qrcode/table/:tableNumber — Génère QR code PNG
// ═══════════════════════════════════════════
router.get('/table/:tableNumber', async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.tableNumber);
    if (!tableNumber || tableNumber < 1) {
      return res.status(400).json({ error: 'Numéro de table invalide' });
    }
    const rid = req.user && req.user.restaurant_id;
    if (!rid) return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });

    const url = `https://www.restosuite.fr/menu?r=${rid}&table=${tableNumber}`;
    
    const qrBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#1B2A4A', light: '#FFFFFF' }
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-table-${tableNumber}.png"`);
    res.send(qrBuffer);
  } catch (e) {
    console.error('QR code generation error:', e);
    res.status(500).json({ error: 'Erreur génération QR code' });
  }
});

// ═══════════════════════════════════════════
// GET /api/qrcode/tables — Génère QR codes pour toutes les tables
// ═══════════════════════════════════════════
router.get('/tables', async (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const tables = all('SELECT * FROM tables WHERE active = 1 AND restaurant_id = ? ORDER BY table_number', [rid]);
    
    const qrCodes = [];
    for (const table of tables) {
      const url = `https://www.restosuite.fr/menu?r=${rid}&table=${table.table_number}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: '#1B2A4A', light: '#FFFFFF' }
      });
      qrCodes.push({
        table_number: table.table_number,
        zone: table.zone,
        seats: table.seats,
        qr_data_url: dataUrl
      });
    }

    res.json(qrCodes);
  } catch (e) {
    console.error('QR codes generation error:', e);
    res.status(500).json({ error: 'Erreur génération QR codes' });
  }
});

module.exports = router;
