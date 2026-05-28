import { completeLlmChat } from './llm-chat.ts';
import { fetchSourceInventory } from './source-inventory.ts';
import { buildSourceSignalKey } from './signal-utils.ts';
import { getServiceClient } from './supabase.ts';
import type { KbDriverId } from './autonomous-scout-drivers.ts';

export type InformationFinding = {
  finding_id: string;
  check_type:
    | 'missing_live_traffic'
    | 'stale_live_traffic'
    | 'missing_corpus'
    | 'missing_field'
    | 'unresolved_meg'
    | 'verification_gap'
    | 'missing_promotion'
    | 'missing_evidence';
  severity: 'low' | 'medium' | 'high';
  target_kb_driver: KbDriverId | 'portfolio';
  resource_type: string;
  resource_id?: string | null;
  field_path: string;
  status: 'missing' | 'stale' | 'invalid' | 'unchecked';
  observed: string;
  expected: string;
  suggested_fill_action: string;
  auto_fillable: boolean;
};

type DriverSpec = {
  id: KbDriverId;
  label: string;
  sourceSystems: string[];
  liveEventTypes: string[];
  corpusSourceSystems: string[];
  smokeEventTypes: string[];
};

export const KB_AUDIT_DRIVERS: DriverSpec[] = [
  {
    id: 'centralr2',
    label: 'CentralR2',
    sourceSystems: ['centralr2'],
    liveEventTypes: [
      'knowledge_event',
      'client_enriched',
      'rental_analysis',
      'property_lookup',
      'mesh_signal_correlated',
      'valuation_scenario',
    ],
    corpusSourceSystems: ['centralr2'],
    smokeEventTypes: ['stream_a_closeout', 'kb_four_smoke', 'r2.signal.ingest.probe'],
  },
  {
    id: 'r2chart',
    label: 'R2Chart',
    sourceSystems: ['r2chart', 'continuity_nexus'],
    liveEventTypes: ['ingest_probe', 'continuity_signal', 'charter_ingest'],
    corpusSourceSystems: ['r2chart', 'continuity_nexus'],
    smokeEventTypes: ['kb_four_smoke'],
  },
  {
    id: 'ip_pulse_point',
    label: 'R2-IP',
    sourceSystems: ['ip_pulse_point'],
    liveEventTypes: [
      'patent_analysis_complete',
      'ip_analysis_complete',
      'ip_analysis_completed',
      'analysis_complete',
    ],
    corpusSourceSystems: ['ip_pulse_point'],
    smokeEventTypes: ['kb_four_smoke'],
  },
  {
    id: 'operator_workbench',
    label: 'R2Works',
    sourceSystems: ['operator_workbench', 'r2_works'],
    liveEventTypes: [
      'friction_collapse_emitted',
      'friction_collapse_draft',
      'friction_collapse_validated',
      'friction_zero',
    ],
    corpusSourceSystems: ['operator_workbench', 'r2_works'],
    smokeEventTypes: ['kb_four_smoke'],
  },
];

const MEG_SENSITIVE_TYPES = new Set([
  'mesh_signal_correlated',
  'rental_analysis',
  'property_lookup',
  'valuation_scenario',
  'patent_analysis_complete',
  'continuity_signal',
]);

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_MS = 48 * 60 * 60 * 1000;

function findingId(parts: string[]): string {
  return parts.join(':');
}

type FeedRow = {
  id: string;
  source_system: string;
  source_event_type: string;
  event_time: string;
  ingested_at: string;
  actor_meg_entity_id: string | null;
  related_entity_ids: unknown;
  summary: string;
};

