export type AdapterVisibility = 'public' | 'eigenx';

export interface AdapterIngestMetadata {
  site_id: string;
  source_system: string;
  source_ref: string;
  visibility: AdapterVisibility;
  tags?: string[];
}

export function visibilityPolicyTags(
  visibility: AdapterVisibility,
  extra: string[] = [],
): string[] {
  const base = visibility === 'public' ? ['eigen_public'] : ['eigenx'];
  return Array.from(new Set([...base, ...extra]));
}
