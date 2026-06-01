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
- `apikey: <Eigen public anon key>` — required by Supabase gateway for Edge invokes. In Lovable or other repos this value is often already present as **`SUPABASE_ANON_KEY`**, **`VITE_SUPABASE_PUBLISHABLE_KEY`**, **`VITE_SUPABASE_ANON_KEY`**, or a project-specific alias — any of them is fine **as long as the JWT `ref` claim is `zudslxucibosjwefojtm`** ([Pitfall A3]). The header name must be **`apikey`**.

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

## Cross-source dedup (normalized identity)

`meg_resolve_or_create` (migration `20260602120000_meg_resolve_normalized_dedup`) stores a stable **`meg_dedup_key`** on `meg_entities.external_ids` and reuses an existing active row when the key matches (same **entity family**: property / person / org):

| Family       | Key inputs (normalized)                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Property** | `address` + `city` + `state` (St→Street, lowercased, punctuation stripped); falls back to name + city + state, then name alone |
| **Person**   | email if present, else normalized full name                                                                                    |
| **Org**      | normalized name with LLC/Inc/Corp suffixes stripped                                                                            |

Bridge callers should pass **`hints.address`**, **`hints.city`**, **`hints.state`** for CentralR2 properties (see `property-eigen-sync`). `ensure_source_entity_meg_linkage` accepts **`p_hints`** with the same shape and merges **`works.entities`** rows that share the dedup key or case-insensitive label.

## Gateway config

In `supabase/config.toml` for this repo, add a block so the gateway does not require a Supabase user JWT (callers use the bridge token only), mirroring `r2-signal-ingest`:

```toml
[functions.meg-resolve-bridge]
verify_jwt = false
```

## Hardening (defense-in-depth)

The bridge runs with gateway `verify_jwt = false`, so all access control is in
code. The handler enforces the following policies (see
`supabase/functions/_shared/meg-bridge-policy.ts` and
`tests/meg/meg-resolve-bridge-hardening.test.ts`):

| Env var                                       | Default | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEG_RESOLVE_BRIDGE_TOKEN`                    | —       | Required. Tokens shorter than 32 chars are rejected at preflight with `503` (catches placeholder / sample secrets). Use `openssl rand -hex 32`.                                                                                                                                                                                                                                                                                                 |
| `MEG_RESOLVE_BRIDGE_ALLOWED_SOURCES`          | unset   | Optional comma-separated allowlist (case-insensitive). When set, requests with a `source_platform` outside the list are rejected with `400 source_platform not in allowlist` and logged as `meg_resolve_source_rejected`. When unset, any `source_platform` is accepted (back-compat).                                                                                                                                                          |
| `MEG_RESOLVE_BRIDGE_ALLOW_CANONICAL_OVERRIDE` | `true`  | Controls whether `hints.meg_canonical_id` / `hints.canonical_external_id` is honored. Set to `false` (or `0` / `no` / `off`) to ignore caller-supplied canonical ids — closes a spine-poisoning vector where a token holder attaches their `(source_platform, external_id)` to an existing canonical entity. Suppressed overrides emit `meg_resolve_override_suppressed`; honored ones emit `canonical_override_used: true` on the success log. |

Other always-on hardening:

- `Content-Type`, when present, must be `application/json` (with optional
  `charset`); other media types are rejected with `415`. Absent header is
  accepted for server-to-server `fetch` back-compat.
- `401` responses emit a structured `meg_resolve_unauthorized` log line
  including caller IP (`cf-connecting-ip` → `x-real-ip` → `x-forwarded-for`)
  and (capped) user-agent so abuse attempts are auditable.
- `503` preflight failures emit `meg_resolve_misconfigured` with a
  `reason` of `token_missing` or `token_too_short`.

Recommended production posture once callers are confirmed:

```bash
MEG_RESOLVE_BRIDGE_ALLOWED_SOURCES=ip_pulse_point,centralr2,...
MEG_RESOLVE_BRIDGE_ALLOW_CANONICAL_OVERRIDE=false
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

Replace placeholders. For **`apikey`**, use whichever Eigen anon variable your shell already has (`SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, etc.); they are the same **public** key for `zudslxucibosjwefojtm` as long as the JWT `ref` matches that project ([Pitfall A3]).

```bash
curl -sS -X POST "${MEG_RESOLVE_BRIDGE_URL}" \
  -H "Authorization: Bearer ${MEG_RESOLVE_BRIDGE_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"source_platform":"ip_pulse_point","external_id":"smoke-test-1","kind":"topic","hints":{"title":"Smoke"}}' | jq .
```

Expect `meg_entity_id` UUID and `resolution: "tower"`.

### If you get **404** `NOT_FOUND`

The Edge bundle is **not deployed** to Eigen yet. After merging `meg-resolve-bridge` into `main`, the **Deploy to Supabase** GitHub Action must succeed (production environment secrets, including a valid **`SUPABASE_ACCESS_TOKEN`** — see repo deploy runbook when auth fails). You can also deploy from a linked checkout: `supabase functions deploy meg-resolve-bridge --no-verify-jwt` (Eigen project).

### If you get **401** `Unauthorized`

The function is deployed; fix **`MEG_RESOLVE_BRIDGE_TOKEN`** (caller header must match the secret set on the function).

### If you get **503** `MEG_RESOLVE_BRIDGE_TOKEN not configured`

Set the function secret on Eigen for **`meg-resolve-bridge`**, then redeploy or wait for the secret to bind.
