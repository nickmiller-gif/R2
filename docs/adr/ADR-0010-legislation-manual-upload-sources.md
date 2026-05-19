# ADR-0010: Legislation ingest + manual_upload source systems (v1.2.0)

- **Status:** Accepted (2026-05-19)
- **Related:** ADR-0007, `legislation-ingest` / `legislation-resolve` on Eigen, operator-workbench legislation adapters

## Context

`validate-source-system-literals.sh` flagged `congress`, `eurlex`, `legiscan`, and `manual_upload` as drift. These literals are emitted by deployed Eigen edges and R2 Works MCP paths; they were missing from `@r2/meg-catalog` v1.1.0.

## Decision

Bump catalog to **v1.2.0** (additive minor) with:

- `congress` — US Congress legislation adapter
- `eurlex` — EUR-Lex adapter
- `legiscan` — LegiScan adapter
- `manual_upload` — R2 Works manual document ingest (Phase 2a)

No renames or removals.

## Consequences

- Workspace literal lint passes without allowlist entries for these four.
- MEG Phase 3 backfill jobs may resolve legislation-sourced rows when volume appears.
