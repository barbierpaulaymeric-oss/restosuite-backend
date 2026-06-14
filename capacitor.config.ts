import type { CapacitorConfig } from '@capacitor/cli';

/**
 * RestoSuite Cuisine — app mobile native (iOS / iPadOS / macOS Catalyst / Android).
 *
 * ⚠️ Ce N'EST PAS un wrapper WebView de la prod. C'est une UI custom dédiée
 * cuisine (dossier `mobile/www`), bundlée DANS l'app et pensée pour la mise en
 * place et le service (gros boutons, contraste élevé, dictée, offline fiches).
 *
 * L'app parle au MÊME backend que le web (https://www.restosuite.fr/api) avec le
 * même JWT. Les requêtes passent par CapacitorHttp (couche HTTP native) → pas de
 * restriction CORS ni de problème de cookies cross-origin ; on s'appuie sur le
 * token Bearer renvoyé par /api/auth/smart-login.
 *
 * Pas de `server.url` : le code web est embarqué, donc consultable hors-ligne.
 */
const config: CapacitorConfig = {
  appId: 'fr.restosuite.app',
  appName: 'RestoSuite Cuisine',
  webDir: 'mobile/www',
  // Fond sombre de la WebView native : évite les flashs/barres blanches pendant
  // l'ouverture du clavier, l'overscroll et avant le premier rendu.
  backgroundColor: '#0B231C',
  ios: {
    scrollEnabled: true,
    // 'never' : on gère TOUTES les marges sûres (notch, Home Indicator) en CSS
    // via env(safe-area-inset-*). 'always' faisait doublon et faussait le calcul.
    contentInset: 'never',
    backgroundColor: '#0B231C',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // HTTP natif : contourne CORS pour les appels cross-origin vers l'API prod.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0B231C',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B231C',
      // true : la WebView occupe tout l'écran (full-bleed) et env(safe-area-inset-top)
      // renvoie la vraie hauteur de la Dynamic Island → le header se décale via CSS.
      overlaysWebView: true,
    },
    Camera: {},
  },
};

export default config;
