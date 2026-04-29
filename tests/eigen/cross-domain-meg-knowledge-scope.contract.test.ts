import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

/**
 * Contract: entity-scoped Eigen retrieval must match chunks tagged only via
 * knowledge_chunks.meg_entity_id (see migration 202604290002). Ingest must
 * accept meg_entity_id (eigen-ingest) so producers can populate the FK.
 */
describe('Cross-domain MEG + Eigen knowledge scope', () => {
  it('documents backfill script for meg_entity_id from single entity_ids', () => {
    const sql = readFileSync(join(repoRoot, 'scripts/backfill-meg-entity-id-chunks.sql'), 'utf8');
    expect(sql).toContain('meg_entity_id');
    expect(sql).toContain('entity_ids');
    expect(sql).toContain('meg_entities');
  });

  it('eigen-ingest persists meg_entity_id on chunk rows', () => {
    const src = readFileSync(join(repoRoot, 'supabase/functions/eigen-ingest/index.ts'), 'utf8');
    expect(src).toContain('meg_entity_id: requestBody.meg_entity_id ?? null');
    expect(src).toContain('assertActiveMegEntity');
  });
});