export async function runDeterministicInformationAudit(): Promise<{
  findings: InformationFinding[];
  checks_run: string[];
  verified_count: number;
}> {
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const findings: InformationFinding[] = [];
  const checks_run: string[] = [];
  let verified_count = 0;
  const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString();

  checks_run.push('kb_four_live_traffic');
  for (const driver of KB_AUDIT_DRIVERS) {
    const { data, error } = await client
      .from('platform_feed_items')
      .select(
        'id,source_system,source_event_type,event_time,ingested_at,actor_meg_entity_id,related_entity_ids,summary',
      )
      .in('source_system', driver.sourceSystems)
      .gte('ingested_at', sinceIso)
      .order('ingested_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as FeedRow[];
    const liveRows = rows.filter(
      (row) =>
        driver.liveEventTypes.includes(row.source_event_type) &&
        !driver.smokeEventTypes.includes(row.source_event_type),
    );

    if (liveRows.length === 0) {
      findings.push({
        finding_id: findingId(['traffic', driver.id, 'missing']),
        check_type: 'missing_live_traffic',
        severity: 'high',
        target_kb_driver: driver.id,
        resource_type: 'platform_feed_items',
        field_path: 'source_event_type',
        status: 'missing',
        observed: `0 live events in 7d (expected one of: ${driver.liveEventTypes.join(', ')})`,
        expected: `At least one published ${driver.label} producer event`,
        suggested_fill_action:
          driver.id === 'centralr2'
            ? 'Publish CentralR2 and run rental-analysis or property-lookup in production.'
            : driver.id === 'ip_pulse_point'
              ? 'Complete a patent analysis in R2-IP and redeploy ip-router after Lovable secret sync.'
              : driver.id === 'r2chart'
                ? 'Run continuity-ingest-signal probe signed in as charter operator.'
                : 'Emit friction_zero from R2Works Friction Zero after VITE_SUPABASE_URL is set on Lovable.',
        auto_fillable: false,
      });
    } else {
      verified_count += 1;
      const latest = liveRows[0]!;
      const ageMs = Date.now() - new Date(latest.ingested_at).getTime();
      if (ageMs > STALE_MS) {
        findings.push({
          finding_id: findingId(['traffic', driver.id, 'stale']),
          check_type: 'stale_live_traffic',
          severity: 'medium',
          target_kb_driver: driver.id,
          resource_type: 'platform_feed_items',
          resource_id: latest.id,
          field_path: 'ingested_at',
          status: 'stale',
          observed: `Latest live event ${latest.source_event_type} ingested ${latest.ingested_at}`,
          expected: 'Live traffic within the last 48 hours',
          suggested_fill_action: `Trigger a fresh ${driver.label} producer action and confirm row on /today.`,
          auto_fillable: false,
        });
      }
    }

    checks_run.push(`meg_resolution:${driver.id}`);
    const megRows = liveRows.filter((row) => MEG_SENSITIVE_TYPES.has(row.source_event_type));
    for (const row of megRows.slice(0, 12)) {
      const related = Array.isArray(row.related_entity_ids) ? row.related_entity_ids : [];
      if (!row.actor_meg_entity_id) {
        findings.push({
          finding_id: findingId(['meg', row.id, 'actor']),
          check_type: 'unresolved_meg',
          severity: 'medium',
          target_kb_driver: driver.id,
          resource_type: 'platform_feed_items',
          resource_id: row.id,
          field_path: 'actor_meg_entity_id',
          status: 'missing',
          observed: 'null',
          expected: 'meg:property or resolved actor UUID after MEG stage',
          suggested_fill_action:
            'Run meg-backfill smoke on Eigen or replay feed item after MEG resolve migration.',
          auto_fillable: false,
        });
      } else {
        verified_count += 1;
      }
      if (MEG_SENSITIVE_TYPES.has(row.source_event_type) && related.length === 0) {
        findings.push({
          finding_id: findingId(['meg', row.id, 'related']),
          check_type: 'missing_field',
          severity: 'low',
          target_kb_driver: driver.id,
          resource_type: 'platform_feed_items',
          resource_id: row.id,
          field_path: 'related_entity_ids',
          status: 'missing',
          observed: '[]',
          expected: 'At least one related MEG entity id for cross-graph linking',
          suggested_fill_action:
            'Verify producer emits related_entity_ids; replay processing if MEG resolve succeeded.',
          auto_fillable: false,
        });
      }
    }
  }

  checks_run.push('corpus_inventory');
  const inventory = await fetchSourceInventory(client, 'all');
  for (const driver of KB_AUDIT_DRIVERS) {
    const docCount = inventory.sources
      .filter((s) => driver.corpusSourceSystems.includes(s.source_system))
      .reduce((sum, s) => sum + s.document_count, 0);
    const chunkCount = inventory.sources
      .filter((s) => driver.corpusSourceSystems.includes(s.source_system))
      .reduce((sum, s) => sum + s.chunk_count, 0);

    if (docCount === 0) {
      findings.push({
        finding_id: findingId(['corpus', driver.id, 'documents']),
        check_type: 'missing_corpus',
        severity: 'high',
        target_kb_driver: driver.id,
        resource_type: 'documents',
        field_path: 'source_system',
        status: 'missing',
        observed: '0 documents',
        expected: `Ingested knowledge documents for ${driver.corpusSourceSystems.join(' or ')}`,
        suggested_fill_action:
          'Run Atlas/eigen-ingest for the brand or capture via autonomous-capture-ingest with operator review.',
        auto_fillable: false,
      });
    } else {
      verified_count += 1;
    }

    if (docCount > 0 && chunkCount === 0) {
      findings.push({
        finding_id: findingId(['corpus', driver.id, 'chunks']),
        check_type: 'missing_corpus',
        severity: 'high',
        target_kb_driver: driver.id,
        resource_type: 'knowledge_chunks',
        field_path: 'document_id',
        status: 'missing',
        observed: '0 chunks for driver documents',
        expected: 'Chunked knowledge for retrieval',
        suggested_fill_action: 'Re-run eigen-ingest chunking pipeline for pending documents.',
        auto_fillable: false,
      });
    }
  }

  checks_run.push('meg_entity_catalog');
  const { count: megCount, error: megError } = await client
    .from('meg_entities')
    .select('id', { count: 'exact', head: true });
  if (megError) throw new Error(megError.message);
  if ((megCount ?? 0) < 5) {
    findings.push({
      finding_id: findingId(['meg', 'catalog', 'sparse']),
      check_type: 'verification_gap',
      severity: 'medium',
      target_kb_driver: 'portfolio',
      resource_type: 'meg_entities',
      field_path: 'row_count',
      status: 'missing',
      observed: String(megCount ?? 0),
      expected: 'Sparse catalog populated (MEG backfill or live producer resolves)',
      suggested_fill_action:
        'Run meg-backfill-platform-feed-smoke with MEG_BACKFILL_BEARER on Eigen.',
      auto_fillable: false,
    });
  } else {
    verified_count += 1;
  }

  return { findings, checks_run, verified_count };
}

export function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) {
    const match = trimmed.match(/```json\s*([\s\S]*?)```/i);
    if (match?.[1]) return match[1].trim();
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  }
  return trimmed;
}

