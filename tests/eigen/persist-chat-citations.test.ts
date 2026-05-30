import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { persistChatCitationsForTurn } from '../../supabase/functions/_shared/persist-chat-citations.ts';

describe('persistChatCitationsForTurn', () => {
  it('returns persisted=false when citation service throws', async () => {
    const client = {
      from(table: string) {
        if (table === 'eigen_chat_turns') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: 'turn-1' }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'eigen_chat_citations') {
          return {
            delete: () => ({
              eq: async () => ({ error: { message: 'delete failed' } }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await persistChatCitationsForTurn(client, {
      assistantTurnId: 'turn-1',
      ownerId: 'owner-1',
      retrievalRunId: null,
      citations: [
        {
          chunk_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          source: 'Doc',
          relevance: 0.8,
          authority_tier: 'corpus',
          evidence_tier: 'B',
        },
      ],
    });

    expect(result.persisted).toBe(false);
    expect(result.citations[0]?.citation_id).toBeUndefined();
  });

  it('returns persisted=true for empty citation list', async () => {
    const client = {} as SupabaseClient;
    const result = await persistChatCitationsForTurn(client, {
      assistantTurnId: 'turn-1',
      ownerId: 'owner-1',
      retrievalRunId: null,
      citations: [],
    });
    expect(result).toEqual({ citations: [], persisted: true });
  });
});
