# Eigen Mobile (WebView shell)

Minimal Expo app that wraps the deployed **Eigen Chat** web UI in a full-screen WebView.

## Prerequisites

- Node 20+
- [Expo Go](https://expo.dev/go) on your phone (fastest test), or Xcode / Android Studio for simulators
- Deployed `apps/eigen-chat` on Cloudflare Pages (workflow: `deploy-eigen-chat-cloudflare.yml`)

## Setup

```bash
cd apps/eigen-mobile
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_EIGEN_CHAT_URL to your Cloudflare Pages URL
npm install
```

## Run on your phone (fastest)

```bash
npm start
```

Scan the QR code with Expo Go (iOS Camera or Android Expo Go app).

## Run on simulator

```bash
npm run ios     # macOS + Xcode
npm run android # Android Studio emulator
```

## Auth note

`eigen-chat` stores the Supabase access token in **localStorage** for EigenX tier. The WebView enables `domStorageEnabled` so sign-in persists between app launches.

For production App Store builds, use EAS Build:

```bash
npx eas-cli build --platform ios
npx eas-cli build --platform android
```

Set `EXPO_PUBLIC_EIGEN_CHAT_URL` in [EAS environment secrets](https://docs.expo.dev/eas/environment-variables/) before building.

## Customization

| File            | Purpose                                |
| --------------- | -------------------------------------- |
| `app.config.ts` | App name, bundle IDs, default chat URL |
| `App.tsx`       | WebView, loading/error states          |

This app intentionally contains **no** duplicate chat logic — all intelligence stays in R2 `eigen-chat` + edge functions.
