import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.restosuite.app',
  appName: 'RestoSuite',
  webDir: 'client',
  server: {
    url: 'https://restosuite.fr',
    cleartext: true,
  },
  plugins: {
    Camera: {
      // Permissions are configured in native projects when `npx cap add ios/android` is run
    },
  },
};

export default config;
