const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const dataDir = process.env.NODE_ENV === 'production' && fs.existsSync('/data')
  ? '/data'
  : path.join(__dirname, 'data');
const backupDir = path.join(dataDir, 'backups');
const dbPath = path.join(dataDir, 'restosuite.db');

function backupDatabase() {
  if (!fs.existsSync(dbPath)) return;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // WAL-safe: flush the write-ahead log into the main .db file so the byte-for-byte
  // copy below is a consistent snapshot. Without this, transactions still sitting in
  // the -wal sidecar would be silently missing from the backup. Best-effort.
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* :memory: or no WAL — ignore */ }

  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `restosuite-${date}.db`);
  
  // Copy DB file
  fs.copyFileSync(dbPath, backupPath);
  
  // Keep only last 7 backups
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('restosuite-') && f.endsWith('.db'))
    .sort()
    .reverse();
  
  backups.slice(7).forEach(old => {
    fs.unlinkSync(path.join(backupDir, old));
  });
  
  console.log(`✅ Backup: ${backupPath}`);
}

module.exports = { backupDatabase };
