/**
 * Tests for Eigen site registry service (policy metadata slice).
 */
import { describe, it, expect } from 'vitest';
import {
  createEigenSiteRegistryService,
  type EigenSiteRegistryDb,
  type DbEigenSiteRegistryRow,
} from '../../src/services/eigen/site-registry.service.js';
import type { EigenSiteRegistryFilter } from '../../src/types/eigen/site-registry.js';

function baseRow(overrides: Partial<DbEigenSiteRegistryRow> = {}): DbEigenSiteRegistryRow {
  return {
    site_id: 'demo-site',
    display_name: 'Demo',
    mode: 'public',
    origins: '[]',
    source_systems: '[]',
    default_policy_scope: '["eigen_public"]',
    status: 'active',
    metadata: '{}',
    policy_notes: null,
    capability_profile: '{}',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockDb(initial: DbEigenSiteRegistryRow[]): EigenSiteRegistryDb & {
  rows: DbEigenSiteRegistryRow[];
} {
  const rows = [...initial];
  return {
    rows,
    async findSiteById(siteId) {
      return rows.find((r) => r.site_id === siteId) ?? null;
    },
    async querySites(filter?: EigenSiteRegistryFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.mode && r.mode !== filter.mode) return false;
        return true;
      });
    },
    async updateSite(siteId, patch) {
      const idx = rows.findIndex((r) => r.site_id === siteId);
      if (idx === -1) throw new Error(`Site not found: ${siteId}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('EigenSiteRegistryService', () => {
  it('parses jsonb arrays and metadata on read', async () => {
    const db = makeMockDb([
      baseRow({
        site_id: 'a',
        origins: '["https://a.example"]',
        source_systems: '["supabase"]',
        metadata: '{"x":1}',
        capability_profile: '{"defaultTags":["read:tool-capability"]}',
      }),
    ]);
    const svc = createEigenSiteRegistryService(db);
    const site = await svc.getBySiteId('a');
    expect(site).not.toBeNull();
    expect(site!.origins).toEqual(['https://a.example']);
    expect(site!.sourceSystems).toEqual(['supabase']);
    expect(site!.metadata).toEqual({ x: 1 });
    expect(site!.capabilityProfile).toEqual({ defaultTags: ['read:tool-capability'] });
  });

  it('lists with status filter', async () => {
    const db = makeMockDb([
      baseRow({ site_id: 'x', status: 'active' }),
      baseRow({ site_id: 'y', status: 'paused' }),
    ]);
    const svc = createEigenSiteRegistryService(db);
    const active = await svc.list({ status: 'active' });
    expect(active.map((s) => s.siteId)).toEqual(['x']);
  });

  it('updates policy metadata', async () => {
    const db = makeMockDb([baseRow({ site_id: 'z' })]);
    const svc = createEigenSiteRegistryService(db);
    const updated = await svc.updatePolicyMeta('z', {
      policyNotes: 'Scoped to public widget',
      capabilityProfile: { surfaces: ['widget'] },
    });
    expect(updated.policyNotes).toBe('Scoped to public widget');
    expect(updated.capabilityProfile).toEqual({ surfaces: ['widget'] });
    expect(db.rows[0].policy_notes).toBe('Scoped to public widget');
    expect(db.rows[0].capability_profile).toBe(JSON.stringify({ surfaces: ['widget'] }));
  });
});
