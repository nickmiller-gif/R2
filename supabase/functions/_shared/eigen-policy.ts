export const POLICY_TAG_EIGEN_PUBLIC = 'eigen_public';
export const POLICY_TAG_EIGENX = 'eigenx';

/** Per-user private supplements in `knowledge_chunks.policy_tags` (see eigenx-scope.ts). */
export function policyTagEigenxUser(userId: string): string {
  return `eigenx:user:${userId}`;
}

export type EigenCorpusTier = 'public' | 'eigenx';

/**
 * Canonicalizes policy tags for Eigen corpora.
 * - Public corpus must carry `eigen_public`.
 * - Internal corpus defaults to `eigenx`.
 */
export function normalizeCorpusPolicyTags(input: string[]): string[] {
  const cleaned = input.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const set = new Set(cleaned);
  if (set.has(POLICY_TAG_EIGEN_PUBLIC)) {
    return Array.from(new Set([POLICY_TAG_EIGEN_PUBLIC, ...set]));
  }
  return Array.from(new Set([POLICY_TAG_EIGENX, ...set]));
}

export function inferCorpusTier(policyTags: string[]): EigenCorpusTier {
  return policyTags.includes(POLICY_TAG_EIGEN_PUBLIC) ? 'public' : 'eigenx';
}
