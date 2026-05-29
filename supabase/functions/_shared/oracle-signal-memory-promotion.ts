import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildOracleSignalMemoryValue,
  oracleEntitySignalMemoryKey,
  shouldPromoteOracleSignalToMemory,
} from '../../../src/services/eigen/oracle-signal-promotion.service.ts';
import { readOracleSignalChatMinScore } from '../../../src/lib/eigen/retrieve-feature-flags.ts';
import { parseBooleanEnvFlag } from '../../../src/lib/eigen/retrieve-feature-flags.ts';

export function readOracleSignalMemoryPromotionEnabled(): boolean {
  return parseBooleanEnvFlag(Deno.env.get('EIGEN_ORACLE_SIGNAL_MEMORY_PROMOTION'), false);
}

function readWorkspaceMemoryOwnerId(): string | null {
  const raw = Deno.env.get('EIGEN_WORKSPACE_MEMORY_OWNER_ID')?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export async function promoteOracleSignalToMemoryEntries(
  client: SupabaseClient,
  input: {
    signalId: string;
    entityIds: string[];
    score: number;
    confidence: string;
    reasons: string[];
    tags: string[];
    scoredAt: string;
  },
): Promise<{ promoted: number; skipped: boolean }> {
  if (!readOracleSignalMemoryPromotionEnabled()) {
    return { promoted: 0, skipped: true };
  }

  const ownerId = readWorkspaceMemoryOwnerId();
  if (!ownerId) return { promoted: 0, skipped: true };

  const minScore = readOracleSignalChatMinScore(Deno.env.get('EIGEN_ORACLE_SIGNAL_CHAT_MIN_SCORE'));
  if (
    !shouldPromoteOracleSignalToMemory(
      { score: input.score, confidence: input.confidence },
      minScore,
    )
  ) {
    return { promoted: 0, skipped: true };
  }

  let promoted = 0;
  for (const entityId of input.entityIds) {
    const key = oracleEntitySignalMemoryKey(entityId, input.signalId);
    const value = buildOracleSignalMemoryValue({
      signalId: input.signalId,
      entityId,
      score: input.score,
      confidence: input.confidence,
      reasons: input.reasons,
      tags: input.tags,
      scoredAt: input.scoredAt,
    });

    const { error } = await client.from('memory_entries').upsert(
      [
        {
          scope: 'workspace',
          key,
          value,
          retention_class: 'long_term',
          confidence_band: input.confidence,
          owner_id: ownerId,
        },
      ],
      { onConflict: 'scope,owner_id,key' },
    );
    if (!error) promoted += 1;
  }

  return { promoted, skipped: false };
}
