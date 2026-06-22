# Guide — Captures d'écran App Store (RestoSuite Cuisine)

Procédure pour générer les screenshots **iPhone 6.7" (1290 × 2796)** exigés par App Store Connect, via le simulateur Xcode.

## 1. Lancer le bon simulateur

App Store 6.7" = iPhone 15 Pro Max (ou 16 Pro Max), qui rend nativement en 1290 × 2796.

```bash
# Lister les simulateurs disponibles
xcrun simctl list devices available | grep -i "Pro Max"

# Démarrer le simulateur (exemple iPhone 15 Pro Max)
xcrun simctl boot "iPhone 15 Pro Max"
open -a Simulator
```

## 2. Construire et installer l'app

Depuis Xcode (recommandé pour la première fois) :
1. Ouvrir `ios/App/App.xcworkspace` (ou `App.xcodeproj` si pas de Pods).
2. Sélectionner le scheme **App** + destination **iPhone 15 Pro Max**.
3. ⌘R pour build & run sur le simulateur.

Ou en ligne de commande :
```bash
cd ios/App
xcodebuild -scheme App -destination 'platform=iOS Simulator,name=iPhone 15 Pro Max' build
```

## 3. Se connecter avec le compte de démo

- Email : `demo@restosuite.fr`
- Mot de passe : *(voir appstore-metadata.md)*

Vérifier que le compte contient des données réalistes (fiches, fournisseurs, relevés) avant de capturer.

## 4. Capturer chaque écran

Pour chaque écran, naviguer dans l'app puis capturer :

```bash
# Capture l'écran du simulateur au format PNG natif (1290 x 2796)
xcrun simctl io booted screenshot ~/Desktop/restosuite-shots/01-login.png
```

Raccourci alternatif dans le Simulator : **⌘S** (enregistre sur le Bureau).

### Écrans à capturer (ordre App Store)

| # | Écran | Comment y accéder | Fichier |
|---|---|---|---|
| 1 | **Login** | écran de démarrage avant connexion | `01-login.png` |
| 2 | **Service** | accueil après connexion | `02-service.png` |
| 3 | **Fiches techniques** | onglet Fiches → ouvrir une fiche (food cost visible) | `03-fiches.png` |
| 4 | **HACCP relevé T°** | onglet HACCP → saisie de température | `04-haccp-temp.png` |
| 5 | **Commandes** | onglet Commandes → nouvelle commande fournisseur | `05-commandes.png` |
| 6 | **Alto** | bouton assistant vocal Alto | `06-alto.png` |

```bash
mkdir -p ~/Desktop/restosuite-shots
# puis une commande screenshot par écran (voir tableau)
```

## 5. Vérifier les dimensions

```bash
sips -g pixelWidth -g pixelHeight ~/Desktop/restosuite-shots/*.png
# Toutes doivent être 1290 x 2796
```

## 6. Upload

Glisser les 6 PNG dans App Store Connect → onglet **iPhone 6.7" Display**. Apple dérive automatiquement les autres tailles si elles ne sont pas fournies.

> Astuce : si l'app affiche la barre d'état du simulateur avec une heure/batterie incohérentes, lancer avant capture :
> ```bash
> xcrun simctl status_bar booted override --time "09:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
> ```
