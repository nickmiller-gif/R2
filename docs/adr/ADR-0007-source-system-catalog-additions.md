# ADR-0007: source_system catalog additions (v1.1.0 minor bump)

- **Status:** Accepted (2026-05-17)
- **Canonical umbrella copy:** [docs/adr/ADR-0007-source-system-catalog-additions.md](https://github.com/nickmiller-gif/R2-Complete/blob/main/docs/adr/ADR-0007-source-system-catalog-additions.md)
- **Package:** `R2/packages/meg-catalog` v1.1.0

Eight additive `MegSourceSystem` literals plus `friction_zero` and `r2chart` (production producers). Source renames: `productivity` → `productivity_workflow`, `regrid` → `regrid_external`, `centralr2-core` → `centralr2` in eigen-emit.

Lint: `bash scripts/validate-source-system-literals.sh --allow-known-drift` (≤1 known case: `insightr` data backfill in insr repo).

**Not** [ADR-0007-meg-phase3-preflight.md](./ADR-0007-meg-phase3-preflight.md) (MEG locks).
