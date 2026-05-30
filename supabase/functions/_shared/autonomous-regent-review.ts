/**
 * REGENT — resident operating intelligence, as an autonomous bot (runtime glue).
 *
 * The deterministic executive faculties live in the dependency-free, unit-tested
 * package `@r2/regent` (packages/r2-regent/src/review.ts). This module adds only
 * the two pieces that need the Deno/Supabase runtime:
 *   - buildLiveWorldStateFromDb: derive a world-state from the live Eigen feed
 *     when the caller supplies none (financials stay UNSOURCED — invariant #2);
 *   - emitRegentReviewSignal: the single advisory side effect — insert one
 *     platform_feed_item and enqueue processing. No transactional client exists.
 */

import { buildSourceSignalKey } from './signal-utils.ts';
import { getServiceClient } from './supabase.ts';
import {
  buildRegentReview,
  type Domain,
  type RegentDecision,
  type RegentReview,
  type RepoAsset,
  type WorldState,
} from '../../../packages/r2-regent/src/review.ts';

export {
  buildRegentReview,
  type Domain,
  type RegentDecision,
  type RegentReview,
  type RepoAsset,
  type WorldState,
};

// --------------------------------------------------------------------------- //
// Live world-state from the Eigen database (when no state is supplied)         //
// --------------------------------------------------------------------------- //

const SOURCE_DOMAIN: Record<string, { domain_key: string; series: string }> = {
  centralr2: { domain_key: 'platform_core', series: 'A' },
  operator_workbench: { domain_key: 'autonomous_ops', series: 'E' },
  r2_works: { domain_key: 'autonomous_ops', series: 'E' },
  autonomous_bot_os: { domain_key: 'autonomous_ops', series: 'E' },
  r2chart: { domain_key: 'platform_core', series: 'A' },
  continuity_nexus: { domain_key: 'platform_core', series: 'A' },
  ip_pulse_point: { domain_key: 'ip_patent', series: 'C' },
  rays_retreat: { domain_key: 'retreat_commerce', series: 'D' },
};

const DOMAIN_META: Record<string, { name: string; series: string; stage: string; role: string }> = {
  platform_core: { name: 'Platform Core', series: 'A', stage: 'build', role: 'core' },
  health_wellness: { name: 'Health & Wellness', series: 'B', stage: 'revenue', role: 'bet' },
  ip_patent: { name: 'IP & Patent Intelligence', series: 'C', stage: 'revenue', role: 'bet' },
  retreat_commerce: { name: 'Retreat & Commerce', series: 'D', stage: 'revenue', role: 'bet' },
  autonomous_ops: { name: 'Autonomous Ops', series: 'E', stage: 'pilot', role: 'core' },
  productivity_memory: {
    name: 'Productivity & Memory',
    series: 'foundation',
    stage: 'build',
    role: 'option',
  },
};

const UNSOURCED_FRESHNESS = 9999;

/**
 * Derive a world-state from live Eigen data when the caller supplies none.
 * Financials are NOT measurable from the feed, so they are left UNSOURCED
 * (every domain stale → excluded from scoring, gap named — invariant #2). The
 * real, observed signal is per-product feed freshness, surfaced as repo_assets
 * so the asset-review faculty can flag products that have gone quiet.
 */
