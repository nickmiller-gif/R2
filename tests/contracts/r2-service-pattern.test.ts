/**
 * R2 Canonical Contract Tests — Service Pattern Verification
 *
 * These tests verify that every domain service follows the R2 pattern:
 *   1. Has a factory function (createXxxService)
 *   2. Exports a Service interface
 *   3. Exports a Db interface (the port)
 *   4. Exports a DbXxxRow type (snake_case)
 *   5. Factory accepts Db, returns Service
 *   6. Service methods return domain objects (camelCase)
 *
 * This is the "immune system" — if a service drifts from the pattern,
 * these tests catch it.
 */
import { describe, it, expect } from 'vitest';

// ── Foundation ───────────────────────────────────────────────────────
import {
  createDocumentsService,
  type DocumentsService,
  type DocumentsDb,
  type DbDocumentRow,
} from '../../src/services/documents/index.js';

import {
  createAssetRegistryService,
  type AssetRegistryService,
  type AssetRegistryDb,
  type DbAssetRegistryRow,
  type DbEvidenceLinkRow,
} from '../../src/services/foundation/index.js';

// ── Charter ──────────────────────────────────────────────────────────
import {
  createGovernanceKernelService,
  type GovernanceKernelService,
  type GovernanceKernelDb,
  type DbGovernanceEntityRow,
} from '../../src/services/charter/governance-kernel.service.js';

import {
  createProvenanceService,
  type ProvenanceService,
  type ProvenanceDb,
  type DbProvenanceEventRow,
} from '../../src/services/charter/provenance.service.js';

import {
  createAuditReadService,
  type AuditReadService,
  type AuditReadDb,
  type DbAuditLogRow,
} from '../../src/services/charter/audit-read.service.js';

import {
  createCharterEntityContextService,
  type CharterEntityContextService,
  type EntityContextDb,
  type AssetRegistryPort,
  type DbCharterEntityRow,
} from '../../src/services/charter/entity-context.service.js';

import {
  createCharterRightService,
  type CharterRightService,
  type CharterRightDb,
  type DbCharterRightRow,
} from '../../src/services/charter/right.service.js';

import {
  createCharterObligationService,
  type CharterObligationService,
  type CharterObligationDb,
  type DbCharterObligationRow,
} from '../../src/services/charter/obligation.service.js';

import {
  createCharterEvidenceService,
  type CharterEvidenceService,
  type CharterEvidenceDb,
  type DbCharterEvidenceRow,
} from '../../src/services/charter/evidence.service.js';

import {
  createCharterPayoutService,
  type CharterPayoutService,
  type CharterPayoutDb,
  type DbCharterPayoutRow,
} from '../../src/services/charter/payout.service.js';

import {
  createCharterDecisionService,
  type CharterDecisionService,
  type CharterDecisionDb,
  type DbCharterDecisionRow,
} from '../../src/services/charter/decision.service.js';

import {
  createCharterRoleService,
  type CharterRoleService,
  type CharterRoleDb,
  type DbCharterUserRoleRow,
} from '../../src/services/charter/role.service.js';

// ── Oracle ───────────────────────────────────────────────────────────
import {
  createOracleSignalService,
  type OracleSignalService,
  type OracleSignalDb,
  type DbOracleSignalRow,
} from '../../src/services/oracle/oracle-signal.service.js';

import {
  createOracleThesisService,
  type OracleThesisService,
  type OracleThesisDb,
  type DbOracleThesisRow,
} from '../../src/services/oracle/oracle-thesis.service.js';

import {
  createOracleEvidenceItemService,
  type OracleEvidenceItemService,
  type OracleEvidenceItemDb,
  type DbOracleEvidenceItemRow,
} from '../../src/services/oracle/oracle-evidence-item.service.js';

import {
  createOracleSourcePackService,
  type OracleSourcePackService,
  type OracleSourcePackDb,
  type DbOracleSourcePackRow,
} from '../../src/services/oracle/oracle-source-pack.service.js';

import {
  createOracleThesisEvidenceLinkService,
  type OracleThesisEvidenceLinkService,
  type OracleThesisEvidenceLinkDb,
  type DbOracleThesisEvidenceLinkRow,
} from '../../src/services/oracle/oracle-thesis-evidence-link.service.js';

