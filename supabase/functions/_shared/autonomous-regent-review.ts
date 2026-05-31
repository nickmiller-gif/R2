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
  applyFinancials,
  buildExecutiveTeam,
  buildRegentReview,
  type AgentActivity,
  type Domain,
  type ExecutiveTeamReview,
  type PriorAgendaItem,
  type RegentDecision,
  type RegentFinancials,
  type RegentReview,
  type RepoAsset,
  type WorldState,
} from '../../../packages/r2-regent/src/review.ts';

export {
  applyFinancials,
  buildExecutiveTeam,
  buildRegentReview,
  type AgentActivity,
  type Domain,
  type ExecutiveTeamReview,
  type PriorAgendaItem,
  type RegentDecision,
  type RegentFinancials,
  type RegentReview,
  type RepoAsset,
  type WorldState,
};

/**
 * The previous week's agenda (titles + severities) AND accumulated ages from
 * the last regent_executive_review signal — REGENT's institutional memory for
 * the diff and outcome scoring.
 */
export async function fetchPreviousRegentReview(
  client: ReturnType<typeof getServiceClient>,
): Promise<{ agenda: PriorAgendaItem[]; ages: Record<string, number> } | null> {
  const c = client as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const { data, error } = await c
    .from('platform_feed_items')
    .select('payload')
    .eq('source_system', 'autonomous_bot_os')
    .eq('source_event_type', 'regent_executive_review')
    .order('ingested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const payload = data.payload as {
    agenda?: Array<{ title?: unknown; severity?: unknown }>;
    agenda_ages?: Record<string, unknown>;
  };
  if (!Array.isArray(payload?.agenda)) return null;
  const agenda = payload.agenda
    .map((a) => ({
      title: typeof a.title === 'string' ? a.title : '',
      severity: typeof a.severity === 'number' ? a.severity : 0,
    }))
    .filter((a) => a.title);
  const ages: Record<string, number> = {};
  if (payload.agenda_ages && typeof payload.agenda_ages === 'object') {
    for (const [k, v] of Object.entries(payload.agenda_ages)) {
      if (typeof v === 'number') ages[k] = v;
    }
  }
  return { agenda, ages };
}

/**
 * Load the latest principal-attested financial inputs from regent_world_state.
 * Returns null when the table is empty — financials then stay UNSOURCED and the
 * faculties name the gap rather than guess (invariant #2).
 */
export async function loadRegentFinancials(
  client: ReturnType<typeof getServiceClient>,
): Promise<RegentFinancials | null> {
  const c = client as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const { data, error } = await c
    .from('regent_world_state')
    .select(
      'as_of,cash_on_hand,cost_of_capital_pct,runway_floor_months,domains,committed_inflows,funding,source',
    )
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Table absent or unreadable — treat as unsourced, do not fail the run.
    return null;
  }
  if (!data) return null;
  return {
    as_of: typeof data.as_of === 'string' ? data.as_of : undefined,
    cash_on_hand: typeof data.cash_on_hand === 'number' ? data.cash_on_hand : undefined,
    cost_of_capital_pct:
      typeof data.cost_of_capital_pct === 'number' ? data.cost_of_capital_pct : undefined,
    runway_floor_months:
      typeof data.runway_floor_months === 'number' ? data.runway_floor_months : undefined,
    committed_inflows: Array.isArray(data.committed_inflows) ? data.committed_inflows : undefined,
    domains: Array.isArray(data.domains) ? data.domains : undefined,
    funding: data.funding ?? undefined,
    source: typeof data.source === 'string' ? data.source : 'regent_world_state',
  };
}

/**
 * The Chief of Staff's view of the rest of the fleet: recent autonomous-bot
 * signals grouped by generator. Excludes REGENT itself so it does not reconcile
 * its own output.
 */
