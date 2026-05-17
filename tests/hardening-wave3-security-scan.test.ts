import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

describe('security-scan wave 3 targets', () => {
  it('gates r2-signal-process-deadletter with guardAuth and requireRole', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/r2-signal-process-deadletter/index.ts'),
      'utf8',
    );
    expect(src).toMatch(/guardAuth\s*\(/);
    expect(src).toMatch(/requireRole\s*\(/);
  });

  it('gates meg-resolve-bridge with authorizeBridge token check', () => {
    const src = readFileSync(join(ROOT, 'supabase/functions/meg-resolve-bridge/index.ts'), 'utf8');
    expect(src).toMatch(/authorizeBridge\s*\(/);
    expect(src).toMatch(/timingSafeEqual\s*\(/);
  });
});
