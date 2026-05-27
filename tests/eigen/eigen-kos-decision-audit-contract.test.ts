/**
 * Plan.md backlog: contract tests for policy decision outcomes across
 * `eigenx` / `eigen_public` scopes.
 *
 * The existing `eigen-kos-contract-matrix.test.ts` locks the engine's
 * decision output against the seeded rule set. The decision recorder is
 * covered separately in `eigen-policy-decision-recorder.test.ts`. What was
 * missing — and what this file adds — is the **end-to-end wiring** through
 * `enforceEigenKosCapabilityBundle` with `audit:` provided, asserting that
 * for every (surface × scope × role) tuple in the runtime contract:
 *
 *   1. The bundle decision (ok / denial) matches the seeded semantics.
 *   2. Exactly one `eigen_policy_decisions` row is inserted, with
 *      `allowed`, `metadata.surface`, `policy_tags`, `caller_subject`,
 *      and `correlation_id` round-tripped from the audit context.
 *   3. No row is inserted when `rulesConfigured=false` (rollout backstop).
 *
 * This catches a class of regressions the matrix and recorder tests miss:
 * a future change that decouples the audit row from the actual decision
 * (e.g. always-allowed metadata, drift between recorder fields and engine
 * output) would pass both existing suites but fail here.
 *
 * Seed rules are duplicated from `eigen-kos-contract-matrix.test.ts`
 * rather than imported so this file is independently reviewable: a seed
 * change that drifts the two fixtures apart is the signal we want.
 */

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enforceEigenKosCapabilityBundle } from '../../supabase/functions/_shared/eigen-kos-enforcement.ts';
import { EIGEN_KOS_CAPABILITY } from '../../src/lib/eigen/eigen-kos-capabilities.ts';

