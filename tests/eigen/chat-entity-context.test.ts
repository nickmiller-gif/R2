import { describe, expect, it } from 'vitest';
import {
  EIGEN_ENTITY_CONTEXT_INTRO,
  buildUserMessageWithEntityAndRetrievalContext,
  formatEntityContextForLlm,
  isValidMegEntityId,
  mergeEntityFieldMaps,
  normalizeEntityScopeIds,
} from '../../src/lib/eigen/chat-entity-context.ts';

const SAMPLE_ID = '550e8400-e29b-41d4-a716-446655440000';

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
        lastSourceSystem: 'operator_workbench',
        lastUpdatedAt: '2026-05-27T12:00:00.000Z',
        sourceLabels: ['clients'],
      },
    ]);
    expect(block).toContain('Entity 1: Acme Corp');
    expect(block).toContain(`MEG ID: ${SAMPLE_ID}`);
    expect(block).toContain('org (client)');
    expect(block).toContain('industry: Biotech');
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
});
