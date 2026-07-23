import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clubrugbytipping.app',
  appName: 'Club Rugby Tipping',
  webDir: 'public',
  server: {
    url: 'https://clubrugbytipping.com',
    cleartext: false,
    allowNavigation: ['clubrugbytipping.com', '*.clubrugbytipping.com', '*.supabase.co'],
  },
};

export default config;
