# RestoSuite Cuisine — Guide app mobile native (iOS / iPadOS / macOS / Android)

> **Ce que c'est** : une **vraie app mobile native** avec une **UI custom dédiée
> cuisine** (pas un wrapper WebView de la version web). Pensée pour la **mise en
> place et le service** : gros boutons (gants/mains mouillées), contraste élevé
> (néons), mode sombre, navigation par onglets en bas, dictée vocale omniprésente,
> consultation des fiches **hors-ligne**.
>
> Elle parle au **même backend** que le web (`https://www.restosuite.fr/api`) avec
> le **même compte / JWT**. Mais l'interface est entièrement séparée et réduite à ce
> qui sert en cuisine.

Stack : **Capacitor 8** + **UI vanilla JS custom** (cohérent avec le projet : pas de
framework). Le code de l'UI mobile est embarqué dans l'app (bundlé), donc consultable
hors connexion.

---

## 1. Pourquoi Capacitor + UI custom (et pas React Native, ni un wrapper)

- **Pas un wrapper** : on ne charge plus `restosuite.fr/app`. L'UI mobile est un code
  dédié (`mobile/www`) embarqué dans l'app → expérience native, offline, et écrans
  pensés cuisine.
- **Capacitor plutôt que React Native** : l'infra Capacitor (iOS/Android) est déjà en
  place, et le projet est explicitement « vanilla JS, pas de framework ». RN imposerait
  un toolchain et un langage étrangers à l'équipe. Capacitor réutilise les mêmes
  compétences web et le même client API.
- **CapacitorHttp** est activé : les appels API passent par la couche **HTTP native**,
  donc **aucun problème de CORS** ni de cookies cross-origin. L'auth utilise le **token
  Bearer** renvoyé dans le body de `/api/auth/smart-login`.

---

## 2. Structure du projet

```
mobile/
└── www/                      ← webDir Capacitor (UI embarquée)
    ├── index.html            shell + boot splash
    ├── css/theme.css         thème sombre cuisine (tokens, gros boutons, contraste)
    └── js/
        ├── config.js         apiBase, clés de stockage, couleurs marque
        ├── api.js            client API (Bearer + CSRF), gestion 401/offline
        ├── auth.js           login/logout (smart-login), compte courant
        ├── store.js          cache offline (fetchWithCache) pour les fiches
        ├── router.js         routeur hash minimal
        ├── ui.js             helpers DOM + icônes inline + toast
        ├── app.js            point d'entrée : shell, tab bar, micro, garde auth
        └── screens/
            ├── service.js     écran d'accueil « Service » (actions rapides)
            ├── fiches.js      fiches techniques (recherche + offline)
            ├── haccp.js       relevés T° (2 taps), checklist, minuterie
            ├── receptions.js  contrôle livraison vs commande
            ├── commandes.js   renouveler une commande fournisseur
            ├── alto.js        assistant vocal (Web Speech), startVoice()
            └── login.js       connexion (compte RestoSuite)

capacitor.config.ts           webDir: mobile/www, CapacitorHttp, splash, status bar
ios/  android/                projets natifs (sync via cap)
assets/                       sources icône + splash (logo.png 1024×1024)
```

### Navigation (tab bar basse, pas de hamburger)

5 onglets : **Fiches · HACCP · Réceptions · Commandes · Alto**.
L'app s'ouvre sur l'écran **Service** (accueil) — le logo/titre du header y ramène.

### Ce qui est volontairement absent

Dashboard analytics, configuration (tables/zones/équipe), gestion administrative
(factures/exports compta), admin plateforme → restent sur le web.

---

## 3. Prérequis

| Plateforme | Outils |
|---|---|
| **iOS / iPadOS / macOS** | macOS + **Xcode 15+**, compte **Apple Developer** (99 €/an). SPM (pas CocoaPods). |
| **Android** | **Android Studio** + JDK 17, compte **Google Play Console** (25 $). |
| **Commun** | Node.js 18+, `npm install`. |

---

## 4. Développer l'UI mobile

L'UI est en ES modules vanilla, aucun build requis. Pour itérer dans un navigateur :

```bash
npx http-server mobile/www -p 5599 -c-1
# puis http://localhost:5599
```

> En dev navigateur, `CapacitorHttp` n'est pas actif → les appels API sont soumis au
> CORS. Pour tester les appels réseau réels, lance sur **simulateur/appareil** (étapes
> ci-dessous), où le HTTP natif contourne le CORS.

