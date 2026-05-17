import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(
  join(import.meta.dirname, '../supabase/migrations/20260517160000_friction_zero_hardening.sql'),
  'utf8',
);

describe('friction_zero_hardening migration', () => {
  it('grants outbound UPDATE for operators', () => {
    expect(MIGRATION).toMatch(/friction_outbound_update/);
    expect(MIGRATION).toMatch(/FOR UPDATE/);
    expect(MIGRATION).toMatch(/friction_zero_is_operator\(\)/);
  });

  it('restricts watchlist SELECT to owner only', () => {
    expect(MIGRATION).toMatch(/friction_watchlist_select/);
    expect(MIGRATION).toMatch(/user_id = \(SELECT auth\.uid\(\)\)/);
    expect(MIGRATION).not.toMatch(/friction_zero_is_operator\(\).*watchlist/i);
  });
});
