import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type OraclePublicationTargetType = 'signal' | 'thesis';

/** Insert oracle_publication_events after a successful publication_state update. */
export async function insertOraclePublicationAuditEvent(
  client: SupabaseClient,
  params: {
    targetType: OraclePublicationTargetType;
    targetId: string;
    fromState: string | null;
    toState: string;
    decidedBy: string;
    decidedAt: string;
    notes: string | null;
    action: string;
  },
): Promise<string | null> {
  const { error } = await client.from('oracle_publication_events').insert({
    target_type: params.targetType,
    target_id: params.targetId,
    from_state: params.fromState,
    to_state: params.toState,
    decided_by: params.decidedBy,
    decided_at: params.decidedAt,
    notes: params.notes,
    metadata: { action: params.action },
  });
  return error?.message ?? null;
}
