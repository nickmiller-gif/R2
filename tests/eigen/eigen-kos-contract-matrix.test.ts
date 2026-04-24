/**
 * Slice 6c — full KOS contract matrix.
 *
 * Goal: every canonical (capability bundle × caller role × policy scope)
 * tuple that runtime endpoints evaluate at least once, with the seeded
 * rule set from migrations 202604090003 + 202604130001 + 202604130003 +
 * 202604240002. If a seed ever drifts in a way that silently flips a
 * bundle's decision, this test fires before an endpoint ships behavior
 * changes to production.
 *
 * The matrix captures the complete seeded policy state for `eigenx`,
 * `eigenx:*` (user-scoped), and `eigen_public`, and asserts that the
 * shared enforcement helper returns the expected decision for each
 * (surface, scope, role) combo.
 *
 * We intentionally re-seed the rules inside the test fixture instead of
 * querying the live DB so the contract is reproducible in CI without
 * Supabase credentials and locks the semantics — any edit to the live
 * seed that narrows / widens the bundle decisions must also update this
 * fixture, which surfaces the intent in review.
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

/**
 * Canonical seeded rule set baked in as of 2026-04-24.
 *
 * Covers:
 *   - eigenx      : read:* member, write:* operator
 *   - eigenx:*    : read:* member, write:* operator   (user-scoped)
 *   - eigen_public: read:* member, search member, ai:* member, write:* operator
 */
