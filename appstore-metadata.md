# App Store — RestoSuite Cuisine

> Métadonnées pour la fiche App Store Connect. Bundle ID : `fr.restosuite.app`
> Version 1.0.0 (build 1)

## Informations de base

| Champ | Valeur |
|---|---|
| **Nom** | RestoSuite Cuisine |
| **Sous-titre** | Gestion restaurant en cuisine |
| **Catégorie principale** | Économie et entreprise |
| **Catégorie secondaire** | Productivité |
| **Classification** | 4+ |
| **Copyright** | 2026 Paul-Aymeric Barbier |
| **URL de confidentialité** | https://www.restosuite.fr/legal/privacy |
| **URL de support** | https://www.restosuite.fr |

## Description

```
RestoSuite Cuisine est l'assistant de cuisine conçu pour les restaurateurs. Consultez vos fiches techniques, relevez vos températures HACCP, contrôlez vos réceptions et passez vos commandes fournisseurs — le tout depuis votre téléphone, en plein service.

Fonctionnalités :
- Fiches techniques avec food cost en temps réel
- Relevés de température HACCP en 2 taps
- Checklist HACCP du jour
- Contrôle des réceptions fournisseurs
- Commandes fournisseurs rapides
- Assistant IA vocal (Alto)
- Consultation rapide des allergènes (14 INCO)
- Minuteries multiples de cuisson
- Mode sombre haute lisibilité pour la cuisine
- Dictée vocale intégrée
- Cache offline pour les fiches techniques

Interface pensée pour la cuisine : gros boutons, contraste élevé, utilisable avec des mains mouillées.
```

## Mots-clés

```
restauration,HACCP,fiches techniques,commandes,fournisseurs,cuisine,food cost,allergènes,température,gestion
```

> Champ « Keywords » App Store Connect : 100 caractères max, séparés par des virgules sans espace. La chaîne ci-dessus fait 99 caractères ✓.

## Notes pour le reviewer Apple

```
Cette app est le compagnon mobile de RestoSuite (www.restosuite.fr), un logiciel de gestion pour restaurants. L'app nécessite un compte RestoSuite pour se connecter.

Compte de test : demo@restosuite.fr / <mot de passe — voir seed-demo.js>

L'app communique avec l'API à https://www.restosuite.fr/api/
```

> ⚠️ Saisir le mot de passe directement dans App Store Connect (champ « Sign-in information »), pas dans ce fichier suivi par git. Le couple identifiant/mot de passe est la source de vérité dans `server/seed-demo.js` (`OWNER_EMAIL` / `OWNER_PASSWORD`). Compte déjà provisionné en prod avec données d'exemple (fiches, fournisseurs, relevés HACCP) ; exclu des KPI admin via `isDemoEmail` (cf. [[feedback_admin_demo_account_exclusion.md]]).

> ✅ **Compte de démo prêt** : `demo@restosuite.fr` (mot de passe = `OWNER_PASSWORD` dans `server/seed-demo.js`), provisionné en prod avec données d'exemple (fiches, fournisseurs, relevés HACCP). Le reviewer peut tester sans setup.

## Captures d'écran requises

App Store Connect exige au minimum le set **iPhone 6.7"** (les autres tailles sont dérivées automatiquement par Apple si absentes).

| Taille | Résolution (portrait) | Appareil simulateur |
|---|---|---|
| **6.7" (obligatoire)** | 1290 × 2796 | iPhone 15 Pro Max / 16 Pro Max |
| 6.5" (optionnel) | 1242 × 2688 | iPhone 11 Pro Max |

Écrans à capturer (dans l'ordre conseillé) :
1. **Login** — écran de connexion
2. **Service** — accueil / tableau de bord du jour
3. **Fiches techniques** — liste + détail avec food cost
4. **HACCP — relevé T°** — saisie de température
5. **Commandes** — passage de commande fournisseur
6. **Alto** — assistant IA vocal

Voir `appstore-screenshots-guide.md` pour la procédure de capture via le simulateur.

## Checklist build (vérifié le 2026-06-22)

- [x] Bundle ID : `fr.restosuite.app`
- [x] Version marketing : `1.0.0`, build : `1`
- [x] Scheme `App` partagé (Archive → config Release)
- [x] Icône 1024×1024 sans canal alpha (conforme App Store)
- [x] Icônes générées à toutes les tailles iPhone (20/29/40/58/60/80/87/120/180/1024)
- [x] `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, etc. en français
- [x] **Capabilities push** — DÉSACTIVÉ pour la v1 (réseau-seule). Voir ci-dessous.
- [x] Compte de démo provisionné (`demo@restosuite.fr`, mot de passe dans `seed-demo.js`, données seedées en prod)
- [ ] Screenshots 6.7" à générer

### Push notifications — DÉSACTIVÉ en v1 (réactivable en v1.x)

Décision (2026-06-22, PA indisponible → choix raisonnable) : **la v1 est réseau-seule, sans push**. Ça évite de dépendre de la config Apple Developer (capability Push Notifications activée sur l'App ID + clé `.p8` APNs) pour soumettre, et supprime tout risque de question reviewer sur un `UIBackgroundModes` inutilisé.

Concrètement, retiré pour la v1 :
- `aps-environment` dans `App.entitlements` et `App-Release.entitlements`
- `UIBackgroundModes: remote-notification` dans `Info.plist`
- flag `PUSH_ENABLED = false` dans `mobile/www/js/push.js` → `initPush()` no-op (aucune demande de permission notif inutile)

**Conservé (dormant)** : le transport serveur `push-sender.js` (env-gated, no-op tant que `APNS_*` absent) et les déclencheurs métier (réception commande, changement de prix, début de service) restent dans le code, prêts à servir.

**Réactivation v1.x** : remettre `aps-environment` (dev + prod), restaurer `UIBackgroundModes`, repasser `PUSH_ENABLED` à `true`, activer la capability Push sur l'App ID, et poser `APNS_KEY_ID`/`APNS_TEAM_ID`/`APNS_SIGNING_KEY` sur Render.
