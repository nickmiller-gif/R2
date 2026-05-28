import { completeLlmChat } from './llm-chat.ts';
import { buildSourceSignalKey } from './signal-utils.ts';
import { getServiceClient } from './supabase.ts';
import type { KbDriverId } from '../../../packages/r2-steward/src/cluster.ts';
import {
  buildClustersFromRows,
  countsTowardKbDriver,
  type MegEdge,
  type StewardFeedRow,
} from '../../../packages/r2-steward/src/cluster.ts';
import {
  autoRemediateFindings,
  buildCorpusFindingsForStewardDrivers,
  filterInformationFindingsForStewardCluster,
  mergeInformationFindings,
  runDeterministicInformationAudit,
  type InformationFinding,
} from './autonomous-information-audit.ts';
import { extractJsonCandidate } from './autonomous-information-audit.ts';
import { fetchSourceInventory } from './source-inventory.ts';

export {
  buildClustersFromRows,
  countsTowardKbDriver,
  extractMegIdsFromRow,
  UnionFind,
} from '../../../packages/r2-steward/src/cluster.ts';

export type StewardRecommendedAction =
  | 'promote_to_truth_market'
  | 'open_convergence'
  | 'capture_url'
  | 'producer_trigger'
  | 'replay_feed_processing';

export type StewardPatternCluster = {
  pattern_id: string;
  meg_entity_ids: string[];
  domains: KbDriverId[];
  signal_ids: string[];
  evidence_sample: Array<{ feed_item_id: string; summary: string; source_system: string }>;
  findings: InformationFinding[];
  completeness_score: number;
  narrative: string;
  recommended_actions: StewardRecommendedAction[];
};

const LOOKBACK_DAYS = 30;

/** Source systems scanned for steward clustering (includes autonomous_bot_os for context). */
export const STEWARD_FEED_SOURCES = [
  'centralr2',
  'operator_workbench',
  'r2_works',
  'r2chart',
  'continuity_nexus',
  'ip_pulse_point',
  'autonomous_bot_os',
] as const;

function buildPatternFindings(
  cluster: { megIds: Set<string>; rows: StewardFeedRow[]; drivers: Set<KbDriverId> },
  patternIndex: number,
): InformationFinding[] {
  const findings: InformationFinding[] = [];
  const megList = Array.from(cluster.megIds);

  const missingActor = cluster.rows.filter(
    (r) =>
      countsTowardKbDriver(r.source_system, r.source_event_type) && !r.actor_meg_entity_id?.trim(),
  );
  if (missingActor.length > 0) {
    findings.push({
      finding_id: `steward:${patternIndex}:meg:actor`,
      check_type: 'unresolved_meg',
      severity: 'medium',
      target_kb_driver: 'portfolio',
      resource_type: 'platform_feed_items',
      resource_id: missingActor[0]!.id,
      field_path: 'actor_meg_entity_id',
      status: 'missing',
      observed: `${missingActor.length} signal(s) without actor MEG`,
      expected: 'Resolved actor_meg_entity_id on KB-four producer rows',
      suggested_fill_action: 'Run MEG backfill or replay feed processing for unresolved rows.',
      auto_fillable: true,
    });
  }

  const needsReview = cluster.rows.filter((r) => r.autonomy_decision === 'needs_review');
  if (needsReview.length > 0) {
    findings.push({
      finding_id: `steward:${patternIndex}:promotion:review`,
      check_type: 'missing_promotion',
      severity: 'low',
      target_kb_driver: 'portfolio',
      resource_type: 'platform_feed_items',
      resource_id: needsReview[0]!.id,
      field_path: 'autonomy_decision',
      status: 'missing',
      observed: `${needsReview.length} signal(s) awaiting operator review`,
      expected: 'Operator accept or promote to Truth Market / Convergence',
      suggested_fill_action:
        'Triage on Today and accept or promote high-confidence cluster signals.',
      auto_fillable: false,
    });
  }

  if (megList.length < 2) {
    findings.push({
      finding_id: `steward:${patternIndex}:meg:sparse`,
      check_type: 'missing_field',
      severity: 'low',
      target_kb_driver: 'portfolio',
      resource_type: 'meg_entities',
      field_path: 'related_entity_ids',
      status: 'missing',
      observed: String(megList.length),
      expected: 'Multiple linked MEG entities for cross-domain pattern',
      suggested_fill_action: 'Enrich producer payloads with related_entity_ids across drivers.',
      auto_fillable: false,
    });
  }

  return findings;
}

function defaultRecommendedActions(drivers: Set<KbDriverId>): StewardRecommendedAction[] {
  const actions: StewardRecommendedAction[] = ['open_convergence'];
  if (drivers.has('r2chart') || drivers.has('ip_pulse_point')) {
    actions.unshift('promote_to_truth_market');
  }
  if (drivers.has('centralr2')) actions.push('producer_trigger');
  actions.push('replay_feed_processing');
  return Array.from(new Set(actions));
}

