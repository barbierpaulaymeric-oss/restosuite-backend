# RestoSuite — Deployment Notes

Checklist des configurations DNS / hébergement à vérifier avant chaque mise en
production. Ces étapes sont **externes au code** et doivent être réalisées dans
le dashboard Render + chez le registrar DNS (OVH / Gandi / Cloudflare).

---

## 1. Domaine apex `restosuite.fr` → redirect vers `www.restosuite.fr`

### Problème observé
Lors du test prospect du 24/04/2026, entrer `restosuite.fr` (sans le `www`) dans
le navigateur donne une page d'erreur. Seul `https://www.restosuite.fr` répond.

### Cause
Le service Render est attaché au domaine `www.restosuite.fr` uniquement. Le
domaine apex (`restosuite.fr`, sans sous-domaine) n'a pas de redirect configuré
et retourne une erreur DNS côté registrar.

### Configuration à appliquer

#### Option A — Redirect HTTP côté registrar (préférée, plus simple)
Chez le registrar DNS (OVH / Gandi / Cloudflare / Porkbun…), configurer un
**redirect HTTP permanent (301)** au niveau du domaine :

| Source              | Destination                    | Type  |
|---------------------|--------------------------------|-------|
| `restosuite.fr`     | `https://www.restosuite.fr`    | 301   |

Chez **OVH** : zone DNS → "Redirection web" → type "Redirection visible permanente".
Chez **Cloudflare** : Rules → Redirect Rules → matching `restosuite.fr/*` →
`https://www.restosuite.fr/$1` (301).

#### Option B — ALIAS/ANAME + Render custom domain
Si le registrar supporte les enregistrements **ALIAS / ANAME / CNAME flattening**
pour le domaine apex :

1. Dashboard Render → Settings → Custom Domains → ajouter `restosuite.fr`.
2. Render fournit un hostname cible (ex. `xxxx.onrender.com`).
3. Dans la zone DNS, créer un enregistrement :
   - type `ALIAS` ou `ANAME` (selon registrar) pour `restosuite.fr` → hostname Render.
   - **Ne pas** utiliser un A record direct vers une IP (Render change les IPs).
4. Ajouter dans l'application Express un middleware de redirect apex → www :
   ```js
   app.use((req, res, next) => {
     if (req.hostname === 'restosuite.fr') {
       return res.redirect(301, 'https://www.restosuite.fr' + req.originalUrl);
     }
     next();
   });
   ```

### Vérification post-déploiement
```bash
curl -I https://restosuite.fr              # attendu : HTTP/1.1 301 Location: https://www.restosuite.fr/
curl -I https://www.restosuite.fr          # attendu : HTTP/1.1 200 OK
curl -I http://restosuite.fr               # attendu : 301 vers https://www.restosuite.fr/
```

---

## 2. DNS / TLS — rappels généraux

