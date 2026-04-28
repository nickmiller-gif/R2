# Wave 1 signal ingest — staging hardening script

Stress and correctness probes for `r2-signal-ingest` against a live project (staging or production). Source: `R2/scripts/stage-wave1-signal-hardening.mjs`.

## Credentials (local only)

Create `R2/.env.wave1.local` (gitignored) from `.env.wave1.local.example` at the repo root. Required variables:

- `R2_SIGNAL_INGEST_URL` — `https://<project_ref>.supabase.co/functions/v1/r2-signal-ingest`
- `R2_SIGNAL_INGEST_BEARER` — must match Edge secret `R2_SIGNAL_INGEST_BEARER`
- `R2_SIGNAL_INGEST_HMAC_SECRET` — must match Edge secret `R2_SIGNAL_INGEST_HMAC_SECRET`

Run all commands with **current working directory = `R2`**.

## Minimum regression sweep (all probe modes)

The script cycles nine modes (`valid`, bad metadata variants, bad/missing HMAC, duplicate idempotency). Use a multiple of **9** iterations so each mode runs at least once:

```bash
cd R2
node scripts/stage-wave1-signal-hardening.mjs \
  --iterations 9 \
  --concurrency 1 \
  --sleep-ms 0 \
  --fail-fast \
  --event-prefix wave1_probe
```

Expect `pass=9`, `fail=0` in the summary.

## Optional stress run

Higher iteration counts and concurrency are for soak testing only after the 9-mode sweep passes:

```bash
node scripts/stage-wave1-signal-hardening.mjs --iterations 2000 --concurrency 20 --sleep-ms 10
```

## Wave 1 metadata limits (server-side)

Enforced in `supabase/functions/_shared/wave1-signal-metadata.ts`:

- `sources_queried`: at most **64** entries; each entry at most **512** characters.
- `registry_verified_ratio`: must be **finite** and in **[0, 1]**.

Producers exceeding these receive **422** with structured `code` / `message`.

## Related

- Umbrella handoff: `docs/wave1/wave1-handoff-report.md`
- Promotion gates: `docs/wave1/wave1-promotion-matrix.md`
