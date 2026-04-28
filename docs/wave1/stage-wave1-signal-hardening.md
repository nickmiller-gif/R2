# Stage Wave 1 Signal Hardening Loop

## Purpose

Run aggressive repeated staging probes against `r2-signal-ingest` to verify:

- valid Wave 1 payloads are accepted (`202`);
- malformed Wave 1 metadata gets structured rejects (`422`);
- bad or missing signatures fail auth (`401`).

## Script

- `scripts/stage-wave1-signal-hardening.mjs`

## Required environment

- `R2_SIGNAL_INGEST_URL`
- `R2_SIGNAL_INGEST_BEARER`
- `R2_SIGNAL_INGEST_HMAC_SECRET`

Optional fallback legacy names are supported:

- `R2_EIGEN_INGEST_URL` (or `R2_EIGEN_INGEST_ENDPOINT`)
- `R2_EIGEN_INGEST_BEARER`
- `R2_EIGEN_INGEST_HMAC_SECRET`

The script auto-loads, in order:

- `.env.wave1.local`
- `.env.supabase.local`
- `.env`

## Usage

```bash
cd R2
node scripts/stage-wave1-signal-hardening.mjs --iterations 200 --concurrency 8
```

Intense run (break-oriented):

```bash
cd R2
node scripts/stage-wave1-signal-hardening.mjs --iterations 2000 --concurrency 20 --sleep-ms 10
```

Fail immediately on first mismatch:

```bash
cd R2
node scripts/stage-wave1-signal-hardening.mjs --iterations 500 --concurrency 10 --fail-fast
```

## Probe modes included

- `valid` (expects `202`)
- `duplicate_idempotency` (expects `202`)
- `missing_ingest_run` (expects `422`)
- `source_mismatch` (expects `422`)
- `invalid_ratio` (expects `422`)
- `empty_sources` (expects `422`)
- `invalid_tier` (expects `422`)
- `tampered_signature` (expects `401`)
- `missing_signature` (expects `401`)

## Success criteria

- `fail = 0` in summary output.
- No unexpected status codes for any mode.
- Progress logs complete all requested iterations.
