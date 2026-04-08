export interface AdapterRoadmapItem {
  repo: string;
  priority: 'p0' | 'p1' | 'p2';
  target_source_system: string;
  corpus_tier: 'public' | 'eigenx' | 'mixed';
  status: 'planned' | 'in_progress' | 'blocked';
  notes: string;
}

/**
 * Execution roadmap for multi-domain ingest adapters.
 * This keeps implementation tickets in code next to adapter contracts.
 */
export const DOMAIN_ADAPTER_ROADMAP: AdapterRoadmapItem[] = [
  {
    repo: 'raysretreat',
    priority: 'p0',
    target_source_system: 'raysretreat',
    corpus_tier: 'mixed',
    status: 'planned',
    notes:
      'Ingest public pages/news into eigen_public; ingest internal ops docs into eigenx. Add scheduled export job to R2 eigen-ingest.',
  },
  {
    repo: 'ip-insights-hub',
    priority: 'p0',
    target_source_system: 'ip-insights-hub',
    corpus_tier: 'eigenx',
    status: 'in_progress',
    notes:
      'Adapter exists. Next: add retry queue + backfill script and include thesis/asset IDs in metadata.',
  },
  {
    repo: 'oracle-operator',
    priority: 'p1',
    target_source_system: 'oracle-operator',
    corpus_tier: 'eigenx',
    status: 'planned',
    notes:
      'Ingest operator decisions, run outcomes, and evidence summaries for EigenX retrieval grounding.',
  },
  {
    repo: 'smartplrx-trend-tracker',
    priority: 'p1',
    target_source_system: 'smartplrx',
    corpus_tier: 'mixed',
    status: 'planned',
    notes:
      'Ingest external trend briefs to eigen_public where safe; private analysis versions to eigenx.',
  },
  {
    repo: 'health-supplement-tr',
    priority: 'p1',
    target_source_system: 'health-supplement-tr',
    corpus_tier: 'mixed',
    status: 'planned',
    notes:
      'Move client-side ingestion to server adapter and route all content through R2 eigen-ingest.',
  },
  {
    repo: 'project-darling',
    priority: 'p2',
    target_source_system: 'project-darling',
    corpus_tier: 'mixed',
    status: 'planned',
    notes:
      'Confirm whether this remains UI-only; if yes, adapter pulls from its backing Supabase tables.',
  },
  {
    repo: 'centralr2-core',
    priority: 'p0',
    target_source_system: 'centralr2-core',
    corpus_tier: 'eigenx',
    status: 'planned',
    notes:
      'Map governance/asset snapshots into eigenx with strong provenance metadata per record.',
  },
  {
    repo: 'hpseller',
    priority: 'p1',
    target_source_system: 'hpseller',
    corpus_tier: 'eigenx',
    status: 'planned',
    notes:
      'Ingest seller workflow docs, checklists, and transaction notes with access-scoped policy tags.',
  },
  {
    repo: 'r2app',
    priority: 'p0',
    target_source_system: 'r2app',
    corpus_tier: 'mixed',
    status: 'planned',
    notes:
      'Ingest approved public Q&A into eigen_public and internal notes into eigenx; preserve event timestamps.',
  },
  {
    repo: 'chartr2-assets',
    priority: 'p0',
    target_source_system: 'chartr2',
    corpus_tier: 'eigenx',
    status: 'blocked',
    notes:
      'Blocked until Foundation/Chart document APIs are finalized. Then add scheduled asset+decision adapter into eigen-ingest.',
  },
];
