import type { CapacitorConfig } from '@capacitor/cli';

// L'app mobile (App Store / Play Store) emballe la même appli React que le site.
// Le code est embarqué dans l'app ; les appels /api partent vers https://frigia.fr (voir src/lib/native.ts).
const config: CapacitorConfig = {
  appId: 'fr.frigia.app',
  appName: 'Frigia',
  webDir: 'dist',
  android: {
    // Le site est en https : l'app aussi, pour que les cookies et Supabase se comportent pareil
    // (adresse interne https://localhost)
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    // Une notif qui arrive pendant que l'app est ouverte s'affiche quand même (iPhone)
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
