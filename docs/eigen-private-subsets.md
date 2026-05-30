# EigenX Private Subsets

EigenX supports per-user, per-group, and per-role private subset access using policy tags.

## How it works

- Private chunks are tagged with policy tags in `knowledge_chunks.policy_tags`.
- Access grants live in `eigen_policy_access_grants` (optional extra narrowing).
- Shared groups live in `eigen_access_groups` + `eigen_access_group_members`.
- On `eigen-chat`, `eigen-retrieve`, and `eigen-widget-session` (eigenx mode), the server picks a **base** policy scope, then intersects with grants when grants exist.

### Default scope (recommended operations model)

- **Full-access roles** (env `EIGENX_FULL_ACCESS_ROLES`, default `admin`) use the org default: `EIGENX_DEFAULT_POLICY_SCOPE` or `eigenx`. Admins see everything.
- **Regular members** default to **personal + groups**:
  - `eigenx:user:<their Supabase user id>` — material they uploaded
  - `eigenx:group:<group uuid>` — for each active group they belong to
- Members **cannot** widen scope to org-wide `eigenx` from the client.
- **Site administration**: assign `admin` (or add roles to `EIGENX_FULL_ACCESS_ROLES`) for org-wide corpus access.

### Access groups (`eigen_access_groups`)

Use groups when several users should share a private corpus (e.g. a deal team, practice group).

**Admin API:** `POST /functions/v1/eigen-access-groups`

```json
{ "action": "create_group", "label": "Forma Team", "slug": "forma-team" }
{ "action": "add_member", "group_id": "<uuid>", "user_id": "<auth.users.id>" }
{ "action": "remove_member", "group_id": "<uuid>", "user_id": "<auth.users.id>" }
```

**Ingest for a group:** pass `group_id` on `eigen-ingest` (member must belong to the group). Chunks receive `eigenx:group:<group_id>`.

**List my groups:** `GET /functions/v1/eigen-access-groups` (members see their groups; admins see all).

### Grants (`eigen_policy_access_grants`)

- If **no** grant rows apply to the user, full-access users keep the org default; limited users keep personal + group tags (`eigenx:user:<id>` and `eigenx:group:<id>` per membership).
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

For shared team supplements, tag with `eigenx:group:<group_uuid>` or pass `group_id` on ingest.

**Member uploads:** `eigen-ingest` auto-tags personal uploads with `eigenx:user:<owner_id>` (no org-wide `eigenx` tag). Optional `group_id` adds the group tag when the uploader is a member.

### Asset registry (`asset_registry`)

Reads are scoped by RLS (see migration `20260528160000_asset_registry_scoped_rls`):

| Who                                           | Visible assets                                        |
| --------------------------------------------- | ----------------------------------------------------- |
| **Admin** (`charter_user_roles.role = admin`) | All rows                                              |
| **Owner**                                     | `user_id = auth.uid()`                                |
| **Group member**                              | `access_group_id` matches a group the user belongs to |

Ingest sets `user_id` to the uploader and optional `access_group_id` from `group_id`. Evidence links require **both** endpoint assets to be visible.

### Documents (`documents`)

Reads are scoped by RLS (migration `20260528170000_eigen_access_hardening`):

| Who                                      | Visible documents                                     |
| ---------------------------------------- | ----------------------------------------------------- |
| **Admin** (`user_has_eigen_full_access`) | All rows                                              |
| **Owner**                                | `owner_id = auth.uid()`                               |
| **Group member**                         | `access_group_id` matches a group the user belongs to |

`knowledge_chunks` read policy follows document visibility. Org pipeline corpus (`owner_id` service placeholder) is admin-only for direct reads; members still retrieve via scoped chat.

### Source inventory

`GET /functions/v1/eigen-source-inventory` returns documents whose chunk policy tags overlap the caller's effective scope. Full-access roles receive the org-wide inventory.

### Migration

If you previously relied on “no grants = everyone searches full `eigenx`”, deploy only after: (1) org corpus stays tagged `eigenx` (or your `EIGENX_DEFAULT_POLICY_SCOPE`), (2) every user who should still see that corpus has role `admin` or is listed in `EIGENX_FULL_ACCESS_ROLES`, (3) personal material for everyone else is ingested under `eigenx:user:<their id>`.
