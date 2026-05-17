import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const INGEST_SRC = readFileSync(
  join(import.meta.dirname, '../supabase/functions/r2-signal-ingest/index.ts'),
  'utf8',
);
const PROMOTE_SRC = readFileSync(
  join(import.meta.dirname, '../supabase/functions/truth-market-promote/index.ts'),
  'utf8',
);

describe('member JWT authz on signal edges', () => {
  it('r2-signal-ingest requires operator role after guardAuth on user_jwt path', () => {
    expect(INGEST_SRC).toMatch(/guardAuth/);
    expect(INGEST_SRC).toMatch(/requireRole\(auth\.claims\.userId,\s*'operator'\)/);
    const userPath = INGEST_SRC.slice(INGEST_SRC.indexOf("authMode = 'user_jwt'") - 400);
    expect(userPath).toMatch(/requireRole/);
  });

  it('truth-market-promote requires operator role before service RPC', () => {
    expect(PROMOTE_SRC).toMatch(/requireRole\(auth\.claims\.userId,\s*'operator'\)/);
    expect(PROMOTE_SRC.indexOf('requireRole')).toBeLessThan(
      PROMOTE_SRC.indexOf(".rpc('truth_market_promote'"),
    );
  });
});
