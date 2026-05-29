import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type OracleSignalForPrompt,
  shouldIncludeOracleSignal,
} from '../../../src/lib/eigen/chat-oracle-signals-context.ts';
import { readOracleSignalChatMinScore } from '../../../src/lib/eigen/retrieve-feature-flags.ts';

export async function fetchOracleSignalsForEntityScope(
  client: SupabaseClient,
  entityScope: string[],
  maxSignals = 6,
): Promise<OracleSignalForPrompt[]> {
  const entityIds = entityScope.map((id) => id.trim()).filter((id) => id.length > 0);
  if (entityIds.length === 0) return [];

  const minScore = readOracleSignalChatMinScore(Deno.env.get('EIGEN_ORACLE_SIGNAL_CHAT_MIN_SCORE'));

  const assetsResult = await client
    .from('asset_registry')
    .select('id, ref_id')
    .eq('kind', 'governance_entity')
    .in('ref_id', entityIds);

  if (assetsResult.error || !assetsResult.data?.length) return [];

  const assetToEntity = new Map<string, string>();
  for (const row of assetsResult.data) {
    const refId = typeof row.ref_id === 'string' ? row.ref_id : '';
    const assetId = String(row.id);
    if (refId) assetToEntity.set(assetId, refId);
  }

  const assetIds = [...assetToEntity.keys()];
  if (assetIds.length === 0) return [];

  const signalsResult = await client
    .from('oracle_signals')
    .select('id, entity_asset_id, score, confidence, reasons, tags, scored_at, status')
    .in('entity_asset_id', assetIds)
    .eq('status', 'scored')
    .order('scored_at', { ascending: false })
    .limit(Math.min(maxSignals * 2, 24));

  if (signalsResult.error || !signalsResult.data?.length) return [];

  const out: OracleSignalForPrompt[] = [];
  for (const row of signalsResult.data) {
    const entityId = assetToEntity.get(String(row.entity_asset_id));
    if (!entityId) continue;
    const score = Number(row.score ?? 0);
    const confidence = String(row.confidence ?? 'medium');
    if (!shouldIncludeOracleSignal({ score, confidence, minScore })) continue;

    out.push({
      signalId: String(row.id),
      entityId,
      score,
      confidence,
      reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      scoredAt: String(row.scored_at ?? ''),
    });
    if (out.length >= maxSignals) break;
  }

  return out;
}
