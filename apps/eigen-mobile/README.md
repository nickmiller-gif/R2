# Eigen Mobile (EigenX native)

Native Expo app for **EigenX members** — sign in with Supabase, chat against R2 `eigen-chat`, and see what MEG and cross-app knowledge was used to answer.

## What it does

- **Sign in** with your R2 Supabase account (member role required for `eigen-chat`)
- **Chat** with EigenX intelligence — MEG entity resolution, memory episodes, multi-app corpus retrieval
- **Context panel** on each reply shows:
  - MEG entities in scope and graph nodes injected
  - Policy scope applied
  - Citations grouped by app (CentralR2, R2Works, R2Chart, R2-IP, Oracle, uploads, etc.)
- **Sources tab** loads `eigen-source-inventory` — document/chunk counts per source system

All intelligence stays in R2 edge functions; this app is a thin native client.

## Prerequisites

- Node 20+
- [Expo Go](https://expo.dev/go) on your phone, or Xcode / Android Studio for simulators
- Supabase anon key for project `zudslxucibosjwefojtm`
- An EigenX member account (Charter `member` role)

## Setup

```bash
cd apps/eigen-mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_ANON_KEY (Dashboard → Settings → API → anon public)
npm install
```

## Run

```bash
npm start
```

Scan the QR code with Expo Go, or press `i` / `a` for simulators.

## Environment

| Variable                        | Purpose                                       |
| ------------------------------- | --------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | R2 Supabase project URL (default: production) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key for auth session                     |

## Architecture

```
App.tsx
  ├── AuthScreen → supabase.auth.signInWithPassword
  ├── ChatScreen → POST /functions/v1/eigen-chat
  │     └── ContextPanel ← entity_scope_applied, entity_context_count, citations
  └── SourcesScreen → GET /functions/v1/eigen-source-inventory
```

Optional **Focus entity** field maps to `entity_label` on `eigen-chat` — the backend resolves MEG UUIDs from natural language (client/property/person names).

## Production builds

```bash
npx eas-cli build --platform ios
npx eas-cli build --platform android
```

Set env vars in [EAS environment secrets](https://docs.expo.dev/eas/environment-variables/) before building.

## Typecheck

```bash
npm run typecheck
```
