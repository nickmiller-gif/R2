# EigenX Private Subsets

EigenX now supports per-user and per-role private subset access using policy tags.

## How it works

- Private chunks are tagged with policy tags in `knowledge_chunks.policy_tags`.
- Access grants live in `eigen_policy_access_grants`.
- On `eigen-chat`, `eigen-retrieve`, and `eigen-widget-session` (eigenx mode), the server picks a **base** policy scope, then intersects with grants when grants exist.

### Default scope (recommended operations model)

- **Full-access roles** (env `EIGENX_FULL_ACCESS_ROLES`, default `admin`) use the org default: `EIGENX_DEFAULT_POLICY_SCOPE` or `eigenx`. No per-user tagging required for org-wide corpus.
- **All other members** default to **personal supplements only**: `eigenx:user:<their Supabase user id>`. Ingest user-specific material with that tag. They cannot widen scope by sending a different `policy_scope` from the client (only the same tag or `eigenx:user:<id>:*` sub-tags).
- **Site administration**: assign `admin` (or add roles to `EIGENX_FULL_ACCESS_ROLES`, e.g. `admin,operator`) so those users see the full org index without maintaining grants for each person.

### Grants (`eigen_policy_access_grants`)

- If **no** grant rows apply to the user, full-access users keep the org default; limited users keep `eigenx:user:<id>` only.
- If grants exist, effective scope is the intersection of the requested tags with granted tags.
- If that intersection is empty, the request is denied (`403`).

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

For per-user supplements (members without full-access roles), tag chunks with `eigenx:user:<user_uuid>` (same UUID as `auth.users.id`).

### Migration

If you previously relied on “no grants = everyone searches full `eigenx`”, deploy only after: (1) org corpus stays tagged `eigenx` (or your `EIGENX_DEFAULT_POLICY_SCOPE`), (2) every user who should still see that corpus has role `admin` or is listed in `EIGENX_FULL_ACCESS_ROLES`, (3) personal material for everyone else is ingested under `eigenx:user:<their id>`.
