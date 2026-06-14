// Configuration globale de l'app mobile cuisine.
export const CONFIG = {
  // Backend partagé avec la version web (même API, même JWT).
  // Les requêtes passent par CapacitorHttp (natif) → pas de souci CORS cross-origin.
  apiBase: 'https://www.restosuite.fr/api',
  // Origine pour les fichiers servis à la racine (photos de fiches dans /uploads…).
  assetBase: 'https://www.restosuite.fr',

  appName: 'RestoSuite Cuisine',
  version: '1.0.0',

  // Clés de stockage local — alignées sur la version web pour partage éventuel.
  tokenKey: 'restosuite_token',
  accountKey: 'restosuite_account',

  // Couleurs marque (référence ; la source de vérité est theme.css).
  colors: { navy: '#2D8B5E', orange: '#2D8B5E', accent: '#1F7A4D' },
};
