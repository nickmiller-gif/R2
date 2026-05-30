import type { ExpoConfig } from 'expo/config';

const eigenChatUrl =
  process.env.EXPO_PUBLIC_EIGEN_CHAT_URL?.trim() || 'https://eigen-chat.pages.dev';

const config: ExpoConfig = {
  name: 'Eigen',
  slug: 'eigen-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
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
    eigenChatUrl,
  },
};

export default config;
