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

Compte de test : demo@restosuite.fr / [À REMPLIR PAR PA]

L'app communique avec l'API à https://www.restosuite.fr/api/
```

> ⚠️ **À compléter avant soumission** : créer/vérifier le compte de démo `demo@restosuite.fr`, renseigner le mot de passe ci-dessus, et s'assurer qu'il contient des données d'exemple (fiches techniques, fournisseurs, relevés HACCP) pour que le reviewer puisse tester sans setup.

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
- [x] **Capabilities push** — push APNs CONSERVÉ (décision 2026-06-22, voir ci-dessous)
- [ ] Compte de démo Apple à provisionner
- [ ] Screenshots 6.7" à générer

### Push notifications (CONSERVÉ)

Décision : on garde le push APNs. Il sert à notifier le restaurateur des **réceptions de commandes**, **changements de prix fournisseurs** et **débuts de service**. L'infra iOS est déjà câblée (entitlements dev+prod, `UIBackgroundModes: remote-notification`, callbacks `AppDelegate`, plugin Capacitor `PushNotifications`).

**À ajouter aux notes reviewer Apple** (justifie le `UIBackgroundModes: remote-notification` et l'usage de la position/micro/caméra) :

```
L'app envoie des notifications push pour alerter le restaurateur des événements
métier en temps réel : réception d'une commande fournisseur, changement de prix
d'un fournisseur, et début de service. Le mode remote-notification est utilisé
uniquement pour traiter ces notifications APNs.
```

> ⚠️ **À implémenter** : les *déclencheurs* de notification (réception commande, changement prix, début service) ne sont pas encore branchés côté backend/app. Le transport push est prêt ; il reste à émettre les notifications sur ces événements. Voir le suivi de scope ci-dessous / la conversation.
