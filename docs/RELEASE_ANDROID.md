# Publier RestoSuite sur Google Play — guide de mise en ligne

> État au 2026-07-05 : **identité visuelle corrigée** (icônes + splash régénérés en
> vert/or, template Capacitor supprimé), **config de signature release en place**
> (guardée). Il reste les étapes qui exigent **ta machine** (Android Studio + JDK)
> et **ton compte Google Play** — détaillées ci-dessous.
>
> Rappel appId : `fr.restosuite.app` · versionCode `1` · versionName `1.0` ·
> targetSdk `36` (conforme aux exigences Play 2025-26). L'app embarque l'UI
> cuisine `mobile/www` (offline), même backend que le web.

---

## ✅ Déjà fait (dans le repo)

- Icônes de lancement (toutes densités), icône adaptative (fond vert + R), icône
  ronde, et splash (disque vert sur fond pine) **régénérés depuis la source verte**
  via `@capacitor/assets`. L'ancien bleu/cuivre et le template Capacitor teal+robot
  sont supprimés.
- Bloc `signingConfigs.release` dans `android/app/build.gradle`, **guardé** :
  sans `keystore.properties`, les builds **debug** marchent comme avant.
- **Depuis 2026-07-30 : une build release SANS keystore ÉCHOUE explicitement**
  (garde `gradle.taskGraph.whenReady`) au lieu de retomber silencieusement sur
  la signature debug. Un AAB/APK release signé debug est inutilisable pour le
  Play Store ; l'échec clair évite de le découvrir après upload. Message :
  « Build release refusée : android/keystore.properties introuvable ».
- `keystore.properties`, `*.jks`, `*.keystore` dans `.gitignore`.
- Template `android/keystore.properties.example`.
- Test instrumenté `ExampleInstrumentedTest` corrigé (`fr.restosuite.app`, plus
  le gabarit `com.getcapacitor.app`).

> ✅ Vérifié le 2026-07-30 avec le JDK d'Android Studio :
> `assembleDebug` OK sans keystore, `assembleRelease` OK avec keystore présent,
> `assembleRelease` échoue clairement quand `keystore.properties` est absent.
> `assembleDebug` + `testDebugUnitTest` : **BUILD SUCCESSFUL**.

---

## 1. Prérequis (une fois)

- **Android Studio** installé (embarque le JDK + l'Android SDK).
- **Compte Google Play Console** (frais uniques ~25 $) : https://play.google.com/console
- Depuis la racine du repo, synchroniser le projet natif si besoin :
  ```bash
  npx cap sync android
  ```

## 2. Générer la clé de signature (une seule fois — À NE JAMAIS PERDRE)

Depuis `android/`, avec le JDK d'Android Studio dans le PATH :
```bash
keytool -genkey -v -keystore restosuite-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias restosuite
```
Renseigne un mot de passe fort. Puis crée `android/keystore.properties` à partir
du `.example` avec ce mot de passe et l'alias `restosuite`.

> 🔐 **Sauvegarde `restosuite-release.jks` + les mots de passe hors du repo** (gestionnaire
> de mots de passe + backup chiffré). Perdre cette clé = ne plus jamais pouvoir
> mettre à jour l'app sur Play. (Active de préférence **Play App Signing** à l'upload :
> Google gère alors la clé de distribution, tu ne gardes que la clé d'upload.)

## 3. Construire le bundle de publication (AAB)

**Option A — ligne de commande** (une fois `keystore.properties` en place) :
```bash
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```
**Option B — Android Studio** (recommandé si tu débutes) : ouvre `android/` dans
Android Studio → **Build → Generate Signed Bundle / APK → Android App Bundle** → crée/choisis
le keystore → variante `release`. L'IDE gère la signature (pas besoin de l'option A).

## 4. Fiche Play Store (Play Console → Créer une application)

- **Nom de l'app (fiche Store) :** `RestoSuite Cuisine`
  *(le libellé sous l'icône sur l'appareil reste « RestoSuite » — voulu.)*
- **Description courte (≤80 car.) :** `HACCP, stock, food-cost et commandes — la cuisine sous contrôle.`
- **Description longue :** l'app tout-en-un pensée pour les restaurateurs : relevés HACCP
  (températures, nettoyage, traçabilité, refroidissement…), fiches techniques et food-cost,
  commandes fournisseurs, et un assistant IA à la voix. Conçue pour la mise en place et le
  service : gros boutons, dictée, consultation hors-ligne des fiches. Même compte que le
  logiciel web RestoSuite.
- **Catégorie :** Professionnel / Entreprise.
- **Confidentialité :** URL politique = `https://www.restosuite.fr/privacy`.
- **Data safety :** déclarer les données collectées/transmises — compte (email), contenu
  métier (recettes, relevés), et l'envoi de documents scannés à Google (Gemini) ; chiffrées
  en transit ; suppression sur demande (droit à l'effacement in-app).
- **Content rating :** remplir le questionnaire (app pro → « Tout public »).
- **Captures d'écran :** min. 2 (téléphone). Réutiliser/adapter celles de la fiche iOS
  (`marketing/screenshots-capterra/`, `appstore-screenshots-guide.md`).
- **Icône Play (512×512) :** exporter depuis la source verte `assets/icon-only.png`.
- **Feature graphic (1024×500) :** à produire (bannière verte + logo + tagline).

## 5. Upload & publication

Testing interne d'abord (recommandé) → puis production :
- Play Console → **Testing → Internal testing** → upload de l'`.aab` → ajouter ton email testeur → installer via le lien → vérifier icône/splash/login.
- Quand OK : **Production → Create new release** → upload l'AAB → notes de version → **Envoyer pour examen** (validation Google : quelques heures à ~2 jours).

## Mises à jour suivantes

Incrémenter **`versionCode`** (2, 3, …) et **`versionName`** dans
`android/app/build.gradle` avant chaque nouveau build, sinon Play refuse l'upload.

---

### Ce que je ne peux pas faire d'ici
Compiler/signer l'AAB (pas de JDK/SDK sur la machine d'exécution) et l'uploader
(compte Google Play requis). Tout le reste — assets, config, fiche — est prêt.
