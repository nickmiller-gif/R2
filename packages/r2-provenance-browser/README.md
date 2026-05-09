# @r2/provenance-browser

Meta-B (Signal Provenance Browser): headless-friendly **read-only** tree UI for `provenance_chain` RPC results.

- `ProvenanceTree` — collapsible forest from flat `nodes[]` (`id`, `parent_id`, `kind`, `title`, …).
- `parseProvenanceChainPayload` — normalizes Supabase `jsonb` / `Json` RPC output.

Canonical spec: umbrella `R2-Revolutionary-Features-2026-05-09.md` section 7 (Meta-B).
