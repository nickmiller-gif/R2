# R2 Capability Rollout Smoke Checklist

Use this checklist after deploying capability/policy/auth changes.

## Preconditions

- `tool_capabilities` seeded from `202604130002_seed_tool_capabilities_catalog.sql`.
- capability/policy alignment migration applied: `202604130003_align_capability_tags_and_policy_rules.sql`.
- target functions deployed:
  - `eigen-tool-capabilities`
  - `oracle-theses`
  - `oracle-evidence-items`
- known fixture IDs available:
  - blocked capability id
  - thesis id
  - evidence id

## Automated Run

Run:

`PROJECT_REF=<ref> SUPABASE_ANON_KEY=<anon> MEMBER_EMAIL=<member> MEMBER_PASSWORD=<password> OPERATOR_EMAIL=<operator> OPERATOR_PASSWORD=<password> THESIS_ID=<thesis-id> EVIDENCE_ID=<evidence-id> BLOCKED_CAPABILITY_ID=<blocked-id> ./scripts/smoke-capability-rollout.sh`

## Expected Results

- member capability list: `200`
- member blocked capability by id: `404`
- oracle theses allowlisted PATCH: `200`
- oracle theses non-allowlisted PATCH: `400`
- oracle theses missing id: `400`
- oracle evidence allowlisted PATCH: `200`
- oracle evidence non-allowlisted PATCH: `400`
- oracle evidence missing id: `400`

## Troubleshooting

- If all checks return `401 {"code":"Invalid JWT"}`, verify Supabase Edge Gateway JWT settings.
- If checks return `401 {"error":"Invalid or expired token"}`, function-level `guardAuth` rejected token format or issuer.
- If member list is empty unexpectedly, inspect `eigen_policy_rules` and `capability_tags` for `read:*` / `write:*` alignment.
