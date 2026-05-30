/**
 * Tests for eigen-chat turn persistence idempotency.
 */
import { describe, expect, it } from 'vitest';
import { persistTurnPair } from '../../supabase/functions/_shared/eigen-chat-history.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const SESSION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EXISTING_ASSISTANT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

interface TurnRow {
  id: string;
  session_id: string;
  owner_id: string;
  role: string;
  turn_index: number;
  content: string;
  idempotency_key: string | null;
}

type TurnPairTestClient = SupabaseClient & {
  __setInsertConflict: (value: boolean) => void;
  __rows: TurnRow[];
};

function makeTurnPairClient(initialRows: TurnRow[] = []): TurnPairTestClient {
  const rows = [...initialRows];
  let insertShouldConflict = false;

  const client = {
    from(table: string) {
      if (table !== 'eigen_chat_turns') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: (column: keyof TurnRow, value: unknown) => ({
            eq: (column2: keyof TurnRow, value2: unknown) => ({
              eq: (column3: keyof TurnRow, value3: unknown) => ({
                maybeSingle: async () => {
                  const match = rows.find(
                    (row) =>
                      row[column] === value && row[column2] === value2 && row[column3] === value3,
                  );
                  return { data: match ? { id: match.id } : null, error: null };
                },
              }),
            }),
          }),
        }),
        insert: (payload: Array<Record<string, unknown>>) => ({
          select: (_cols: string) => {
            if (insertShouldConflict) {
              return Promise.resolve({
                data: null,
                error: { message: 'duplicate key', code: '23505' as const },
              });
            }
            const created = payload.map((row) => {
              const id = crypto.randomUUID();
              rows.push({
                id,
                session_id: String(row.session_id),
                owner_id: String(row.owner_id),
                role: String(row.role),
                turn_index: Number(row.turn_index),
                content: String(row.content),
                idempotency_key:
                  row.idempotency_key === undefined || row.idempotency_key === null
                    ? null
                    : String(row.idempotency_key),
              });
              return { id, role: String(row.role) };
            });
            return Promise.resolve({ data: created, error: null });
          },
        }),
      };
    },
    __setInsertConflict(value: boolean) {
      insertShouldConflict = value;
    },
    __rows: rows,
  };

  return client as unknown as TurnPairTestClient;
}

const BASE_INPUT = {
  sessionId: SESSION_ID,
  ownerId: OWNER_ID,
  userMessage: 'Hello',
  assistantMessage: 'Hi there',
  retrievalRunId: null,
  citations: [],
  confidence: null,
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  llmFallbackUsed: false,
  llmCriticUsed: false,
  latencyMs: 42,
};

describe('persistTurnPair idempotency', () => {
  it('returns existing assistant turn when idempotency key already persisted', async () => {
    const client = makeTurnPairClient([
      {
        id: EXISTING_ASSISTANT_ID,
        session_id: SESSION_ID,
        owner_id: OWNER_ID,
        role: 'assistant',
        turn_index: 1,
        content: 'Hi there',
        idempotency_key: 'idem-1',
      },
    ]);

    const result = await persistTurnPair(client, {
      ...BASE_INPUT,
      idempotencyKey: 'idem-1',
    });

    expect(result.ok).toBe(true);
    expect(result.assistantTurnId).toBe(EXISTING_ASSISTANT_ID);
    expect(client.__rows).toHaveLength(1);
  });

  it('stores idempotency key on assistant row for new turn pairs', async () => {
    const client = makeTurnPairClient();

    const result = await persistTurnPair(client, {
      ...BASE_INPUT,
      idempotencyKey: 'idem-2',
    });

    expect(result.ok).toBe(true);
    expect(client.__rows).toHaveLength(2);
    const assistant = client.__rows.find((row) => row.role === 'assistant');
    expect(assistant?.idempotency_key).toBe('idem-2');
    expect(result.assistantTurnId).toBe(assistant?.id);
  });

  it('recovers assistant turn id on unique violation race', async () => {
    const client = makeTurnPairClient([
      {
        id: EXISTING_ASSISTANT_ID,
        session_id: SESSION_ID,
        owner_id: OWNER_ID,
        role: 'assistant',
        turn_index: 1,
        content: 'Hi there',
        idempotency_key: 'idem-3',
      },
    ]);
    client.__setInsertConflict(true);

    const result = await persistTurnPair(client, {
      ...BASE_INPUT,
      idempotencyKey: 'idem-3',
    });

    expect(result.ok).toBe(true);
    expect(result.assistantTurnId).toBe(EXISTING_ASSISTANT_ID);
  });
});
