import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

describe('meg-entities resolve_bundle', () => {
  it('exposes GET resolve_bundle with alias or entity_id and optional neighbors', () => {
    const src = readFileSync(join(repoRoot, 'supabase/functions/meg-entities/index.ts'), 'utf8');
    expect(src).toContain("action === 'resolve_bundle'");
    expect(src).toContain('include_neighbors');
    expect(src).toContain('meg_entity_edges');
    expect(src).toContain('matched_via');
    expect(src).toContain('entity_id must be a UUID');
    expect(src).toContain('512');
  });
});
