# RestoSuite — Instructions de build iOS avec Xcode

## Contexte

RestoSuite est une web app restaurant (Node.js/Express + Vanilla JS) wrappée dans Capacitor pour devenir une app iOS native. L'app charge `https://restosuite.fr` dans une WebView native et ajoute l'accès à la caméra pour scanner les étiquettes de traçabilité alimentaire (HACCP).

## Prérequis

- macOS avec Xcode 15+ installé
- Compte Apple Developer actif (99€/an)
- Node.js 18+ installé
- Le repo RestoSuite cloné localement

## Étape 1 — Préparer le projet Capacitor

Ouvre un terminal et exécute :

```bash
cd ~/Claude/projects/restosuite
npm install
npx cap sync ios
```

Cela copie les assets web dans le projet iOS et résout les dépendances Swift Package Manager.

## Étape 2 — Ouvrir le projet dans Xcode

```bash
open ios/App/App.xcodeproj
```

**IMPORTANT** : ouvre `.xcodeproj`, PAS `.xcworkspace`. Capacitor 8 utilise Swift Package Manager, pas CocoaPods.

## Étape 3 — Configurer le Signing

1. Dans le navigateur de projet (panneau gauche), sélectionne le projet **App** (icône bleue en haut)
2. Sélectionne le target **App** dans la liste des targets
3. Va dans l'onglet **Signing & Capabilities**
4. Coche **Automatically manage signing**
5. Dans le menu déroulant **Team**, sélectionne ton compte Apple Developer
6. Le **Bundle Identifier** doit être `fr.restosuite.app`
7. Si Xcode affiche une erreur "No profiles for fr.restosuite.app", c'est normal — il va créer le provisioning profile automatiquement

## Étape 4 — Vérifier les permissions caméra

1. Dans le navigateur de projet, ouvre `ios/App/App/Info.plist`
2. Vérifie que ces deux clés existent :
   - `NSCameraUsageDescription` = "RestoSuite utilise la caméra pour scanner les étiquettes de traçabilité alimentaire"
   - `NSPhotoLibraryUsageDescription` = "RestoSuite accède à vos photos pour importer des étiquettes de traçabilité"
3. Si elles n'existent pas, ajoute-les

## Étape 5 — Ajouter l'icône de l'app

1. Dans le navigateur de projet, ouvre **Assets.xcassets > AppIcon**
2. L'icône doit être un PNG de 1024x1024 pixels
3. Pas de transparence, pas de coins arrondis (Apple les arrondit automatiquement)
4. Glisse l'image dans le slot "All Sizes" ou "1024x1024"
5. Si tu n'as pas d'icône, tu peux en générer une temporaire sur appicon.co

## Étape 6 — Builder sur simulateur

1. Dans la barre d'outils en haut de Xcode, clique sur le sélecteur de destination (à droite du nom du scheme "App")
2. Sélectionne un simulateur iPhone (ex: **iPhone 15 Pro**)
3. Appuie sur **Cmd+R** ou clique sur le bouton ▶ Play
4. Le premier build prendra 1-2 minutes (résolution des packages SPM : CapacitorCordova, Capacitor, CapacitorCamera)
5. L'app doit s'ouvrir dans le simulateur et afficher la page de login de RestoSuite
6. Identifiants de test : `demo@restosuite.fr` / `Demo2026!`

### Erreurs courantes au build :

- **"No such module 'Capacitor'"** → Ferme Xcode, supprime le dossier `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/`, rouvre le projet, attends que SPM resolve
- **Signing error** → Vérifie que le Team est sélectionné dans Signing & Capabilities
- **Minimum deployment target** → Si erreur, va dans Build Settings > iOS Deployment Target et mets 14.0

## Étape 7 — Tester sur un iPhone physique

1. Branche ton iPhone en USB
2. Sur l'iPhone : Réglages > Général > Gestion de l'appareil (ou VPN et gestion) > fais confiance au certificat développeur
3. Dans Xcode, sélectionne ton iPhone comme destination
4. **Cmd+R** pour builder et installer
5. Teste spécifiquement :
   - Le login fonctionne
   - La navigation entre les pages
   - La caméra s'ouvre quand tu vas dans HACCP > Traçabilité > Scan étiquettes
   - Le menu hamburger fonctionne (touche le bouton ☰ en haut)

## Étape 8 — Archiver pour l'App Store

1. Sélectionne **Any iOS Device (arm64)** comme destination (pas un simulateur)
2. Menu **Product > Archive**
3. Attends que le build se termine (2-5 minutes)
4. La fenêtre **Organizer** s'ouvre automatiquement avec l'archive
5. Clique **Distribute App**
6. Sélectionne **App Store Connect**
7. Sélectionne **Upload** (pas Export)
8. Laisse les options par défaut (Include bitcode, Upload symbols)
9. Clique **Upload**
10. Attends la fin de l'upload

