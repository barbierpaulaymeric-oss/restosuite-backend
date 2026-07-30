# Exploitation — Persistance, sauvegardes et chiffrement

> Mise à jour : 2026-07-30. Concerne `server/db.js`, `server/db-path.js`,
> `server/backup.js`, `server/scripts/restore-backup.js`,
> `server/scripts/encrypt-db.js` et le service Render `restosuite`.

## 1. Où vit la base

La résolution du chemin est centralisée dans `server/db-path.js` (utilisée par
`db.js`, `backup.js`, `encrypt-db.js`, `restore-backup.js`) :

1. `DB_PATH` (variable d'environnement) si définie ;
2. sinon `/data/restosuite.db` si `NODE_ENV=production` **et** que `/data`
   existe (disque persistant Render) ;
3. sinon `server/data/restosuite.db` (dev local).

**Garde de production** : depuis 2026-07-30, un démarrage en
`NODE_ENV=production` sans `DB_PATH` **et** sans `/data` refuse de démarrer
(`process.exit(1)`), au lieu d'écrire silencieusement sur le disque éphémère de
l'instance. Un environnement jetable peut lever le garde avec
`ALLOW_EPHEMERAL_DB=true`.

`GET /api/health/persistence` (public, booléens seulement) permet de vérifier à
tout moment : type de stockage, existence de la base, chiffrement au repos,
WAL, nombre de sauvegardes et date de la dernière.

## 2. Sauvegardes locales

- **Fréquence** : au démarrage du serveur puis toutes les 6 h
  (`server/index.js`), plus à la demande via `POST /api/admin/backup` (gérant).
- **Mécanisme** : `wal_checkpoint(TRUNCATE)` sur le handle ouvert, copie
  byte-for-byte vers `<dossier de la base>/backups/restosuite-<date>.db`,
  puis **`PRAGMA quick_check` sur la copie** (avec la clé si chiffrée). Une
  copie qui échoue au contrôle est supprimée et l'échec est journalisé.
- **Rétention** : 7 sauvegardes (≈ 42 h d'historique au rythme de 6 h).
- **Limite connue** : ces sauvegardes vivent sur le **même disque** que la
  base. Elles protègent contre une corruption applicative ou une fausse
  manœuvre, **pas** contre la perte du disque ou du compte Render.

## 3. Sauvegardes hors instance (à mettre en place — décision requise)

Aucune copie hors instance n'existe aujourd'hui. Proposition (en attente du
choix du fournisseur de destination par le propriétaire) :

1. Un cron externe (GitHub Actions programmé, ou le cron du poste local)
   appelle un endpoint d'export authentifié **ou** utilise `render ssh`/
   `render disk snapshot` selon le plan Render.
2. La copie chiffrée est poussée vers un stockage objet indépendant
   (ex. OVH Object Storage, Backblaze B2, S3) avec rétention 30 jours.
3. La clé `DB_ENCRYPTION_KEY` est stockée **séparément** des sauvegardes
   (gestionnaire de secrets / coffre), jamais dans le même bucket.

À noter : Render propose des snapshots de disque persistant (rétention 7 jours)
sur les plans avec disque — à vérifier dans le dashboard, c'est un filet
supplémentaire mais pas une sauvegarde hors fournisseur.

## 4. Restauration

Testée localement le 2026-07-30 (voir rapport). Procédure :

```bash
# 1. Arrêter le serveur (Render : suspendre le service ou passer en maintenance)
# 2. Lister les sauvegardes
node server/scripts/restore-backup.js
# 3. Restaurer (la base courante est mise de côté en .pre-restore-<date>, jamais écrasée)
DB_ENCRYPTION_KEY=<clé si chiffrée> node server/scripts/restore-backup.js restosuite-<date>.db
# 4. Redémarrer, puis vérifier
curl -s https://www.restosuite.fr/api/health
curl -s https://www.restosuite.fr/api/health/persistence
```

Le script vérifie `PRAGMA integrity_check` sur la sauvegarde **avant** de
toucher à la base courante, met l'actuelle de côté (rollback possible), et
purge les sidecars `-wal`/`-shm` périmés.

## 5. Chiffrement au repos

- Opt-in via `DB_ENCRYPTION_KEY` (64 hex = clé 32 octets, `openssl rand -hex 32`).
- Au premier boot avec la clé : sauvegarde plaintext horodatée puis
  `PRAGMA rekey` in-place (voir `server/db.js`). Les boots suivants font
  `PRAGMA key` + vérification (mauvaise clé → arrêt immédiat).
- ✅ **État production confirmé le 2026-07-30 : chiffrement ACTIF.**
  `DB_ENCRYPTION_KEY` est bien définie dans les variables d'environnement du
  service `restosuite-backend`. L'affirmation « données chiffrées » de la
  landing est donc exacte. `GET /api/health/persistence` (déployé avec le
  nouveau code) renvoie `encrypted_at_rest: true` pour le re-vérifier à tout
  moment sans exposer de secret.
- Après activation : supprimer manuellement le fichier
  `*.plaintext-backup-*` resté sur `/data` une fois la migration vérifiée.

### Rotation de clé

Jamais en place à chaud. Procédure : fenêtre d'intervention → sauvegarde
vérifiée hors instance → arrêt du serveur → `PRAGMA rekey` via script dédié
avec l'ancienne puis la nouvelle clé → redémarrage avec la nouvelle
`DB_ENCRYPTION_KEY` → contrôle `/api/health` → conservation de l'ancienne clé
tant que des sauvegardes chiffrées avec elle existent (sinon elles deviennent
illisibles).

## 6. Incident — perte ou corruption de données

1. **Geler** : suspendre le service Render (éviter d'écrire par-dessus).
2. Identifier la dernière sauvegarde saine : `quick_check`/`integrity_check`
   sur les copies de `/data/backups` (du plus récent au plus ancien).
3. Restaurer via `restore-backup.js` (§4) — jamais de copie manuelle directe.
4. Redémarrer, vérifier `/api/health/persistence` et quelques parcours métier.
5. Post-mortem : cause, fenêtre de perte (max 6 h entre sauvegardes), actions.

## 7. Render — configuration cible (À APPLIQUER APRÈS VALIDATION)

Le `render.yaml` actuel ne déclare **ni disque persistant ni DB_PATH** ; la
persistance repose sur un disque ajouté via le dashboard (présence de `/data`
constatée par convention projet, à confirmer via `/api/health/persistence`
après déploiement). Diff proposé pour aligner le blueprint sur la réalité —
**ne pas appliquer sans validation du propriétaire** (la synchronisation d'un
blueprint peut recréer des ressources) :

```yaml
services:
  - type: web
    name: restosuite
    env: node
    buildCommand: cd server && npm install
    startCommand: node server/index.js
    disk:                       # ← disque persistant (déjà présent via dashboard ?)
      name: restosuite-data
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: NODE_ENV
        value: production
      - key: DB_PATH            # ← chemin explicite, plus de fallback implicite
        value: /data/restosuite.db
      - key: DB_ENCRYPTION_KEY  # ← secret, jamais de valeur dans Git
        sync: false
      - key: JWT_SECRET
        sync: false
      # … (GEMINI_API_KEY, STRIPE_* inchangés)
```

### État constaté au dashboard le 2026-07-30

| Élément | État réel | Action |
| --- | --- | --- |
| Disque persistant | ✅ **Présent** — 1 GB monté, snapshots Render quotidiens conservés 7 j (filet hors-instance en plus des backups locaux) | Aucune |
| `DB_ENCRYPTION_KEY` | ✅ **Définie** (chiffrement actif) | Aucune |
| `DB_PATH` | ⚠️ **Absente** — le code retombe correctement sur `/data/restosuite.db` (NODE_ENV=production + `/data` monté), et le garde `assertProductionPersistence` accepte cet état | Facultatif : ajouter `DB_PATH=/data/restosuite.db` pour lever toute ambiguïté (défensif, non critique) |
| Certificat apex | ✅ Émis (voir domain-apex.md) | Aucune |

Recommandation résiduelle unique : au prochain déploiement, ajouter la variable
`DB_PATH=/data/restosuite.db` (Environment) — purement défensif, pointe là où la
base vit déjà, aucune migration.