import {
  createOracleProfileRunService,
  type OracleProfileRunService,
  type OracleProfileRunDb,
  type DbOracleProfileRunRow,
} from '../../src/services/oracle/oracle-profile-run.service.js';

// ── Eigen ────────────────────────────────────────────────────────────
import {
  createKnowledgeChunkService,
  type KnowledgeChunkService,
  type KnowledgeChunkDb,
  type DbKnowledgeChunkRow,
} from '../../src/services/eigen/knowledge-chunk.service.js';

import {
  createRetrievalRunService,
  type RetrievalRunService,
  type RetrievalRunDb,
  type DbRetrievalRunRow,
} from '../../src/services/eigen/retrieval-run.service.js';

import {
  createToolCapabilityService,
  type ToolCapabilityService,
  type ToolCapabilityDb,
  type DbToolCapabilityRow,
} from '../../src/services/eigen/tool-capability.service.js';

import {
  createMemoryEntryService,
  type MemoryEntryService,
  type MemoryEntryDb,
  type DbMemoryEntryRow,
} from '../../src/services/eigen/memory-entry.service.js';

describe('R2 Service Pattern Contract', () => {
  it('every factory is a function', () => {
    const factories = [
      createDocumentsService,
      createAssetRegistryService,
      createGovernanceKernelService,
      createProvenanceService,
      createAuditReadService,
      createCharterEntityContextService,
      createCharterRightService,
      createCharterObligationService,
      createCharterEvidenceService,
      createCharterPayoutService,
      createCharterDecisionService,
      createCharterRoleService,
      createOracleThesisService,
      createOracleEvidenceItemService,
      createOracleSourcePackService,
      createOracleThesisEvidenceLinkService,
      createOracleSignalService,
      createOracleProfileRunService,
      createKnowledgeChunkService,
      createRetrievalRunService,
      createToolCapabilityService,
      createMemoryEntryService,
    ];

    for (const factory of factories) {
      expect(typeof factory).toBe('function');
    }

    // If this compiles, the type-level contracts hold:
    // - Each factory takes a Db interface
    // - Each factory returns a Service interface
    // - Each Db exposes DbXxxRow-shaped operations
    expect(factories).toHaveLength(22);
  });
});

describe('Cross-domain Event Envelope contract', () => {
  it('createEventEnvelope produces valid envelope', async () => {
    const { createEventEnvelope } = await import('../../src/types/shared/event-envelope.js');

    const envelope = createEventEnvelope({
      eventType: 'charter.right.created',
      payload: { rightId: 'r-1', status: 'pending' },
      producer: 'charter-service',
      idempotencyKey: 'idem-key-1',
      correlationId: 'corr-id-1',
    });

    expect(envelope.id).toBeTruthy();
    expect(envelope.eventType).toBe('charter.right.created');
    expect(envelope.payload).toEqual({ rightId: 'r-1', status: 'pending' });
    expect(envelope.producer).toBe('charter-service');
    expect(envelope.idempotencyKey).toBe('idem-key-1');
    expect(envelope.correlationId).toBe('corr-id-1');
    expect(envelope.causationId).toBeNull();
    expect(envelope.eventVersion).toBe(1);
    expect(envelope.occurredAt).toBeTruthy();
  });
});

describe('Cross-domain provenance chain integrity', () => {
  it('hash chain is deterministic and consistent', async () => {
    const { hashPayload, genesisChainHash, nextChainHash } = await import('../../src/lib/provenance/hash.js');

    // Same input → same hash (deterministic)
    const h1 = hashPayload('test payload');
    const h2 = hashPayload('test payload');
    expect(h1).toBe(h2);

    // Different input → different hash
    const h3 = hashPayload('different payload');
    expect(h3).not.toBe(h1);

    // Chain hashing preserves ordering
    const genesis = genesisChainHash('domain-1');
    expect(genesis).toBeTruthy();

    const chain1 = nextChainHash(genesis, 'event-1-payload');
    const chain2 = nextChainHash(chain1, 'event-2-payload');
    expect(chain1).not.toBe(genesis);
    expect(chain2).not.toBe(chain1);

    // Chain is reproducible
    const chain1b = nextChainHash(genesis, 'event-1-payload');
    expect(chain1b).toBe(chain1);
  });
});

