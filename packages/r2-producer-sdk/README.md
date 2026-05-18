# @r2/producer-sdk

Shared **emit** helper for R2 Signal Contract v1 producers. Validates envelopes via `@r2/signal-contract`, signs with HMAC, and POSTs to `r2-signal-ingest`.

Edge functions (Deno) should keep thin `_shared/r2SignalBridge.ts` wrappers until those repos can import this package; Node scripts and CI smokes can import directly.

## Usage

```ts
import { emitR2Signal } from '@r2/producer-sdk';
import { SIGNAL_CONTRACT_VERSION } from '@r2/signal-contract';

const result = await emitR2Signal(
  {
    contract_version: SIGNAL_CONTRACT_VERSION,
    source_system: 'ip_pulse_point',
    source_repo: 'nickmiller-gif/ip-pulse-point',
    source_event_type: 'ip_analysis_completed',
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: new Date().toISOString(),
    summary: 'Analysis complete',
    raw_payload: {
      ingest_run: {
        id: crypto.randomUUID(),
        source_system: 'ip_pulse_point',
        started_at: new Date().toISOString(),
        trigger: 'ip-router',
      },
    },
    confidence: 0.7,
    privacy_level: 'operator',
    provenance: {},
    routing_targets: ['oracle', 'eigen'],
  },
  {
    ingestUrl: process.env.R2_SIGNAL_INGEST_URL!,
    bearer: process.env.R2_SIGNAL_INGEST_BEARER!,
    hmacSecret: process.env.R2_SIGNAL_INGEST_HMAC_SECRET!,
    idempotencyKey: 'ip_pulse_point:analysis:…',
  },
);
```
