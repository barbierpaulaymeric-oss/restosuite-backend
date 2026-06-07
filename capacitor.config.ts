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
  ios: {
    scrollEnabled: true,
    contentInset: 'always',
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
      backgroundColor: '#0E1626',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0E1626',
      overlaysWebView: false,
    },
    Camera: {},
  },
};

export default config;