- Enregistrement A/ALIAS pour `www.restosuite.fr` pointé sur Render : vérifier.
- Certificat TLS auto-provisionné par Render (Let's Encrypt) : doit couvrir à la
  fois `www.restosuite.fr` ET `restosuite.fr` (Render supporte les deux si les
  deux sont ajoutés en custom domains).
- HSTS : activé via headers Express dans `server/index.js` (helmet).

---

## 3. Variables d'environnement Render (production)

Vérifier que ces variables sont définies dans le dashboard Render (Environment)
et non-vides avant chaque déploiement :

| Variable              | Obligatoire | Notes                                      |
|-----------------------|-------------|--------------------------------------------|
| `JWT_SECRET`          | ✅          | 64+ caractères, jamais réutilisé          |
| `GEMINI_API_KEY`      | ✅          | Compte Google avec quota production       |
| `STRIPE_SECRET_KEY`   | ✅          | `sk_live_…` en prod, `sk_test_…` en staging |
| `STRIPE_WEBHOOK_SECRET` | ✅        | Whsec depuis le dashboard Stripe          |
| `DATABASE_URL`        | ⚠️          | Requis si migration vers PostgreSQL       |
| `SENTRY_DSN`          | optionnel   | Recommandé en prod                         |

Voir `.env.example` à la racine pour la liste complète.

---

## 4. Post-déploiement — smoke tests manuels

1. `https://restosuite.fr` → redirige vers `https://www.restosuite.fr`.
2. `https://www.restosuite.fr` → landing s'affiche (pas de 500).
3. `https://www.restosuite.fr/app` → page de connexion.
4. Test login restaurateur démo → dashboard.
5. Test login fournisseur démo → portail fournisseur.
6. Vérifier `/api/health` retourne `{ ok: true }`.
7. Vérifier Stripe webhook reçoit bien les événements (dashboard Stripe → Events).

---

## 5. Comptes de démo (`npm run seed:demo`)

Le seed `server/seed-demo.js` (idempotent — re-running is a no-op) installe le
restaurant fictif "Chez Laurent — Paris 11" + le fournisseur Metro Paris Nation
configuré comme compte démo du portail fournisseur.

### Restaurant
| Rôle      | Identifiant                | Mot de passe / PIN |
|-----------|----------------------------|--------------------|
| Gérant    | `demo@restosuite.fr`       | `Demo2026!`        |
| Cuisinier | Thomas Moreau              | PIN `1234`         |
| Équipier  | Julie Dubois               | PIN `5678`         |
| Salle     | Marc Bernard               | PIN `9012`         |

### Fournisseur (portail Metro Paris Nation)
| Champ       | Valeur                              |
|-------------|-------------------------------------|
| Email       | `demo-fournisseur@restosuite.fr`    |
| Mot de passe| `Demo2026!`                         |
| PIN membre  | `1111` (Jean Dupont, commercial Metro) |

Flux : depuis `/app` → bouton **Fournisseur** → email + mot de passe →
sélection du membre **Jean Dupont** → PIN `1111`.

---

## Chiffrement de la base au repos (SQLCipher) — RGPD Art. 32

La base peut être chiffrée au repos via `better-sqlite3-multiple-ciphers` (SQLCipher).
C'est **opt-in** : sans `DB_ENCRYPTION_KEY`, la base reste en clair (dev/tests inchangés).

### Activation en production (chiffrement AU BOOT — pas de script shell)
Le chiffrement se fait automatiquement au démarrage de l'app, quand elle est la
SEULE connexion à la base. (Lancer `encrypt-db.js` à la main pendant que le service
tourne échoue avec `SQLITE_BUSY` / « database is locked » : l'app garde la base
ouverte ; le script n'obtient jamais le verrou exclusif. Le script ne sert donc
qu'en local, service arrêté.)

1. Générer une clé : `openssl rand -hex 32` (64 caractères hex). **La stocker dans un
   gestionnaire de mots de passe**, jamais dans le repo. Sa perte = données irrécupérables.
2. Render → Environment → ajouter `DB_ENCRYPTION_KEY` = `<la clé>` → Save.
3. Render redémarre le service. Au premier boot avec la clé, `db.js` détecte que la
   base est encore en clair, en fait une copie `*.plaintext-backup-*`, puis la chiffre
   en place (`PRAGMA rekey`) avant de servir. Les boots suivants ouvrent simplement la
   base chiffrée ; clé absente ou erronée ⇒ refus de démarrer (fail-fast).
4. Vérifier que l'app revient en 200 (`/api/health`).
5. **Supprimer les backups en clair** laissés sur `/data` (`*.plaintext-backup-*`) —
   sinon une copie non chiffrée des données subsiste sur le disque.
6. Mettre à jour `client/legal/privacy.html` pour mentionner le chiffrement au repos (Art. 32).

---

## Région d'hébergement Render (transfert hors UE — RGPD Art. 44)

`render.yaml` ne spécifie **aucune** `region` → Render défaute sur **Oregon (US)**.
**À VÉRIFIER dans le dashboard Render** (page du service → Region) quelle est la région réelle :
- Si **Frankfurt (EU)** : mettre à jour `privacy.html` + `mentions.html` (qui indiquent
  aujourd'hui un hébergement US) pour refléter l'hébergement UE — le transfert hors UE disparaît.
- Si **US** : soit migrer (Render ne déplace pas un service existant en changeant `region` ;
  il faut recréer le service en région EU et y restaurer `/data`), soit sécuriser juridiquement
  (vérifier la certification DPF de Render, signer le DPA + clauses contractuelles types, TIA).

⚠️ Ne pas affirmer « hébergé en UE » dans la politique de confidentialité tant que la région
n'est pas confirmée dans le dashboard (sinon fausse allégation de conformité).
