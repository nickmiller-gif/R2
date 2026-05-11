import { describe, expect, it } from 'vitest';
import {
  MEG_RESOLVE_BOUNDS,
  findCoffeeCounterpartyMegResolveArgs,
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

  it('infers actor from attendee_a_external_id (r2app coffee_match_created)', () => {
    const initiator = '50429563-07e6-4dda-b397-a25333b7680f';
    const r = inferActorMegResolveArgs({
      id: 'sig-coffee-a',
      source_system: 'rays_retreat',
      source_event_type: 'coffee_match_created',
      summary: 'Coffee match summary',
      payload: {
        attendee_a_external_id: initiator,
        attendee_b_external_id: '72d1128b-0eb1-47f2-a75a-ea3edd86628a',
      },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_external_id).toBe(initiator);
    expect(r!.p_canonical_name).toBe('Coffee match summary');
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

  it('infers actor email from raw_payload.metadata (CentralR2 submit-inquiry shape)', () => {
    const r = inferActorMegResolveArgs({
      id: 'sig-inq',
      source_system: 'centralr2',
      source_event_type: 'investor_inquiry_submitted',
      summary: 'Investor inquiry: Pat',
      payload: {
        title: 'Inquiry',
        content_type: 'text/plain',
        metadata: {
          user_email: 'pat@example.com',
          inquirer_name: 'Pat Example',
        },
      },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_email).toBe('pat@example.com');
    expect(r!.p_canonical_name).toBe('Pat Example');
  });

  it('infers actor client_id from metadata', () => {
    const r = inferActorMegResolveArgs({
      id: 'sig-client',
      source_system: 'centralr2',
      source_event_type: 'client_enriched',
      summary: 'Client snapshot',
      payload: {
        metadata: { client_id: 'client-ext-42', actor_name: 'Acme LLC' },
      },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_external_id).toBe('client-ext-42');
    expect(r!.p_canonical_name).toBe('Acme LLC');
  });

  it('infers actor external id from top-level client_id / clientId', () => {
    const r = inferActorMegResolveArgs({
      id: 'sig-top-client',
      source_system: 'centralr2',
      source_event_type: 'client_enriched',
      summary: 'Client snapshot',
      payload: { clientId: 'top-client-77' },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_external_id).toBe('top-client-77');
  });

  it('uses metadata user_email when payload user_email is not a valid email', () => {
    const r = inferActorMegResolveArgs({
      id: 'sig-email-pm',
      source_system: 'centralr2',
      source_event_type: 'x',
      summary: 's',
      payload: {
        user_email: 'not-an-email',
        metadata: { user_email: 'real@example.com' },
      },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_email).toBe('real@example.com');
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

  it('infers meg:property from parcel identifiers in payload', () => {
    const list = inferRelatedMegResolveArgsList({
      id: 's-prop',
      source_system: 'centralr2',
      source_event_type: 'property_lookup',
      summary: 'Lookup',
      payload: { apn: '12-345-67-89-0.12-34567', property_name: 'Sample parcel' },
    });
    const prop = list.find((x) => x.p_entity_type === 'meg:property');
    expect(prop).toBeDefined();
    expect(prop!.p_canonical_external_id).toBe('12-345-67-89-0.12-34567');
    expect(prop!.p_canonical_name).toContain('Sample parcel');
    expect(prop!.p_source_row_id).toContain('prop:apn');
  });

  it('infers meg:ip_matter and meg:patent from IP payload fields', () => {
    const list = inferRelatedMegResolveArgsList({
      id: 's-ip',
      source_system: 'ip_insights_hub',
      source_event_type: 'ip_matter_event',
      summary: 'Matter update',
      payload: {
        ip_matter_id: 'matter-ext-1',
        patent_number: 'US7123456',
        patent_title: 'Widget assembly',
      },
    });
    const matter = list.find((x) => x.p_entity_type === 'meg:ip_matter');
    const patent = list.find((x) => x.p_entity_type === 'meg:patent');
    expect(matter?.p_canonical_external_id).toBe('matter-ext-1');
    expect(patent?.p_canonical_external_id).toBe('US7123456');
  });

  it('resolves CentralR2 property-lookup from metadata.parcel.parcelNumber', () => {
    const list = inferRelatedMegResolveArgsList({
      id: 's-cr2-prop',
      source_system: 'centralr2',
      source_event_type: 'client_enriched',
      summary: 'Property Lookup: 1 Main St',
      payload: {
        source_ref: 'property-lookup:x',
        title: 'Property Lookup',
        content_type: 'centralr2_property_lookup',
        metadata: {
          function_name: 'property-lookup',
          address: '1 Main St',
          state: 'CA',
          zip: '90210',
          parcel: { parcelNumber: 'PARCEL-999' },
        },
      },
    });
    const central = list.find((x) => x.p_source_row_id.includes('centralr2:property'));
    expect(central).toBeDefined();
    expect(central!.p_canonical_external_id).toBe('PARCEL-999');
    expect(central!.p_entity_type).toBe('meg:property');
  });

  it('resolves CentralR2 valuation tower + scenario from metadata', () => {
    const list = inferRelatedMegResolveArgsList({
      id: 's-val',
      source_system: 'centralr2',
      source_event_type: 'agent_finding_published',
      summary: 'Published scenario',
      payload: {
        metadata: {
          kind: 'valuation_scenario',
          scenarioId: 'aaaaaaaa-bbbb-4ccc-8eee-aaaaaaaaaaaa',
          towerAssetId: 'bbbbbbbb-bbbb-4ccc-8eee-bbbbbbbbbbbb',
          leaseType: 'ground',
        },
      },
    });
    const tower = list.find((x) => x.p_source_row_id.includes('centralr2:tower_asset'));
    const scen = list.find((x) => x.p_source_row_id.includes('centralr2:valuation_scenario'));
    expect(tower?.p_canonical_external_id).toBe('bbbbbbbb-bbbb-4ccc-8eee-bbbbbbbbbbbb');
    expect(scen?.p_canonical_external_id).toBe('aaaaaaaa-bbbb-4ccc-8eee-aaaaaaaaaaaa');
    expect(tower?.p_entity_type).toBe('meg:property');
    expect(scen?.p_entity_type).toBe('meg:event');
  });

  it('resolves IP matter_id from metadata (ip_insights_hub shape)', () => {
    const list = inferRelatedMegResolveArgsList({
      id: 's-ip-meta',
      source_system: 'ip_insights_hub',
      source_event_type: 'matter_updated',
      summary: 'Matter',
      payload: {
        metadata: {
          matter_id: 'matter-uuid-1',
          matter_title: 'Portfolio X',
        },
      },
    });
    const matter = list.find((x) => x.p_source_row_id.includes('ip:ip_matter_id'));
    expect(matter).toBeDefined();
    expect(matter!.p_canonical_external_id).toBe('matter-uuid-1');
    expect(matter!.p_entity_type).toBe('meg:ip_matter');
  });

  it('infers coffee counterparty from attendee_b_external_id', () => {
    const a = 'aaaaaaaa-bbbb-4ccc-8eee-111111111111';
    const b = 'bbbbbbbb-bbbb-4ccc-8eee-222222222222';
    const list = inferRelatedMegResolveArgsList({
      id: 's-coffee',
      source_system: 'rays_retreat',
      source_event_type: 'coffee_match_created',
      summary: 'Match',
      payload: {
        attendee_a_external_id: a,
        attendee_b_external_id: b,
        matched_name: 'Pat Lee',
      },
    });
    const counterparty = list.find((x) => x.p_source_row_id.includes('coffee_counterparty'));
    expect(counterparty).toBeDefined();
    expect(counterparty!.p_canonical_external_id).toBe(b);
    expect(counterparty!.p_canonical_name).toBe('Pat Lee');
  });
});

describe('findCoffeeCounterpartyMegResolveArgs', () => {
  it('returns the coffee_counterparty meg_resolve slot', () => {
    const a = 'aaaaaaaa-bbbb-4ccc-8eee-111111111111';
    const b = 'bbbbbbbb-bbbb-4ccc-8eee-222222222222';
    const cp = findCoffeeCounterpartyMegResolveArgs({
      id: 's-cp-find',
      source_system: 'rays_retreat',
      source_event_type: 'coffee_match_created',
      summary: 'm',
      payload: {
        attendee_a_external_id: a,
        attendee_b_external_id: b,
        matched_name: 'Pat',
      },
    });
    expect(cp).not.toBeNull();
    expect(cp!.p_canonical_external_id).toBe(b);
    expect(cp!.p_source_row_id).toBe('s-cp-find:coffee_counterparty');
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

describe('MEG_RESOLVE_BOUNDS — caller-supplied input caps', () => {
  it('clamps oversize canonical_name (from summary fallback) to bound', () => {
    const longSummary = 'x'.repeat(MEG_RESOLVE_BOUNDS.canonicalNameMaxLength + 200);
    const r = inferActorMegResolveArgs({
      id: 'sig-long-1',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: longSummary,
      payload: { email: 'a@b.co' },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_name.length).toBeLessThanOrEqual(
      MEG_RESOLVE_BOUNDS.canonicalNameMaxLength,
    );
  });

  it('clamps oversize email and external_id', () => {
    const longLocal = 'a'.repeat(MEG_RESOLVE_BOUNDS.canonicalEmailMaxLength + 100);
    const longExt = 'e'.repeat(MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength + 100);
    const r = inferActorMegResolveArgs({
      id: 'sig-long-2',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: 's',
      payload: { email: `${longLocal}@x.co`, user_id: longExt },
    });
    expect(r).not.toBeNull();
    expect(r!.p_canonical_email!.length).toBeLessThanOrEqual(
      MEG_RESOLVE_BOUNDS.canonicalEmailMaxLength,
    );
    expect(r!.p_canonical_external_id!.length).toBeLessThanOrEqual(
      MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength,
    );
  });

  it('replaces oversize payload with truncation marker', () => {
    const fat = 'p'.repeat(MEG_RESOLVE_BOUNDS.payloadMaxJsonBytes + 1024);
    const r = inferActorMegResolveArgs({
      id: 'sig-long-3',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: 's',
      payload: { email: 'a@b.co', blob: fat },
    });
    expect(r).not.toBeNull();
    expect(r!.p_payload.__meg_payload_truncated).toBe(true);
    expect(r!.p_payload.cap_bytes).toBe(MEG_RESOLVE_BOUNDS.payloadMaxJsonBytes);
    expect(typeof r!.p_payload.original_byte_length).toBe('number');
  });

  it('clamps oversize related external_id entries', () => {
    const longExt = 'r'.repeat(MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength + 100);
    const list = inferRelatedMegResolveArgsList({
      id: 'sig-long-4',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: 's',
      payload: { related_external_ids: [longExt] },
    });
    expect(list).toHaveLength(1);
    expect(list[0]!.p_canonical_external_id!.length).toBeLessThanOrEqual(
      MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength,
    );
  });

  it('caps related-entity inference at maxRelatedInfer', () => {
    const ids = Array.from(
      { length: MEG_RESOLVE_BOUNDS.maxRelatedInfer + 5 },
      (_, i) => `ext-${i}`,
    );
    const list = inferRelatedMegResolveArgsList({
      id: 'sig-long-5',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: 's',
      payload: { related_external_ids: ids },
    });
    expect(list.length).toBeLessThanOrEqual(MEG_RESOLVE_BOUNDS.maxRelatedInfer);
  });

  it('clamps oversize entity_type to bound (no overflow into metadata catalog field)', () => {
    const longType = `meg:${'z'.repeat(MEG_RESOLVE_BOUNDS.entityTypeMaxLength + 50)}`;
    const r = inferActorMegResolveArgs({
      id: 'sig-long-6',
      source_system: 'r2_widget',
      source_event_type: 'x',
      summary: 's',
      payload: { email: 'a@b.co', actor_entity_type: longType },
    });
    expect(r).not.toBeNull();
    expect(r!.p_entity_type.length).toBeLessThanOrEqual(MEG_RESOLVE_BOUNDS.entityTypeMaxLength);
  });
});
