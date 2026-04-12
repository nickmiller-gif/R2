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
      'Adapter + ip-router live. Backfill: `ip-insights-hub/scripts/backfill-eigen-ingest.mjs` + workflow `eigen-backfill.yml` (manual).',
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
    status: 'in_progress',
    notes:
      'Export `scripts/export-trends-to-r2.mjs` + daily `eigen-export.yml`; R2 adapter `eigen-smartplrx-adapter.ts`. Use SPLX_EIGEN_VISIBILITY=eigenx for operator-only.',
  },
  {
    repo: 'health-supplement-tr',
    priority: 'p1',
    target_source_system: 'health-supplement-tr',
    corpus_tier: 'mixed',
    status: 'in_progress',
    notes:
      'Export `scripts/export-trends-to-r2.mjs` includes eigen_public; scheduled `eigen-export.yml` (daily) + manual dispatch.',
  },
  {
    repo: 'project-darling',
    priority: 'p2',
    target_source_system: 'project-darling',
    corpus_tier: 'mixed',
    status: 'in_progress',
    notes:
      'Confirmed UI-only today; widget + site registration added. Use file/sitemap ingest unless a backing data model is introduced.',
  },
  {
    repo: 'centralr2-core',
    priority: 'p0',
    target_source_system: 'centralr2-core',
    corpus_tier: 'eigenx',
    status: 'in_progress',
    notes:
      'Property and rental analysis edge functions now emit knowledge snapshots into eigen-ingest with provenance metadata.',
  },
  {
    repo: 'hpseller',
    priority: 'p1',
    target_source_system: 'hpseller',
    corpus_tier: 'eigenx',
    status: 'in_progress',
    notes:
      'db-write server events now ingest seller files/checklists/notes with access-scoped policy tags.',
  },
  {
    repo: 'r2app',
    priority: 'p0',
    target_source_system: 'r2app',
    corpus_tier: 'mixed',
    status: 'in_progress',
    notes:
      'Runtime chat now defaults to shared Eigen widget path; next: wire conversation capture into adapter ingest path.',
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