export async function fetchAgentActivity(
  client: ReturnType<typeof getServiceClient>,
  opts: { excludeBot?: string | null } = {},
): Promise<AgentActivity[]> {
  // The Chief of Staff must not reconcile REGENT against itself, so the default
  // excludes it. The fleet-health watchdog passes excludeBot: null to include
  // REGENT (it needs to confirm REGENT is itself running).
  const excludeBot = opts.excludeBot === undefined ? 'autonomous-regent-review' : opts.excludeBot;
  const c = client as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await c
    .from('platform_feed_items')
    .select('source_event_type,provenance,payload,ingested_at')
    .eq('source_system', 'autonomous_bot_os')
    .gte('ingested_at', sinceIso)
    .order('ingested_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const byBot = new Map<string, { last: string; count: number; domains: Set<string> }>();
  for (const row of (data ?? []) as Array<{
    source_event_type: string;
    provenance: { tool?: string } | null;
    payload: Record<string, unknown> | null;
    ingested_at: string;
  }>) {
    const tool = row.provenance?.tool ?? row.source_event_type ?? 'unknown';
    if (excludeBot && tool === excludeBot) continue;
    const cur = byBot.get(tool);
    const entry = cur ?? { last: row.ingested_at, count: 0, domains: new Set<string>() };
    entry.count += 1;
    for (const d of extractPeerDomains(row.source_event_type, row.payload)) entry.domains.add(d);
    byBot.set(tool, entry);
  }

  const out: AgentActivity[] = [];
  for (const [bot, v] of byBot) {
    const days = Math.max(0, Math.floor((Date.now() - new Date(v.last).getTime()) / 86_400_000));
    out.push({ bot, last_seen_days: days, recent_count: v.count, domains: [...v.domains] });
  }
  return out;
}

// Map a KB-driver / source literal to the six-domain key, so peer-bot findings
// can be reconciled against the REGENT agenda by domain.
const DRIVER_DOMAIN: Record<string, string> = {
  centralr2: 'platform_core',
  r2chart: 'platform_core',
  continuity_nexus: 'platform_core',
  ip_pulse_point: 'ip_patent',
  operator_workbench: 'autonomous_ops',
  r2_works: 'autonomous_ops',
  rays_retreat: 'retreat_commerce',
  portfolio: 'platform_core',
};

/** Extract the domain keys a peer bot's signal touches, from its known payload shapes. */
function extractPeerDomains(eventType: string, payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const out = new Set<string>();
  const add = (driver: unknown) => {
    if (typeof driver === 'string' && DRIVER_DOMAIN[driver]) out.add(DRIVER_DOMAIN[driver]);
  };
  // information-audit: { findings: [{ target_kb_driver }] }
  if (Array.isArray(payload.findings)) {
    for (const f of payload.findings as Array<Record<string, unknown>>) add(f?.target_kb_driver);
  }
  // steward brief: { domains: [driver] }
  if (Array.isArray(payload.domains)) for (const d of payload.domains) add(d);
  // revolutionary mesh: { patterns: [{ domains: [driver] }] }
  if (Array.isArray(payload.patterns)) {
    for (const p of payload.patterns as Array<Record<string, unknown>>) {
      if (Array.isArray(p?.domains)) for (const d of p.domains) add(d);
    }
  }
  // upgrade scout: { target_kb_driver }
  add(payload.target_kb_driver);
  return [...out];
}

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
  review: ExecutiveTeamReview;
  state: WorldState;
}): Promise<{ signal_id: string | null; status: number }> {
  const { review, state } = input;
  const sourceSystem = 'autonomous_bot_os';
  const top = review.agenda[0];
  const high = review.agenda.filter((d: RegentDecision) => d.severity >= 80).length;
  const corroborated = review.agenda.filter((d: RegentDecision) => d.corroborated).length;
  const actingRoles = review.roles.filter((r) => r.posture === 'act').map((r) => r.role);

  const envelope = {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: 'nickmiller-gif/R2',
    source_event_type: 'regent_executive_review',
    actor_meg_entity_id: null,
    related_entity_ids: [] as string[],
    event_time: new Date().toISOString(),
    summary: top
      ? `REGENT executive team: ${review.agenda.length} decisions (${high} high), ${actingRoles.length} exec(s) acting — top: ${top.title}`
      : 'REGENT executive team: no decision cleared the threshold this week',
    raw_payload: {
      finding_kind: 'regent_executive_review',
      generator: 'autonomous-regent-review',
      advisory_only: true,
      as_of: state.as_of ?? null,
      unsourced_note: state._SYNTHETIC ?? null,
      agenda: review.agenda,
      deferred: review.deferred.map((d: RegentDecision) => d.title),
      stale_domains: review.staleDomains,
      // The executive team: each member's memo, cross-desk tensions, and the
      // Chief of Staff's synthesis.
      executive_team: review.roles,
      tensions: review.tensions,
      chief_of_staff: review.chief_of_staff,
      delta: review.delta ?? null,
      outcomes: review.outcomes ?? null,
      agenda_ages: review.agenda_ages ?? {},
      counsel_queue: review.counsel_queue ?? [],
      acting_roles: actingRoles,
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
