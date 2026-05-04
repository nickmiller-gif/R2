# r2-signal-process · operations

## Heartbeat (pg_cron)

Scheduling lives in Supabase migrations:

- `supabase/migrations/202604270002_schedule_r2_signal_process.sql` (initial job)
- `supabase/migrations/202605040001_r2_signal_process_cron_heartbeat.sql` (idempotent reschedule, `limit=25`, 15s cadence)

**Prerequisites**

1. Vault secret **`r2_signal_process_token`** (must match Edge secret **`R2_SIGNAL_PROCESS_TOKEN`** on the R2 project).
2. Extensions **`pg_cron`** and **`pg_net`** enabled (standard on production R2 projects).

After this migration is **applied to the database** (via your normal release path—Supabase Dashboard SQL, linked `supabase db push` from a trusted checkout, MCP migration apply, etc.—not necessarily from every local clone), confirm `cron.job` contains **`r2-signal-process-dispatcher`** and `net._http_response` shows successful calls.

**Pitfall (zsh / cron):** keep `net.http_post` `body` as static `jsonb_build_object(...)` in migrations—do not interpolate shell variables into the migration string, or local tooling may mangle the payload (see `R2-Operational-Pitfalls.md` in the umbrella repo).

## Backpressure

- Edge handler caps `limit` query param / env override at **25** per invocation (`r2-signal-process/index.ts`).
- SQL `claim_platform_feed_items` already bounds claims; empty claim returns immediately with `claimed: 0`.

## Observability

Each invocation emits a JSON log line via `signal_process_batch` with `claimed`, `processed`, `failed`, `duration_ms`, `batch_limit` (and `functionName: r2-signal-process`).

## Smoke · 50-row drain

Use a **staging** project or disposable signals only.

1. Insert **50** `platform_feed_items` rows in **`pending`** (or whatever state `claim_platform_feed_items` selects), using valid minimal contract payload shapes, **or** POST 50 envelopes through `r2-signal-ingest` with distinct `x-idempotency-key` values.
2. Ensure cron is firing **or** invoke `r2-signal-process` manually with `x-r2-signal-process-token` every few seconds.
3. **Pass criterion:** queue drains so remaining pending/claimed rows approach zero within **under 5 minutes** at 15s cadence and batch 25 (worst case roughly ceil(50/25)\*15s ≈ **30s** of wall time between cron ticks if each batch succeeds; add headroom for processing time and cold starts).

If drain stalls, inspect logs for `signal_process_batch`, `signal_process_claim_failed`, and `platform_feed_items.error`.
