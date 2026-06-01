import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const CHARTER_FUNCTIONS_DIR = join(ROOT, 'supabase/functions');

function readCharterFunction(name: string): string {
  return readFileSync(join(CHARTER_FUNCTIONS_DIR, name, 'index.ts'), 'utf8');
}

const CHARTER_WRITE_ENDPOINTS = readdirSync(CHARTER_FUNCTIONS_DIR)
  .filter((name) => name.startsWith('charter-') && name !== 'charter-audit-read')
  .sort();

describe('Charter write endpoint hardening (static audit)', () => {
  for (const fn of CHARTER_WRITE_ENDPOINTS) {
    it(`${fn} uses sanitizeInsert or sanitizeUpdate for mutations`, () => {
      const src = readCharterFunction(fn);
      expect(src).toMatch(/sanitizeInsert|sanitizeUpdate/);
      expect(src).not.toMatch(/\.\.\.body\.data/);
    });
  }

  it('charter-asset-valuations injects created_by from JWT, not client body', () => {
    const src = readCharterFunction('charter-asset-valuations');
    expect(src).toMatch(/sanitizeInsert\(body, INSERT_FIELDS,/);
    expect(src).toMatch(/created_by: auth\.claims\.userId/);
    expect(src).not.toMatch(/pickInsertRow/);
    const insertFields = src.match(/const INSERT_FIELDS = (\[[\s\S]*?\]) as const;/)?.[1] ?? '';
    expect(insertFields).not.toMatch(/created_by/);
    expect(insertFields).not.toMatch(/'id'/);
  });

  it('charter-roles validates CharterRole enum on writes', () => {
    const src = readCharterFunction('charter-roles');
    expect(src).toMatch(/isCharterRole/);
    expect(src).toMatch(/ROLE_HIERARCHY/);
  });
});
