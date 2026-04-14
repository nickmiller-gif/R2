import { describe, expect, it } from 'vitest';
import {
  applySiteRelevanceGate,
  inferOutsideDomainIntent,
  limitCrossSourceRatio,
} from '../../src/lib/eigen/source-relevance-gating.js';

type Candidate = {
  chunk_id: string;
  source_system: string;
  similarity_score: number;
  composite_score: number;
};

function sampleCandidates(): Candidate[] {
  return [
    { chunk_id: 'retreat-1', source_system: 'raysretreat', similarity_score: 0.82, composite_score: 0.8 },
    { chunk_id: 'retreat-2', source_system: 'raysretreat', similarity_score: 0.66, composite_score: 0.7 },
    { chunk_id: 'supp-1', source_system: 'health-supplement-tr', similarity_score: 0.63, composite_score: 0.69 },
    { chunk_id: 'supp-2', source_system: 'health-supplement-tr', similarity_score: 0.61, composite_score: 0.65 },
  ];
}

describe('applySiteRelevanceGate', () => {
  it('suppresses cross-source chunks when site evidence is strong', () => {
    const gated = applySiteRelevanceGate(sampleCandidates(), {
      siteSources: new Set(['raysretreat']),
      siteRelevanceMin: 0.36,
      allowCrossSourceWhenLowConfidence: true,
      outsideDomainIntent: false,
    });

    expect(gated.candidates.map((item) => item.chunk_id)).toEqual(['retreat-1', 'retreat-2']);
    expect(gated.crossSuppressedCount).toBe(2);
    expect(gated.crossSourceFallbackEnabled).toBe(false);
  });

  it('allows fallback when site evidence is weak', () => {
    const weakCandidates: Candidate[] = [
      { chunk_id: 'retreat-weak', source_system: 'raysretreat', similarity_score: 0.12, composite_score: 0.12 },
      { chunk_id: 'supp-strong', source_system: 'health-supplement-tr', similarity_score: 0.54, composite_score: 0.53 },
    ];

    const gated = applySiteRelevanceGate(weakCandidates, {
      siteSources: new Set(['raysretreat']),
      siteRelevanceMin: 0.36,
      allowCrossSourceWhenLowConfidence: true,
      outsideDomainIntent: false,
    });

    expect(gated.candidates.map((item) => item.chunk_id)).toEqual(['retreat-weak', 'supp-strong']);
    expect(gated.crossSourceFallbackEnabled).toBe(true);
  });

  it('allows cross-source when explicit outside-domain intent is detected', () => {
    const gated = applySiteRelevanceGate(sampleCandidates(), {
      siteSources: new Set(['raysretreat']),
      siteRelevanceMin: 0.36,
      allowCrossSourceWhenLowConfidence: false,
      outsideDomainIntent: true,
    });

    expect(gated.candidates).toHaveLength(4);
    expect(gated.crossSourceFallbackEnabled).toBe(true);
  });
});

describe('limitCrossSourceRatio', () => {
  it('caps cross-source share in ranked candidates', () => {
    const ranked: Candidate[] = [
      { chunk_id: 'retreat-1', source_system: 'raysretreat', similarity_score: 0.8, composite_score: 0.82 },
      { chunk_id: 'supp-1', source_system: 'health-supplement-tr', similarity_score: 0.77, composite_score: 0.8 },
      { chunk_id: 'retreat-2', source_system: 'raysretreat', similarity_score: 0.75, composite_score: 0.78 },
      { chunk_id: 'supp-2', source_system: 'health-supplement-tr', similarity_score: 0.74, composite_score: 0.77 },
    ];

    const limited = limitCrossSourceRatio(ranked, {
      siteSources: new Set(['raysretreat']),
      crossSourceMaxRatio: 0.25,
      maxChunks: 4,
    });

    expect(limited.candidates.map((item) => item.chunk_id)).toEqual(['retreat-1', 'supp-1', 'retreat-2']);
    expect(limited.droppedCrossSourceCount).toBe(1);
  });
});

describe('inferOutsideDomainIntent', () => {
  it('detects supplement-focused user intent', () => {
    expect(inferOutsideDomainIntent('What is the best NAD+ and creatine stack?')).toBe(true);
    expect(inferOutsideDomainIntent('Which sessions are in the retreat archive?')).toBe(false);
  });
});
