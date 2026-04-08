# EigenX Private Subsets

EigenX now supports per-user and per-role private subset access using policy tags.

## How it works

- Private chunks are tagged with policy tags in `knowledge_chunks.policy_tags`.
- Access grants live in `eigen_policy_access_grants`.
- On `eigen-chat` and `eigen-widget-chat`, policy scope is resolved server-side:
  - If no grants exist for the user/roles, behavior is backward-compatible.
  - If grants exist, effective scope is restricted to granted tags only.
  - If no granted overlap remains, request is denied (`403`).

## Grant model

Table: `public.eigen_policy_access_grants`

- `principal_type`: `user` or `role`
- `principal_id`:
  - `user`: Supabase user UUID (`auth.users.id`)
  - `role`: Charter role (`member`, `reviewer`, `operator`, `counsel`, `admin`)
- `policy_tag`: exact tag or wildcard prefix (example: `eigenx:finance:*`)
- `status`: `active`, `paused`, `revoked`

## Example grants

```sql
-- Finance team role can access all finance subsets
insert into public.eigen_policy_access_grants (principal_type, principal_id, policy_tag)
values ('role', 'operator', 'eigenx:finance:*');

-- Specific user can access legal docs only
insert into public.eigen_policy_access_grants (principal_type, principal_id, policy_tag)
values ('user', '00000000-0000-0000-0000-000000000000', 'eigenx:legal');

-- Full EigenX access for an admin user
insert into public.eigen_policy_access_grants (principal_type, principal_id, policy_tag)
values ('user', '11111111-1111-1111-1111-111111111111', 'eigenx');
```

## Tagging ingest payloads

For subset docs, ingest with specific tags:

- `eigenx:finance`
- `eigenx:legal`
- `eigenx:ops`

For broad private access docs, keep `eigenx`.
