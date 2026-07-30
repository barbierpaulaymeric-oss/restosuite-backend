'use strict';
// ═══════════════════════════════════════════
// Résolution UNIQUE du chemin de la base de données.
//
// Partagée par db.js, backup.js et les scripts d'exploitation
// (scripts/encrypt-db.js, scripts/restore-backup.js). Avant cette
// factorisation, backup.js codait le chemin en dur sans respecter DB_PATH :
// avec un DB_PATH personnalisé, le backup copiait un autre fichier — ou ne
// faisait rien, silencieusement. Toute évolution de la résolution de chemin
// doit se faire ICI et nulle part ailleurs.
// ═══════════════════════════════════════════
const path = require('path');
const fs = require('fs');

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

// /data = disque persistant Render (monté via le dashboard). En dev/test,
// server/data. NB: en test, DB_PATH=':memory:' court-circuite tout ceci.
function resolveDataDir() {
  if (isProduction() && fs.existsSync('/data')) return '/data';
  return path.join(__dirname, 'data');
}

function resolveDbPath() {
  return process.env.DB_PATH || path.join(resolveDataDir(), 'restosuite.db');
}

// Répertoire des sauvegardes locales : à côté de la base (même disque). La
// copie HORS instance est un processus séparé — voir docs/operations/persistence.md.
function resolveBackupDir() {
  const dbPath = resolveDbPath();
  if (dbPath === ':memory:') return null;
  return path.join(path.dirname(dbPath), 'backups');
}

// Refus d'une configuration de production ambiguë : en production, la base DOIT
// vivre soit à un DB_PATH explicite, soit sur le disque persistant /data. Sans
// cela elle atterrit silencieusement sur le disque ÉPHÉMÈRE de l'instance et
// chaque déploiement efface les données clients. ALLOW_EPHEMERAL_DB=true lève
// ce garde pour un environnement jetable, en connaissance de cause.
function assertProductionPersistence() {
  if (!isProduction()) return;
  if (process.env.DB_PATH) return;
  if (fs.existsSync('/data')) return;
  if (process.env.ALLOW_EPHEMERAL_DB === 'true') {
    console.warn('⚠️  ALLOW_EPHEMERAL_DB=true : base sur disque ÉPHÉMÈRE — perdue à chaque déploiement.');
    return;
  }
  console.error('❌ FATAL: production sans persistance garantie.');
  console.error('   Ni DB_PATH défini, ni disque persistant monté sur /data.');
  console.error('   → Montez un disque sur /data (dashboard Render → Disks) ou définissez DB_PATH.');
  console.error('   → Pour un environnement jetable uniquement : ALLOW_EPHEMERAL_DB=true.');
  process.exit(1);
}

module.exports = { resolveDataDir, resolveDbPath, resolveBackupDir, assertProductionPersistence };
