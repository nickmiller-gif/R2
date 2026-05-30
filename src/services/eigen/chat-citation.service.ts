/**
 * Eigen chat citation persistence (E4).
 */

import type {
  ChatCitationWithId,
  EigenChatCitation,
  PersistEigenChatCitationInput,
  PersistEigenChatCitationsForTurnInput,
} from '../../types/eigen/chat-citation.ts';

export interface DbEigenChatCitationRow {
  id: string;
  chat_turn_id: string;
  owner_id: string;
  chunk_id: string | null;
  rank_index: number;
  source: string;
  section: string | null;
  relevance: number;
  authority_tier: string;
  evidence_tier: string;
  policy_decision_id: string | null;
  retrieval_run_id: string | null;
  created_at: string;
}

export interface EigenChatCitationDb {
  deleteForTurn(chatTurnId: string): Promise<void>;
  insertMany(
    rows: Array<Omit<DbEigenChatCitationRow, 'id' | 'created_at'>>,
  ): Promise<DbEigenChatCitationRow[]>;
  listByTurnId(chatTurnId: string): Promise<DbEigenChatCitationRow[]>;
}

export interface EigenChatCitationService {
  persistForTurn(input: PersistEigenChatCitationsForTurnInput): Promise<EigenChatCitation[]>;
  listByTurnId(chatTurnId: string): Promise<EigenChatCitation[]>;
  attachCitationIds(
    citations: PersistEigenChatCitationInput[],
    persisted: EigenChatCitation[],
  ): ChatCitationWithId[];
}

function rowToEntity(row: DbEigenChatCitationRow): EigenChatCitation {
  return {
    id: row.id,
    chatTurnId: row.chat_turn_id,
    ownerId: row.owner_id,
    chunkId: row.chunk_id,
    rankIndex: row.rank_index,
    source: row.source,
    section: row.section,
    relevance: Number(row.relevance),
    authorityTier: row.authority_tier as EigenChatCitation['authorityTier'],
    evidenceTier: row.evidence_tier as EigenChatCitation['evidenceTier'],
    policyDecisionId: row.policy_decision_id,
    retrievalRunId: row.retrieval_run_id,
    createdAt: new Date(row.created_at),
  };
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export function createEigenChatCitationService(db: EigenChatCitationDb): EigenChatCitationService {
  return {
    async persistForTurn(input) {
      const chatTurnId = input.chatTurnId.trim();
      const ownerId = input.ownerId.trim();
      if (!chatTurnId || !ownerId) {
        throw new Error('chat_turn_id and owner_id required');
      }
      if (input.citations.length === 0) return [];

      const rows = input.citations.map((citation, index) => ({
        chat_turn_id: chatTurnId,
        owner_id: ownerId,
        chunk_id: isValidUuid(citation.chunkId) ? citation.chunkId.trim() : null,
        rank_index: citation.rankIndex ?? index,
        source: citation.source.trim() || 'unknown',
        section: citation.section?.trim() ?? null,
        relevance: citation.relevance,
        authority_tier: citation.authorityTier,
        evidence_tier: citation.evidenceTier,
        policy_decision_id: input.policyDecisionId?.trim() ?? null,
        retrieval_run_id: input.retrievalRunId?.trim() ?? null,
      }));

      // Replace semantics: retries or duplicate persist calls for the same turn
      // should not accumulate rows (enforced by UNIQUE(chat_turn_id, rank_index)).
      await db.deleteForTurn(chatTurnId);
      const inserted = await db.insertMany(rows);
      return inserted.map(rowToEntity);
    },

    async listByTurnId(chatTurnId) {
      const trimmed = chatTurnId.trim();
      if (!trimmed) return [];
      const rows = await db.listByTurnId(trimmed);
      return rows.map(rowToEntity);
    },

    attachCitationIds(citations, persisted) {
      const byRank = new Map(persisted.map((row) => [row.rankIndex, row]));
      return citations.map((citation, index) => {
        const row = byRank.get(citation.rankIndex ?? index);
        return {
          citation_id: row?.id ?? citation.chunkId,
          chunk_id: citation.chunkId,
          source: citation.source,
          section: citation.section,
          relevance: citation.relevance,
          authority_tier: citation.authorityTier,
          evidence_tier: citation.evidenceTier,
        };
      });
    },
  };
}

/** Maps runtime ChatCitation shape to persistence inputs. */
export function toPersistCitationInputs(
  citations: Array<{
    chunk_id: string;
    source: string;
    section?: string;
    relevance: number;
    authority_tier: string;
    evidence_tier: string;
  }>,
): PersistEigenChatCitationInput[] {
  return citations.map((citation, index) => ({
    chunkId: citation.chunk_id,
    source: citation.source,
    section: citation.section,
    relevance: citation.relevance,
    authorityTier: citation.authority_tier as PersistEigenChatCitationInput['authorityTier'],
    evidenceTier: citation.evidence_tier as PersistEigenChatCitationInput['evidenceTier'],
    rankIndex: index,
  }));
}
