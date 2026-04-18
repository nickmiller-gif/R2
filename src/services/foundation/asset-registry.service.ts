/**
 * Asset Registry + Evidence Links Service — the entity graph primitives.
 *
 * Connects ideas, documents, signals, and governance entities
 * into an auditable evidence graph. Any domain registers its entities
 * here, then links them via typed evidence relationships.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  AssetRegistryEntry,
  AssetEvidenceLink,
  CreateAssetRegistryInput,
  CreateEvidenceLinkInput,
  AssetKind,
  EvidenceLinkKind,
} from '../../types/shared/asset-registry.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbField } from '../oracle/oracle-db-utils.js';
import { assertConfidence01 } from '../../lib/charter/validate.js';
import { withPagination } from '../../lib/service-utils/pagination.js';

// ── Filters ──────────────────────────────────────────────────────────

export interface AssetRegistryFilter {
  kind?: AssetKind;
  domain?: string;
  refId?: string;
  limit?: number;
  offset?: number;
}

export interface EvidenceLinkFilter {
  fromAssetId?: string;
  toAssetId?: string;
  linkKind?: EvidenceLinkKind;
  limit?: number;
  offset?: number;
}

// ── Service interface ────────────────────────────────────────────────

export interface AssetRegistryService {
  /** Register a new asset in the graph. */
  registerAsset(input: CreateAssetRegistryInput): Promise<AssetRegistryEntry>;
  /** Look up a single asset by id. */
  getAssetById(id: string): Promise<AssetRegistryEntry | null>;
  /** Look up an asset by its (kind, refId, domain) natural key. */
  getAssetByRef(kind: AssetKind, refId: string, domain: string): Promise<AssetRegistryEntry | null>;
  /** Query assets by filter. */
  listAssets(filter?: AssetRegistryFilter): Promise<AssetRegistryEntry[]>;

  /** Create a typed evidence link between two registered assets. */
  linkAssets(input: CreateEvidenceLinkInput): Promise<AssetEvidenceLink>;
  /** Get all outgoing links from an asset. */
  getLinksFrom(assetId: string): Promise<AssetEvidenceLink[]>;
  /** Get all incoming links to an asset. */
  getLinksTo(assetId: string): Promise<AssetEvidenceLink[]>;
  /** Query links by filter. */
  listLinks(filter?: EvidenceLinkFilter): Promise<AssetEvidenceLink[]>;
  /** Remove a link. */
  removeLink(id: string): Promise<void>;
}

// ── Db interface (port) ──────────────────────────────────────────────

export interface DbAssetRegistryRow {
  id: string;
  kind: string;
  ref_id: string;
  domain: string;
  label: string;
  metadata: string;
  created_at: string;
}

export interface DbEvidenceLinkRow {
  id: string;
  from_asset_id: string;
  to_asset_id: string;
  link_kind: string;
  confidence: number | null;
  metadata: string;
  created_at: string;
}

export interface AssetRegistryDb {
  insertAsset(row: DbAssetRegistryRow): Promise<DbAssetRegistryRow>;
  findAssetById(id: string): Promise<DbAssetRegistryRow | null>;
  findAssetByRef(kind: string, refId: string, domain: string): Promise<DbAssetRegistryRow | null>;
  queryAssets(filter?: AssetRegistryFilter): Promise<DbAssetRegistryRow[]>;

  insertLink(row: DbEvidenceLinkRow): Promise<DbEvidenceLinkRow>;
  queryLinks(filter?: EvidenceLinkFilter): Promise<DbEvidenceLinkRow[]>;
  deleteLink(id: string): Promise<void>;
}

// ── Mappers ──────────────────────────────────────────────────────────

function rowToAsset(row: DbAssetRegistryRow): AssetRegistryEntry {
  return {
    id: row.id,
    kind: row.kind as AssetRegistryEntry['kind'],
    refId: row.ref_id,
    domain: row.domain,
    label: row.label,
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
  };
}

function rowToLink(row: DbEvidenceLinkRow): AssetEvidenceLink {
  return {
    id: row.id,
    fromAssetId: row.from_asset_id,
    toAssetId: row.to_asset_id,
    linkKind: row.link_kind as AssetEvidenceLink['linkKind'],
    confidence: row.confidence,
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
  };
}

// ── Factory ──────────────────────────────────────────────────────────

export function createAssetRegistryService(db: AssetRegistryDb): AssetRegistryService {
  return {
    async registerAsset(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertAsset({
        id: crypto.randomUUID(),
        kind: input.kind,
        ref_id: input.refId,
        domain: input.domain,
        label: input.label,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
      });
      return rowToAsset(row);
    },

    async getAssetById(id) {
      const row = await db.findAssetById(id);
      return row ? rowToAsset(row) : null;
    },

    async getAssetByRef(kind, refId, domain) {
      const row = await db.findAssetByRef(kind, refId, domain);
      return row ? rowToAsset(row) : null;
    },

    async listAssets(filter) {
      const rows = await db.queryAssets(withPagination(filter));
      return rows.map(rowToAsset);
    },

    async linkAssets(input) {
      if (input.confidence !== undefined && input.confidence !== null) {
        assertConfidence01(input.confidence, 'confidence');
      }
      const now = nowUtc().toISOString();
      const row = await db.insertLink({
        id: crypto.randomUUID(),
        from_asset_id: input.fromAssetId,
        to_asset_id: input.toAssetId,
        link_kind: input.linkKind,
        confidence: input.confidence ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
      });
      return rowToLink(row);
    },

    async getLinksFrom(assetId) {
      const rows = await db.queryLinks({ fromAssetId: assetId });
      return rows.map(rowToLink);
    },

    async getLinksTo(assetId) {
      const rows = await db.queryLinks({ toAssetId: assetId });
      return rows.map(rowToLink);
    },

    async listLinks(filter) {
      const rows = await db.queryLinks(withPagination(filter));
      return rows.map(rowToLink);
    },

    async removeLink(id) {
      await db.deleteLink(id);
    },
  };
}
