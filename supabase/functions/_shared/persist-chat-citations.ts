import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ChatCitation } from './eigen-chat-contract.ts';
import {
  createEigenChatCitationService,
  toPersistCitationInputs,
} from '../../../src/services/eigen/chat-citation.service.ts';
import { createEigenChatCitationDb } from './eigen-chat-citation-db.ts';
import { logWarn } from './log.ts';

export async function persistChatCitationsForTurn(
  client: SupabaseClient,
  input: {
    assistantTurnId: string;
    ownerId: string;
    retrievalRunId: string | null;
    policyDecisionId?: string | null;
    citations: ChatCitation[];
  },
): Promise<ChatCitation[]> {
  if (input.citations.length === 0) return input.citations;

  try {
    const svc = createEigenChatCitationService(createEigenChatCitationDb(client));
    const persistInputs = toPersistCitationInputs(input.citations);
    const persisted = await svc.persistForTurn({
      chatTurnId: input.assistantTurnId,
      ownerId: input.ownerId,
      retrievalRunId: input.retrievalRunId,
      policyDecisionId: input.policyDecisionId ?? null,
      citations: persistInputs,
    });
    return svc.attachCitationIds(persistInputs, persisted);
  } catch (err) {
    logWarn('persistChatCitationsForTurn failed', {
      functionName: 'persist-chat-citations',
      error: err instanceof Error ? err.message : String(err),
    });
    return input.citations;
  }
}
