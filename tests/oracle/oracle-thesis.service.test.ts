/**
 * Tests for the Oracle thesis service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOracleThesisService,
  type OracleThesisDb,
  type DbOracleThesisRow,
} from '../../src/services/oracle/oracle-thesis.service.js';
import type { OracleThesisFilter } from '../../src/types/oracle/thesis.js';

function makeMockDb(): OracleThesisDb & { rows: DbOracleThesisRow[] } {
  const rows: DbOracleThesisRow[] = [];
  return {
    rows,
    async insertThesis(row) {
      rows.push(row);
      return row;
    },
    async findThesisById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryTheses(filter?: OracleThesisFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.profileId && r.profile_id !== filter.profileId) return false;
        if (filter.noveltyStatus && r.novelty_status !== filter.noveltyStatus) return false;
        if (filter.megEntityId && r.meg_entity_id !== filter.megEntityId) return false;
        return true;
      });
    },
    async updateThesis(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Thesis not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('OracleThesisService', () => {
  it('creates thesis with draft status and default confidence', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis = await service.create({
      title: 'Market consolidation thesis',
      thesisStatement: 'The market will consolidate within 18 months',
    });

    expect(thesis.title).toBe('Market consolidation thesis');
    expect(thesis.thesisStatement).toBe('The market will consolidate within 18 months');
    expect(thesis.status).toBe('draft');
    expect(thesis.confidence).toBe(50);
    expect(thesis.publicationState).toBe('pending_review');
    expect(thesis.inspirationSignalIds).toEqual([]);
    expect(thesis.inspirationEvidenceItemIds).toEqual([]);
    expect(thesis.validationEvidenceItemIds).toEqual([]);
    expect(thesis.contradictionEvidenceItemIds).toEqual([]);
  });

  it('returns null for nonexistent thesis', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('lists theses filtered by status', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    await service.create({
      title: 'Thesis 1',
      thesisStatement: 'Statement 1',
    });

    const thesis2 = await service.create({
      title: 'Thesis 2',
      thesisStatement: 'Statement 2',
    });

    await service.challenge(thesis2.id);

    const draftTheses = await service.list({ status: 'draft' });
    expect(draftTheses).toHaveLength(1);
    expect(draftTheses[0].title).toBe('Thesis 1');

    const challengedTheses = await service.list({ status: 'challenged' });
    expect(challengedTheses).toHaveLength(1);
    expect(challengedTheses[0].title).toBe('Thesis 2');
  });

  it('updates thesis fields', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis = await service.create({
      title: 'Original title',
      thesisStatement: 'Original statement',
      confidence: 40,
    });

    const updated = await service.update(thesis.id, {
      title: 'Updated title',
      confidence: 75,
    });

    expect(updated.title).toBe('Updated title');
    expect(updated.thesisStatement).toBe('Original statement');
    expect(updated.confidence).toBe(75);
  });

  it('publish sets state and timestamp', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis = await service.create({
      title: 'Thesis to publish',
      thesisStatement: 'Statement',
    });

    expect(thesis.publicationState).toBe('pending_review');
    expect(thesis.publishedAt).toBeNull();
    expect(thesis.publishedBy).toBeNull();

    const published = await service.publish(thesis.id, 'user-123');

    expect(published.publicationState).toBe('published');
    expect(published.publishedAt).not.toBeNull();
    expect(published.publishedBy).toBe('user-123');
  });

  it('challenge sets status to challenged', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis = await service.create({
      title: 'Thesis to challenge',
      thesisStatement: 'Statement',
    });

    expect(thesis.status).toBe('draft');

    const challenged = await service.challenge(thesis.id);

    expect(challenged.status).toBe('challenged');
  });

  it('supersede sets status and reference', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis1 = await service.create({
      title: 'Original thesis',
      thesisStatement: 'Statement 1',
    });

    const thesis2 = await service.create({
      title: 'Replacement thesis',
      thesisStatement: 'Statement 2',
    });

    expect(thesis1.status).toBe('draft');
    expect(thesis1.supersededByThesisId).toBeNull();

    const superseded = await service.supersede(thesis1.id, thesis2.id);

    expect(superseded.status).toBe('superseded');
    expect(superseded.supersededByThesisId).toBe(thesis2.id);
  });

  it('retrieves thesis by id with all fields', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis = await service.create({
      title: 'Test thesis',
      thesisStatement: 'Test statement',
      profileId: 'profile-123',
      confidence: 65,
      metadata: { custom: 'value' },
      governance: { platformId: 'team-a' },
    });

    const retrieved = await service.getById(thesis.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(thesis.id);
    expect(retrieved!.profileId).toBe('profile-123');
    expect(retrieved!.confidence).toBe(65);
    expect(retrieved!.metadata).toEqual({ custom: 'value' });
    expect(retrieved!.governance).toEqual({ platformId: 'team-a' });
  });

  it('lists all theses when no filter provided', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    await service.create({
      title: 'Thesis 1',
      thesisStatement: 'Statement 1',
    });

    await service.create({
      title: 'Thesis 2',
      thesisStatement: 'Statement 2',
    });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('creates thesis linked to a MEG entity', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const megId = crypto.randomUUID();
    const thesis = await service.create({
      title: 'Entity-scoped thesis',
      thesisStatement: 'Thesis about a specific MEG entity',
      megEntityId: megId,
    });

    expect(thesis.megEntityId).toBe(megId);
  });

  it('creates thesis without MEG entity (null by default)', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis = await service.create({
      title: 'Abstract thesis',
      thesisStatement: 'No specific entity subject',
    });

    expect(thesis.megEntityId).toBeNull();
  });

  it('filters theses by megEntityId', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const megId = crypto.randomUUID();
    await service.create({
      title: 'Entity thesis',
      thesisStatement: 'About entity',
      megEntityId: megId,
    });

    await service.create({
      title: 'Unlinked thesis',
      thesisStatement: 'No entity',
    });

    const filtered = await service.list({ megEntityId: megId });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Entity thesis');
    expect(filtered[0].megEntityId).toBe(megId);
  });

  it('updates megEntityId on an existing thesis', async () => {
    const db = makeMockDb();
    const service = createOracleThesisService(db);

    const thesis = await service.create({
      title: 'Thesis to link',
      thesisStatement: 'Will be linked later',
    });

    expect(thesis.megEntityId).toBeNull();

    const megId = crypto.randomUUID();
    const updated = await service.update(thesis.id, { megEntityId: megId });

    expect(updated.megEntityId).toBe(megId);
  });
});
