# Operator deadletter console (Phase 6)

Implements the intent of [R2#211](https://github.com/nickmiller-gif/R2/issues/211) **without** a second bespoke admin app:

## Where to triage

- **`operator-workbench`** → **`/today`** (`Today.tsx`)
- Filter **processing status** to **Deadletter** (or **Failed**); filter **source system** as needed.
- Each card exposes **Replay** for `failed` / `deadletter` rows, calling RPC **`replay_platform_feed_item`** via the typed client (`replayPlatformFeedItem`).

## Backend

- **`r2-signal-process`** — marks terminal **deadletter** after attempt budget (see `r2-signal-process` source).
- **`r2-signal-process-deadletter`** — service path for replay / drain operations.
- Migration scaffold + RPC: `replay_platform_feed_item` (see `R2/supabase/migrations` and `R2/docs/r2-signal-process-ops.md`).

## CI / types

`lint:supabase:types` runs when **`SUPABASE_PROJECT_REF`** and **`SUPABASE_ACCESS_TOKEN`** are set on the umbrella and R2 GitHub Actions workflows (see `R2-Complete/.github/workflows/r2-consistency.yml`).
