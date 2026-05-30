import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ChatCitation } from './eigen-chat-contract.ts';
import {
  createEigenChatCitationService,
  toPersistCitationInputs,
} from '../../../src/services/eigen/chat-citation.service.ts';
import { createEigenChatCitationDb } from './eigen-chat-citation-db.ts';
import { logWarn } from './log.ts';

export interface PersistChatCitationsResult {
  citations: ChatCitation[];
  persisted: boolean;
}

export async function persistChatCitationsForTurn(
  client: SupabaseClient,
  input: {
    assistantTurnId: string;
    ownerId: string;
    retrievalRunId: string | null;
    policyDecisionId?: string | null;
    citations: ChatCitation[];
  },
): Promise<PersistChatCitationsResult> {
  if (input.citations.length === 0) {
    return { citations: input.citations, persisted: true };
  }

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
    return {
      citations: svc.attachCitationIds(persistInputs, persisted),
      persisted: true,
    };
  } catch (err) {
    logWarn('persistChatCitationsForTurn failed', {
      functionName: 'persist-chat-citations',
      error: err instanceof Error ? err.message : String(err),
    });
    return { citations: input.citations, persisted: false };
  }
}
