/**
 * Tests for the shared identity primitives (foundation-01).
 *
 * Covers: EntityRef helpers, Alias helpers, and actor normalisation.
 */
import { describe, it, expect } from 'vitest';
import { makeEntityRef, entityRefKey, entityRefsEqual } from '../../src/lib/identity/entity-ref.js';
import { makeAlias, findAlias, aliasIndex } from '../../src/lib/identity/alias.js';
import { normalizeActor } from '../../src/lib/identity/index.js';
import type { Alias } from '../../src/types/shared/identity.js';

// ─── EntityRef ────────────────────────────────────────────────────────────────

describe('makeEntityRef', () => {
  it('creates a ref without kind', () => {
    const ref = makeEntityRef('charter', 'entity-1');
    expect(ref).toEqual({ domain: 'charter', id: 'entity-1' });
    expect(ref.kind).toBeUndefined();
  });

  it('creates a ref with kind', () => {
    const ref = makeEntityRef('oracle', 'signal-42', 'signal');
    expect(ref).toEqual({ domain: 'oracle', id: 'signal-42', kind: 'signal' });
  });
});

describe('entityRefKey', () => {
  it('returns domain:id', () => {
    const ref = makeEntityRef('charter', 'abc-123');
    expect(entityRefKey(ref)).toBe('charter:abc-123');
  });

  it('ignores kind in the key', () => {
    const ref = makeEntityRef('oracle', 'sig-1', 'signal');
    expect(entityRefKey(ref)).toBe('oracle:sig-1');
  });
});

describe('entityRefsEqual', () => {
  it('returns true for same domain and id', () => {
    const a = makeEntityRef('charter', 'x');
    const b = makeEntityRef('charter', 'x', 'governance');
    expect(entityRefsEqual(a, b)).toBe(true);
  });

  it('returns false when domain differs', () => {
    const a = makeEntityRef('charter', 'x');
    const b = makeEntityRef('oracle', 'x');
    expect(entityRefsEqual(a, b)).toBe(false);
  });

  it('returns false when id differs', () => {
    const a = makeEntityRef('charter', 'x');
    const b = makeEntityRef('charter', 'y');
    expect(entityRefsEqual(a, b)).toBe(false);
  });
});

// ─── Alias ────────────────────────────────────────────────────────────────────

describe('makeAlias', () => {
  it('creates an alias with the correct shape', () => {
    const ref = makeEntityRef('charter', 'e-1');
    const alias = makeAlias(ref, 'slug', 'my-policy');
    expect(alias.entityRef).toEqual(ref);
    expect(alias.aliasKind).toBe('slug');
    expect(alias.value).toBe('my-policy');
  });
});

describe('findAlias', () => {
  it('finds alias by kind', () => {
    const ref = makeEntityRef('charter', 'e-1');
    const aliases: Alias[] = [
      makeAlias(ref, 'slug', 'my-policy'),
      makeAlias(ref, 'display_name', 'My Policy'),
    ];
    const found = findAlias(aliases, 'display_name');
    expect(found).not.toBeUndefined();
    expect(found!.value).toBe('My Policy');
  });

  it('returns undefined when kind not present', () => {
    const ref = makeEntityRef('charter', 'e-1');
    const aliases: Alias[] = [makeAlias(ref, 'slug', 'my-policy')];
    expect(findAlias(aliases, 'external_id')).toBeUndefined();
  });

  it('returns undefined for empty list', () => {
    expect(findAlias([], 'slug')).toBeUndefined();
  });
});

describe('aliasIndex', () => {
  it('builds a map keyed by aliasKind:value', () => {
    const ref = makeEntityRef('oracle', 's-1');
    const aliases: Alias[] = [
      makeAlias(ref, 'slug', 'my-signal'),
      makeAlias(ref, 'external_id', 'EXT-001'),
    ];
    const index = aliasIndex(aliases);
    expect(index.size).toBe(2);
    expect(index.get('slug:my-signal')?.value).toBe('my-signal');
    expect(index.get('external_id:EXT-001')?.value).toBe('EXT-001');
  });

  it('last occurrence wins on duplicate keys', () => {
    const refA = makeEntityRef('oracle', 's-2');
    const refB = makeEntityRef('oracle', 's-3');
    const first = makeAlias(refA, 'slug', 'dup');
    const second = makeAlias(refB, 'slug', 'dup');
    // Same key (slug:dup) — second entry should overwrite first
    const index = aliasIndex([first, second]);
    expect(index.size).toBe(1);
    expect(index.get('slug:dup')).toStrictEqual(second);
  });

  it('returns empty map for empty input', () => {
    expect(aliasIndex([])).toEqual(new Map());
  });
});

// ─── normalizeActor (re-exported from lib/identity) ──────────────────────────

describe('normalizeActor', () => {
  it('maps a known kind through unchanged', () => {
    expect(normalizeActor({ id: 'u-1', kind: 'service' })).toEqual({
      id: 'u-1',
      kind: 'service',
    });
  });

  it('defaults to user when kind is undefined', () => {
    expect(normalizeActor({ id: 'u-2' })).toEqual({ id: 'u-2', kind: 'user' });
  });

  it('defaults to user for an unrecognised kind', () => {
    expect(normalizeActor({ id: 'u-3', kind: 'robot' })).toEqual({
      id: 'u-3',
      kind: 'user',
    });
  });

  it('accepts all three known kinds', () => {
    for (const kind of ['user', 'service', 'system'] as const) {
      expect(normalizeActor({ id: 'x', kind }).kind).toBe(kind);
    }
  });
});
