import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  parseSessionMemoryValue,
  sessionMemoryKeyForChat,
  type SessionMemoryTurn,
} from '../../../src/lib/eigen/chat-session-memory.ts';

export async function loadSessionMemoryForChat(
  client: SupabaseClient,
  sessionId: string,
  ownerId: string,
): Promise<SessionMemoryTurn | null> {
  const key = sessionMemoryKeyForChat(sessionId);
  const { data, error } = await client
    .from('memory_entries')
    .select('value')
    .eq('scope', 'session')
    .eq('owner_id', ownerId)
    .eq('key', key)
    .maybeSingle();
  if (error || !data?.value) return null;
  return parseSessionMemoryValue(data.value);
}
