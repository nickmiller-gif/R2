export interface SourceRelevanceCandidate {
  source_system: string;
  similarity_score: number;
}

export interface SiteRelevanceGateOptions {
  siteSources: Set<string>;
  siteRelevanceMin?: number;
  allowCrossSourceWhenLowConfidence?: boolean;
  outsideDomainIntent?: boolean;
}

export interface SiteRelevanceGateResult<T extends SourceRelevanceCandidate> {
  candidates: T[];
  siteCandidateCount: number;
  crossCandidateCount: number;
  crossSuppressedCount: number;
  bestSiteSimilarity: number;
  crossSourceFallbackEnabled: boolean;
}

export interface CrossSourceRatioOptions {
  siteSources: Set<string>;
  crossSourceMaxRatio?: number;
  maxChunks?: number;
}

export interface CrossSourceRatioResult<T extends SourceRelevanceCandidate> {
  candidates: T[];
  droppedCrossSourceCount: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function inferOutsideDomainIntent(query: string): boolean {
  const normalized = query.toLowerCase();
  const patterns = [
    /\bsupplement(s)?\b/,
    /\blongevity stack\b/,
    /\bcognitive stack\b/,
    /\bsleep stack\b/,
    /\bnad\+?\b/,
    /\bresveratrol\b/,
    /\bomega[-\s]?3\b/,
    /\bcreatine\b/,
    /\blion'?s mane\b/,
    /\bapigenin\b/,
    /\bl[-\s]?theanine\b/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

export function applySiteRelevanceGate<T extends SourceRelevanceCandidate>(
  candidates: T[],
  options: SiteRelevanceGateOptions,
): SiteRelevanceGateResult<T> {
  const siteSources = options.siteSources;
  if (siteSources.size === 0) {
    return {
      candidates,
      siteCandidateCount: 0,
      crossCandidateCount: 0,
      crossSuppressedCount: 0,
      bestSiteSimilarity: 0,
      crossSourceFallbackEnabled: false,
    };
  }

  const siteCandidates: T[] = [];
  const crossCandidates: T[] = [];
  for (const candidate of candidates) {
    if (siteSources.has(candidate.source_system)) siteCandidates.push(candidate);
    else crossCandidates.push(candidate);
  }

  const bestSiteSimilarity = siteCandidates.reduce(
    (best, candidate) => Math.max(best, candidate.similarity_score),
    0,
  );
  const siteRelevanceMin = clamp(options.siteRelevanceMin ?? 0.34, 0, 1);
  const siteEvidenceStrong =
    siteCandidates.length > 0 && bestSiteSimilarity >= siteRelevanceMin;

  const crossSourceFallbackEnabled =
    options.outsideDomainIntent === true ||
    (options.allowCrossSourceWhenLowConfidence === true && !siteEvidenceStrong);

  if (crossSourceFallbackEnabled || siteCandidates.length === 0) {
    return {
      candidates,
      siteCandidateCount: siteCandidates.length,
      crossCandidateCount: crossCandidates.length,
      crossSuppressedCount: 0,
      bestSiteSimilarity,
      crossSourceFallbackEnabled,
    };
  }

  return {
    candidates: siteCandidates,
    siteCandidateCount: siteCandidates.length,
    crossCandidateCount: crossCandidates.length,
    crossSuppressedCount: crossCandidates.length,
    bestSiteSimilarity,
    crossSourceFallbackEnabled: false,
  };
}

export function limitCrossSourceRatio<T extends SourceRelevanceCandidate>(
  candidates: T[],
  options: CrossSourceRatioOptions,
): CrossSourceRatioResult<T> {
  const siteSources = options.siteSources;
  const ratioRaw = options.crossSourceMaxRatio;
  if (siteSources.size === 0 || typeof ratioRaw !== 'number') {
    return { candidates, droppedCrossSourceCount: 0 };
  }

  const ratio = clamp(ratioRaw, 0, 1);
  const maxChunks = Math.max(1, options.maxChunks ?? candidates.length);
  const maxCrossByRatio = Math.floor(maxChunks * ratio);
  const allowedCrossCount = ratio > 0 ? Math.max(1, maxCrossByRatio) : 0;

  if (allowedCrossCount >= maxChunks) {
    return { candidates, droppedCrossSourceCount: 0 };
  }

  const next: T[] = [];
  let crossCount = 0;
  let droppedCrossSourceCount = 0;

  for (const candidate of candidates) {
    if (siteSources.has(candidate.source_system)) {
      next.push(candidate);
      continue;
    }
    if (crossCount < allowedCrossCount) {
      next.push(candidate);
      crossCount += 1;
      continue;
    }
    droppedCrossSourceCount += 1;
  }

  return { candidates: next, droppedCrossSourceCount };
}