export async function enrichFindingsWithLlm(
  findings: InformationFinding[],
): Promise<InformationFinding[]> {
  if (findings.length === 0) return findings;

  const prompt = [
    'You are an operator information auditor. Given JSON findings, return the same array shape with clearer suggested_fill_action strings (one imperative sentence each).',
    'Do not invent new findings. Do not remove findings. Keep finding_id, check_type, severity, field_path, status, observed, expected unchanged.',
    'Set auto_fillable true only when the action is "replay platform feed processing" or "re-queue retrieval run" — otherwise false.',
    '',
    JSON.stringify({ findings }, null, 2),
  ].join('\n');

  try {
    const completion = await completeLlmChat({
      provider: 'openai',
      systemPrompt: 'Return strictly JSON: { "findings": [...] }',
      userContent: prompt,
      maxTokens: 2000,
      temperature: 0.1,
    });
    const parsed = JSON.parse(extractJsonCandidate(completion.text)) as {
      findings?: InformationFinding[];
    };
    if (Array.isArray(parsed.findings) && parsed.findings.length === findings.length) {
      return parsed.findings;
    }
  } catch {
    // fall through to deterministic findings
  }
  return findings;
}

export async function emitInformationAuditSignal(input: {
  idempotencyKey: string;
  findings: InformationFinding[];
  checks_run: string[];
  verified_count: number;
  enrich_with_llm: boolean;
}): Promise<{ signal_id: string | null; status: number }> {
  const findings = input.enrich_with_llm
    ? await enrichFindingsWithLlm(input.findings)
    : input.findings;

  const missing_count = findings.length;
  const sourceSystem = 'autonomous_bot_os';
  const highCount = findings.filter((f) => f.severity === 'high').length;

  const envelope = {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: 'nickmiller-gif/R2',
    source_event_type: 'bot_finding_published',
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: new Date().toISOString(),
    summary:
      missing_count === 0
        ? 'Information audit: all checks passed'
        : `Information audit: ${missing_count} gap(s) found (${highCount} high)`,
    raw_payload: {
      finding_kind: 'information_gap_audit',
      findings,
      checks_run: input.checks_run,
      verified_count: input.verified_count,
      missing_count,
      generator: 'autonomous-information-audit',
    },
    confidence:
      missing_count === 0 ? 0.95 : Number(Math.max(0.5, 0.9 - highCount * 0.08).toFixed(3)),
    privacy_level: 'operator',
    provenance: {
      tool: 'autonomous-information-audit',
      generated_at: new Date().toISOString(),
    },
    routing_targets: ['operator_workbench'],
  };

  const sourceSignalKey = buildSourceSignalKey(sourceSystem, `info_audit:${input.idempotencyKey}`);
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
    throw new Error(insertResult.error?.message ?? 'Failed to insert audit signal');
  }

  const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
  if (enqueue.error) throw new Error(enqueue.error.message);

  return { signal_id: signalId, status: 202 };
}

