# meg-resolve-bridge (Eigen)

HTTP entrypoint on **R2 (Eigen)** for external producers (for example **Lovable Cloud** Edge functions) that need `meg_entity_id` / stable canonical strings **without** embedding the Eigen **service-role** JWT in a third-party host.

## Registry decision (CentralR2 Tower vs Eigen)

- **Canonical MEG** for the spine (`platform_feed_items`, operator-workbench, `meg_entities`) is **`public.meg_resolve_or_create`** on Eigen (`zudslxucibosjwefojtm`). See [meg-domain-onboarding.md](./meg-domain-onboarding.md) and the MEG conversion runbook in the umbrella repo.
- **CentralR2 Tower** uses a different Supabase project and **`resolve_meg_identity`** for Tower-local rows; it does **not** expose the `{ source_platform, external_id, kind }` HTTP contract. Do **not** configure **`TOWER_MEG_RESOLVER_URL`** / **`TOWER_MEG_RESOLVER_TOKEN`** toward Tower for Eigen-aligned UUIDs.

## Endpoint

After deploy:

`POST https://<EIGEN_PROJECT_REF>.supabase.co/functions/v1/meg-resolve-bridge`

## Secrets ([Pitfall A1, A2, A3])

1. On the **Eigen** project (Supabase Dashboard → Edge Functions → `meg-resolve-bridge` secrets), set **`MEG_RESOLVE_BRIDGE_TOKEN`** to a long random string (for example `openssl rand -hex 32`). This is **not** the same secret as `R2_SIGNAL_INGEST_HMAC_SECRET` ([Pitfall A2] — keep ingest HMAC separate from MEG bridge tokens).
2. On the **caller** (Lovable env, CI, etc.), set:
   - **`MEG_RESOLVE_BRIDGE_URL`** — full URL above (Eigen, not `ukffrvqainkntdgjzyde`).
   - **`MEG_RESOLVE_BRIDGE_TOKEN`** — same value as (1).
3. When validating JWT `ref` claims for any **other** Eigen secret, confirm project ref **`zudslxucibosjwefojtm`** ([Pitfall A3]).

## Request

Headers:

- `Authorization: Bearer <MEG_RESOLVE_BRIDGE_TOKEN>`
- `Content-Type: application/json`
- `apikey: <EIGEN_ANON_KEY>` — required by Supabase gateway for Edge invokes (same as other functions).

Body (JSON object):

| Field             | Required | Description                                                                                                                                                     |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_platform` | yes      | Short source id (≤64 chars), e.g. catalog `ip_pulse_point` or app slug.                                                                                         |
| `external_id`     | yes      | Stable row/signal id in the caller (≤256 chars).                                                                                                                |
| `kind`            | no       | Mapped to `p_entity_type`: bare names become `meg:<name>`; values already starting with `meg:` are passed through (truncated to 64 chars). Default `meg:topic`. |
| `hints`           | no       | Object: optional `title`, `display_name`, `email`, `source_table`, `source_row_id`, `meg_canonical_id` / `canonical_external_id` (override stable id).          |

## Response

`200` JSON:

```json
{
  "meg_canonical_id": "meg:topic:ip_pulse_point_abc123",
  "meg_entity_id": "uuid",
  "resolution": "tower"
}
```

`resolution` is always **`tower`** when Eigen returns a row (authoritative registry). Callers that previously used a local slug fallback when HTTP was unset can treat any `200` as authoritative.

## Gateway config

In `supabase/config.toml` for this repo, add a block so the gateway does not require a Supabase user JWT (callers use the bridge token only), mirroring `r2-signal-ingest`:

```toml
[functions.meg-resolve-bridge]
verify_jwt = false
```

## `meg-backfill` on Lovable (or other hosts)

Batch backfills should call the **same** bridge URL + token per row (or batch in your Edge with concurrency limits), not a separate Tower URL. Keeps `meg_entity_id` FK-compatible with Eigen `meg_entities` when you store those UUIDs in app tables.

### Renaming Lovable env vars (from `TOWER_MEG_RESOLVER_*`)

If a Lovable project used **`TOWER_MEG_RESOLVER_URL`** / **`TOWER_MEG_RESOLVER_TOKEN`**, replace them with:

| Deprecated (Tower-oriented) | Use instead                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `TOWER_MEG_RESOLVER_URL`    | `MEG_RESOLVE_BRIDGE_URL` = `https://zudslxucibosjwefojtm.supabase.co/functions/v1/meg-resolve-bridge` |
| `TOWER_MEG_RESOLVER_TOKEN`  | `MEG_RESOLVE_BRIDGE_TOKEN` = same value as the Eigen function secret                                  |

Update **`resolveMeg`** (or equivalent) to `POST` the bridge URL with the bridge token. Response shape is unchanged: `meg_canonical_id`, `meg_entity_id`, `resolution: "tower"`.

## Smoke (curl)

Replace placeholders:

```bash
curl -sS -X POST "${MEG_RESOLVE_BRIDGE_URL}" \
  -H "Authorization: Bearer ${MEG_RESOLVE_BRIDGE_TOKEN}" \
  -H "apikey: ${EIGEN_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"source_platform":"ip_pulse_point","external_id":"smoke-test-1","kind":"topic","hints":{"title":"Smoke"}}' | jq .
```

Expect `meg_entity_id` UUID and `resolution: "tower"`.
