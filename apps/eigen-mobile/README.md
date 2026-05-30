# Eigen Mobile (Ray voice chat)

Native Expo app for **EigenX members** — sign in, text naturally, and get answers in **Ray's correspondence voice** grounded in MEG and your R2 knowledge.

## What it feels like

- Plain **chat bubbles** — no citations panel, no source counts in the UI
- Answers written like **Ray in email or text**: warm, direct, conversational
- Backend pulls **Ray correspondence examples** from the voice library (`ray_correspondence_*`, `ray_voice_*`) to match tone
- MEG entity resolution and cross-app retrieval still happen behind the scenes — you just see the answer

## Prerequisites

- Node 20+
- [Expo Go](https://expo.dev/go) on your phone, or Xcode / Android Studio
- Supabase anon key for project `zudslxucibosjwefojtm`
- EigenX **member** account

## Setup

```bash
cd apps/eigen-mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm start
```

## Ray correspondence library

Ingest Ray's emails, texts, and written answers via `eigen-ingest`:

| `source_system`                          | Use                                        |
| ---------------------------------------- | ------------------------------------------ |
| `ray_correspondence_public`              | Published / shareable correspondence       |
| `ray_correspondence_private`             | EigenX-only correspondence (member policy) |
| `ray_voice_public` / `ray_voice_private` | Podcast and voice transcripts              |

Policy tags `ray_voice` and `voice_style` are applied automatically. The more correspondence you index, the closer the chat tone matches Ray.

## Environment

| Variable                        | Purpose                 |
| ------------------------------- | ----------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | R2 Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key for auth       |

## Typecheck

```bash
npm run typecheck
```
