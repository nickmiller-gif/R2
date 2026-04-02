# Memory

## Me
Nick Miller — solo founder/builder of the R2 Ecosystem. Lawyer background, building a multi-domain intelligence platform. Pilates entrepreneur on the side (R2 Fit / Forma).

## Architecture
| Layer | What |
|-------|------|
| **R2 repo** | Headless backend/core — Supabase schema, edge functions, services, types, tests. No frontend. |
| **raysretreat** | Legacy monolith — 13K+ commits, 100+ edge functions, full React SPA. Source of truth for extraction. |
| **Lovable frontends** | Separate repos per product domain. Plug into R2 via API surface. |

## Key Systems
| System | Status | Location |
|--------|--------|----------|
| **Oracle** | Most complete. 15+ edge functions, 13 shared modules, eval harness (13 audit passes). | raysretreat shared/oracle/, supabase/functions/oracle-*, evals/oracle/ |
| **Charter** | Slice 01 ported to R2. Governance kernel + provenance + audit read. | R2 src/services/charter/, supabase/migrations/ |
| **Eigen/EigenX** | Architectural plan complete (KOS upgrade). Early implementation. | raysretreat shared/eigenPolicy.ts, EIGENX_KOS_UPGRADE_PLAN.md |
| **MEG** | Canonical identity layer. | Shared across all domains |

## Service Pattern (R2 convention)
Every service follows: `interface XxxService` + `interface XxxDb` + `createXxxService(db)` factory + `DbXxxRow` + `rowToEntity()` mapper. Types in `src/types/`, services in `src/services/`, tests with fixtures.

## Supabase Project
- Project ref: `zudslxucibosjwefojtm`
- Connected via MCP in settings.json

## Terms
| Term | Meaning |
|------|---------|
| MEG | Master Entity Graph — canonical identity layer |
| KOS | Knowledge Operating System — EigenX upgrade target |
| RLS | Row-Level Security (Supabase/Postgres) |
| RRAC | Ray's Retreat Access Control hardening pattern |
| Whitespace | Oracle's gap/opportunity detection in market intelligence |
| Fusion | Oracle's evidence synthesis and contradiction resolution |
| Reweighting | Oracle's scoring recalibration based on new evidence |

## Preferences
- Minimum blast radius — small, reviewable, reversible slices
- Define contract first (schema + service + types), then implement
- No frontend code in R2 repo ever
- Follow existing Charter Slice 01 patterns exactly
- Additive migrations only
