const { Router } = require('express');
const { db, all, get, run } = require('../db');
const PDFDocument = require('pdfkit');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// ═══════════════════════════════════════════
// TEMPERATURE ZONES
// ═══════════════════════════════════════════

router.get('/zones', (req, res) => {
  const zones = all('SELECT * FROM temperature_zones ORDER BY name');
  res.json(zones);
});

router.post('/zones', (req, res) => {
  try {
    const { name, type, min_temp, max_temp } = req.body;

    if (!name) return res.status(400).json({ error: 'Le nom est requis' });

    // Validate temperature values (reasonable range: -50 to 300°C)
    if (min_temp !== undefined && min_temp !== null) {
      if (typeof min_temp !== 'number' || min_temp < -50 || min_temp > 300) {
        return res.status(400).json({ error: 'min_temp must be a number between -50 and 300°C' });
      }
    }

    if (max_temp !== undefined && max_temp !== null) {
      if (typeof max_temp !== 'number' || max_temp < -50 || max_temp > 300) {
        return res.status(400).json({ error: 'max_temp must be a number between -50 and 300°C' });
      }
    }

    const info = run(
      'INSERT INTO temperature_zones (name, type, min_temp, max_temp) VALUES (?, ?, ?, ?)',
      [name, type || 'fridge', min_temp ?? 0, max_temp ?? 4]
    );
    const zone = get('SELECT * FROM temperature_zones WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(zone);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/zones/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM temperature_zones WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Zone introuvable' });

    const { name, type, min_temp, max_temp } = req.body;

    // Validate temperature values (reasonable range: -50 to 300°C)
    if (min_temp !== undefined && min_temp !== null) {
      if (typeof min_temp !== 'number' || min_temp < -50 || min_temp > 300) {
        return res.status(400).json({ error: 'min_temp must be a number between -50 and 300°C' });
      }
    }

    if (max_temp !== undefined && max_temp !== null) {
      if (typeof max_temp !== 'number' || max_temp < -50 || max_temp > 300) {
        return res.status(400).json({ error: 'max_temp must be a number between -50 and 300°C' });
      }
    }

    run(
      'UPDATE temperature_zones SET name = ?, type = ?, min_temp = ?, max_temp = ? WHERE id = ?',
      [name || existing.name, type || existing.type, min_temp ?? existing.min_temp, max_temp ?? existing.max_temp, id]
    );
    res.json(get('SELECT * FROM temperature_zones WHERE id = ?', [id]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/zones/:id', (req, res) => {
  const id = Number(req.params.id);
  run('DELETE FROM temperature_logs WHERE zone_id = ?', [id]);
  const info = run('DELETE FROM temperature_zones WHERE id = ?', [id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Zone introuvable' });
  res.json({ deleted: true });
});

// ═══════════════════════════════════════════
// TEMPERATURE LOGS
// ═══════════════════════════════════════════

router.get('/temperatures', (req, res) => {
  const { zone_id, date } = req.query;
  let sql = `
    SELECT tl.*, tz.name as zone_name, tz.min_temp, tz.max_temp, tz.type as zone_type,
           a.name as recorded_by_name
    FROM temperature_logs tl
    JOIN temperature_zones tz ON tz.id = tl.zone_id
    LEFT JOIN accounts a ON a.id = tl.recorded_by
  `;
  const conditions = [];
  const params = [];
  if (zone_id) { conditions.push('tl.zone_id = ?'); params.push(Number(zone_id)); }
  if (date) { conditions.push("date(tl.recorded_at) = date(?)"); params.push(date); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY tl.recorded_at DESC';
  res.json(all(sql, params));
});

router.post('/temperatures', (req, res) => {
  try {
    const { zone_id, temperature, notes, recorded_by } = req.body;

    if (!zone_id || temperature == null) {
      return res.status(400).json({ error: 'zone_id et temperature sont requis' });
    }

    // Validate temperature is a number in reasonable range (-50 to 300°C)
    if (typeof temperature !== 'number' || temperature < -50 || temperature > 300) {
      return res.status(400).json({ error: 'temperature must be a number between -50 and 300°C' });
    }

    const zone = get('SELECT * FROM temperature_zones WHERE id = ?', [zone_id]);
    if (!zone) return res.status(404).json({ error: 'Zone introuvable' });

    const isAlert = (temperature < zone.min_temp || temperature > zone.max_temp) ? 1 : 0;
    const info = run(
      'INSERT INTO temperature_logs (zone_id, temperature, recorded_by, notes, is_alert) VALUES (?, ?, ?, ?, ?)',
      [zone_id, temperature, recorded_by || null, notes || null, isAlert]
    );
    const log = get(`
      SELECT tl.*, tz.name as zone_name, tz.min_temp, tz.max_temp,
             a.name as recorded_by_name
      FROM temperature_logs tl
      JOIN temperature_zones tz ON tz.id = tl.zone_id
      LEFT JOIN accounts a ON a.id = tl.recorded_by
      WHERE tl.id = ?
    `, [info.lastInsertRowid]);
    res.status(201).json(log);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/temperatures/today', (req, res) => {
  const zones = all('SELECT * FROM temperature_zones ORDER BY name');
  const today = new Date().toISOString().slice(0, 10);
  const result = zones.map(zone => {
    const lastLog = get(`
      SELECT tl.*, a.name as recorded_by_name
      FROM temperature_logs tl
      LEFT JOIN accounts a ON a.id = tl.recorded_by
      WHERE tl.zone_id = ? AND date(tl.recorded_at) = date(?)
      ORDER BY tl.recorded_at DESC LIMIT 1
    `, [zone.id, today]);

    const allToday = all(`
      SELECT * FROM temperature_logs
      WHERE zone_id = ? AND date(recorded_at) = date(?)
      ORDER BY recorded_at DESC
    `, [zone.id, today]);

    // Check if last recording is older than 4 hours
    let needsRecording = true;
    if (lastLog) {
      const lastTime = new Date(lastLog.recorded_at).getTime();
      const now = Date.now();
      needsRecording = (now - lastTime) > 4 * 60 * 60 * 1000;
    }

    return {
      ...zone,
      last_log: lastLog || null,
      today_logs: allToday,
      needs_recording: needsRecording,
      status: !lastLog ? 'missing' : lastLog.is_alert ? 'alert' : 'ok'
    };
  });
  res.json(result);
});

router.get('/temperatures/alerts', (req, res) => {
  const alerts = all(`
    SELECT tl.*, tz.name as zone_name, tz.min_temp, tz.max_temp,
           a.name as recorded_by_name
    FROM temperature_logs tl
    JOIN temperature_zones tz ON tz.id = tl.zone_id
    LEFT JOIN accounts a ON a.id = tl.recorded_by
    WHERE tl.is_alert = 1
    ORDER BY tl.recorded_at DESC
    LIMIT 50
  `);
  res.json(alerts);
});

// ═══════════════════════════════════════════
// CLEANING TASKS
// ═══════════════════════════════════════════

router.get('/cleaning', (req, res) => {
  const tasks = all('SELECT * FROM cleaning_tasks ORDER BY frequency, zone, name');
  res.json(tasks);
});

router.post('/cleaning', (req, res) => {
  const { name, zone, frequency, product, method, concentration, temps_contact, temperature_eau, rincage, epi } = req.body;
  if (!name || !zone) return res.status(400).json({ error: 'name et zone sont requis' });
  const info = run(
    'INSERT INTO cleaning_tasks (name, zone, frequency, product, method, concentration, temps_contact, temperature_eau, rincage, epi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, zone, frequency || 'daily', product || null, method || null,
     concentration || null, temps_contact || null, temperature_eau || null, rincage || null, epi || null]
  );
  res.status(201).json(get('SELECT * FROM cleaning_tasks WHERE id = ?', [info.lastInsertRowid]));
});

router.put('/cleaning/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM cleaning_tasks WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable' });
  const { name, zone, frequency, product, method, concentration, temps_contact, temperature_eau, rincage, epi } = req.body;
  run(
    'UPDATE cleaning_tasks SET name = ?, zone = ?, frequency = ?, product = ?, method = ?, concentration = ?, temps_contact = ?, temperature_eau = ?, rincage = ?, epi = ? WHERE id = ?',
    [name || existing.name, zone || existing.zone, frequency || existing.frequency,
     product !== undefined ? product : existing.product, method !== undefined ? method : existing.method,
     concentration !== undefined ? concentration : existing.concentration,
     temps_contact !== undefined ? temps_contact : existing.temps_contact,
     temperature_eau !== undefined ? temperature_eau : existing.temperature_eau,
     rincage !== undefined ? rincage : existing.rincage,
     epi !== undefined ? epi : existing.epi, id]
  );
  res.json(get('SELECT * FROM cleaning_tasks WHERE id = ?', [id]));
});

router.delete('/cleaning/:id', (req, res) => {
  const id = Number(req.params.id);
  run('DELETE FROM cleaning_logs WHERE task_id = ?', [id]);
  const info = run('DELETE FROM cleaning_tasks WHERE id = ?', [id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Tâche introuvable' });
  res.json({ deleted: true });
});

router.post('/cleaning/:id/done', (req, res) => {
  const id = Number(req.params.id);
  const task = get('SELECT * FROM cleaning_tasks WHERE id = ?', [id]);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
  const { completed_by, notes } = req.body;
  const info = run(
    'INSERT INTO cleaning_logs (task_id, completed_by, notes) VALUES (?, ?, ?)',
    [id, completed_by || null, notes || null]
  );
  const log = get(`
    SELECT cl.*, ct.name as task_name, a.name as completed_by_name
    FROM cleaning_logs cl
    JOIN cleaning_tasks ct ON ct.id = cl.task_id
    LEFT JOIN accounts a ON a.id = cl.completed_by
    WHERE cl.id = ?
  `, [info.lastInsertRowid]);
  res.status(201).json(log);
});

router.get('/cleaning/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date().getDay(); // 0=Sunday
  const dayOfMonth = new Date().getDate();

  const tasks = all('SELECT * FROM cleaning_tasks ORDER BY zone, name');
  const result = tasks.filter(task => {
    if (task.frequency === 'daily') return true;
    if (task.frequency === 'weekly') return dayOfWeek === 1; // Monday
    if (task.frequency === 'monthly') return dayOfMonth === 1; // 1st of month
    return true;
  }).map(task => {
    const lastDone = get(`
      SELECT cl.*, a.name as completed_by_name
      FROM cleaning_logs cl
      LEFT JOIN accounts a ON a.id = cl.completed_by
      WHERE cl.task_id = ? AND date(cl.completed_at) = date(?)
      ORDER BY cl.completed_at DESC LIMIT 1
    `, [task.id, today]);
    return {
      ...task,
      done_today: !!lastDone,
      done_by: lastDone ? lastDone.completed_by_name : null,
      done_at: lastDone ? lastDone.completed_at : null
    };
  });

  const total = result.length;
  const done = result.filter(t => t.done_today).length;
  res.json({ tasks: result, total, done });
});

// ═══════════════════════════════════════════
// TRACEABILITY
// ═══════════════════════════════════════════

router.get('/traceability', (req, res) => {
  const { date, supplier } = req.query;
  let sql = `
    SELECT tl.*, a.name as received_by_name
    FROM traceability_logs tl
    LEFT JOIN accounts a ON a.id = tl.received_by
  `;
  const conditions = [];
  const params = [];
  if (date) { conditions.push("date(tl.received_at) = date(?)"); params.push(date); }
  if (supplier) { conditions.push("tl.supplier LIKE ?"); params.push(`%${supplier}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY tl.received_at DESC';
  res.json(all(sql, params));
});

router.post('/traceability', (req, res) => {
  const { product_name, supplier, batch_number, dlc, ddm, temperature_at_reception, quantity, unit, received_by, notes, etat_emballage, conformite_organoleptique, numero_bl } = req.body;
  if (!product_name) return res.status(400).json({ error: 'Le nom du produit est requis' });
  const info = run(
    `INSERT INTO traceability_logs (product_name, supplier, batch_number, dlc, ddm, temperature_at_reception, quantity, unit, received_by, notes, etat_emballage, conformite_organoleptique, numero_bl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [product_name, supplier || null, batch_number || null, dlc || null, ddm || null,
     temperature_at_reception ?? null, quantity ?? null, unit || 'kg', received_by || null, notes || null,
     etat_emballage || null, conformite_organoleptique || null, numero_bl || null]
  );
  const log = get(`
    SELECT tl.*, a.name as received_by_name
    FROM traceability_logs tl
    LEFT JOIN accounts a ON a.id = tl.received_by
    WHERE tl.id = ?
  `, [info.lastInsertRowid]);
  res.status(201).json(log);
});

router.get('/traceability/dlc-alerts', requireAuth, (req, res) => {
  try {
    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const rows = db.prepare(`
      SELECT *, CAST((julianday(dlc) - julianday('now')) AS INTEGER) as days_until_dlc
      FROM traceability_logs
      WHERE dlc IS NOT NULL AND dlc <= ?
      ORDER BY dlc ASC
    `).all(in3days);
    const categorized = rows.map(r => ({
      ...r,
      alert_level: r.days_until_dlc < 0 ? 'expired' :
                   r.days_until_dlc === 0 ? 'today' :
                   r.days_until_dlc === 1 ? 'tomorrow' : 'two_days'
    }));
    res.json(categorized);
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ═══════════════════════════════════════════
// PDF EXPORTS
// ═══════════════════════════════════════════

const PAGE_W = 595.28;
const MARGIN = 42;
const CONTENT_W = PAGE_W - 2 * MARGIN;

function pdfHeader(doc, title, from, to) {
  let y = MARGIN;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1B2A4A');
  doc.text('RESTOSUITE — HACCP', MARGIN, y);
  y += 20;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
  doc.text(title, MARGIN, y);
  y += 16;
  doc.font('Helvetica').fontSize(9).fillColor('#666');
  const periodText = from && to ? `Période : ${from} au ${to}` : `Généré le ${new Date().toLocaleDateString('fr-FR')}`;
  doc.text(periodText, MARGIN, y);
  y += 6;
  doc.text(`Date d'export : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, MARGIN, y);
  y += 14;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(1).stroke('#1B2A4A');
  y += 12;
  return y;
}

function pdfTableHeader(doc, y, columns) {
  doc.rect(MARGIN, y, CONTENT_W, 18).fill('#E8E8E8').stroke('#CCC');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5);
  let x = MARGIN;
  for (const col of columns) {
    doc.text(col.label, x + 4, y + 5, { width: col.width - 8, align: col.align || 'left' });
    x += col.width;
  }
  return y + 18;
}

function checkPageBreak(doc, y, needed) {
  if (y + needed > 800) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

// Export temperatures PDF
router.get('/export/temperatures', (req, res) => {
  const { from, to } = req.query;
  let sql = `
    SELECT tl.*, tz.name as zone_name, tz.min_temp, tz.max_temp,
           a.name as recorded_by_name
    FROM temperature_logs tl
    JOIN temperature_zones tz ON tz.id = tl.zone_id
    LEFT JOIN accounts a ON a.id = tl.recorded_by
  `;
  const conditions = [];
  const params = [];
  if (from) { conditions.push("date(tl.recorded_at) >= date(?)"); params.push(from); }
  if (to) { conditions.push("date(tl.recorded_at) <= date(?)"); params.push(to); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY tl.recorded_at DESC';
  const logs = all(sql, params);

  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="haccp-temperatures-${from || 'all'}.pdf"`);
  doc.pipe(res);

  let y = pdfHeader(doc, 'RELEVÉS DE TEMPÉRATURE', from, to);

  const columns = [
    { label: 'Date / Heure', width: 100 },
    { label: 'Zone', width: 110 },
    { label: 'Temp °C', width: 60, align: 'center' },
    { label: 'Plage', width: 70, align: 'center' },
    { label: 'Statut', width: 55, align: 'center' },
    { label: 'Relevé par', width: 80 },
    { label: 'Notes', width: CONTENT_W - 475 },
  ];
  y = pdfTableHeader(doc, y, columns);

  doc.font('Helvetica').fontSize(7.5);
  for (const log of logs) {
    y = checkPageBreak(doc, y, 16);
    const isAlert = log.is_alert;
    if (isAlert) {
      doc.rect(MARGIN, y, CONTENT_W, 15).fill('#FFF0F0');
    }
    doc.fillColor(isAlert ? '#D93025' : '#000');
    let x = MARGIN;
    const date = new Date(log.recorded_at);
    doc.text(date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), x + 4, y + 4, { width: columns[0].width - 8 });
    x += columns[0].width;
    doc.text(log.zone_name, x + 4, y + 4, { width: columns[1].width - 8 });
    x += columns[1].width;
    doc.font('Helvetica-Bold').text(log.temperature.toFixed(1) + '°C', x + 4, y + 4, { width: columns[2].width - 8, align: 'center' });
    doc.font('Helvetica');
    x += columns[2].width;
    doc.text(`${log.min_temp}° / ${log.max_temp}°`, x + 4, y + 4, { width: columns[3].width - 8, align: 'center' });
    x += columns[3].width;
    doc.text(isAlert ? '⚠ ALERTE' : '✓ OK', x + 4, y + 4, { width: columns[4].width - 8, align: 'center' });
    x += columns[4].width;
    doc.text(log.recorded_by_name || '—', x + 4, y + 4, { width: columns[5].width - 8 });
    x += columns[5].width;
    doc.text(log.notes || '', x + 4, y + 4, { width: columns[6].width - 8 });

    doc.fillColor('#CCC');
    doc.moveTo(MARGIN, y + 15).lineTo(MARGIN + CONTENT_W, y + 15).lineWidth(0.25).stroke('#DDD');
    y += 15;
  }

  if (logs.length === 0) {
    doc.fillColor('#999').fontSize(9).text('Aucun relevé sur cette période.', MARGIN, y + 10);
  }

  // Summary
  y += 20;
  y = checkPageBreak(doc, y, 60);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
  doc.text(`Total relevés : ${logs.length}`, MARGIN, y);
  const alerts = logs.filter(l => l.is_alert);
  doc.fillColor(alerts.length > 0 ? '#D93025' : '#2D8B55');
  doc.text(`Alertes : ${alerts.length}`, MARGIN, y + 14);

  doc.end();
});

// Export cleaning PDF
router.get('/export/cleaning', (req, res) => {
  const { from, to } = req.query;
  const tasks = all('SELECT * FROM cleaning_tasks ORDER BY frequency, zone, name');

  let logSql = `
    SELECT cl.*, ct.name as task_name, ct.zone, ct.frequency, a.name as completed_by_name
    FROM cleaning_logs cl
    JOIN cleaning_tasks ct ON ct.id = cl.task_id
    LEFT JOIN accounts a ON a.id = cl.completed_by
  `;
  const conditions = [];
  const params = [];
  if (from) { conditions.push("date(cl.completed_at) >= date(?)"); params.push(from); }
  if (to) { conditions.push("date(cl.completed_at) <= date(?)"); params.push(to); }
  if (conditions.length) logSql += ' WHERE ' + conditions.join(' AND ');
  logSql += ' ORDER BY cl.completed_at DESC';
  const logs = all(logSql, params);

  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="haccp-nettoyage-${from || 'all'}.pdf"`);
  doc.pipe(res);

  let y = pdfHeader(doc, 'PLAN DE NETTOYAGE', from, to);

  // Tasks reference
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
  doc.text('Tâches de nettoyage définies :', MARGIN, y);
  y += 14;

  const freqLabels = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel' };
  doc.font('Helvetica').fontSize(8);
  for (const task of tasks) {
    y = checkPageBreak(doc, y, 14);
    doc.fillColor('#000');
    doc.text(`• ${task.name} — ${task.zone} (${freqLabels[task.frequency] || task.frequency})`, MARGIN + 4, y);
    if (task.product) {
      doc.fillColor('#666').text(`  Produit : ${task.product}`, MARGIN + 12, y + 10);
      y += 10;
    }
    y += 14;
  }

  y += 10;
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
  doc.text('Historique des exécutions :', MARGIN, y);
  y += 14;

  const columns = [
    { label: 'Date / Heure', width: 110 },
    { label: 'Tâche', width: 140 },
    { label: 'Zone', width: 80 },
    { label: 'Effectué par', width: 90 },
    { label: 'Notes', width: CONTENT_W - 420 },
  ];
  y = pdfTableHeader(doc, y, columns);

  doc.font('Helvetica').fontSize(7.5);
  for (const log of logs) {
    y = checkPageBreak(doc, y, 15);
    doc.fillColor('#000');
    let x = MARGIN;
    const date = new Date(log.completed_at);
    doc.text(date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), x + 4, y + 4, { width: columns[0].width - 8 });
    x += columns[0].width;
    doc.text(log.task_name, x + 4, y + 4, { width: columns[1].width - 8 });
    x += columns[1].width;
    doc.text(log.zone || '', x + 4, y + 4, { width: columns[2].width - 8 });
    x += columns[2].width;
    doc.text(log.completed_by_name || '—', x + 4, y + 4, { width: columns[3].width - 8 });
    x += columns[3].width;
    doc.text(log.notes || '', x + 4, y + 4, { width: columns[4].width - 8 });
    doc.moveTo(MARGIN, y + 15).lineTo(MARGIN + CONTENT_W, y + 15).lineWidth(0.25).stroke('#DDD');
    y += 15;
  }

  if (logs.length === 0) {
    doc.fillColor('#999').fontSize(9).text('Aucune exécution sur cette période.', MARGIN, y + 10);
  }

  doc.end();
});

// Export traceability PDF
router.get('/export/traceability', (req, res) => {
  const { from, to } = req.query;
  let sql = `
    SELECT tl.*, a.name as received_by_name
    FROM traceability_logs tl
    LEFT JOIN accounts a ON a.id = tl.received_by
  `;
  const conditions = [];
  const params = [];
  if (from) { conditions.push("date(tl.received_at) >= date(?)"); params.push(from); }
  if (to) { conditions.push("date(tl.received_at) <= date(?)"); params.push(to); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY tl.received_at DESC';
  const logs = all(sql, params);

  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="haccp-tracabilite-${from || 'all'}.pdf"`);
  doc.pipe(res);

  let y = pdfHeader(doc, 'TRAÇABILITÉ — RÉCEPTIONS MARCHANDISE', from, to);

  const columns = [
    { label: 'Date', width: 75 },
    { label: 'Produit', width: 100 },
    { label: 'Fournisseur', width: 80 },
    { label: 'N° Lot', width: 60 },
    { label: 'DLC', width: 60 },
    { label: 'T° Réc.', width: 45, align: 'center' },
    { label: 'Qté', width: 45, align: 'center' },
    { label: 'Reçu par', width: CONTENT_W - 465 },
  ];
  y = pdfTableHeader(doc, y, columns);

  doc.font('Helvetica').fontSize(7.5);
  for (const log of logs) {
    y = checkPageBreak(doc, y, 15);
    doc.fillColor('#000');
    let x = MARGIN;
    const date = new Date(log.received_at);
    doc.text(date.toLocaleDateString('fr-FR'), x + 4, y + 4, { width: columns[0].width - 8 });
    x += columns[0].width;
    doc.text(log.product_name, x + 4, y + 4, { width: columns[1].width - 8 });
    x += columns[1].width;
    doc.text(log.supplier || '—', x + 4, y + 4, { width: columns[2].width - 8 });
    x += columns[2].width;
    doc.text(log.batch_number || '—', x + 4, y + 4, { width: columns[3].width - 8 });
    x += columns[3].width;
    const dlcStr = log.dlc ? new Date(log.dlc).toLocaleDateString('fr-FR') : '—';
    doc.text(dlcStr, x + 4, y + 4, { width: columns[4].width - 8 });
    x += columns[4].width;
    doc.text(log.temperature_at_reception != null ? log.temperature_at_reception + '°C' : '—', x + 4, y + 4, { width: columns[5].width - 8, align: 'center' });
    x += columns[5].width;
    doc.text(log.quantity != null ? `${log.quantity} ${log.unit || ''}` : '—', x + 4, y + 4, { width: columns[6].width - 8, align: 'center' });
    x += columns[6].width;
    doc.text(log.received_by_name || '—', x + 4, y + 4, { width: columns[7].width - 8 });
    doc.moveTo(MARGIN, y + 15).lineTo(MARGIN + CONTENT_W, y + 15).lineWidth(0.25).stroke('#DDD');
    y += 15;
  }

  if (logs.length === 0) {
    doc.fillColor('#999').fontSize(9).text('Aucune réception sur cette période.', MARGIN, y + 10);
  }

  doc.end();
});

// ─── Refroidissements rapides ───

router.get('/cooling', requireAuth, (req, res) => {
  try {
    const { from, to, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT cl.*, a.name as recorded_by_name
      FROM cooling_logs cl
      LEFT JOIN accounts a ON cl.recorded_by = a.id
    `;
    const params = [];
    const conditions = [];
    if (from) { conditions.push("DATE(cl.start_time) >= DATE(?)"); params.push(from); }
    if (to)   { conditions.push("DATE(cl.start_time) <= DATE(?)"); params.push(to); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY cl.start_time DESC';
    const total = db.prepare(`SELECT COUNT(*) as c FROM cooling_logs cl ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}`).get(...params).c;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
    const items = db.prepare(sql).all(...params);
    res.json({ items, total, limit: Number(limit), offset: Number(offset) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.post('/cooling', requireAuth, (req, res) => {
  try {
    const { product_name, quantity, unit, start_time, temp_start, time_at_63c, time_at_10c, notes, recorded_by } = req.body;
    if (!product_name || !start_time || temp_start == null) {
      return res.status(400).json({ error: 'product_name, start_time et temp_start sont obligatoires' });
    }
    let is_compliant = null;
    if (time_at_63c && time_at_10c) {
      const diffMs = new Date(time_at_10c) - new Date(time_at_63c);
      is_compliant = diffMs <= 2 * 60 * 60 * 1000 ? 1 : 0;
    }
    const result = db.prepare(`
      INSERT INTO cooling_logs (product_name, quantity, unit, start_time, temp_start, time_at_63c, time_at_10c, is_compliant, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product_name, quantity ?? null, unit ?? 'kg', start_time, temp_start, time_at_63c ?? null, time_at_10c ?? null, is_compliant, notes ?? null, recorded_by ?? null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.put('/cooling/:id', requireAuth, (req, res) => {
  try {
    const { time_at_63c, time_at_10c, notes } = req.body;
    let is_compliant = null;
    if (time_at_63c && time_at_10c) {
      const diffMs = new Date(time_at_10c) - new Date(time_at_63c);
      is_compliant = diffMs <= 2 * 60 * 60 * 1000 ? 1 : 0;
    }
    db.prepare(`
      UPDATE cooling_logs SET time_at_63c = ?, time_at_10c = ?, is_compliant = ?, notes = ?
      WHERE id = ?
    `).run(time_at_63c ?? null, time_at_10c ?? null, is_compliant, notes ?? null, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Remises en température ───

router.get('/reheating', requireAuth, (req, res) => {
  try {
    const { from, to, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT rl.*, a.name as recorded_by_name
      FROM reheating_logs rl
      LEFT JOIN accounts a ON rl.recorded_by = a.id
    `;
    const params = [];
    const conditions = [];
    if (from) { conditions.push("DATE(rl.start_time) >= DATE(?)"); params.push(from); }
    if (to)   { conditions.push("DATE(rl.start_time) <= DATE(?)"); params.push(to); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY rl.start_time DESC';
    const total = db.prepare(`SELECT COUNT(*) as c FROM reheating_logs rl ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}`).get(...params).c;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
    const items = db.prepare(sql).all(...params);
    res.json({ items, total, limit: Number(limit), offset: Number(offset) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.post('/reheating', requireAuth, (req, res) => {
  try {
    const { product_name, quantity, unit, start_time, temp_start, time_at_63c, notes, recorded_by } = req.body;
    if (!product_name || !start_time || temp_start == null) {
      return res.status(400).json({ error: 'product_name, start_time et temp_start sont obligatoires' });
    }
    let is_compliant = null;
    if (time_at_63c) {
      const diffMs = new Date(time_at_63c) - new Date(start_time);
      is_compliant = diffMs <= 1 * 60 * 60 * 1000 ? 1 : 0;
    }
    const result = db.prepare(`
      INSERT INTO reheating_logs (product_name, quantity, unit, start_time, temp_start, time_at_63c, is_compliant, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product_name, quantity ?? null, unit ?? 'kg', start_time, temp_start, time_at_63c ?? null, is_compliant, notes ?? null, recorded_by ?? null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.put('/reheating/:id', requireAuth, (req, res) => {
  try {
    const { time_at_63c, notes } = req.body;
    const existing = db.prepare('SELECT start_time FROM reheating_logs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Enregistrement non trouvé' });
    let is_compliant = null;
    if (time_at_63c) {
      const diffMs = new Date(time_at_63c) - new Date(existing.start_time);
      is_compliant = diffMs <= 1 * 60 * 60 * 1000 ? 1 : 0;
    }
    db.prepare(`UPDATE reheating_logs SET time_at_63c = ?, is_compliant = ?, notes = ? WHERE id = ?`)
      .run(time_at_63c ?? null, is_compliant, notes ?? null, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Huiles de friture ───

router.get('/fryers', requireAuth, (req, res) => {
  try {
    const fryers = db.prepare('SELECT * FROM fryers WHERE is_active = 1 ORDER BY name').all();
    const result = fryers.map(fryer => {
      const lastCheck = db.prepare(`
        SELECT * FROM fryer_checks WHERE fryer_id = ? ORDER BY action_date DESC LIMIT 1
      `).get(fryer.id);
      const lastFilter = db.prepare(`
        SELECT action_date FROM fryer_checks WHERE fryer_id = ? AND action_type = 'filtrage' ORDER BY action_date DESC LIMIT 1
      `).get(fryer.id);
      const lastChange = db.prepare(`
        SELECT action_date FROM fryer_checks WHERE fryer_id = ? AND action_type = 'changement' ORDER BY action_date DESC LIMIT 1
      `).get(fryer.id);
      const serviceStart = db.prepare(`
        SELECT action_date FROM fryer_checks WHERE fryer_id = ? AND action_type = 'mise_en_service' ORDER BY action_date DESC LIMIT 1
      `).get(fryer.id);
      return { ...fryer, last_check: lastCheck, last_filter: lastFilter, last_change: lastChange, service_start: serviceStart };
    });
    res.json({ items: result, total: result.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.post('/fryers', requireAuth, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name est obligatoire' });
    const result = db.prepare('INSERT INTO fryers (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.get('/fryers/:id/checks', requireAuth, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT fc.*, a.name as recorded_by_name
      FROM fryer_checks fc
      LEFT JOIN accounts a ON fc.recorded_by = a.id
      WHERE fc.fryer_id = ?
      ORDER BY fc.action_date DESC
      LIMIT 100
    `).all(req.params.id);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.post('/fryers/:id/checks', requireAuth, (req, res) => {
  try {
    const { action_type, action_date, polar_value, notes, recorded_by } = req.body;
    const VALID_TYPES = ['mise_en_service', 'controle_polaire', 'filtrage', 'changement'];
    if (!action_type || !VALID_TYPES.includes(action_type)) {
      return res.status(400).json({ error: `action_type doit être l'un de: ${VALID_TYPES.join(', ')}` });
    }
    if (action_type === 'controle_polaire' && polar_value == null) {
      return res.status(400).json({ error: 'polar_value est obligatoire pour un contrôle polaire' });
    }
    const result = db.prepare(`
      INSERT INTO fryer_checks (fryer_id, action_type, action_date, polar_value, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, action_type, action_date || new Date().toISOString(), polar_value ?? null, notes ?? null, recorded_by ?? null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Non-conformités ───

router.get('/non-conformities', requireAuth, (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT nc.*,
        a1.name as detected_by_name,
        a2.name as resolved_by_name
      FROM non_conformities nc
      LEFT JOIN accounts a1 ON nc.detected_by = a1.id
      LEFT JOIN accounts a2 ON nc.resolved_by = a2.id
    `;
    const params = [];
    if (status) { sql += ' WHERE nc.status = ?'; params.push(status); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM non_conformities nc ${status ? 'WHERE nc.status = ?' : ''}`).get(...(status ? [status] : [])).c;
    sql += ' ORDER BY nc.detected_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const items = db.prepare(sql).all(...params);
    res.json({ items, total, limit: Number(limit), offset: Number(offset) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.post('/non-conformities', requireAuth, (req, res) => {
  try {
    const { title, description, category, severity, detected_by } = req.body;
    if (!title) return res.status(400).json({ error: 'title est obligatoire' });
    const result = db.prepare(`
      INSERT INTO non_conformities (title, description, category, severity, detected_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, description ?? null, category ?? 'autre', severity ?? 'mineure', detected_by ?? null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.put('/non-conformities/:id', requireAuth, (req, res) => {
  try {
    const { corrective_action, status, resolved_by } = req.body;
    const existing = db.prepare('SELECT * FROM non_conformities WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Non-conformité non trouvée' });
    const resolved_at = status === 'resolu' ? new Date().toISOString() : existing.resolved_at;
    db.prepare(`
      UPDATE non_conformities
      SET corrective_action = ?, status = ?, resolved_at = ?, resolved_by = ?
      WHERE id = ?
    `).run(
      corrective_action ?? existing.corrective_action,
      status ?? existing.status,
      resolved_at,
      resolved_by ?? existing.resolved_by,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