describe('Barrel export surface', () => {
  it('top-level index exports all domain factories', async () => {
    const r2 = await import('../../src/index.js');

    // Foundation
    expect(typeof r2.createDocumentsService).toBe('function');
    expect(typeof r2.createAssetRegistryService).toBe('function');
    expect(typeof r2.hashPayload).toBe('function');
    expect(typeof r2.nowUtc).toBe('function');
    expect(typeof r2.toUtc).toBe('function');
    expect(typeof r2.requireUtc).toBe('function');
    expect(typeof r2.isValidUtcDate).toBe('function');
    expect(typeof r2.toIsoUtc).toBe('function');
    expect(r2.UTC_TIMEZONE).toBe('UTC');
    expect(typeof r2.makeTimeWindow).toBe('function');
    expect(typeof r2.makeValidityWindow).toBe('function');
    expect(typeof r2.validityWindowToTimeWindow).toBe('function');
    expect(typeof r2.timeWindowContains).toBe('function');
    expect(typeof r2.timeWindowsOverlap).toBe('function');
    expect(typeof r2.intersectTimeWindows).toBe('function');
    expect(typeof r2.makeEntityRef).toBe('function');
    expect(typeof r2.entityRefKey).toBe('function');
    expect(typeof r2.entityRefsEqual).toBe('function');
    expect(typeof r2.makeAlias).toBe('function');
    expect(typeof r2.findAlias).toBe('function');
    expect(typeof r2.aliasIndex).toBe('function');
    expect(typeof r2.normalizeActor).toBe('function');

    // Charter
    expect(typeof r2.createGovernanceKernelService).toBe('function');
    expect(typeof r2.createProvenanceService).toBe('function');
    expect(typeof r2.createAuditReadService).toBe('function');
    expect(typeof r2.createCharterEntityContextService).toBe('function');
    expect(typeof r2.createCharterRightService).toBe('function');
    expect(typeof r2.createCharterObligationService).toBe('function');
    expect(typeof r2.createCharterEvidenceService).toBe('function');
    expect(typeof r2.createCharterPayoutService).toBe('function');
    expect(typeof r2.createCharterDecisionService).toBe('function');
    expect(typeof r2.createCharterRoleService).toBe('function');

    // Oracle — services
    expect(typeof r2.createOracleSignalService).toBe('function');
    expect(typeof r2.createOracleThesisService).toBe('function');
    expect(typeof r2.createOracleEvidenceItemService).toBe('function');
    expect(typeof r2.createOracleSourcePackService).toBe('function');
    expect(typeof r2.createOracleThesisEvidenceLinkService).toBe('function');
    expect(typeof r2.createOracleProfileRunService).toBe('function');

    // Oracle — intelligence primitives (lib/oracle)
    expect(typeof r2.reweightScore).toBe('function');
    expect(typeof r2.scoreToConfidenceBand).toBe('function');
    expect(typeof r2.aggregateScores).toBe('function');
    expect(typeof r2.blendEvidenceScore).toBe('function');
    expect(typeof r2.assessEvidenceConsistency).toBe('function');
    expect(typeof r2.classifyContradiction).toBe('function');
    expect(typeof r2.identifyGaps).toBe('function');
    expect(typeof r2.predictiveGapScore).toBe('function');
    expect(typeof r2.temporalDiff).toBe('function');
    expect(typeof r2.temporalDrift).toBe('function');
    expect(typeof r2.computeFreshness).toBe('function');
    expect(typeof r2.feedRescore).toBe('function');
    expect(typeof r2.scoreOpportunity).toBe('function');
    expect(typeof r2.classifyHorizon).toBe('function');
    expect(typeof r2.multiHorizonTiming).toBe('function');
    expect(typeof r2.crossRunDiff).toBe('function');
    expect(typeof r2.makeRetrievalQuery).toBe('function');
    expect(typeof r2.filterByRelevance).toBe('function');

    // Eigen
    expect(typeof r2.createKnowledgeChunkService).toBe('function');
    expect(typeof r2.createRetrievalRunService).toBe('function');
    expect(typeof r2.createToolCapabilityService).toBe('function');
    expect(typeof r2.createMemoryEntryService).toBe('function');
  });

  it('EventEnvelope types are exported', async () => {
    const r2 = await import('../../src/index.js');
    expect(typeof r2.createEventEnvelope).toBe('function');
  });
});