function buildDeterministicNarrative(
  drivers: Set<KbDriverId>,
  megIds: string[],
  rowCount: number,
): string {
  const labels = Array.from(drivers).join(', ');
  return (
    `Cross-domain KB-four pattern across ${labels}: ${rowCount} linked signal(s) ` +
    `share MEG cluster (${megIds.slice(0, 3).join(', ')}${megIds.length > 3 ? '…' : ''}) in the last ${LOOKBACK_DAYS} days.`
  );
}

function computeCompletenessScore(findings: InformationFinding[], rowCount: number): number {
  const penalty = findings.reduce((sum, f) => {
    if (f.severity === 'high') return sum + 0.2;
    if (f.severity === 'medium') return sum + 0.1;
    return sum + 0.05;
  }, 0);
  const base = Math.min(1, 0.35 + rowCount * 0.05);
  return Number(Math.max(0.2, base - penalty).toFixed(3));
}

export async function fetchInfrastructureGapsViaAudit(
  serviceToken: string,
): Promise<InformationFinding[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  if (!supabaseUrl) return [];

  const hourBucket = new Date().toISOString().slice(0, 13);
  const response = await fetch(`${supabaseUrl}/functions/v1/autonomous-information-audit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      'Content-Type': 'application/json',
      'x-idempotency-key': `steward-pre-audit:${hourBucket}`,
    },
    body: JSON.stringify({ enrich_with_llm: false, auto_remediate: false, emit_when_clear: false }),
  });

  if (!response.ok) return [];
  const body = (await response.json().catch(() => ({}))) as { findings?: InformationFinding[] };
  return Array.isArray(body.findings) ? body.findings : [];
}

export async function runStewardCycle(input: {
  infrastructure_gaps?: InformationFinding[];
  enrich_with_llm?: boolean;
  skip_portfolio_audit?: boolean;
}): Promise<{
  patterns: StewardPatternCluster[];
  infrastructure_gaps: InformationFinding[];
  checks_run: string[];
  auto_remediations?: Array<{ finding_id: string; action: string; ok: boolean; detail?: string }>;
}> {
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const checks_run = ['fetch_kb_four_feed', 'meg_union_find_2hop', 'pattern_completeness'];

  let portfolioFindings = input.infrastructure_gaps ?? [];
  if (!input.skip_portfolio_audit && portfolioFindings.length === 0) {
    const audit = await runDeterministicInformationAudit();
    portfolioFindings = audit.findings;
    checks_run.push(...audit.checks_run);
  } else if (portfolioFindings.length > 0) {
    checks_run.push('infrastructure_gaps_prefetch');
  }

  checks_run.push('corpus_inventory');
  const inventory = await fetchSourceInventory(client, 'all');

  const clusteringSources = STEWARD_FEED_SOURCES.filter((s) => s !== 'autonomous_bot_os');
  const { data: feedData, error: feedError } = await client
    .from('platform_feed_items')
    .select(
      'id,source_system,source_event_type,summary,event_time,ingested_at,actor_meg_entity_id,related_entity_ids,autonomy_decision',
    )
    .in('source_system', [...clusteringSources])
    .gte('ingested_at', sinceIso)
    .order('ingested_at', { ascending: false })
    .limit(1500);
  if (feedError) throw new Error(feedError.message);

  const rows = (feedData ?? []) as StewardFeedRow[];

  const { data: edgeData, error: edgeError } = await client
    .from('meg_entity_edges')
    .select('source_entity_id,target_entity_id')
    .limit(2000);
  if (edgeError) throw new Error(edgeError.message);

  const edges = (edgeData ?? []) as MegEdge[];
  const clusters = buildClustersFromRows(rows, edges, { maxEdgeHops: 2 });
  const infrastructure_gaps = portfolioFindings;

  const patterns: StewardPatternCluster[] = [];
  const autoFillCandidates: InformationFinding[] = [];
  let index = 0;
  for (const cluster of clusters.slice(0, 5)) {
    const feedItemIds = new Set(cluster.rows.map((r) => r.id));
    const megEntityIds = new Set(cluster.megIds);
    const scopedAudit = filterInformationFindingsForStewardCluster(portfolioFindings, {
      drivers: cluster.drivers,
      feedItemIds,
      megEntityIds,
    });
    const corpusFindings = buildCorpusFindingsForStewardDrivers(inventory, cluster.drivers, index);
    const patternFindings = mergeInformationFindings(
      buildPatternFindings(cluster, index),
      scopedAudit,
      corpusFindings,
    );
    for (const finding of patternFindings) {
      if (finding.auto_fillable) autoFillCandidates.push(finding);
    }
    const domains = Array.from(cluster.drivers);
    const meg_entity_ids = Array.from(cluster.megIds).slice(0, 12);
    const evidence_sample = cluster.rows.slice(0, 8).map((r) => ({
      feed_item_id: r.id,
      summary: r.summary,
      source_system: r.source_system,
    }));

    let narrative = buildDeterministicNarrative(
      cluster.drivers,
      meg_entity_ids,
      cluster.rows.length,
    );
    let recommended_actions = defaultRecommendedActions(cluster.drivers);

    if (input.enrich_with_llm && Deno.env.get('STEWARD_LLM_ENRICH') === 'true') {
      try {
        const enriched = await enrichStewardBriefWithLlm({
          domains,
          meg_entity_ids,
          evidence_sample,
          findings: patternFindings,
        });
        if (enriched.narrative) narrative = enriched.narrative;
        if (enriched.recommended_actions?.length) {
          recommended_actions = enriched.recommended_actions;
        }
      } catch {
        // keep deterministic narrative
      }
    }

    patterns.push({
      pattern_id: `steward-pattern:${index}:${cluster.rootId.slice(0, 8)}`,
      meg_entity_ids,
      domains,
      signal_ids: cluster.rows.map((r) => r.id),
      evidence_sample,
      findings: patternFindings,
      completeness_score: computeCompletenessScore(patternFindings, cluster.rows.length),
      narrative,
      recommended_actions,
    });
    index += 1;
  }

  const auto_remediations =
    autoFillCandidates.length > 0 ? await autoRemediateFindings(autoFillCandidates) : [];

  return { patterns, infrastructure_gaps, checks_run, auto_remediations };
}

async function enrichStewardBriefWithLlm(input: {
  domains: KbDriverId[];
  meg_entity_ids: string[];
  evidence_sample: Array<{ feed_item_id: string; summary: string; source_system: string }>;
  findings: InformationFinding[];
}): Promise<{ narrative?: string; recommended_actions?: StewardRecommendedAction[] }> {
  const prompt = [
    'Summarize this cross-domain KB-four pattern for an operator in 2-3 sentences.',
    'Return JSON: { "narrative": string, "recommended_actions": string[] }',
    'recommended_actions must be subset of: promote_to_truth_market, open_convergence, capture_url, producer_trigger, replay_feed_processing',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n');

  const completion = await completeLlmChat({
    provider: 'openai',
    systemPrompt: 'Return only valid JSON.',
    userContent: prompt,
    maxTokens: 600,
    temperature: 0.2,
  });

  const parsed = JSON.parse(extractJsonCandidate(completion.text)) as {
    narrative?: string;
    recommended_actions?: string[];
  };
  const allowed = new Set<StewardRecommendedAction>([
    'promote_to_truth_market',
    'open_convergence',
    'capture_url',
    'producer_trigger',
    'replay_feed_processing',
  ]);
  const recommended_actions = (parsed.recommended_actions ?? []).filter(
    (a): a is StewardRecommendedAction => allowed.has(a as StewardRecommendedAction),
  );
  return { narrative: parsed.narrative, recommended_actions };
}

export async function emitStewardBriefSignals(input: {
  idempotencyKey: string;
  patterns: StewardPatternCluster[];
  infrastructure_gaps: InformationFinding[];
}): Promise<Array<{ pattern_id: string; signal_id: string | null }>> {
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const results: Array<{ pattern_id: string; signal_id: string | null }> = [];

  for (let i = 0; i < input.patterns.length; i++) {
    const pattern = input.patterns[i]!;
    const sourceSystem = 'autonomous_bot_os';
    const keySuffix = `${input.idempotencyKey}:pattern:${i}`;
    const sourceSignalKey = buildSourceSignalKey(sourceSystem, `steward_brief:${keySuffix}`);

    const envelope = {
      contract_version: '1.0.0',
      source_system: sourceSystem,
      source_repo: 'nickmiller-gif/R2',
      source_event_type: 'steward_brief_published',
      actor_meg_entity_id: pattern.meg_entity_ids[0] ?? null,
      related_entity_ids: pattern.meg_entity_ids,
      event_time: new Date().toISOString(),
      summary: `Eigen Steward: ${pattern.domains.join(' + ')} — ${pattern.narrative.slice(0, 120)}`,
      raw_payload: {
        pattern_id: pattern.pattern_id,
        domains: pattern.domains,
        meg_entity_ids: pattern.meg_entity_ids,
        narrative: pattern.narrative,
        completeness_score: pattern.completeness_score,
        findings: pattern.findings,
        recommended_actions: pattern.recommended_actions,
        evidence_sample: pattern.evidence_sample,
        infrastructure_gaps: i === 0 ? input.infrastructure_gaps : [],
        generator: 'autonomous-steward-cycle',
      },
      confidence: pattern.completeness_score,
      privacy_level: 'operator',
      provenance: {
        tool: 'autonomous-steward-cycle',
        generated_at: new Date().toISOString(),
      },
      routing_targets: ['operator_workbench'],
    };

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
      signalId = (existing.data?.id as string) ?? null;
    } else {
      throw new Error(insertResult.error?.message ?? 'Failed to insert steward brief');
    }

    if (signalId) {
      const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
      if (enqueue.error) throw new Error(enqueue.error.message);
    }

    results.push({ pattern_id: pattern.pattern_id, signal_id: signalId });
  }

  return results;
}