interface SeedRule {
  id: string;
  policy_tag: string;
  capability_tag_pattern: string;
  effect: 'allow' | 'deny';
  required_role: string | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const SEEDED_RULES: SeedRule[] = [
  {
    id: 'allow-eigenx-read-member',
    policy_tag: 'eigenx',
    capability_tag_pattern: 'read:*',
    effect: 'allow',
    required_role: 'member',
    rationale: 'Read capabilities require member role or higher.',
    metadata: {},
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
  },
  {
    id: 'allow-eigenx-write-operator',
    policy_tag: 'eigenx',
    capability_tag_pattern: 'write:*',
    effect: 'allow',
    required_role: 'operator',
    rationale: 'Write-class capabilities require operator role in baseline policy.',
    metadata: {},
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
  },
  {
    id: 'allow-eigenx-user-read-member',
    policy_tag: 'eigenx:*',
    capability_tag_pattern: 'read:*',
    effect: 'allow',
    required_role: 'member',
    rationale: 'User-scoped read capabilities require member role or higher.',
    metadata: {},
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
  },
  {
    id: 'allow-eigenx-user-write-operator',
    policy_tag: 'eigenx:*',
    capability_tag_pattern: 'write:*',
    effect: 'allow',
    required_role: 'operator',
    rationale: 'User-scoped write capabilities require operator role or higher.',
    metadata: {},
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
  },
  {
    id: 'allow-eigen-public-read-member',
    policy_tag: 'eigen_public',
    capability_tag_pattern: 'read:*',
    effect: 'allow',
    required_role: 'member',
    rationale: 'Public corpus read capabilities require member role or higher.',
    metadata: {},
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
  },
  {
    id: 'allow-eigen-public-search-member',
    policy_tag: 'eigen_public',
    capability_tag_pattern: 'search',
    effect: 'allow',
    required_role: 'member',
    rationale: 'Public corpus retrieval search capability requires member role or higher.',
    metadata: {},
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
  },
  {
    id: 'allow-eigen-public-ai-member',
    policy_tag: 'eigen_public',
    capability_tag_pattern: 'ai:*',
    effect: 'allow',
    required_role: 'member',
    rationale: 'Public corpus synthesis capabilities require member role or higher.',
    metadata: {},
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
  },
  {
    id: 'allow-eigen-public-write-operator',
    policy_tag: 'eigen_public',
    capability_tag_pattern: 'write:*',
    effect: 'allow',
    required_role: 'operator',
    rationale: 'Public corpus write capabilities require operator role or higher.',
    metadata: {},
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
  },
];

interface RecordedDecision {
  allowed: boolean;
  policy_tags: string[];
  capability_tags: string[];
  caller_roles: string[];
  caller_subject: string | null;
  matched_rule_ids: string[];
  deny_reasons: string[];
  correlation_id: string | null;
  evaluation_ms: number | null;
  metadata: Record<string, unknown>;
}

/**
 * Stub client that both serves `eigen_policy_rules` reads from the seeded
 * fixture and captures `eigen_policy_decisions` inserts into a sink. The
 * insert returns a synthetic id so the recorder's `.select('id').single()`
 * post-insert read succeeds.
 */
function makeStubClient(
  rules: SeedRule[],
  sink: RecordedDecision[],
  options: { failInserts?: boolean } = {},
): SupabaseClient {
  const fake = {
    from(table: string) {
      if (table === 'eigen_policy_rules') {
        return {
          select: () => ({
            eq: (column: string, value: unknown) =>
              Promise.resolve({
                data: rules.filter((row) => {
                  const actual = (row as unknown as Record<string, unknown>)[column];
                  if (actual === undefined && column === 'is_active') return value === true;
                  return actual === value;
                }),
                error: null,
              }),
          }),
        };
      }
      if (table === 'eigen_policy_decisions') {
        return {
          insert: (rows: RecordedDecision[]) => {
            if (options.failInserts) {
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: 'simulated insert failure' },
                    }),
                }),
              };
            }
            for (const row of rows) sink.push(row);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: `dec-${sink.length}` },
                    error: null,
                  }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table in audit-contract stub: ${table}`);
    },
  };
  return fake as unknown as SupabaseClient;
}

interface AuditMatrixCase {
  surface: 'eigen-retrieve' | 'eigen-chat' | 'eigen-widget-chat.eigenx' | 'eigen-ingest';
  bundle: keyof typeof EIGEN_KOS_CAPABILITY;
  policyTags: string[];
  role: string;
  expectedAllowed: boolean;
  note: string;
}

const AUDIT_MATRIX: AuditMatrixCase[] = [
  // eigen-retrieve / eigen_public — bundle = [search, read:knowledge]
  {
    surface: 'eigen-retrieve',
    bundle: 'retrieve',
    policyTags: ['eigen_public'],
    role: 'member',
    expectedAllowed: true,
    note: 'eigen_public allows member to search + read:knowledge',
  },
  {
    surface: 'eigen-retrieve',
    bundle: 'retrieve',
    policyTags: ['eigen_public'],
    role: '',
    expectedAllowed: false,
    note: 'anon caller denied on member-gated reads',
  },
  // eigen-retrieve / eigenx — search has no rule, so deny even at admin
  {
    surface: 'eigen-retrieve',
    bundle: 'retrieve',
    policyTags: ['eigenx'],
    role: 'admin',
    expectedAllowed: false,
    note: 'eigenx scope has no search allow rule',
  },
  // eigen-chat / eigen_public — bundle = [search, read:knowledge, ai:synthesis]
  {
    surface: 'eigen-chat',
    bundle: 'chat',
    policyTags: ['eigen_public'],
    role: 'member',
    expectedAllowed: true,
    note: 'eigen_public member can chat (read + search + ai)',
  },
  {
    surface: 'eigen-chat',
    bundle: 'chat',
    policyTags: ['eigen_public'],
    role: '',
    expectedAllowed: false,
    note: 'anon caller denied chat bundle on public scope',
  },
  // eigen-widget-chat.eigenx is a chat bundle on eigenx scope — denies due to missing search/ai rules
  {
    surface: 'eigen-widget-chat.eigenx',
    bundle: 'chat',
    policyTags: ['eigenx'],
    role: 'operator',
    expectedAllowed: false,
    note: 'eigenx scope lacks search and ai:* allow rules',
  },
  {
    surface: 'eigen-widget-chat.eigenx',
    bundle: 'chat',
    policyTags: ['eigenx:user:11111111-1111-1111-1111-111111111111'],
    role: 'operator',
    expectedAllowed: false,
    note: 'user-scoped eigenx:* mirrors eigenx — same missing rules',
  },
  // eigen-ingest / eigen_public — bundle = [write:knowledge]
  {
    surface: 'eigen-ingest',
    bundle: 'ingest',
    policyTags: ['eigen_public'],
    role: 'operator',
    expectedAllowed: true,
    note: 'eigen_public write:* allows operator',
  },
  {
    surface: 'eigen-ingest',
    bundle: 'ingest',
    policyTags: ['eigen_public'],
    role: 'member',
    expectedAllowed: false,
    note: 'eigen_public write:* requires operator, denies member',
  },
  // eigen-ingest / eigenx — same operator gate
  {
    surface: 'eigen-ingest',
    bundle: 'ingest',
    policyTags: ['eigenx'],
    role: 'admin',
    expectedAllowed: true,
    note: 'eigenx write:* allows admin (above operator)',
  },
];

describe('Eigen KOS — decision/audit contract (cross-surface × scope × role)', () => {
  for (const tc of AUDIT_MATRIX) {
    const roleLabel = tc.role || 'anon';
    const scopeLabel = tc.policyTags.join(',');
    const expectedLabel = tc.expectedAllowed ? 'allow+audit' : 'deny+audit';
    it(`${tc.surface} × [${scopeLabel}] × role=${roleLabel} → ${expectedLabel}`, async () => {
      const sink: RecordedDecision[] = [];
      const result = await enforceEigenKosCapabilityBundle(makeStubClient(SEEDED_RULES, sink), {
        policyTags: tc.policyTags,
        requiredCapabilityTags: EIGEN_KOS_CAPABILITY[tc.bundle],
        callerRoles: (tc.role ? [tc.role] : []) as never,
        surface: tc.surface,
        audit: {
          callerSubject: `subj-${roleLabel}`,
          correlationId: `corr-${tc.surface}-${roleLabel}`,
          metadata: { scope: scopeLabel },
        },
      });

      expect(result.ok, tc.note).toBe(tc.expectedAllowed);
      expect(sink, 'exactly one decision row per bundle evaluation').toHaveLength(1);

      const recorded = sink[0]!;
      expect(recorded.allowed, 'recorded.allowed mirrors result.ok').toBe(tc.expectedAllowed);
      expect(recorded.policy_tags).toEqual(tc.policyTags);
      expect(recorded.caller_subject).toBe(`subj-${roleLabel}`);
      expect(recorded.correlation_id).toBe(`corr-${tc.surface}-${roleLabel}`);
      expect(recorded.metadata.surface, 'surface folded into metadata').toBe(tc.surface);
      expect(recorded.metadata.scope, 'caller metadata round-trips').toBe(scopeLabel);
      // Deny rows must carry at least one reason; allow rows carry an empty list.
      if (tc.expectedAllowed) {
        expect(recorded.deny_reasons).toEqual([]);
      } else {
        expect(recorded.deny_reasons.length).toBeGreaterThan(0);
      }
    });
  }

  it('no audit row is recorded when rulesConfigured=false (rollout backstop)', async () => {
    const sink: RecordedDecision[] = [];
    const result = await enforceEigenKosCapabilityBundle(makeStubClient([], sink), {
      policyTags: ['eigenx'],
      requiredCapabilityTags: EIGEN_KOS_CAPABILITY.chat,
      callerRoles: ['member'] as never,
      surface: 'eigen-chat',
      audit: {
        callerSubject: 'subj-1',
        correlationId: 'corr-1',
      },
    });
    expect(result.ok).toBe(true);
    expect(sink, 'empty rule set must not produce an audit row').toHaveLength(0);
  });

  it('no audit row when audit context is omitted (opt-in semantics)', async () => {
    const sink: RecordedDecision[] = [];
    const result = await enforceEigenKosCapabilityBundle(makeStubClient(SEEDED_RULES, sink), {
      policyTags: ['eigen_public'],
      requiredCapabilityTags: EIGEN_KOS_CAPABILITY.retrieve,
      callerRoles: ['member'] as never,
      surface: 'eigen-retrieve',
      // audit intentionally omitted
    });
    expect(result.ok).toBe(true);
    expect(sink, 'omitting audit must skip recording').toHaveLength(0);
  });

  it('enforcement proceeds even when the audit insert errors', async () => {
    const sink: RecordedDecision[] = [];
    // failInserts simulates a DB outage on the audit table; the recorder
    // must swallow and the bundle decision must still return cleanly.
    const result = await enforceEigenKosCapabilityBundle(
      makeStubClient(SEEDED_RULES, sink, { failInserts: true }),
      {
        policyTags: ['eigen_public'],
        requiredCapabilityTags: EIGEN_KOS_CAPABILITY.retrieve,
        callerRoles: ['member'] as never,
        surface: 'eigen-retrieve',
        audit: { callerSubject: 'subj', correlationId: 'corr' },
      },
    );
    expect(result.ok, 'audit-table outage must not break enforcement').toBe(true);
    expect(sink, 'failed insert leaves the sink empty').toHaveLength(0);
  });
});
