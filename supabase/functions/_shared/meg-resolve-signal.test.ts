import { describe, expect, it } from 'vitest';
import {
  MEG_RESOLVE_BOUNDS,
  sanitizeMegResolveRpcArgs,
  stripNulText,
} from './meg-resolve-signal.ts';

describe('meg-resolve-signal sanitization', () => {
  it('stripNulText removes ASCII NUL', () => {
    expect(stripNulText('a\u0000b')).toBe('ab');
    expect(stripNulText('   ')).toBeNull();
  });

  it('sanitizeMegResolveRpcArgs strips NUL from RPC strings', () => {
    const args = sanitizeMegResolveRpcArgs({
      p_entity_type: 'meg:person',
      p_canonical_name: 'Test\u0000Name',
      p_canonical_email: 'a\u0000@example.com',
      p_canonical_external_id: 'ext\u00001',
      p_source_system: 'centralr2',
      p_source_table: 'platform_feed_items',
      p_source_row_id: 'row-id',
      p_payload: { ok: true },
    });
    expect(args.p_canonical_name).not.toContain('\0');
    expect(args.p_canonical_email).toBe('a@example.com');
    expect(args.p_canonical_external_id).toBe('ext1');
    expect(args.p_canonical_name.length).toBeLessThanOrEqual(
      MEG_RESOLVE_BOUNDS.canonicalNameMaxLength,
    );
  });
});