## Étape 9 — Configurer sur App Store Connect

Va sur https://appstoreconnect.apple.com et crée une nouvelle app :

### Informations de base :
- **Nom** : RestoSuite
- **Langue principale** : Français
- **Bundle ID** : fr.restosuite.app (doit matcher le projet Xcode)
- **SKU** : restosuite-ios-001
- **Catégorie principale** : Affaires (ou Productivité)

### Fiche de l'app :
- **Sous-titre** : Gestion HACCP & cuisine pour restaurants
- **Description** :
```
RestoSuite est l'outil tout-en-un de gestion pour les restaurants professionnels.

• HACCP complet : relevés de température, plan de nettoyage, traçabilité, scan d'étiquettes par caméra
• Fiches techniques avec calcul automatique du food cost
• Assistant IA Alto pour la saisie vocale et les suggestions
• Gestion des fournisseurs et commandes
• Pilotage avec analytics et menu engineering

Conforme aux réglementations CE 852/2004 et Arrêté du 21/12/2009.

Essai gratuit 60 jours, sans engagement, sans carte bancaire.
```
- **Mots-clés** : haccp,restaurant,cuisine,food cost,traçabilité,hygiène,nettoyage,fiche technique,gestion,chef
- **URL politique de confidentialité** : https://www.restosuite.fr/privacy
- **URL support** : https://www.restosuite.fr

### Captures d'écran requises :
Il faut des captures pour 2 tailles d'écran minimum :
- **6.7 pouces** (iPhone 15 Pro Max) : 1290 x 2796 px
- **5.5 pouces** (iPhone 8 Plus) : 1242 x 2208 px

Pour les générer :
1. Lance l'app dans le simulateur iPhone 15 Pro Max
2. Navigue vers chaque écran clé (dashboard, fiches techniques, HACCP, saisie température, Alto)
3. Cmd+S dans le simulateur pour sauvegarder une capture
4. Répète avec le simulateur iPhone 8 Plus

Captures recommandées (5 maximum, dans cet ordre) :
1. Dashboard avec la carte "Ma journée HACCP"
2. Fiche technique avec food cost
3. Saisie groupée des températures
4. Plan de nettoyage avec checkboxes
5. Alto IA en action

### Tarification :
- Sélectionne **Gratuit** (l'app est gratuite, l'abonnement se gère côté web sur restosuite.fr)

### Review Apple — Points d'attention :
- Apple peut rejeter les apps qui sont "juste un site web dans une WebView"
- **Notre justification** : l'app utilise la caméra native (plugin Capacitor Camera) pour le scan d'étiquettes HACCP — c'est une fonctionnalité native qui n'est pas possible dans un navigateur mobile
- Dans les notes de review, écris : "Cette application utilise la caméra native via Capacitor Camera pour scanner les étiquettes de traçabilité alimentaire (conformité HACCP). Cette fonctionnalité nécessite un accès natif à la caméra qui n'est pas disponible via le navigateur web mobile."
- Fournis les identifiants de démo : `demo@restosuite.fr` / `Demo2026!`

## Étape 10 — Soumettre pour review

1. Sur App Store Connect, sélectionne le build uploadé
2. Remplis toutes les sections marquées d'un ⚠️
3. Clique **Ajouter pour review**
4. Clique **Soumettre pour review**
5. Délai : 24h à 7 jours (généralement 24-48h)

## Configuration serveur — Redirect DNS (IMPORTANT)

Pour que `restosuite.fr` (sans www) fonctionne :
1. Va sur le dashboard Render > ton service RestoSuite
2. Settings > Custom Domains
3. Ajoute `restosuite.fr` en plus de `www.restosuite.fr`
4. Configure un enregistrement DNS A ou ALIAS pointant vers l'IP Render

## Architecture technique

```
┌─────────────────────────┐
│   App iOS (Capacitor)   │
│   WebView → restosuite.fr│
│   + Camera native plugin │
└────────────┬────────────┘
             │ HTTPS
┌────────────▼────────────┐
│   Render (Node.js)      │
│   Express + SQLite      │
│   Gemini AI (Alto)      │
└─────────────────────────┘
```

- L'app iOS est une coquille native autour de la web app
- Tout changement côté web est instantané (pas besoin de re-publier sur l'App Store)
- Seuls les changements de permissions natives (nouvelle API iOS) nécessitent un update App Store

## Fichiers importants

| Fichier | Rôle |
|---------|------|
| `capacitor.config.ts` | Config Capacitor (appId, webDir, server URL) |
| `ios/App/App/Info.plist` | Permissions iOS (caméra, photos) |
| `ios/App/App.xcodeproj` | Projet Xcode |
| `client/` | Code source web (chargé dans la WebView) |
| `server/` | Backend Node.js (tourne sur Render) |
