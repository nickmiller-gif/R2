import type { EigenRetrieveChunk } from './eigen-retrieve-core.ts';

export type LlmProvider = 'openai' | 'anthropic' | 'perplexity';
export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type CitationAuthorityTier = 'user_upload' | 'oracle' | 'charter' | 'web' | 'corpus';

export interface ChatConfidence {
  overall: ConfidenceLabel;
  retrieval: ConfidenceLabel;
  upload_support: ConfidenceLabel;
  model_agreement?: ConfidenceLabel;
  signals: {
    citation_count: number;
    avg_relevance: number;
    upload_ratio: number;
  };
}

export interface ChatCitation {
  chunk_id: string;
  source: string;
  section?: string;
  relevance: number;
  authority_tier: CitationAuthorityTier;
  evidence_tier: 'A' | 'B' | 'C' | 'D';
}

function classifyAuthorityTier(chunk: EigenRetrieveChunk): CitationAuthorityTier {
  const sourceSystem = chunk.provenance?.source_system?.toLowerCase() ?? '';
  if (sourceSystem.includes('upload') || sourceSystem.includes('manual')) return 'user_upload';
  if (sourceSystem.includes('oracle') || chunk.oracle_signal_id) return 'oracle';
  if (sourceSystem.includes('charter')) return 'charter';
  if (sourceSystem.includes('web') || sourceSystem.includes('perplexity')) return 'web';
  return 'corpus';
}

export function buildCitations(chunks: EigenRetrieveChunk[]): ChatCitation[] {
  return chunks.slice(0, 8).map((chunk) => ({
    chunk_id: chunk.chunk_id,
    source:
      chunk.provenance?.source_ref ??
      chunk.provenance?.source_system ??
      'unknown',
    section:
      chunk.provenance?.heading_path && chunk.provenance.heading_path.length > 0
        ? chunk.provenance.heading_path.join(' › ')
        : undefined,
    relevance: Number(chunk.composite_score?.toFixed(4) ?? chunk.similarity_score?.toFixed(4) ?? 0),
    authority_tier: classifyAuthorityTier(chunk),
    evidence_tier: classifyEvidenceTier(chunk),
  }));
}

function classifyEvidenceTier(chunk: EigenRetrieveChunk): 'A' | 'B' | 'C' | 'D' {
  const score = Number(chunk.composite_score ?? chunk.similarity_score ?? 0);
  if (score >= 0.85) return 'A';
  if (score >= 0.7) return 'B';
  if (score >= 0.5) return 'C';
  return 'D';
}

function toLabel(score: number): ConfidenceLabel {
  if (score >= 0.72) return 'high';
  if (score >= 0.42) return 'medium';
  return 'low';
}

export function buildCompositeConfidence(citations: ChatCitation[]): ChatConfidence {
  const count = citations.length;
  const avgRelevance = count > 0
    ? citations.reduce((sum, c) => sum + c.relevance, 0) / count
    : 0;
  const uploadCount = citations.filter((c) => c.authority_tier === 'user_upload').length;
  const uploadRatio = count > 0 ? uploadCount / count : 0;
  const retrievalScore = Math.min(1, (count / 6) * 0.55 + avgRelevance * 0.45);
  const uploadScore = Math.min(1, uploadRatio * 1.1);
  const blendedScore = retrievalScore * 0.7 + uploadScore * 0.3;

  return {
    overall: toLabel(blendedScore),
    retrieval: toLabel(retrievalScore),
    upload_support: toLabel(uploadScore),
    signals: {
      citation_count: count,
      avg_relevance: Number(avgRelevance.toFixed(4)),
      upload_ratio: Number(uploadRatio.toFixed(4)),
    },
  };
}

export function buildUploadFirstStrataWeights(
  explicit?: Record<string, number>,
): Record<string, number> | undefined {
  if (explicit && Object.keys(explicit).length > 0) return explicit;
  return {
    claim: 1.25,
    paragraph: 1.15,
    section: 1.05,
    document: 1.0,
  };
}
