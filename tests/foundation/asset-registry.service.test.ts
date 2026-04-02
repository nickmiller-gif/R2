/**
 * Tests for the Asset Registry + Evidence Links service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAssetRegistryService,
  type AssetRegistryDb,
  type DbAssetRegistryRow,
  type DbEvidenceLinkRow,
  type AssetRegistryFilter,
  type EvidenceLinkFilter,
} from '../../src/services/foundation/asset-registry.service.js';
import {
  makeCreateAssetRegistryInput,
  makeCreateEvidenceLinkInput,
  resetFixtureCounter,
} from './fixtures/foundation-fixtures.js';

function makeMockDb(): AssetRegistryDb & {
  assets: DbAssetRegistryRow[];
  links: DbEvidenceLinkRow[];
} {
  const assets: DbAssetRegistryRow[] = [];
  const links: DbEvidenceLinkRow[] = [];

  return {
    assets,
    links,
    async insertAsset(row) {
      assets.push(row);
      return row;
    },
    async findAssetById(id) {
      return assets.find((r) => r.id === id) ?? null;
    },
    async findAssetByRef(kind, refId, domain) {
      return (
        assets.find(
          (r) => r.kind === kind && r.ref_id === refId && r.domain === domain,
        ) ?? null
      );
    },
    async queryAssets(filter?: AssetRegistryFilter) {
      return assets.filter((r) => {
        if (!filter) return true;
        if (filter.kind && r.kind !== filter.kind) return false;
        if (filter.domain && r.domain !== filter.domain) return false;
        if (filter.refId && r.ref_id !== filter.refId) return false;
        return true;
      });
    },
    async insertLink(row) {
      links.push(row);
      return row;
    },
    async queryLinks(filter?: EvidenceLinkFilter) {
      return links.filter((r) => {
        if (!filter) return true;
        if (filter.fromAssetId && r.from_asset_id !== filter.fromAssetId) return false;
        if (filter.toAssetId && r.to_asset_id !== filter.toAssetId) return false;
        if (filter.linkKind && r.link_kind !== filter.linkKind) return false;
        return true;
      });
    },
    async deleteLink(id) {
      const idx = links.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Link not found: ${id}`);
      links.splice(idx, 1);
    },
  };
}

describe('AssetRegistryService', () => {
  beforeEach(() => resetFixtureCounter());

  it('registers an asset with defaults', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const asset = await service.registerAsset(makeCreateAssetRegistryInput());

    expect(asset.kind).toBe('document');
    expect(asset.domain).toBe('test');
    expect(asset.metadata).toEqual({});
    expect(asset.createdAt).toBeInstanceOf(Date);
  });

  it('registers an asset with metadata', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const asset = await service.registerAsset(
      makeCreateAssetRegistryInput({
        kind: 'oracle_signal',
        domain: 'oracle',
        label: 'Market signal',
        metadata: { score: 85, source: 'reuters' },
      }),
    );

    expect(asset.kind).toBe('oracle_signal');
    expect(asset.domain).toBe('oracle');
    expect(asset.label).toBe('Market signal');
    expect(asset.metadata).toEqual({ score: 85, source: 'reuters' });
  });

  it('returns null for nonexistent asset', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const result = await service.getAssetById('nonexistent');
    expect(result).toBeNull();
  });

  it('looks up asset by natural key (kind, refId, domain)', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const asset = await service.registerAsset(
      makeCreateAssetRegistryInput({
        kind: 'governance_entity',
        refId: 'entity-99',
        domain: 'charter',
        label: 'Test Entity',
      }),
    );

    const found = await service.getAssetByRef('governance_entity', 'entity-99', 'charter');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(asset.id);

    const notFound = await service.getAssetByRef('governance_entity', 'entity-99', 'oracle');
    expect(notFound).toBeNull();
  });

  it('lists assets filtered by kind', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    await service.registerAsset(makeCreateAssetRegistryInput({ kind: 'document' }));
    await service.registerAsset(makeCreateAssetRegistryInput({ kind: 'oracle_signal' }));
    await service.registerAsset(makeCreateAssetRegistryInput({ kind: 'document' }));

    const docs = await service.listAssets({ kind: 'document' });
    expect(docs).toHaveLength(2);
    expect(docs.every((a) => a.kind === 'document')).toBe(true);
  });

  it('lists assets filtered by domain', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    await service.registerAsset(makeCreateAssetRegistryInput({ domain: 'charter' }));
    await service.registerAsset(makeCreateAssetRegistryInput({ domain: 'oracle' }));
    await service.registerAsset(makeCreateAssetRegistryInput({ domain: 'charter' }));

    const charter = await service.listAssets({ domain: 'charter' });
    expect(charter).toHaveLength(2);
  });

  it('lists all assets when no filter', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    await service.registerAsset(makeCreateAssetRegistryInput());
    await service.registerAsset(makeCreateAssetRegistryInput());

    const all = await service.listAssets();
    expect(all).toHaveLength(2);
  });

  // ── Evidence Links ──

  it('creates an evidence link between two assets', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const assetA = await service.registerAsset(
      makeCreateAssetRegistryInput({ label: 'Asset A' }),
    );
    const assetB = await service.registerAsset(
      makeCreateAssetRegistryInput({ label: 'Asset B' }),
    );

    const link = await service.linkAssets({
      fromAssetId: assetA.id,
      toAssetId: assetB.id,
      linkKind: 'supports',
      confidence: 0.92,
    });

    expect(link.fromAssetId).toBe(assetA.id);
    expect(link.toAssetId).toBe(assetB.id);
    expect(link.linkKind).toBe('supports');
    expect(link.confidence).toBe(0.92);
    expect(link.metadata).toEqual({});
    expect(link.createdAt).toBeInstanceOf(Date);
  });

  it('creates link with metadata and no confidence', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const assetA = await service.registerAsset(makeCreateAssetRegistryInput());
    const assetB = await service.registerAsset(makeCreateAssetRegistryInput());

    const link = await service.linkAssets({
      fromAssetId: assetA.id,
      toAssetId: assetB.id,
      linkKind: 'derived_from',
      metadata: { extractionMethod: 'llm-v2' },
    });

    expect(link.linkKind).toBe('derived_from');
    expect(link.confidence).toBeNull();
    expect(link.metadata).toEqual({ extractionMethod: 'llm-v2' });
  });

  it('getLinksFrom returns outgoing links', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const origin = await service.registerAsset(makeCreateAssetRegistryInput());
    const targetA = await service.registerAsset(makeCreateAssetRegistryInput());
    const targetB = await service.registerAsset(makeCreateAssetRegistryInput());
    const other = await service.registerAsset(makeCreateAssetRegistryInput());

    await service.linkAssets({
      fromAssetId: origin.id, toAssetId: targetA.id, linkKind: 'supports',
    });
    await service.linkAssets({
      fromAssetId: origin.id, toAssetId: targetB.id, linkKind: 'references',
    });
    await service.linkAssets({
      fromAssetId: other.id, toAssetId: origin.id, linkKind: 'contradicts',
    });

    const outgoing = await service.getLinksFrom(origin.id);
    expect(outgoing).toHaveLength(2);
    expect(outgoing.every((l) => l.fromAssetId === origin.id)).toBe(true);
  });

  it('getLinksTo returns incoming links', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const target = await service.registerAsset(makeCreateAssetRegistryInput());
    const srcA = await service.registerAsset(makeCreateAssetRegistryInput());
    const srcB = await service.registerAsset(makeCreateAssetRegistryInput());

    await service.linkAssets({
      fromAssetId: srcA.id, toAssetId: target.id, linkKind: 'supports',
    });
    await service.linkAssets({
      fromAssetId: srcB.id, toAssetId: target.id, linkKind: 'scored_by',
    });

    const incoming = await service.getLinksTo(target.id);
    expect(incoming).toHaveLength(2);
    expect(incoming.every((l) => l.toAssetId === target.id)).toBe(true);
  });

  it('lists links filtered by linkKind', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const a = await service.registerAsset(makeCreateAssetRegistryInput());
    const b = await service.registerAsset(makeCreateAssetRegistryInput());
    const c = await service.registerAsset(makeCreateAssetRegistryInput());

    await service.linkAssets({ fromAssetId: a.id, toAssetId: b.id, linkKind: 'supports' });
    await service.linkAssets({ fromAssetId: a.id, toAssetId: c.id, linkKind: 'contradicts' });
    await service.linkAssets({ fromAssetId: b.id, toAssetId: c.id, linkKind: 'supports' });

    const supports = await service.listLinks({ linkKind: 'supports' });
    expect(supports).toHaveLength(2);
    expect(supports.every((l) => l.linkKind === 'supports')).toBe(true);
  });

  it('removes a link', async () => {
    const db = makeMockDb();
    const service = createAssetRegistryService(db);

    const a = await service.registerAsset(makeCreateAssetRegistryInput());
    const b = await service.registerAsset(makeCreateAssetRegistryInput());

    const link = await service.linkAssets({
      fromAssetId: a.id, toAssetId: b.id, linkKind: 'supersedes',
    });

    expect(db.links).toHaveLength(1);
    await service.removeLink(link.id);
    expect(db.links).toHaveLength(0);
  });
});
