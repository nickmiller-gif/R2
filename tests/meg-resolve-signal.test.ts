import { describe, expect, it } from 'vitest';
import {
  inferActorMegResolveArgs,
  inferRelatedMegResolveArgsList,
  isCoffeePairingSignal,
  isUuid,
  pickCoffeeMatchTargetMegEntityId,
} from '../supabase/functions/_shared/meg-resolve-signal.ts';

describe('inferActorMegResolveArgs', () => {
  it('returns null when actor_meg_entity_id already set', () => {
    expect(
      inferActorMegResolveArgs({
        id: 'sig-1',
        source_system: 'r2_widget',
        source_event_type: 'coffee_match',
        summary: 'x',
        payload: { email: 'a@b.co' },
        actor_meg_entity_id: '00000000-0000-0000-0000-000000000001',
      }),
    ).toBeNull();
  });

  it('returns null when no email or external id', () => {
    expect(
      inferActorMegResolveArgs({
        id: 'sig-1',
        source_system: 'r2_widget',
        source_event_type: 'coffee_match',
        summary: 'only summary',
        payload: { foo: 'bar' },
      }),
    ).toBeNull();
  });

  it('infers from email and uses summary as name fallback', () => {
    const r = inferActorMegResolveArgs({
      id: 'sig-1',
      source_system: 'r2_widget',
      source_event_type: 'coffee_match',
      summary: 'Hello world',
      payload: { email: 'Jane@Example.com' },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_email).toBe('jane@example.com');
    expect(r!.p_canonical_name).toBe('Hello world');
    expect(r!.p_entity_type).toBe('meg:person');
    expect(r!.p_source_row_id).toBe('sig-1');
  });

  it('prefers actor_name over summary', () => {
    const r = inferActorMegResolveArgs({
      id: 'sig-2',
      source_system: 'centralr2',
      source_event_type: 'client_enriched',
      summary: 'short',
      payload: { user_id: 'usr-9', actor_name: '  Acme Lead  ' },
    });
    expect(r!.p_canonical_external_id).toBe('usr-9');
    expect(r!.p_canonical_name).toBe('Acme Lead');
  });

  it('respects actor_entity_type when meg: prefixed', () => {
    const r = inferActorMegResolveArgs({
      id: 'sig-3',
      source_system: 'centralr2',
      source_event_type: 'x',
      summary: 's',
      payload: { email: 'x@y.co', actor_entity_type: 'meg:company' },
    });
    expect(r!.p_entity_type).toBe('meg:company');
  });
});

describe('inferRelatedMegResolveArgsList', () => {
  it('builds args from related_external_ids strings', () => {
    const list = inferRelatedMegResolveArgsList({
      id: 's1',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: 'sum',
      payload: { related_external_ids: ['ext-a', 'ext-b'] },
    });
    expect(list).toHaveLength(2);
    expect(list[0]!.p_canonical_external_id).toBe('ext-a');
    expect(list[0]!.p_source_row_id).toBe('s1:rext:0');
    expect(list[1]!.p_source_row_id).toBe('s1:rext:1');
  });

  it('dedupes identical external keys', () => {
    const list = inferRelatedMegResolveArgsList({
      id: 's1',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: 'sum',
      payload: { related_external_ids: ['dup', 'dup'] },
    });
    expect(list).toHaveLength(1);
  });
});

describe('coffee pairing helpers', () => {
  it('detects coffee from event type', () => {
    expect(
      isCoffeePairingSignal({
        source_event_type: 'coffee_match_created',
        payload: {},
      }),
    ).toBe(true);
  });

  it('detects coffee from payload flag', () => {
    expect(
      isCoffeePairingSignal({
        source_event_type: 'other',
        payload: { coffee_match: true },
      }),
    ).toBe(true);
  });

  it('picks non-actor related id', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    expect(pickCoffeeMatchTargetMegEntityId(a, [a, b])).toBe(b);
  });

  it('isUuid accepts lowercase uuid', () => {
    expect(isUuid('aaaaaaaa-bbbb-4ccc-8eee-eeeeeeeeeeee')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});