const SEEDED_RULES: SeedRule[] = [
  // --- eigenx baseline (202604130001 + 202604130003) ---
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
  // --- eigenx:* (user-scoped) mirrors eigenx ---
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
  // --- eigen_public (202604240002) ---
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

function makeStubClient(rules: SeedRule[]): SupabaseClient {
  const fake = {
    from(table: string) {
      if (table !== 'eigen_policy_rules') {
        throw new Error(`Unexpected table in KOS contract stub: ${table}`);
      }
      return {
        select: () => Promise.resolve({ data: rules, error: null }),
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

async function decide(
  rules: SeedRule[],
  opts: {
    policyTags: string[];
    bundle: readonly string[];
    callerRoles: string[];
  },
): Promise<'allow' | 'deny'> {
  const result = await enforceEigenKosCapabilityBundle(makeStubClient(rules), {
    policyTags: opts.policyTags,
    requiredCapabilityTags: opts.bundle,
    callerRoles: opts.callerRoles as never,
    surface: 'contract-matrix',
  });
  return result.ok ? 'allow' : 'deny';
}

interface MatrixCase {
  surface: 'retrieve' | 'chat' | 'ingest';
  policyTags: string[];
  role: string;
  expected: 'allow' | 'deny';
  // Human-readable why-this-is-the-right-decision, printed on failure.
  note: string;
}

const HIERARCHICAL_ROLES = ['member', 'reviewer', 'operator', 'counsel', 'admin'] as const;

const MATRIX: MatrixCase[] = [
  // ─── retrieve bundle (search + read:knowledge) on eigenx ───
  ...HIERARCHICAL_ROLES.map(
    (role): MatrixCase => ({
      surface: 'retrieve',
      policyTags: ['eigenx'],
      role,
      expected: 'deny', // no rule covers `search` on eigenx
      note: 'eigenx has no allow rule for the bare `search` capability tag',
    }),
  ),

  // ─── retrieve bundle on eigen_public — anon / below-member deny, member+ allow ───
  {
    surface: 'retrieve',
    policyTags: ['eigen_public'],
    role: '',
    expected: 'deny',
    note: 'anon has no member role',
  },
  {
    surface: 'retrieve',
    policyTags: ['eigen_public'],
    role: 'member',
    expected: 'allow',
    note: 'seeded allow on read:* + search requires member',
  },
  {
    surface: 'retrieve',
    policyTags: ['eigen_public'],
    role: 'operator',
    expected: 'allow',
    note: 'operator satisfies member-minimum on read/search',
  },
  {
    surface: 'retrieve',
    policyTags: ['eigen_public'],
    role: 'admin',
    expected: 'allow',
    note: 'admin satisfies every minimum',
  },

  // ─── chat bundle (search + read:knowledge + ai:synthesis) on eigen_public ───
  {
    surface: 'chat',
    policyTags: ['eigen_public'],
    role: '',
    expected: 'deny',
    note: 'anon has no member role for ai:* / read:* / search',
  },
  {
    surface: 'chat',
    policyTags: ['eigen_public'],
    role: 'member',
    expected: 'allow',
    note: 'member covers search / read:knowledge / ai:synthesis',
  },
  {
    surface: 'chat',
    policyTags: ['eigen_public'],
    role: 'operator',
    expected: 'allow',
    note: 'operator satisfies member-minimum',
  },

  // ─── chat bundle on eigenx — missing search / ai rules → deny even for operator ───
  ...HIERARCHICAL_ROLES.map(
    (role): MatrixCase => ({
      surface: 'chat',
      policyTags: ['eigenx'],
      role,
      expected: 'deny',
      note: 'eigenx seed has no rule for search or ai:*; only read:* is covered',
    }),
  ),

  // ─── ingest bundle on eigen_public — below-operator deny, operator+ allow ───
  {
    surface: 'ingest',
    policyTags: ['eigen_public'],
    role: 'member',
    expected: 'deny',
    note: 'write:* requires operator on eigen_public',
  },
  {
    surface: 'ingest',
    policyTags: ['eigen_public'],
    role: 'reviewer',
    expected: 'deny',
    note: 'reviewer is below operator in hierarchy',
  },
  {
    surface: 'ingest',
    policyTags: ['eigen_public'],
    role: 'operator',
    expected: 'allow',
    note: 'operator meets write:* minimum',
  },
  {
    surface: 'ingest',
    policyTags: ['eigen_public'],
    role: 'counsel',
    expected: 'allow',
    note: 'counsel > operator in hierarchy',
  },
  {
    surface: 'ingest',
    policyTags: ['eigen_public'],
    role: 'admin',
    expected: 'allow',
    note: 'admin > operator in hierarchy',
  },

  // ─── ingest bundle on eigenx mirrors eigen_public (same operator-gated write:*) ───
  {
    surface: 'ingest',
    policyTags: ['eigenx'],
    role: 'member',
    expected: 'deny',
    note: 'eigenx write:* requires operator',
  },
  {
    surface: 'ingest',
    policyTags: ['eigenx'],
    role: 'operator',
    expected: 'allow',
    note: 'eigenx write:* grants operator',
  },

  // ─── User-scoped `eigenx:user:<uuid>` inherits the eigenx:* wildcard rules ───
  {
    surface: 'retrieve',
    policyTags: ['eigenx:user:11111111-1111-1111-1111-111111111111'],
    role: 'member',
    expected: 'deny',
    note: 'eigenx:* lacks search allow; only read:* covered',
  },
  {
    surface: 'ingest',
    policyTags: ['eigenx:user:11111111-1111-1111-1111-111111111111'],
    role: 'operator',
    expected: 'allow',
    note: 'eigenx:* write:* grants operator',
  },
  {
    surface: 'ingest',
    policyTags: ['eigenx:user:11111111-1111-1111-1111-111111111111'],
    role: 'member',
    expected: 'deny',
    note: 'eigenx:* write:* requires operator',
  },
];

describe('Eigen KOS policy engine — contract matrix (seed state 2026-04-24)', () => {
  for (const tc of MATRIX) {
    const roleLabel = tc.role || 'anon';
    const policyLabel = tc.policyTags.join(',');
    it(`${tc.surface} bundle × [${policyLabel}] × role=${roleLabel} → ${tc.expected}`, async () => {
      const bundle = EIGEN_KOS_CAPABILITY[tc.surface];
      const decision = await decide(SEEDED_RULES, {
        policyTags: tc.policyTags,
        bundle,
        callerRoles: tc.role ? [tc.role] : [],
      });
      // Fail message surfaces the rationale so a future seed tweak points
      // reviewers at the semantic impact before they just bump the matrix.
      expect(decision, `${tc.note}\n  bundle=${bundle.join(',')}`).toBe(tc.expected);
    });
  }

  it('deny-over-allow precedence inside a bundle', async () => {
    const rules: SeedRule[] = [
      ...SEEDED_RULES,
      {
        id: 'deny-ai-incident',
        policy_tag: 'eigen_public',
        capability_tag_pattern: 'ai:*',
        effect: 'deny',
        required_role: null,
        rationale: 'incident freeze',
        metadata: {},
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      },
    ];
    const decision = await decide(rules, {
      policyTags: ['eigen_public'],
      bundle: EIGEN_KOS_CAPABILITY.chat,
      callerRoles: ['member'],
    });
    expect(decision).toBe('deny');
  });

  it('`rulesConfigured=false` short-circuits to allow when the scope has no rules at all', async () => {
    const decision = await decide([], {
      policyTags: ['eigenx'],
      bundle: EIGEN_KOS_CAPABILITY.chat,
      callerRoles: ['member'],
    });
    expect(decision).toBe('allow');
  });
});
