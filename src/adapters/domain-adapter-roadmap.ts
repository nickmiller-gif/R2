export interface AdapterRoadmapItem {
  repo: string;
  priority: 'p0' | 'p1' | 'p2';
  target_source_system: string;
  corpus_tier: 'public' | 'eigenx' | 'mixed';
  status: 'planned' | 'in_progress' | 'blocked' | 'completed' | 'deferred';
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
    status: 'in_progress',
    notes:
      'agenda_thought_pieces export wired via scripts/eigen-raysretreat-export.mjs + weekly workflow. Follow-up: public pages/news to eigen_public and internal ops docs to eigenx.',
  },
  {
    repo: 'ip-insights-hub',
    priority: 'p0',
    target_source_system: 'ip-insights-hub',
    corpus_tier: 'eigenx',
    status: 'completed',
    notes:
      'Production baseline closed: adapter + ip-router live, with backfill path via `ip-insights-hub/scripts/backfill-eigen-ingest.mjs` and workflow `eigen-backfill.yml`.',
  },
  {
    repo: 'oracle-operator',
    priority: 'p1',
    target_source_system: 'oracle-operator',
    corpus_tier: 'eigenx',
    status: 'completed',
    notes:
      'R2 adapter `src/adapters/oracle-operator/eigen-oracle-operator-adapter.ts` maps operator grounding events to eigen-ingest (eigenx + oracle-operator tags). Wire from oracle-operator repo with service JWT + idempotency.',
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
    status: 'completed',
    notes:
      'Production baseline closed: property/rental analysis edge functions emit snapshots into eigen-ingest with provenance metadata; secrets and validation checklist documented in centralr2-core runbook.',
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
    status: 'deferred',
    notes:
      'Deferred for current production wave: runtime chat already uses shared Eigen widget path; conversation-capture ingest will be wired in a dedicated follow-up release.',
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
