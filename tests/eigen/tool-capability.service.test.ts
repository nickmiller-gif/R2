/**
 * Tests for the Eigen tool capability service.
 */
import { describe, it, expect } from 'vitest';
import {
  createToolCapabilityService,
  type ToolCapabilityDb,
  type DbToolCapabilityRow,
} from '../../src/services/eigen/tool-capability.service.js';
import type { ToolCapabilityFilter } from '../../src/types/eigen/tool-capability.js';

function makeMockDb(): ToolCapabilityDb & { rows: DbToolCapabilityRow[] } {
  const rows: DbToolCapabilityRow[] = [];
  return {
    rows,
    async insertCapability(row) {
      rows.push(row);
      return row;
    },
    async findCapabilityById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryCapabilities(filter?: ToolCapabilityFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.toolId && r.tool_id !== filter.toolId) return false;
        if (filter.mode && r.mode !== filter.mode) return false;
        if (filter.approvalPolicy && r.approval_policy !== filter.approvalPolicy) return false;
        return true;
      });
    },
    async updateCapability(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Capability not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('ToolCapabilityService', () => {
  it('registers a capability with defaults', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    const cap = await service.register({
      toolId: 'tool-slack',
      name: 'Send Message',
      mode: 'write',
    });

    expect(cap.toolId).toBe('tool-slack');
    expect(cap.name).toBe('Send Message');
    expect(cap.mode).toBe('write');
    expect(cap.approvalPolicy).toBe('none_required');
    expect(cap.capabilityTags).toEqual([]);
    expect(cap.roleRequirements).toEqual([]);
    expect(cap.connectorDependencies).toEqual([]);
    expect(cap.ioSchemaRef).toBeNull();
    expect(cap.blastRadius).toBeNull();
    expect(cap.fallbackMode).toBeNull();
  });

  it('registers a capability with all optional fields', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    const cap = await service.register({
      toolId: 'tool-db',
      name: 'Execute Query',
      mode: 'read',
      capabilityTags: ['database', 'sql'],
      ioSchemaRef: 'schema://query-v2',
      approvalPolicy: 'admin_approval',
      roleRequirements: ['db-admin', 'data-eng'],
      connectorDependencies: ['postgres-connector'],
      blastRadius: 'high',
      fallbackMode: 'read_only',
    });

    expect(cap.capabilityTags).toEqual(['database', 'sql']);
    expect(cap.ioSchemaRef).toBe('schema://query-v2');
    expect(cap.approvalPolicy).toBe('admin_approval');
    expect(cap.roleRequirements).toEqual(['db-admin', 'data-eng']);
    expect(cap.connectorDependencies).toEqual(['postgres-connector']);
    expect(cap.blastRadius).toBe('high');
    expect(cap.fallbackMode).toBe('read_only');
  });

  it('returns null for nonexistent capability', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('lists capabilities filtered by mode', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    await service.register({ toolId: 'tool-1', name: 'Read Data', mode: 'read' });
    await service.register({ toolId: 'tool-2', name: 'Write Data', mode: 'write' });
    await service.register({ toolId: 'tool-3', name: 'Read Config', mode: 'read' });

    const reads = await service.list({ mode: 'read' });
    expect(reads).toHaveLength(2);
    expect(reads.every((c) => c.mode === 'read')).toBe(true);

    const writes = await service.list({ mode: 'write' });
    expect(writes).toHaveLength(1);
    expect(writes[0].name).toBe('Write Data');
  });

  it('lists capabilities filtered by toolId', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    await service.register({ toolId: 'tool-a', name: 'Cap 1', mode: 'read' });
    await service.register({ toolId: 'tool-a', name: 'Cap 2', mode: 'write' });
    await service.register({ toolId: 'tool-b', name: 'Cap 3', mode: 'read' });

    const toolA = await service.list({ toolId: 'tool-a' });
    expect(toolA).toHaveLength(2);
    expect(toolA.every((c) => c.toolId === 'tool-a')).toBe(true);
  });

  it('lists capabilities filtered by approvalPolicy', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    await service.register({ toolId: 'tool-1', name: 'Safe Read', mode: 'read' });
    await service.register({
      toolId: 'tool-2',
      name: 'Dangerous Write',
      mode: 'write',
      approvalPolicy: 'admin_approval',
    });

    const adminOnly = await service.list({ approvalPolicy: 'admin_approval' });
    expect(adminOnly).toHaveLength(1);
    expect(adminOnly[0].name).toBe('Dangerous Write');
  });

  it('lists all capabilities when no filter provided', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    await service.register({ toolId: 't1', name: 'A', mode: 'read' });
    await service.register({ toolId: 't2', name: 'B', mode: 'write' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('updates capability fields', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    const cap = await service.register({
      toolId: 'tool-x',
      name: 'Original Name',
      mode: 'read',
      approvalPolicy: 'none_required',
    });

    const updated = await service.update(cap.id, {
      name: 'Updated Name',
      approvalPolicy: 'user_approval',
      capabilityTags: ['updated'],
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.approvalPolicy).toBe('user_approval');
    expect(updated.capabilityTags).toEqual(['updated']);
    expect(updated.toolId).toBe('tool-x');
    expect(updated.mode).toBe('read');
  });

  it('retrieves capability by id with all fields', async () => {
    const db = makeMockDb();
    const service = createToolCapabilityService(db);

    const cap = await service.register({
      toolId: 'tool-full',
      name: 'Full Capability',
      mode: 'write',
      capabilityTags: ['search', 'index'],
      approvalPolicy: 'user_approval',
      roleRequirements: ['search-admin'],
      connectorDependencies: ['elastic'],
      blastRadius: 'medium',
      fallbackMode: 'degraded',
    });

    const retrieved = await service.getById(cap.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(cap.id);
    expect(retrieved!.toolId).toBe('tool-full');
    expect(retrieved!.capabilityTags).toEqual(['search', 'index']);
    expect(retrieved!.roleRequirements).toEqual(['search-admin']);
    expect(retrieved!.connectorDependencies).toEqual(['elastic']);
    expect(retrieved!.blastRadius).toBe('medium');
    expect(retrieved!.fallbackMode).toBe('degraded');
    expect(retrieved!.createdAt).toBeInstanceOf(Date);
    expect(retrieved!.updatedAt).toBeInstanceOf(Date);
  });
});
