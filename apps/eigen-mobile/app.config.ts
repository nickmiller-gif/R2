import type { ExpoConfig } from 'expo/config';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || 'https://zudslxucibosjwefojtm.supabase.co';

const config: ExpoConfig = {
  name: 'Eigen',
  slug: 'eigen-mobile',
  version: '0.2.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  scheme: 'eigen',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.r2.eigen',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0a0f14',
    },
    package: 'com.r2.eigen',
  },
  extra: {
    supabaseUrl,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
  },
};

export default config;
