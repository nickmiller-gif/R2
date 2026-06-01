import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeEigenRetrieve, type EigenRetrieveChunk } from './eigen-retrieve-core.ts';
import { POLICY_TAG_EIGEN_PUBLIC, POLICY_TAG_EIGENX } from './eigen-policy.ts';
import { searchEigenCorpusMulti } from './eigen-corpus-search.ts';
import { eigenVoiceStoreIds } from './eigen-corpus-stores.ts';
import { openAiVectorRetrievalEnabled } from './eigen-openai-corpus-retrieval.ts';

async function fetchOpenAiVoiceLines(message: string, maxLines: number): Promise<string[]> {
  if (!openAiVectorRetrievalEnabled()) return [];
  const storeIds = eigenVoiceStoreIds();
  if (storeIds.length === 0) return [];
  const hits = await searchEigenCorpusMulti(message, {
    storeIds,
    maxResults: maxLines,
    timeoutMs: 6000,
  });
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const hit of hits) {
    const text = truncateSentence(hit.snippet ?? '');
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
    if (lines.length >= maxLines) break;
  }
  return lines;
}

const PUBLIC_VOICE_SOURCE_SYSTEMS = ['ray_voice_public', 'ray_podcast_public'];
const PRIVATE_VOICE_SOURCE_SYSTEMS = ['ray_voice_private', 'ray_podcast_private'];
const PUBLIC_CORRESPONDENCE_SOURCE_SYSTEMS = ['ray_correspondence_public'];
const PRIVATE_CORRESPONDENCE_SOURCE_SYSTEMS = ['ray_correspondence_private'];

function truncateSentence(value: string, maxChars = 220): string {
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

async function retrieveStyleChunks(
  client: SupabaseClient,
  options: {
    message: string;
    sourceSystems: string[];
    policyScope: string[];
    maxChunks: number;
    siteBoost: number;
  },
): Promise<EigenRetrieveChunk[]> {
  const retrieve = await executeEigenRetrieve(client, {
    query: options.message,
    policy_scope: options.policyScope,
    site_source_systems: options.sourceSystems,
    site_boost: options.siteBoost,
    global_penalty: -0.7,
    site_relevance_min: 0.18,
    cross_source_max_ratio: 0.25,
    allow_cross_source_when_low_confidence: true,
    budget_profile: { max_chunks: options.maxChunks, max_tokens: 900 },
    rerank: true,
    include_provenance: false,
  });
  if (!retrieve.ok) return [];
  return retrieve.body.chunks;
}

export async function fetchRayVoiceStyleAddendum(
  client: SupabaseClient,
  options: RayVoiceStyleOptions,
): Promise<string> {
  const policyScope = options.includePrivate
    ? Array.from(new Set([...options.policyScope, POLICY_TAG_EIGENX]))
    : [POLICY_TAG_EIGEN_PUBLIC];

  const correspondenceSystems = options.includePrivate
    ? [...PUBLIC_CORRESPONDENCE_SOURCE_SYSTEMS, ...PRIVATE_CORRESPONDENCE_SOURCE_SYSTEMS]
    : [...PUBLIC_CORRESPONDENCE_SOURCE_SYSTEMS];

  const voiceSystems = options.includePrivate
    ? [...PUBLIC_VOICE_SOURCE_SYSTEMS, ...PRIVATE_VOICE_SOURCE_SYSTEMS]
    : [...PUBLIC_VOICE_SOURCE_SYSTEMS];

  const [correspondenceChunks, voiceChunks, openAiVoiceLines] = await Promise.all([
    retrieveStyleChunks(client, {
      message: options.message,
      sourceSystems: correspondenceSystems,
      policyScope,
      maxChunks: 4,
      siteBoost: 0.95,
    }),
    retrieveStyleChunks(client, {
      message: options.message,
      sourceSystems: voiceSystems,
      policyScope,
      maxChunks: 2,
      siteBoost: 0.75,
    }),
    fetchOpenAiVoiceLines(options.message, 2),
  ]);

  const correspondenceLines = extractVoiceLines(correspondenceChunks, 3);
  const voiceLines = extractVoiceLines(voiceChunks, 2);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of [...correspondenceLines, ...voiceLines, ...openAiVoiceLines]) {
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    if (lines.length >= 5) break;
  }

  if (lines.length === 0) return '';

  const correspondenceUsed = correspondenceLines.length > 0;
  const intro = correspondenceUsed
    ? "Ray's correspondence examples (match tone and phrasing — style only, not factual authority):"
    : 'Ray voice guidance (style only, not factual authority):';

  return [
    intro,
    ...lines.map((line) => `- ${line}`),
    'Answer in the same conversational register Ray uses in email and text. Do not quote these examples verbatim.',
  ].join('\n');
}
