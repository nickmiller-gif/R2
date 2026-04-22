/**
 * Canonical EigenX/KOS capability tags for sensitive paths (retrieve, chat, ingest).
 * Shared by edge functions and tests.
 */
export const EIGEN_KOS_CAPABILITY = {
  retrieve: ['search', 'read:knowledge'] as const,
  chat: ['search', 'read:knowledge', 'ai:synthesis'] as const,
  ingest: ['write:document', 'write:knowledge', 'write:embedding', 'ingest'] as const,
} as const;
