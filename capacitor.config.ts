import type { CapacitorConfig } from '@capacitor/cli';

/**
 * RestoSuite — wrapper WebView natif (iOS / iPadOS / macOS Catalyst / Android).
 *
 * L'app ne sert PAS les fichiers localement : elle charge directement la version
 * web de production (https://www.restosuite.fr/app) dans la WebView native.
 * Avantage : les mises à jour sont instantanées, sans repasser par les stores.
 *
 * Le dossier `webDir` (client) reste requis par Capacitor pour le `sync`, mais
 * son contenu n'est pas utilisé tant que `server.url` est défini.
 */
const config: CapacitorConfig = {
  appId: 'fr.restosuite.app',
  appName: 'RestoSuite',
  webDir: 'client',
  server: {
    // Pointe vers la prod : mises à jour instantanées sans recompiler/resoumettre.
    url: 'https://www.restosuite.fr/app',
    // Domaines autorisés à rester dans la WebView (les autres ouvrent Safari/Chrome).
    allowNavigation: ['www.restosuite.fr', 'restosuite.fr'],
  },
  ios: {
    scrollEnabled: true,
    // Barre de statut intégrée au contenu (thème sombre RestoSuite).
    contentInset: 'always',
  },
  android: {
    // Autorise le chargement HTTPS uniquement (pas de cleartext en prod).
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0f1115',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Thème sombre : texte clair sur fond sombre.
      style: 'DARK',
      backgroundColor: '#0f1115',
      overlaysWebView: false,
    },
    Camera: {},
  },
};

export default config;
