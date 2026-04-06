# Oracle Whitespace Runs — End-to-End Smoke Proof

**Date:** 2026-04-06
**Endpoint:** `POST/GET /functions/v1/oracle-whitespace-runs`
**Project:** zudslxucibosjwefojtm

---

## Infrastructure Deployed

### Tables Created
- `oracle_profile_runs` — lifecycle tracking for Oracle pipeline runs
- `oracle_whitespace_core_runs` — whitespace/gap analysis storage
- `oracle_service_layer_runs` — orchestration layer linking profile + whitespace runs

All three tables have RLS enabled: authenticated SELECT, service_role mutations.

### Edge Function
- `oracle-whitespace-runs` v2 — ACTIVE
- Auth: custom JWKS verification via `guardAuth()` (jose + JWKS)
- RBAC: `requireRole(userId, 'operator')` on POST
- Idempotency: `x-idempotency-key` required on POST
- Body validation: `entityAssetId` (string), `runLabel` (string), `analysisInput` (object)

---

## Test Results — All 9 Criteria Pass

### 1. POST returns 201

```
Status: 201
```

Response envelope:
```json
{
  "run": {
    "id": "9ef11365-6913-4f5e-b495-1633411321a7",
    "entityAssetId": "00000000-0000-0000-0000-00000000abc1",
    "runLabel": "smoke-1775471739543",
    "triggeredBy": "fca0bec7-6d33-475b-ade7-9771879587e3",
    "profileRunId": "ebd0839a-3dbc-4cb7-a86b-58b1fc900b7f",
    "whitespaceRunId": "1606af6f-e73f-4528-8d2f-f2318aab5737",
    "status": "completed"
  },
  "result": {
    "runId": "9ef11365-6913-4f5e-b495-1633411321a7",
    "status": "completed",
    "summary": "Whitespace run 'smoke-1775471739543' completed",
    "analysis": { "coverage": [] }
  }
}
```

### 2. Service-layer row created

```
id:               9ef11365-6913-4f5e-b495-1633411321a7
entity_asset_id:  00000000-0000-0000-0000-00000000abc1
run_label:        smoke-1775471739543
triggered_by:     fca0bec7-6d33-475b-ade7-9771879587e3
profile_run_id:   ebd0839a-3dbc-4cb7-a86b-58b1fc900b7f
whitespace_run_id:1606af6f-e73f-4528-8d2f-f2318aab5737
status:           completed
```

### 3. Whitespace-core row created

```
id:               1606af6f-e73f-4528-8d2f-f2318aab5737
entity_asset_id:  00000000-0000-0000-0000-00000000abc1
run_label:        smoke-1775471739543
```

### 4. Profile-run row created

```
id:               ebd0839a-3dbc-4cb7-a86b-58b1fc900b7f
entity_asset_id:  00000000-0000-0000-0000-00000000abc1
triggered_by:     fca0bec7-6d33-475b-ade7-9771879587e3
status:           completed
signal_count:     0
summary:          Whitespace run 'smoke-1775471739543' completed
```

### 5. GET returns 200 for the new run

```
Status: 200
run.id matches result.runId: true
```

### 6. Missing auth returns 401

```
Status: 401
Body: {"error":"Missing or invalid Authorization header"}
```

### 7. Missing idempotency key returns 400

```
Status: 400
Body: {"error":"Missing required header: x-idempotency-key"}
```

### 8. Non-operator POST returns 403

```
Status: 403
Body: {"error":"No roles assigned"}
```

### 9. Unknown run ID returns 404

```
Status: 404
Body: {"error":"Run not found"}
```

---

## Chain Verification

```
oracle_service_layer_runs.id              = 9ef11365-...  (run.id)
oracle_service_layer_runs.profile_run_id  = ebd0839a-...  (run.profileRunId)
oracle_service_layer_runs.whitespace_run_id = 1606af6f-... (run.whitespaceRunId)
oracle_whitespace_core_runs.id            = 1606af6f-...  (matches whitespace_run_id)
oracle_profile_runs.id                    = ebd0839a-...  (matches profile_run_id)
```

Full chain proven: POST creates profile-run → whitespace-core-run → service-layer-run, all linked by foreign keys.

---

## Security Model Verified

| Layer | Enforcement | Proven |
|-------|-------------|--------|
| Auth (JWT) | `guardAuth()` via jose + JWKS | 401 on missing auth |
| RBAC | `requireRole(userId, 'operator')` | 403 on non-operator |
| Idempotency | `requireIdempotencyKey(req)` | 400 on missing key |
| RLS | authenticated reads, service_role writes | GET works for authenticated, writes only via edge function |

---

## result.summary Verification (v3 fix)

v2 incorrectly hardcoded `result.summary` to a human-readable string.
v3 derives `result.summary` from `analysis_json.summary` (the structured analysis field).

| Case | result.summary | Expected | Pass |
|------|---------------|----------|------|
| POST without `summary` in analysisInput | `null` | `null` | PASS |
| POST with `summary: "High whitespace in competitive positioning"` | `"High whitespace in competitive positioning"` | same | PASS |
| GET same run | `"High whitespace in competitive positioning"` | same | PASS |

The human-readable string `"Whitespace run '...' completed"` is correctly written only to `oracle_profile_runs.summary`, not to the API response envelope.
