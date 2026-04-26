# @r2/signal-contract

Canonical wire envelope for cross-repo R2 signals.

## Version

- Current contract: `1.0.0`
- Canonical schema: `schemas/r2-signal-envelope-v1.json`

## Purpose

- Keep all producers and routers on one envelope.
- Prevent source-specific drift in required metadata.
- Make ingest validation deterministic at service boundaries.

## Usage

```ts
import { validateR2SignalEnvelope, SIGNAL_CONTRACT_VERSION } from '@r2/signal-contract';

const parsed = validateR2SignalEnvelope(payload);
if (!parsed.ok) {
  // return 400 with parsed.issues
}
```

## Notes

- `summary` is limited to 280 chars for operator triage surfaces.
- `privacy_level` is an explicit data-handling contract and must be preserved downstream.
- `routing_targets` are opt-in requests; routers still enforce policy gates.

## Event Vocabulary

Signal producers own their local event verbs, but shared verbs should be reviewed and documented in the ecosystem wire plan. Seed examples in this package include:

- `centralr2.client_enriched`
- `rays_retreat.coffee_match_created`
- `r2_widget.widget_turn`
