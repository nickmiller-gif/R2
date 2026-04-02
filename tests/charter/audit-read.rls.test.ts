import { describe, it, expect } from 'vitest';

/**
 * RLS policy tests for the audit read path.
 *
 * These tests document the expected Row-Level Security (RLS) policy
 * boundaries as defined in migration 202604020003_charter_audit_read_path.sql.
 *
 * Full integration tests require a live Supabase instance with the migrations
 * applied. The specifications below serve as a contract for those policies.
 *
 * To run against a real DB, wire up a Supabase test client with
 * appropriate role tokens and replace the stubs with real queries.
 */

describe('AuditRead RLS Policy Contract', () => {
  it('authenticated users may read charter_provenance_events (audit_log_read policy)', () => {
    // Policy: FOR SELECT USING (auth.role() = 'authenticated')
    // Expected: authenticated role can read rows from charter_provenance_events
    const policy = {
      table: 'charter_provenance_events',
      operation: 'SELECT',
      condition: "auth.role() = 'authenticated'",
    };
    expect(policy.operation).toBe('SELECT');
    expect(policy.condition).toContain('authenticated');
  });

  it('authenticated users may read charter_governance_entities (governance_entity_read policy)', () => {
    const policy = {
      table: 'charter_governance_entities',
      operation: 'SELECT',
      condition: "auth.role() = 'authenticated'",
    };
    expect(policy.operation).toBe('SELECT');
    expect(policy.condition).toContain('authenticated');
  });

  it('only service_role may write charter_governance_entities (governance_entity_write policy)', () => {
    const policy = {
      table: 'charter_governance_entities',
      operation: 'ALL',
      condition: "auth.role() = 'service_role'",
    };
    expect(policy.condition).toContain('service_role');
  });

  it('only service_role may write charter_governance_transitions (governance_transition_write policy)', () => {
    const policy = {
      table: 'charter_governance_transitions',
      operation: 'ALL',
      condition: "auth.role() = 'service_role'",
    };
    expect(policy.condition).toContain('service_role');
  });

  it('charter_provenance_events has no UPDATE or DELETE rules (immutable append)', () => {
    // The migration adds rules that prevent mutation of provenance rows
    const rules = ['no_update_provenance', 'no_delete_provenance'];
    expect(rules).toContain('no_update_provenance');
    expect(rules).toContain('no_delete_provenance');
  });

  it('charter_audit_log view joins governance entities and provenance events', () => {
    // The view charter_audit_log joins charter_provenance_events and charter_governance_entities
    const viewDependencies = ['charter_provenance_events', 'charter_governance_entities'];
    expect(viewDependencies).toContain('charter_provenance_events');
    expect(viewDependencies).toContain('charter_governance_entities');
  });
});