### Scripts npm

```bash
npm run cap:sync       # copie mobile/www + config vers iOS et Android
npm run cap:ios        # sync iOS + ouvre Xcode
npm run cap:android    # sync Android + ouvre Android Studio
npm run cap:copy       # copie web seule (sans maj plugins natifs)
```

Après **chaque** modif de `mobile/www`, lancer `npm run cap:sync` pour la propager
aux projets natifs.

---

## 5. Build & test iOS / iPadOS

```bash
npm install && npm run cap:ios
```

Dans Xcode : target **App** → **Signing & Capabilities** → *Automatically manage
signing* + ton **Team** → choisir un appareil/simulateur → **▶ Run**.

> Ouvrir `ios/App/App.xcodeproj` (PAS `.xcworkspace` — Capacitor 8 = SPM).

## 6. Build & test macOS

Mac Catalyst sur le target iOS : target **App** → **General** → **Supported
Destinations** → ajouter **Mac (Mac Catalyst)** → destination *My Mac* → **▶ Run**.

## 7. Build & test Android

```bash
npm install && npm run cap:android
```

Android Studio : laisser Gradle sync → choisir émulateur/appareil → **▶ Run**.

---

## 8. Permissions natives

Déjà configurées (les fonctions caméra/micro sont des **API web** dans la WebView ;
les chaînes natives autorisent le système à les accorder) :

- **iOS** `ios/App/App/Info.plist` : `NSCameraUsageDescription`,
  `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`,
  `NSPhotoLibraryUsageDescription`.
- **Android** `android/app/src/main/AndroidManifest.xml` : `CAMERA`, `RECORD_AUDIO`,
  `MODIFY_AUDIO_SETTINGS`, `READ_EXTERNAL_STORAGE`.

---

## 9. Icônes & splash

Source : `assets/logo.png` (1024×1024), fond `#0E1626`.

```bash
npx @capacitor/assets generate --ios --android \
  --iconBackgroundColor '#0E1626' --iconBackgroundColorDark '#0E1626' \
  --splashBackgroundColor '#0E1626' --splashBackgroundColorDark '#0E1626'
```

---

## 10. Versionnement & soumission

| Plateforme | Version |
|---|---|
| iOS / macOS | Xcode → target App → General : **Version** + **Build** |
| Android | `android/app/build.gradle` : `versionName` + `versionCode` |

- **App Store** : Xcode → *Product › Archive* → *Distribute App* → App Store Connect.
  Renseigner les déclarations confidentialité (caméra, micro). L'app native dédiée
  écarte le risque guideline 4.2 (« simple site emballé »).
- **Play Store** : Android Studio → *Generate Signed Bundle (.aab)* → Play Console
  (data safety : caméra, micro). Conserver le keystore / activer Play App Signing.

---

## 11. Auth & réseau — notes techniques

- **Login** : `POST /api/auth/smart-login` → `{ token, csrf_token, account }`. Le
  `token` (Bearer) est stocké en `localStorage['restosuite_token']`, le `csrf_token`
  en mémoire (header `X-CSRF-Token` sur les mutations).
- **CapacitorHttp** patche `fetch` en natif → pas de CORS. **En fallback** (si on
  désactivait CapacitorHttp), il faudrait ajouter les origines WebView
  (`capacitor://localhost`, `http://localhost`) à `PROD_CORS_ALLOWLIST` dans
  `server/app.js`.
- **Offline** : `store.js` met en cache les fiches (`fetchWithCache`) ; l'écran tente
  le réseau puis retombe sur le cache (bandeau « hors-ligne »).
- **Endpoints utilisés** : `/api/recipes` (fiches), `/api/purchase-orders` (commandes),
  `/api/haccp` (relevés — POST à brancher), `/api/orders`, `/api/suppliers`.

---

## 12. État actuel (structure de base posée)

✅ Structure projet · navigation 5 onglets · écran **Service** (actions rapides) ·
login · thème cuisine · client API + auth + cache offline · saisie T° HACCP (2 taps) ·
fiches (recherche + offline) · dictée Alto (Web Speech) · icônes/splash.

🔜 À implémenter ensuite : POST relevés T°, checklist HACCP du jour (`/api/haccp-plan`),
détail fiche (`/recipes/:id` + allergènes), scan BL caméra + contrôle ligne à ligne,
minuteries multiples, renouvellement commande (POST), notifications push (alertes T°,
rappels HACCP).
