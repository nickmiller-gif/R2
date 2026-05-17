# KB-four bridge smoke (manual)

Eigen (`zudslxucibosjwefojtm`) and IP project (`jgglfgzvjcbqvnonmldr`) must share bridge secrets before `r2chart` / `ip_pulse_point` rows land in `platform_feed_items`.

## Secret block (both projects)

| Secret                         | Notes                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| `ENABLE_R2_SIGNAL_BRIDGE`      | `true`                                                                   |
| `R2_SIGNAL_INGEST_URL`         | `https://zudslxucibosjwefojtm.supabase.co/functions/v1/r2-signal-ingest` |
| `R2_SIGNAL_INGEST_BEARER`      | R2 **service role** JWT (not anon)                                       |
| `R2_SIGNAL_INGEST_HMAC_SECRET` | Byte-identical to Eigen `r2-signal-ingest`                               |

## Redeploy

- **continuity-ingest-signal** on Eigen (continuity-nexus repo)
- **ip-router** on IP project — use Dashboard/Lovable if CLI returns 403

## Smoke

1. continuity-nexus Settings → Signal ingest probe (`useIngestSignal`) with signed-in operator JWT.
2. Confirm `platform_feed_items` row: `source_system = 'r2chart'`.
3. IP surface emit → `source_system = 'ip_pulse_point'`.
4. Optional: `truth_market_promote_feed_cluster` per driver; log outcome on `/truth-market`.