export async function buildLiveWorldStateFromDb(
  client: ReturnType<typeof getServiceClient>,
): Promise<WorldState> {
  const c = client as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const sinceIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await c
    .from('platform_feed_items')
    .select('source_system,event_time,ingested_at')
    .gte('ingested_at', sinceIso)
    .order('ingested_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const latestBySource = new Map<string, string>();
  for (const row of (data ?? []) as Array<{
    source_system: string;
    event_time: string;
    ingested_at: string;
  }>) {
    if (!latestBySource.has(row.source_system)) {
      latestBySource.set(row.source_system, row.ingested_at ?? row.event_time);
    }
  }

  const repo_assets: RepoAsset[] = [];
  for (const [source, iso] of latestBySource) {
    const map = SOURCE_DOMAIN[source] ?? { domain_key: 'uncategorized', series: '—' };
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
    repo_assets.push({
      repo: source,
      domain_key: map.domain_key,
      series: map.series,
      last_commit_days: days,
      tracked_env_files: [],
    });
  }

  const domains: Domain[] = Object.entries(DOMAIN_META).map(([key, meta]) => ({
    key,
    name: meta.name,
    series: meta.series,
    stage: meta.stage,
    strategic_role: meta.role,
    ttm_revenue: 0,
    ttm_direct_cost: 0,
    monthly_burn: 0,
    invested_capital: 0,
    data_freshness_days: UNSOURCED_FRESHNESS,
    notes: 'financials UNSOURCED (excluded from scoring until feeds are wired).',
  }));

  return {
    _SYNTHETIC:
      'LIVE-DB DERIVED — financials are UNSOURCED (excluded from scoring); the observed signal is per-product feed freshness.',
    as_of: new Date().toISOString().slice(0, 10),
    principal: 'Ray Miller',
    cost_of_capital_pct: 18,
    runway_floor_months: 6,
    stale_after_days: 14,
    repo_stale_after_days: 30,
    treasury: { cash_on_hand: 0, committed_inflows: [] },
    funding: {
      active_phase: 1,
      phases: [
        {
          phase: 1,
          label: 'Formation & first proof',
          target_low: 250000,
          target_high: 750000,
          gate: '501(c)(3) recognition + first two OWSR publications cleared the Oracle boundary',
          gate_cleared: false,
        },
      ],
    },
    domains,
    repo_assets,
  };
}

// --------------------------------------------------------------------------- //
// Signal emission — advisory only (insert one feed item)                       //
// --------------------------------------------------------------------------- //

export async function emitRegentReviewSignal(input: {
  idempotencyKey: string;
  review: RegentReview;
  state: WorldState;
}): Promise<{ signal_id: string | null; status: number }> {
  const { review, state } = input;
  const sourceSystem = 'autonomous_bot_os';
  const top = review.agenda[0];
  const high = review.agenda.filter((d: RegentDecision) => d.severity >= 80).length;
  const corroborated = review.agenda.filter((d: RegentDecision) => d.corroborated).length;

  const envelope = {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: 'nickmiller-gif/R2',
    source_event_type: 'regent_executive_review',
    actor_meg_entity_id: null,
    related_entity_ids: [] as string[],
    event_time: new Date().toISOString(),
    summary: top
      ? `REGENT executive review: ${review.agenda.length} decisions (${high} high) — top: ${top.title}`
      : 'REGENT executive review: no decision cleared the threshold this week',
    raw_payload: {
      finding_kind: 'regent_executive_review',
      generator: 'autonomous-regent-review',
      advisory_only: true,
      as_of: state.as_of ?? null,
      unsourced_note: state._SYNTHETIC ?? null,
      agenda: review.agenda,
      deferred: review.deferred.map((d: RegentDecision) => d.title),
      stale_domains: review.staleDomains,
      treasury: {
        cash_on_hand: review.treasury.cash,
        monthly_burn: review.treasury.totalMonthlyBurn,
        runway_months:
          review.treasury.runwayMonths === Infinity
            ? null
            : Number(review.treasury.runwayMonths.toFixed(1)),
      },
      corroborated_count: corroborated,
    },
    confidence: top ? Number(Math.min(0.95, 0.6 + high * 0.05).toFixed(3)) : 0.9,
    privacy_level: 'operator',
    provenance: { tool: 'autonomous-regent-review', generated_at: new Date().toISOString() },
    routing_targets: ['operator_workbench'],
  };

  const sourceSignalKey = buildSourceSignalKey(
    sourceSystem,
    `regent_review:${input.idempotencyKey}`,
  );
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;

  const insertResult = await client
    .from('platform_feed_items')
    .insert({
      contract_version: envelope.contract_version,
      source_system: envelope.source_system,
      source_repo: envelope.source_repo,
      source_event_type: envelope.source_event_type,
      source_signal_key: sourceSignalKey,
      actor_meg_entity_id: envelope.actor_meg_entity_id,
      related_entity_ids: envelope.related_entity_ids,
      event_time: envelope.event_time,
      summary: envelope.summary,
      payload: envelope.raw_payload,
      confidence: envelope.confidence,
      privacy_level: envelope.privacy_level,
      provenance: envelope.provenance,
      routing_targets: envelope.routing_targets,
    })
    .select('id')
    .single();

  let signalId: string | null = null;
  if (!insertResult.error && insertResult.data?.id) {
    signalId = insertResult.data.id as string;
  } else if (insertResult.error && (insertResult.error as { code?: string }).code === '23505') {
    const existing = await client
      .from('platform_feed_items')
      .select('id')
      .eq('source_signal_key', sourceSignalKey)
      .maybeSingle();
    if (existing.error || !existing.data?.id) {
      throw new Error(existing.error?.message ?? 'Failed to resolve idempotent replay');
    }
    signalId = existing.data.id as string;
  } else {
    throw new Error(insertResult.error?.message ?? 'Failed to insert REGENT review signal');
  }

  const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
  if (enqueue.error) throw new Error(enqueue.error.message);

  return { signal_id: signalId, status: 202 };
}
