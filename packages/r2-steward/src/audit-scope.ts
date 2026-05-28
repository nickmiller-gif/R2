import type { KbDriverId } from './cluster.ts';

export type StewardInformationFinding = {
  finding_id: string;
  check_type: string;
  severity: 'low' | 'medium' | 'high';
  target_kb_driver: KbDriverId | 'portfolio';
  resource_type: string;
  resource_id?: string | null;
  field_path: string;
  status: string;
  observed: string;
  expected: string;
  suggested_fill_action: string;
  auto_fillable: boolean;
};

export type SourceInventorySummary = {
  source_system: string;
  document_count: number;
  chunk_count: number;
};

export type SourceInventorySnapshot = {
  sources: SourceInventorySummary[];
};

const CORPUS_SYSTEMS_BY_DRIVER: Record<KbDriverId, string[]> = {
  centralr2: ['centralr2'],
  r2chart: ['r2chart', 'continuity_nexus'],
  ip_pulse_point: ['ip_pulse_point'],
  operator_workbench: ['operator_workbench', 'r2_works'],
};

function findingId(parts: string[]): string {
  return parts.join(':');
}

export function filterInformationFindingsForStewardCluster(
  findings: StewardInformationFinding[],
  scope: {
    drivers: Set<KbDriverId>;
    feedItemIds: Set<string>;
    megEntityIds: Set<string>;
  },
): StewardInformationFinding[] {
  return findings.filter((finding) => {
    if (finding.target_kb_driver !== 'portfolio' && scope.drivers.has(finding.target_kb_driver)) {
      return true;
    }
    if (finding.resource_id && scope.feedItemIds.has(finding.resource_id)) {
      return true;
    }
    if (
      finding.resource_type === 'meg_entities' &&
      finding.target_kb_driver === 'portfolio' &&
      scope.megEntityIds.size > 0
    ) {
      return true;
    }
    return false;
  });
}

export function buildCorpusFindingsForStewardDrivers(
  inventory: SourceInventorySnapshot,
  drivers: Set<KbDriverId>,
  patternIndex: number,
): StewardInformationFinding[] {
  const findings: StewardInformationFinding[] = [];
  for (const driver of drivers) {
    const systems = CORPUS_SYSTEMS_BY_DRIVER[driver];
    const docCount = inventory.sources
      .filter((s) => systems.includes(s.source_system))
      .reduce((sum, s) => sum + s.document_count, 0);
    const chunkCount = inventory.sources
      .filter((s) => systems.includes(s.source_system))
      .reduce((sum, s) => sum + s.chunk_count, 0);

    if (docCount === 0) {
      findings.push({
        finding_id: findingId(['steward', String(patternIndex), 'corpus', driver, 'documents']),
        check_type: 'missing_corpus',
        severity: 'high',
        target_kb_driver: driver,
        resource_type: 'documents',
        field_path: 'source_system',
        status: 'missing',
        observed: '0 documents in cluster driver corpus',
        expected: `Ingested knowledge documents for ${systems.join(' or ')}`,
        suggested_fill_action:
          'Run Atlas/eigen-ingest for the brand or capture via autonomous-capture-ingest with operator review.',
        auto_fillable: false,
      });
    } else if (docCount > 0 && chunkCount === 0) {
      findings.push({
        finding_id: findingId(['steward', String(patternIndex), 'corpus', driver, 'chunks']),
        check_type: 'missing_corpus',
        severity: 'high',
        target_kb_driver: driver,
        resource_type: 'knowledge_chunks',
        field_path: 'document_id',
        status: 'missing',
        observed: '0 chunks for cluster driver documents',
        expected: 'Chunked knowledge for retrieval',
        suggested_fill_action: 'Re-run eigen-ingest chunking pipeline for pending documents.',
        auto_fillable: false,
      });
    }
  }
  return findings;
}

export function mergeInformationFindings(
  ...groups: StewardInformationFinding[][]
): StewardInformationFinding[] {
  const byId = new Map<string, StewardInformationFinding>();
  for (const group of groups) {
    for (const finding of group) {
      byId.set(finding.finding_id, finding);
    }
  }
  return Array.from(byId.values());
}
