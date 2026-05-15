# ADR-0008 — Generational plan: OpenHuman fork vs borrow

**Status:** Accepted  
**Date:** 2026-05-15  
**Context:** `R2-Generational-Implementation-Plan-2026-05-15.md` Hard Decision A (Initiative 2 — Founder’s Twin).

## Decision

**Borrow** — reimplement the small set of patterns R2 needs (Memory Tree hierarchy, TokenJuice-style compression, Obsidian-compatible vault layout) as first-class TypeScript modules under `R2/src/lib/persona/` and `R2/src/lib/eigen/`, aligned with existing Eigen / Oracle / provenance primitives.

## Rationale

- **GPL-3.0 avoidance:** Forking or linking `tinyhumansai/openhuman` would bind R2 commercial and umbrella repos to GPL obligations and complicate arm’s-length licensing already called out in the charter / commercial split.
- **Substrate fit:** R2 already owns embeddings (`eigen/vector-store.ts`), freshness (`oracle/evidence-freshness.ts`), and hashing (`provenance/hash.ts`). A thin native implementation stays reviewable and deployable on the existing Supabase + Edge stack.
- **Maintenance cost:** A third-party fork would require constant merges for connectors R2 does not need; native modules stay scoped to R2 ingest + governance paths.

## Non-goals

- No vendored or git-subtree copy of OpenHuman in R2 product repos.
- No GPL toolchain dependency in CI or runtime images for Twin / TokenJuice deliverables.

## Consequences

- Engineering owns the Memory Tree and compression algorithms; upstream OpenHuman releases are reference reading only.
- Twin Phase 0–1 milestones proceed on R2 migrations + scripts already sequenced in the Generational Plan without waiting on an external repo import.

## Follow-ups

- Initiative 7 (TokenJuice) and Initiative 2 (Twin) implementation tickets reference this ADR in PR descriptions.
