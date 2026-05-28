import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  sanitizeMegResolveRpcArgs,
  type FeedRowForMeg,
  type MegResolveRpcArgs,
} from './meg-resolve-signal.ts';

/** KB-four producers that participate in cross-domain MEG portfolio linkage. */
export const KB_FOUR_SOURCE_SYSTEMS = new Set([
  'centralr2',
  'operator_workbench',
  'r2_works',
  'r2chart',
  'continuity_nexus',
  'ip_pulse_point',
]);

const PORTFOLIO_ANCHOR_EXTERNAL_ID = 'kb_four:r2:portfolio';
const PORTFOLIO_ANCHOR_NAME = 'R2 KB-four portfolio';

export function isKbFourSourceSystem(sourceSystem: string): boolean {
  return KB_FOUR_SOURCE_SYSTEMS.has(sourceSystem);
}

export function kbFourPortfolioAnchorResolveArgs(feedRowId: string): MegResolveRpcArgs {
  return {
    p_entity_type: 'meg:concept',
    p_canonical_name: PORTFOLIO_ANCHOR_NAME,
    p_canonical_email: null,
    p_canonical_external_id: PORTFOLIO_ANCHOR_EXTERNAL_ID,
    p_source_system: 'r2',
    p_source_table: 'platform_feed_items',
    p_source_row_id: `${feedRowId}:kb_four_portfolio_anchor`,
    p_payload: { kb_four_portfolio_anchor: true },
  };
}

export function collectResolvedMegIdsFromRow(row: FeedRowForMeg): string[] {
  const ids = new Set<string>();
  const actor = row.actor_meg_entity_id?.trim();
  if (actor && isUuid(actor)) ids.add(actor);
  if (Array.isArray(row.related_entity_ids)) {
    for (const entry of row.related_entity_ids) {
      if (typeof entry === 'string' && isUuid(entry.trim())) ids.add(entry.trim());
    }
  }
  return [...ids];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Links every resolved MEG on a KB-four feed row to the shared portfolio anchor via
 * `affiliated_with` edges so steward union-find can see cross-driver patterns.
 */
export async function linkKbFourPortfolioAnchor(
  client: SupabaseClient,
  row: FeedRowForMeg,
): Promise<void> {
  if (!isKbFourSourceSystem(row.source_system)) return;

  const megIds = collectResolvedMegIdsFromRow(row);
  if (megIds.length === 0) return;

  const { data: anchorId, error: anchorError } = await client.rpc(
    'meg_resolve_or_create',
    sanitizeMegResolveRpcArgs(kbFourPortfolioAnchorResolveArgs(row.id)),
  );
  if (anchorError) {
    throw new Error(`meg_resolve_or_create kb_four anchor: ${anchorError.message}`);
  }
  if (!anchorId || !isUuid(String(anchorId))) {
    throw new Error('meg_resolve_or_create kb_four anchor returned empty');
  }
  const anchor = String(anchorId);

  for (const targetId of megIds) {
    if (targetId === anchor) continue;
    const { error } = await client.rpc('meg_link_entities', {
      p_source_entity_id: anchor,
      p_target_entity_id: targetId,
      p_edge_type: 'affiliated_with',
      p_metadata: {
        kb_four_portfolio_anchor: true,
        platform_feed_item_id: row.id,
        source_system: row.source_system,
        source_event_type: row.source_event_type,
      },
    });
    if (error) {
      throw new Error(`meg_link_entities kb_four: ${error.message}`);
    }
  }

  const related = new Set(collectResolvedMegIdsFromRow(row));
  related.add(anchor);
  const nextRelated = [...related];
  const { error: updError } = await client
    .from('platform_feed_items')
    .update({ related_entity_ids: nextRelated })
    .eq('id', row.id);
  if (updError) {
    throw new Error(`platform_feed_items related_entity_ids: ${updError.message}`);
  }
}
