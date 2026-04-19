import { describe, expect, it } from 'vitest';
import { assertNoClientPolicyScopeOverride } from '../supabase/functions/_shared/policy-scope-guard.ts';

describe('assertNoClientPolicyScopeOverride', () => {
  it('allows normal widget payloads', () => {
    expect(() =>
      assertNoClientPolicyScopeOverride({
        widget_token: 'abc',
        message: 'hello',
      })
    ).not.toThrow();
  });

  it('rejects payloads that attempt to set policy_scope', () => {
    expect(() =>
      assertNoClientPolicyScopeOverride({
        widget_token: 'abc',
        message: 'hello',
        policy_scope: ['eigenx:user:123'],
      })
    ).toThrow(/Client policy scope overrides are not allowed/);
  });

  it('rejects payloads that attempt to set effective_policy_scope', () => {
    expect(() =>
      assertNoClientPolicyScopeOverride({
        site_id: 'r2app',
        mode: 'public',
        effective_policy_scope: ['eigenx:user:123'],
      })
    ).toThrow(/effective_policy_scope/);
  });
});
