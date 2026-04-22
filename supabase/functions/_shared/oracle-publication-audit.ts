import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type OraclePublicationTargetType =
  | 'signal'
  | 'thesis';

/** Insert oracle_publication_events after publication or versioned operator workflows. */
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
    metadata?: Record<string, unknown>;
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
    // Ensure canonical action cannot be overridden by caller-provided metadata.
    metadata: { ...(params.metadata ?? {}), action: params.action },
  });
  return error?.message ?? null;
}
