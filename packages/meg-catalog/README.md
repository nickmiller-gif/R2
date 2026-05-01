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

## Publish checklist (when registry exists)

1. Bump `version` in `package.json` per semver rules above.
2. `npm run typecheck`
3. `npm publish --access restricted` (or org-internal equivalent).
