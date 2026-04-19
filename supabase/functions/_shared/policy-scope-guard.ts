const BLOCKED_SCOPE_KEYS = [
  'policy_scope',
  'requested_policy_scope',
  'effective_policy_scope',
  'default_policy_scope',
  'scope',
  'mode_scope',
];

export function assertNoClientPolicyScopeOverride(input: unknown): void {
  if (!input || typeof input !== 'object') return;
  const body = input as Record<string, unknown>;
  const attempted = BLOCKED_SCOPE_KEYS.filter((key) => key in body);
  if (attempted.length === 0) return;

  throw new Error(
    `Client policy scope overrides are not allowed (${attempted.join(', ')})`,
  );
}
