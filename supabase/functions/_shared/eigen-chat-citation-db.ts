import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  DbEigenChatCitationRow,
  EigenChatCitationDb,
} from '../../../src/services/eigen/chat-citation.service.ts';

export function createEigenChatCitationDb(client: SupabaseClient): EigenChatCitationDb {
  return {
    async assertTurnOwnedBy(chatTurnId, ownerId) {
      const { data, error } = await client
        .from('eigen_chat_turns')
        .select('id')
        .eq('id', chatTurnId)
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error('chat turn not found for owner');
      }
    },

    async deleteForTurn(chatTurnId) {
      const { error } = await client
        .from('eigen_chat_citations')
        .delete()
        .eq('chat_turn_id', chatTurnId);
      if (error) throw new Error(error.message);
    },

    async insertMany(rows) {
      const { data, error } = await client
        .from('eigen_chat_citations')
        .insert(rows)
        .select(
          'id, chat_turn_id, owner_id, chunk_id, rank_index, source, section, relevance, authority_tier, evidence_tier, policy_decision_id, retrieval_run_id, created_at',
        );
      if (error) throw new Error(error.message);
      return (data ?? []) as DbEigenChatCitationRow[];
    },

    async listByTurnId(chatTurnId) {
      const { data, error } = await client
        .from('eigen_chat_citations')
        .select(
          'id, chat_turn_id, owner_id, chunk_id, rank_index, source, section, relevance, authority_tier, evidence_tier, policy_decision_id, retrieval_run_id, created_at',
        )
        .eq('chat_turn_id', chatTurnId)
        .order('rank_index');
      if (error) throw new Error(error.message);
      return (data ?? []) as DbEigenChatCitationRow[];
    },
  };
}
