/**
 * Canonical EigenX/KOS capability tags for sensitive paths (retrieve, chat, ingest).
 * Shared by edge functions and tests.
 *
 * Every tag listed here must have at least one matching allow rule in
 * `eigen_policy_rules` for the scopes these paths serve, or KOS bundle
 * enforcement at the endpoint rejects the request with `No matching allow rule`.
 */
export const EIGEN_KOS_CAPABILITY = {
  retrieve: ['search', 'read:knowledge'] as const,
  chat: ['search', 'read:knowledge', 'ai:synthesis'] as const,
  // Ingest writes document rows + knowledge chunks + embedding vectors. The
  // bare `ingest` capability tag was removed from this bundle because the
  // seeded policy covers `write:*` (matching all three) but has no rule for
  // the standalone `ingest` tag — listing it here would cause every
  // authenticated ingest request to 403 even though the caller legitimately
  // has write:* on their policy scope.
  ingest: ['write:document', 'write:knowledge', 'write:embedding'] as const,
} as const;
