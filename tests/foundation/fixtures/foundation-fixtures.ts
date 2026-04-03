/**
 * Test fixture factories for foundation services.
 */
import type { ProvenanceActor } from '../../../src/types/shared/provenance.js';
import type { CreateDocumentInput } from '../../../src/types/shared/documents.js';
import type { CreateOracleSignalInput } from '../../../src/types/oracle/signal.js';
import type { CreateAssetRegistryInput, CreateEvidenceLinkInput } from '../../../src/types/shared/asset-registry.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
}

export function makeActor(overrides?: Partial<ProvenanceActor>): ProvenanceActor {
  return {
    id: nextId(),
    kind: 'user',
    ...overrides,
  };
}

export function makeCreateDocumentInput(overrides?: Partial<CreateDocumentInput>): CreateDocumentInput {
  return {
    sourceSystem: 'test',
    ownerId: nextId(),
    title: `Test Document ${counter}`,
    body: `Body content for test document ${counter}`,
    contentType: 'text/plain',
    ...overrides,
  };
}

export function makeCreateOracleSignalInput(overrides?: Partial<CreateOracleSignalInput>): CreateOracleSignalInput {
  return {
    entityAssetId: nextId(),
    score: 75,
    confidence: 'medium',
    reasons: ['Strong market signal', 'Validated by interviews', 'Price point confirmed'],
    tags: ['idea-validation'],
    producerRef: 'oracle-score-llm-v1',
    ...overrides,
  };
}

export function makeCreateAssetRegistryInput(overrides?: Partial<CreateAssetRegistryInput>): CreateAssetRegistryInput {
  return {
    kind: 'document',
    refId: nextId(),
    domain: 'test',
    label: `Test Asset ${counter}`,
    ...overrides,
  };
}

export function makeCreateEvidenceLinkInput(overrides?: Partial<CreateEvidenceLinkInput>): CreateEvidenceLinkInput {
  return {
    fromAssetId: nextId(),
    toAssetId: nextId(),
    linkKind: 'supports',
    confidence: 0.85,
    ...overrides,
  };
}

export function resetFixtureCounter(): void {
  counter = 0;
}
