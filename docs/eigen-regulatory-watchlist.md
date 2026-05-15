# Regulatory Eigen watchlist (Week 1)

Public regulatory pages are ingested through the same **`eigen-fetch-ingest`** Edge function as the public marketing corpus. Hostnames must be allowlisted server-side via **`EIGEN_FETCH_ALLOWLIST`** (comma-separated hostnames, lowercase; subdomain suffix match is supported by the Edge implementation).

## Week 1 hostnames (Generational Plan §14)

Add these to **Eigen** (and preview if applicable) Edge Function secrets for `eigen-fetch-ingest`:

| Host               | Notes                                    |
| ------------------ | ---------------------------------------- |
| `sos.sc.gov`       | South Carolina Secretary of State        |
| `scstatehouse.gov` | SC Legislature (optional same-week host) |
| `irs.gov`          | IRS publications / public guidance       |

The Generational Implementation Plan also names a longer Initiative 4 list (`federalregister.gov`, `regulations.gov`, `fcc.gov`, `courts.sc.gov`, …). Add those when you begin the federal layer; Week 1 only requires **SC SOS–class pages (three concrete filing URLs)** plus **one IRS publications** host — operational URLs stay in runbooks / counsel notes, not in git.

## Operator checklist

1. Append new hostnames to **`EIGEN_FETCH_ALLOWLIST`** in the Supabase Dashboard (Eigen project) for `eigen-fetch-ingest`.
2. Re-deploy or restart is not required for secret-only changes on Supabase hosted Edge (secret update applies to new invocations).
3. Smoke one URL per host with a **member** JWT:

   ```bash
   curl -sS -X POST "$SUPABASE_URL/functions/v1/eigen-fetch-ingest" \
     -H "Authorization: Bearer $AUTH_BEARER" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://sos.sc.gov/..."}'
   ```

   Expect **2xx** once the host is allowlisted.

## Slack `#r2-regulatory-alerts` (stub)

Week 2+ can add `eigen-regulatory-ingest.py` + a weekly diff job. Capture:

- Incoming webhook URL (Slack app) as a **secret** (e.g. `REGULATORY_SLACK_WEBHOOK_URL`) on the runner or Edge.
- Do **not** commit webhook URLs or tokens to the repo.

Cross-reference: [eigen-public-corpus.md](./eigen-public-corpus.md) for sitemap/RSS ingest env vars.
