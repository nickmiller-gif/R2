import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

describe('match_knowledge_chunks meg_entity scope migration', () => {
  it('keeps meg_entity_id in ANN pipeline and OR filter for filter_entity_ids', () => {
    const sql = readFileSync(
      join(
        repoRoot,
        'supabase/migrations/202604290002_match_knowledge_chunks_meg_entity_scope.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('k.meg_entity_id');
    expect(sql).toContain('a.meg_entity_id');
    expect(sql).toContain('filter_entity_ids');
    expect(sql).toContain('jsonb_array_elements_text(a.entity_ids)');
  });
});

describe('MEG meg_entity_type ip migration', () => {
  it('adds ip enum value', () => {
    const sql = readFileSync(
      join(repoRoot, 'supabase/migrations/202604290003_meg_entity_type_ip.sql'),
      'utf8',
    );
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'ip'");
  });
});