export async function autoRemediateFindings(
  findings: InformationFinding[],
): Promise<Array<{ finding_id: string; action: string; ok: boolean; detail?: string }>> {
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const results: Array<{ finding_id: string; action: string; ok: boolean; detail?: string }> = [];

  for (const finding of findings.filter((f) => f.auto_fillable)) {
    if (
      finding.check_type === 'verification_gap' &&
      finding.field_path === 'retrieval_runs.failed'
    ) {
      const { error } = await client
        .from('retrieval_runs')
        .update({ status: 'pending' })
        .eq('status', 'failed');
      results.push({
        finding_id: finding.finding_id,
        action: 'requeue_failed_retrieval_runs',
        ok: !error,
        detail: error?.message,
      });
      continue;
    }
    if (finding.resource_type === 'platform_feed_items' && finding.resource_id) {
      const enqueue = await client.rpc('enqueue_platform_feed_processing', {
        signal_id: finding.resource_id,
      });
      results.push({
        finding_id: finding.finding_id,
        action: 'replay_feed_processing',
        ok: !enqueue.error,
        detail: enqueue.error?.message,
      });
    }
  }

  return results;
}

/** Marks failed retrieval runs as auto-fillable when present. */
export {
  buildCorpusFindingsForStewardDrivers,
  filterInformationFindingsForStewardCluster,
  mergeInformationFindings,
} from '../../../packages/r2-steward/src/audit-scope.ts';

export async function appendRetrievalRunFindings(
  findings: InformationFinding[],
): Promise<InformationFinding[]> {
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const { count, error } = await client
    .from('retrieval_runs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed');
  if (error) throw new Error(error.message);
  if ((count ?? 0) === 0) return findings;

  return [
    ...findings,
    {
      finding_id: findingId(['retrieval', 'failed']),
      check_type: 'verification_gap',
      severity: 'medium',
      target_kb_driver: 'portfolio',
      resource_type: 'retrieval_runs',
      field_path: 'retrieval_runs.failed',
      status: 'invalid',
      observed: String(count),
      expected: '0 failed retrieval runs',
      suggested_fill_action: 'Re-queue failed retrieval runs (auto-fillable).',
      auto_fillable: true,
    },
  ];
}
