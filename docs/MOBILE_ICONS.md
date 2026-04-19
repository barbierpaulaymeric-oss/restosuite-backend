# Mobile App Icons — RestoSuite

Required assets when running `npx cap add ios` and `npx cap add android`.

## iOS — `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

| File | Size | Usage |
|------|------|-------|
| AppIcon-1024.png | 1024×1024 | App Store submission |
| AppIcon-180.png  | 180×180   | iPhone @3x |
| AppIcon-120.png  | 120×120   | iPhone @2x |
| AppIcon-167.png  | 167×167   | iPad Pro @2x |
| AppIcon-152.png  | 152×152   | iPad @2x |
| AppIcon-76.png   | 76×76     | iPad 1× |

**Rules:** PNG, no alpha/transparency, no pre-rounded corners (iOS applies rounding automatically).

## Android — `android/app/src/main/res/`

| Folder | Size | Purpose |
|--------|------|---------|
| mipmap-mdpi    | 48×48   | Baseline |
| mipmap-hdpi    | 72×72   | 1.5× |
| mipmap-xhdpi   | 96×96   | 2× |
| mipmap-xxhdpi  | 144×144 | 3× |
| mipmap-xxxhdpi | 192×192 | 4× |

Play Store submission: 512×512 PNG (separate upload in Google Play Console).

**Adaptive icons (Android 8+):** foreground layer on transparent background; keep the logo within the inner 66% safe zone so nothing is clipped by circular/squircle masks.

## Splash Screens

Generate with `@capacitor/splash-screen` once platforms are added.
Recommended source: 2732×2732 PNG (scales to all devices).

## One-Command Generation

```bash
# From project root — generates all required sizes from a single 1024×1024 source
npx @capacitor/assets generate --assetPath assets/icon-1024.png
```

Place `assets/icon-1024.png` at project root before running.
