/**
 * Tests for Eigen chat citation service (E4).
 */
import { describe, expect, it } from 'vitest';
import {
  createEigenChatCitationService,
  toPersistCitationInputs,
  type DbEigenChatCitationRow,
  type EigenChatCitationDb,
} from '../../src/services/eigen/chat-citation.service.js';

const TURN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CHUNK_A = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const CHUNK_B = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makeMockDb(): EigenChatCitationDb & { rows: DbEigenChatCitationRow[] } {
  const rows: DbEigenChatCitationRow[] = [];
  return {
    rows,
    async deleteForTurn(chatTurnId) {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i].chat_turn_id === chatTurnId) {
          rows.splice(i, 1);
        }
      }
    },
    async insertMany(insertRows) {
      const created = insertRows.map((row) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...row,
      }));
      rows.push(...created);
      return created;
    },
    async listByTurnId(chatTurnId) {
      return rows
        .filter((row) => row.chat_turn_id === chatTurnId)
        .sort((a, b) => a.rank_index - b.rank_index);
    },
  };
}

const SAMPLE_CITATIONS = [
  {
    chunk_id: CHUNK_A,
    source: 'Doc A',
    relevance: 0.91,
    authority_tier: 'corpus' as const,
    evidence_tier: 'A' as const,
  },
  {
    chunk_id: CHUNK_B,
    source: 'Doc B',
    section: 'Intro',
    relevance: 0.72,
    authority_tier: 'user_upload' as const,
    evidence_tier: 'B' as const,
  },
];

describe('EigenChatCitationService', () => {
  it('persists citations for a turn and lists them by rank', async () => {
    const db = makeMockDb();
    const svc = createEigenChatCitationService(db);
    const persisted = await svc.persistForTurn({
      chatTurnId: TURN_ID,
      ownerId: OWNER_ID,
      retrievalRunId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      citations: toPersistCitationInputs(SAMPLE_CITATIONS),
    });

    expect(persisted).toHaveLength(2);
    expect(persisted[0].chunkId).toBe(CHUNK_A);
    expect(persisted[1].rankIndex).toBe(1);

    const listed = await svc.listByTurnId(TURN_ID);
    expect(listed.map((row) => row.id)).toEqual(persisted.map((row) => row.id));
  });

  it('returns empty when no citations provided', async () => {
    const svc = createEigenChatCitationService(makeMockDb());
    expect(
      await svc.persistForTurn({
        chatTurnId: TURN_ID,
        ownerId: OWNER_ID,
        citations: [],
      }),
    ).toEqual([]);
  });

  it('attaches stable citation ids to client payload', async () => {
    const db = makeMockDb();
    const svc = createEigenChatCitationService(db);
    const inputs = toPersistCitationInputs(SAMPLE_CITATIONS);
    const persisted = await svc.persistForTurn({
      chatTurnId: TURN_ID,
      ownerId: OWNER_ID,
      citations: inputs,
    });
    const withIds = svc.attachCitationIds(inputs, persisted);
    expect(withIds[0].citation_id).toBe(persisted[0].id);
    expect(withIds[0].chunk_id).toBe(CHUNK_A);
    expect(withIds[1].section).toBe('Intro');
  });

  it('rejects persist without turn or owner', async () => {
    const svc = createEigenChatCitationService(makeMockDb());
    await expect(
      svc.persistForTurn({
        chatTurnId: '',
        ownerId: OWNER_ID,
        citations: toPersistCitationInputs(SAMPLE_CITATIONS),
      }),
    ).rejects.toThrow(/chat_turn_id/);
  });

  it('replaces existing citations for the same turn on retry', async () => {
    const db = makeMockDb();
    const svc = createEigenChatCitationService(db);
    const inputs = toPersistCitationInputs(SAMPLE_CITATIONS);

    const first = await svc.persistForTurn({
      chatTurnId: TURN_ID,
      ownerId: OWNER_ID,
      citations: inputs,
    });
    const second = await svc.persistForTurn({
      chatTurnId: TURN_ID,
      ownerId: OWNER_ID,
      citations: inputs,
    });

    expect(second).toHaveLength(2);
    expect(db.rows).toHaveLength(2);
    expect(second.map((row) => row.id)).not.toEqual(first.map((row) => row.id));
  });

  it('persists policy_decision_id when provided', async () => {
    const db = makeMockDb();
    const svc = createEigenChatCitationService(db);
    const policyDecisionId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const persisted = await svc.persistForTurn({
      chatTurnId: TURN_ID,
      ownerId: OWNER_ID,
      policyDecisionId,
      citations: toPersistCitationInputs(SAMPLE_CITATIONS),
    });
    expect(persisted[0].policyDecisionId).toBe(policyDecisionId);
    expect(db.rows[0].policy_decision_id).toBe(policyDecisionId);
  });
});
