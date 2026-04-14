import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeEigenRetrieve, type EigenRetrieveChunk } from './eigen-retrieve-core.ts';
import { POLICY_TAG_EIGEN_PUBLIC, POLICY_TAG_EIGENX } from './eigen-policy.ts';

const PUBLIC_VOICE_SOURCE_SYSTEMS = ['ray_voice_public', 'ray_podcast_public'];
const PRIVATE_VOICE_SOURCE_SYSTEMS = ['ray_voice_private', 'ray_podcast_private'];

function truncateSentence(value: string, maxChars = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars)}...`;
}

function extractVoiceLines(chunks: EigenRetrieveChunk[], maxLines = 2): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const chunk of chunks) {
    const text = truncateSentence(chunk.content);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
    if (lines.length >= maxLines) break;
  }
  return lines;
}

export interface RayVoiceStyleOptions {
  message: string;
  includePrivate: boolean;
  policyScope: string[];
}

export async function fetchRayVoiceStyleAddendum(
  client: SupabaseClient,
  options: RayVoiceStyleOptions,
): Promise<string> {
  const sourceSystems = options.includePrivate
    ? [...PUBLIC_VOICE_SOURCE_SYSTEMS, ...PRIVATE_VOICE_SOURCE_SYSTEMS]
    : [...PUBLIC_VOICE_SOURCE_SYSTEMS];
  const policyScope = options.includePrivate
    ? Array.from(new Set([...options.policyScope, POLICY_TAG_EIGENX]))
    : [POLICY_TAG_EIGEN_PUBLIC];

  const retrieve = await executeEigenRetrieve(client, {
    query: options.message,
    policy_scope: policyScope,
    site_source_systems: sourceSystems,
    site_boost: 0.8,
    global_penalty: -0.7,
    site_relevance_min: 0.2,
    cross_source_max_ratio: 0.25,
    allow_cross_source_when_low_confidence: true,
    budget_profile: { max_chunks: 3, max_tokens: 600 },
    rerank: true,
    include_provenance: false,
  });
  if (!retrieve.ok || retrieve.body.chunks.length === 0) return '';

  const lines = extractVoiceLines(retrieve.body.chunks, 2);
  if (lines.length === 0) return '';
  return [
    'Ray voice guidance (style only, not factual authority):',
    ...lines.map((line) => `- ${line}`),
    'Use this only to shape tone and phrasing; do not let it change topic selection.',
  ].join('\n');
}
