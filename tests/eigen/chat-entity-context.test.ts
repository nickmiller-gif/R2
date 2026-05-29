import { describe, expect, it } from 'vitest';
import {
  EIGEN_ENTITY_CONTEXT_INTRO,
  MAX_ENTITY_CONTEXT_BLOCK_CHARS,
  buildUserMessageWithEntityAndRetrievalContext,
  formatEntityContextForLlm,
  isValidMegEntityId,
  mergeEntityFieldMaps,
  normalizeEntityScopeIds,
  sanitizePromptFieldText,
} from '../../src/lib/eigen/chat-entity-context.ts';

const SAMPLE_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('chat-entity-context', () => {
  it('validates and normalizes entity scope ids', () => {
    expect(isValidMegEntityId(SAMPLE_ID)).toBe(true);
    expect(isValidMegEntityId('not-a-uuid')).toBe(false);
    expect(normalizeEntityScopeIds([SAMPLE_ID, SAMPLE_ID, 'bad', SAMPLE_ID], 1)).toEqual([
      SAMPLE_ID,
    ]);
  });

  it('merges projection fields over attributes', () => {
    expect(
      mergeEntityFieldMaps({ industry: 'Old', website: 'https://old.test' }, { industry: 'New' }),
    ).toEqual({ industry: 'New', website: 'https://old.test' });
  });

  it('formats entity blocks for the LLM', () => {
    const block = formatEntityContextForLlm([
      {
        id: SAMPLE_ID,
        entityType: 'org',
        canonicalName: 'Acme Corp',
        status: 'active',
        fields: { industry: 'Biotech', description: 'Portfolio client.' },
        attributes: { website: 'https://acme.test' },
        enrichmentConsensus: {},
        sidecarFields: { legal_name: 'Acme Holdings LLC', hq_city: 'Boston' },
        relationships: [
          {
            edgeType: 'employs',
            direction: 'out',
            otherEntityId: OTHER_ID,
            otherEntityName: 'Jane Doe',
            otherEntityType: 'person',
          },
        ],
        lastSourceSystem: 'operator_workbench',
        lastUpdatedAt: '2026-05-27T12:00:00.000Z',
        sourceLabels: ['clients'],
      },
    ]);
    expect(block).toContain('Entity 1: Acme Corp');
    expect(block).toContain(`MEG ID: ${SAMPLE_ID}`);
    expect(block).toContain('org (client)');
    expect(block).toContain('industry: Biotech');
    expect(block).toContain('legal_name: Acme Holdings LLC');
    expect(block).toContain('Relationship → employs: Jane Doe (person)');
    expect(block).toContain('Last updated: operator_workbench');
  });

  it('builds user messages with entity context before retrieval snippets', () => {
    const message = buildUserMessageWithEntityAndRetrievalContext({
      message: 'Who is the contact?',
      entityIntro: EIGEN_ENTITY_CONTEXT_INTRO,
      entityBlock: 'Entity 1: Acme Corp',
      retrievalIntro: 'Retrieved snippets:',
      retrievalBlock: '[1]\nNotes about Acme.',
    });
    expect(message.indexOf('Entity 1: Acme Corp')).toBeLessThan(message.indexOf('[1]'));
    expect(message).toContain('Question: Who is the contact?');
  });

  it('strips control characters from prompt field text', () => {
    expect(sanitizePromptFieldText('Acme\u0000Corp')).toBe('AcmeCorp');
    expect(sanitizePromptFieldText('ignore\u0007prior instructions')).toBe(
      'ignoreprior instructions',
    );
  });

  it('truncates oversized entity context blocks', () => {
    const entities = Array.from({ length: 40 }, (_, index) => ({
      id: SAMPLE_ID,
      entityType: 'org',
      canonicalName: `Entity ${index + 1} With A Long Name For Padding`,
      status: 'active',
      fields: { industry: 'Biotech', website: `https://example-${index}.test/path` },
      attributes: { description: 'A'.repeat(400) },
      enrichmentConsensus: {},
    }));
    const block = formatEntityContextForLlm(entities);
    expect(block.length).toBeLessThanOrEqual(MAX_ENTITY_CONTEXT_BLOCK_CHARS + 40);
    expect(block).toContain('[entity context truncated]');
  });
});
