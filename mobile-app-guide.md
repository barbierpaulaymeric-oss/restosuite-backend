# RestoSuite — Guide app mobile (iOS / iPadOS / macOS / Android)

> **Principe** : l'app mobile est un **wrapper WebView natif** autour de la version
> web de production. Elle charge directement `https://www.restosuite.fr/app` —
> **rien n'est servi localement**. Conséquence directe : **toutes les mises à jour
> web sont instantanées** sur mobile, sans recompiler ni resoumettre aux stores.
> On ne repasse par les stores que pour modifier l'enveloppe native (icône, splash,
> permissions, version, plugins).

Stack : [Capacitor 8](https://capacitorjs.com) — pas de framework JS, l'app reste
une SPA vanilla servie par Express.

---

## 1. Architecture

```
capacitor.config.ts        → config commune (appId, server.url, splash, status bar)
assets/                    → sources icône + splash (logo.png 1024×1024, fond #0f1115)
ios/                       → projet Xcode (Swift Package Manager, PAS CocoaPods)
android/                   → projet Android Studio (Gradle)
client/                    → webDir requis par Capacitor (non utilisé tant que server.url est défini)
```

- **appId** : `fr.restosuite.app`
- **appName** : `RestoSuite`
- **server.url** : `https://www.restosuite.fr/app` (prod, mises à jour instantanées)
- **Thème** : fond sombre `#0f1115`, status bar texte clair (`style: DARK`)
- **Permissions** : caméra (scan étiquettes HACCP), micro + reconnaissance vocale (dictée Alto), photos/fichiers (import BL & fiches techniques)

---

## 2. Prérequis

| Plateforme | Outils |
|---|---|
| **iOS / iPadOS / macOS** | macOS + **Xcode 15+**, compte **Apple Developer** (99 €/an). Pas besoin de CocoaPods (Capacitor 8 = Swift Package Manager). |
| **Android** | **Android Studio** (Hedgehog+), JDK 17, un compte **Google Play Console** (25 $ une fois). |
| **Commun** | Node.js 18+, repo cloné, `npm install`. |

---

## 3. Scripts npm

```bash
npm run cap:sync       # copie config + assets vers iOS et Android (les deux)
npm run cap:ios        # sync iOS puis ouvre Xcode
npm run cap:android    # sync Android puis ouvre Android Studio
npm run cap:copy       # copie uniquement (sans mettre à jour les plugins natifs)
```

> Comme `server.url` pointe vers la prod, `cap:sync` ne « déploie » pas de code web —
> il propage seulement la config native (icône, splash, permissions, plugins).

---

## 4. Build & test iOS / iPadOS

```bash
npm install
npm run cap:ios          # = npx cap sync ios && npx cap open ios
```

Dans Xcode :

1. Sélectionne le projet **App** → target **App** → onglet **Signing & Capabilities**.
2. Coche **Automatically manage signing** et choisis ton **Team** Apple Developer.
3. Choisis un appareil/simulateur en haut, puis **▶ Run** (Cmd+R).

> ⚠️ Ouvre `ios/App/App.xcodeproj` (PAS `.xcworkspace` — Capacitor 8 utilise SPM).

### Régénérer l'icône / le splash

```bash
# Remplace assets/logo.png (1024×1024) puis :
npx @capacitor/assets generate --ios \
  --iconBackgroundColor '#0f1115' --iconBackgroundColorDark '#0f1115' \
  --splashBackgroundColor '#0f1115' --splashBackgroundColorDark '#0f1115'
```

---

## 5. Build & test macOS

Capacitor n'a pas de plateforme macOS dédiée → on utilise **Mac Catalyst** sur le
projet iOS existant (l'app iPad tourne nativement sur Mac, Apple Silicon & Intel) :

1. Dans Xcode, target **App** → onglet **General** → section **Supported Destinations**.
2. Ajoute **Mac (Mac Catalyst)** (ou **Mac (Designed for iPad)** pour une mise en route immédiate).
3. Onglet **Signing & Capabilities** : vérifie le signing pour la destination Mac.
4. Sélectionne **My Mac (Mac Catalyst)** comme destination, puis **▶ Run**.

> Pour l'App Store macOS, la soumission se fait depuis le **même** target via App Store
> Connect (un seul build couvre iOS/iPadOS/macOS Catalyst).

---

## 6. Build & test Android

```bash
npm install
npm run cap:android      # = npx cap sync android && npx cap open android
```

Dans Android Studio :

1. Laisse Gradle se synchroniser.
2. Choisis un émulateur ou un appareil branché, puis **▶ Run**.

### Régénérer l'icône / le splash

```bash
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#0f1115' --iconBackgroundColorDark '#0f1115' \
  --splashBackgroundColor '#0f1115' --splashBackgroundColorDark '#0f1115'
```

---

## 7. Versionner l'app

| Plateforme | Où | Quoi incrémenter |
|---|---|---|
| iOS / macOS | Xcode → target App → General | **Version** (ex. 1.0.1) + **Build** (entier croissant) |
| Android | `android/app/build.gradle` | `versionName` (ex. "1.0.1") + `versionCode` (entier croissant) |

> Rappel : on ne bump la version **que** pour un changement de l'enveloppe native.
> Un changement web pur (UI, features, fixes) est déjà live via `server.url` — pas de resoumission.

---

## 8. Soumission App Store (iOS / iPadOS / macOS)

1. Xcode → **Product › Archive** (destination = *Any iOS Device* / *Mac Catalyst*).
2. Fenêtre Organizer → **Distribute App** → **App Store Connect** → upload.
3. Sur [App Store Connect](https://appstoreconnect.apple.com) : crée la fiche app
   (bundle `fr.restosuite.app`), captures d'écran, description, mots-clés, politique
   de confidentialité (URL requise).
4. Sélectionne le build uploadé, renseigne les déclarations de confidentialité
   (caméra, micro), puis **Submit for Review**.

> **⚠️ Guideline App Store 4.2** — Apple rejette parfois les apps qui ne sont « qu'un
> site web emballé ». Mets en avant les fonctions natives : **scan caméra des
> étiquettes HACCP** et **dictée vocale Alto**. Démontre-les dans les captures et la
> note de review.

---

## 9. Soumission Play Store (Android)

1. Android Studio → **Build › Generate Signed Bundle / APK** → **Android App Bundle (.aab)**.
2. Crée/forme un **keystore** de signature (à **conserver précieusement** — il signe toutes les MAJ).
   Idéalement, active **Play App Signing** (Google gère la clé de release).
3. Sur [Play Console](https://play.google.com/console) : crée l'app, remplis la fiche
   (description, captures, icône 512, bannière), la déclaration de confidentialité et
   le questionnaire de contenu/data safety (caméra, micro).
4. Upload le `.aab` sur une piste (Internal testing → Production) puis publie.

---

## 10. Notes techniques

- **Service Worker** : `client/sw.js` est *network-first* → compatible wrapper distant,
  il sert le cache uniquement hors-ligne et ne bloque pas le bridge Capacitor. Le SW
  exécuté dans la WebView est celui servi par la prod (origine `www.restosuite.fr`).
- **Permissions WebView** : la caméra (`getUserMedia` / scan) et le micro (Web Speech /
  dictée Alto) sont des **API web** appelées dans la WebView. Les chaînes de permission
  natives (Info.plist côté iOS, AndroidManifest côté Android) sont requises pour que le
  système autorise ces API — c'est déjà configuré.
- **`allowNavigation`** : limité à `restosuite.fr` / `www.restosuite.fr`. Les liens
  externes s'ouvrent dans le navigateur système, pas dans la WebView.
- **Plugins natifs installés** : `@capacitor/camera`, `@capacitor/splash-screen`,
  `@capacitor/status-bar`. Ajout futur : `npm i @capacitor/<plugin>` puis `npm run cap:sync`.

---

## 11. Checklist mise à jour

**Changement web pur (UI / feature / fix)** → `npm run build`, bump SW (`client/sw.js`),
deploy prod. **Rien à faire côté stores**, c'est live immédiatement.

**Changement natif (icône, splash, permission, version, plugin)** :
1. Modifier la config / les assets.
2. `npm run cap:sync`.
3. Bump version + build/versionCode.
4. Archive + upload (App Store Connect / Play Console).
5. Soumettre pour review.
