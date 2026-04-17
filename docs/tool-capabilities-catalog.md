# Tool Capabilities Catalog — `edge.*` (Canonical Policy Layer)

This catalog is seeded by `supabase/migrations/202604130002_seed_tool_capabilities_catalog.sql`
and extended by `202604140001_add_multi_llm_tool_capabilities.sql` (+3 LLM-router entries).

## Purpose

- Provide a canonical registry for policy-aware tool routing.
- Split surfaces into explicit read/write capabilities.
- Attach baseline risk and approval posture for each capability.

## Related Docs

- [`TOOL-CAPABILITIES-README.md`](./TOOL-CAPABILITIES-README.md) — **start here** for how the whole system fits together
- [`tool-capability-matrix.md`](./tool-capability-matrix.md) — fine-grained action-level supplement (111 entries, seeded in `202604170001`)

## Current Totals

- `edge.*` entries (this catalog): `64`
- Action-level entries (supplement): `111`
- **Total rows in `tool_capabilities`: `175`**
- Domains covered: `eigen`, `oracle`, `meg`, `foundation`, `charter`

## Domain Breakdown

### Eigen (21)

- `edge.eigen-tool-capabilities.read`
- `edge.eigen-tool-capabilities.write`
- `edge.eigen-chat.write`
- `edge.eigen-chat-public.write`
- `edge.eigen-chat-router.write`
- `edge.eigen-chat-confidence.read`
- `edge.eigen-chat-provider-policy.write`
- `edge.eigen-widget-session.write`
- `edge.eigen-widget-chat.write`
- `edge.eigen-retrieve.read`
- `edge.eigen-source-inventory.read`
- `edge.eigen-public-sources.read`
- `edge.eigen-ingest.write`
- `edge.eigen-fetch-ingest.write`
- `edge.eigen-memory-entries.read`
- `edge.eigen-memory-entries.write`
- `edge.eigen-knowledge-chunks.read`
- `edge.eigen-knowledge-chunks.write`
- `edge.eigen-retrieval-runs.read`
- `edge.eigen-retrieval-runs.write`
- `edge.eigen-oracle-outbox-drain.write`

### Oracle (13)

- `edge.oracle-theses.read`
- `edge.oracle-theses.write`
- `edge.oracle-evidence-items.read`
- `edge.oracle-evidence-items.write`
- `edge.oracle-signals.read`
- `edge.oracle-signals.write`
- `edge.oracle-read-models.read`
- `edge.oracle-source-packs.read`
- `edge.oracle-source-packs.write`
- `edge.oracle-thesis-evidence-links.read`
- `edge.oracle-thesis-evidence-links.write`
- `edge.oracle-whitespace-runs.read`
- `edge.oracle-whitespace-runs.write`

### MEG (6)

- `edge.meg-entities.read`
- `edge.meg-entities.write`
- `edge.meg-entity-aliases.read`
- `edge.meg-entity-aliases.write`
- `edge.meg-entity-edges.read`
- `edge.meg-entity-edges.write`

### Foundation (4)

- `edge.foundation-documents.read`
- `edge.foundation-documents.write`
- `edge.foundation-asset-registry.read`
- `edge.foundation-asset-registry.write`

### Charter (20)

- `edge.charter-entities.read`
- `edge.charter-entities.write`
- `edge.charter-rights.read`
- `edge.charter-rights.write`
- `edge.charter-obligations.read`
- `edge.charter-obligations.write`
- `edge.charter-evidence.read`
- `edge.charter-evidence.write`
- `edge.charter-payouts.read`
- `edge.charter-payouts.write`
- `edge.charter-decisions.read`
- `edge.charter-decisions.write`
- `edge.charter-governance.read`
- `edge.charter-governance.write`
- `edge.charter-provenance.write`
- `edge.charter-asset-valuations.read`
- `edge.charter-asset-valuations.write`
- `edge.charter-audit-read.read`
- `edge.charter-roles.read`
- `edge.charter-roles.write`

## Notes

- This seed is an inferred baseline from current edge function surfaces.
- Revisit `approval_policy` and `role_requirements` as governance matures.
- Keep `tool_id` stable; use migration updates for behavioral changes.

## Policy Map (Eigen Runtime)

Policy enforcement in `eigen-tool-capabilities` evaluates `capability_tags` against
`eigen_policy_rules`. The alignment migration
`supabase/migrations/202604130003_align_capability_tags_and_policy_rules.sql` adds
`read:*` and `write:*` tags to every capability row and enforces:

- `read:*` allowed for `member` and above.
- `write:*` allowed for `operator` and above.

Operationally, this means:

- Member users can discover read capabilities.
- Member users do not match write capability allow rules.
- Operator/admin users can discover write capabilities.

If you add capabilities manually, include a mode tag (`read:*` or `write:*`) so
policy outcomes remain deterministic.
