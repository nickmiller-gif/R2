/**
 * EigenX access groups — policy tags and scope helpers (Deno-free for Vitest).
 */

export const POLICY_TAG_EIGENX = 'eigenx';

export function policyTagEigenxUser(userId: string): string {
  return `eigenx:user:${userId.trim()}`;
}

export function policyTagEigenxGroup(groupId: string): string {
  return `eigenx:group:${groupId.trim()}`;
}

/** Default retrieval tags for a non-admin member: personal + each active group. */
export function buildMemberRetrievePolicyScope(userId: string, groupIds: string[]): string[] {
  const personal = policyTagEigenxUser(userId);
  const groupTags = groupIds.map((id) => policyTagEigenxGroup(id));
  return Array.from(new Set([personal, ...groupTags]));
}

/** Clamp explicit client policy_scope to tags the member is allowed to request. */
export function clampMemberExplicitPolicyScope(
  userId: string,
  groupIds: string[],
  explicit: string[],
): string[] {
  const allowedRoots = buildMemberRetrievePolicyScope(userId, groupIds);
  const allowedSet = new Set(allowedRoots);
  const personal = policyTagEigenxUser(userId);

  const filtered = explicit.filter((tag) => {
    if (allowedSet.has(tag)) return true;
    if (tag.startsWith(`${personal}:`)) return true;
    return allowedRoots.some((root) => tag.startsWith(`${root}:`));
  });

  return filtered.length > 0 ? filtered : allowedRoots;
}

/**
 * Policy tags for member uploads — no org-wide eigenx unless explicitly ingested by pipeline.
 */
export function normalizePersonalUploadPolicyTags(
  input: string[],
  ownerUserId: string,
  groupId?: string,
): string[] {
  const personal = policyTagEigenxUser(ownerUserId);
  const cleaned = input
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag !== POLICY_TAG_EIGENX);

  const out = new Set<string>([personal, 'user_upload', ...cleaned]);
  if (groupId?.trim()) {
    out.add(policyTagEigenxGroup(groupId.trim()));
  }
  return Array.from(out);
}

export function isPersonalUploadSourceSystem(sourceSystem: string): boolean {
  const lower = sourceSystem.toLowerCase();
  return lower.includes('upload') || lower.includes('manual') || lower.includes('autonomous');
}

/** True when document chunk tags overlap the caller effective policy scope (ANY match). */
export function policyTagsOverlapScope(documentTags: string[], effectiveScope: string[]): boolean {
  if (effectiveScope.length === 0) return false;
  const scope = new Set(effectiveScope.map((tag) => tag.trim()).filter(Boolean));
  return documentTags.some((tag) => {
    const t = tag.trim();
    if (!t) return false;
    if (scope.has(t)) return true;
    for (const root of scope) {
      if (t.startsWith(`${root}:`)) return true;
    }
    return false;
  });
}
