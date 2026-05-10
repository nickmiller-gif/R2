# @r2/meg-catalog

Canonical **Master Entity Graph** vocabulary: `MegEntityType`, `MegEdgeType`, `MegSourceSystem`, and `MEG_CATALOG_VERSION` (`1.0.0`).

## Consumers

Import from the R2 monorepo path (private package):

```ts
import type { MegEntityType, MegSourceSystem } from '@r2/meg-catalog';
import { MEG_CATALOG_VERSION } from '@r2/meg-catalog';
```

Until a private registry is configured, depend via **git submodule / workspace path** or `npm pack` from this directory.

## Governance

- **Patch:** documentation only.
- **Minor:** additive literals only (new union members) + ADR note.
- **Major:** rename or remove literals.

See [ADR-0004](../../../docs/adr/ADR-0004-meg-phase3-preflight.md) (umbrella repo `docs/adr`).

## Distribution model

The package is `"private": true` on purpose — it must never reach public npm. There are two supported distribution paths:

### Path A: workspace dependency (recommended while consumers live in this monorepo)

Each consumer's `package.json` references the catalog via a workspace path:

```json
{
  "dependencies": {
    "@r2/meg-catalog": "file:../R2/packages/meg-catalog"
  }
}
```

This works without any registry. Lovable-managed repos that don't share the monorepo structure can either copy the type file or pull it via git submodule until a private registry is procured.

### Path B: private registry (when one is set up)

To allow real publishing in the future, the workflow becomes:

1. Set up the private registry (GitHub Packages, Verdaccio, npm Enterprise, etc.) and configure auth.
2. **Drop `"private": true` from `package.json`** in the publish PR (and re-add it on the next development cycle if you want belt-and-suspenders).
3. Bump `version` in `package.json` per the governance rules above.
4. `npm run typecheck`
5. Run the workspace lint: `bash scripts/validate-source-system-literals.sh` from the R2 Complete root — fails CI if any consumer uses a `source_system` literal not in `MegSourceSystem`.
6. `npm publish --access restricted` (or the registry-equivalent).

Until step 1 is done, the only safe operation is Path A. The current `"private": true` flag prevents the wrong workflow from happening accidentally.

## Pre-publish rename log (v1.0.0)

The following literals were renamed inside v1.0.0 before publish (no version bump because v1.0.0 has not yet shipped to any registry):

| Old               | New              | Date       | Reason                                                                                                                                                  |
| ----------------- | ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ip_insights_hub` | `ip_pulse_point` | 2026-05-10 | The `ip-insights-hub` repo was replaced wholesale by `ip-pulse-point`. Site_id, source-system literal, and SEO baseline folder all renamed in lockstep. |

After publish, future renames must follow the major-bump rule above.

## Pre-publish source-code normalization log (v1.0.0)

In addition to the catalog rename above, the audit pass that produced ADR-0007 fixed 13 source-code drift cases where producer code emitted hyphen-form variants of canonical underscored literals:

| Was                                   | Now                                       | Files                                                                                                                                                                                                                                               |
| ------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formahealth`                         | `forma_health`                            | `formahealth/supabase/functions/upload-knowledge/index.ts`                                                                                                                                                                                          |
| `raysretreat`                         | `rays_retreat`                            | `R2/scripts/eigen-raysretreat-export.mjs`, `R2/src/adapters/raysretreat/eigen-raysretreat-adapter.ts` (3 occurrences)                                                                                                                               |
| `centralr2-core`                      | `centralr2`                               | `centralr2-core/supabase/functions/_shared/eigen-ingest.ts` (2 occurrences), `centralr2-core/src/lib/ingestContract.ts` (comment), `R2/tests/eigen/eigen-ingest-client.test.ts`, `R2/src/adapters/centralr2-core/eigen-centralr2-adapter.ts`        |
| `centralr2-web`                       | `centralr2`                               | `centralr2-core/src/lib/analytics.ts`                                                                                                                                                                                                               |
| `ai-health-check`                     | `centralr2`                               | `centralr2-core/supabase/functions/ai-health-check/index.ts`                                                                                                                                                                                        |
| `autonomous-bot-os-in`                | `autonomous_bot_os`                       | `autonomous-bot-os-in/src/lib/supabase-service.ts`, `autonomous-bot-os-in/src/lib/webhook-service.ts`                                                                                                                                               |
| `autonomous_os_extension`             | `autonomous_bot_os`                       | `R2/supabase/functions/autonomous-capture-ingest/index.ts`                                                                                                                                                                                          |
| `health-supplement-tr`                | `health_supplement_tr`                    | `health-supplement-tr/src/lib/eigen-ingest.ts` (2 occurrences), `health-supplement-tr/scripts/export-trends-to-r2.mjs`, `R2/tests/eigen/source-relevance-gating.test.ts`, `R2/src/adapters/health-supplement-tr/eigen-health-supplement-adapter.ts` |
| `ip-insights-hub`                     | `ip_pulse_point`                          | `ip-pulse-point/supabase/functions/ip-router/index.ts`, `ip-pulse-point/supabase/functions/_shared/eigen-ingest.ts` (2), `ip-pulse-point/scripts/backfill-eigen-ingest.mjs`, `R2/src/adapters/ip-insights-hub/eigen-ip-adapter.ts`                  |
| `oracle-operator`                     | `oracle_operator`                         | `R2/src/adapters/oracle-operator/eigen-oracle-operator-adapter.ts`                                                                                                                                                                                  |
| `oracle-ws-pipeline`                  | `oracle_operator`                         | `R2/supabase/functions/oracle-ws-pipeline/index.ts` (3 occurrences)                                                                                                                                                                                 |
| `works`                               | `operator_workbench`                      | `operator-workbench/src/lib/works/people.ts`                                                                                                                                                                                                        |
| `target_source_system: <hyphen-form>` | `target_source_system: <underscore-form>` | `R2/src/adapters/domain-adapter-roadmap.ts` (4 fields)                                                                                                                                                                                              |

Run `bash scripts/validate-source-system-literals.sh` from the workspace root to catch any new drift before re-publishing.
