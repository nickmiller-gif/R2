export type RevolutionaryMeshScore = {
  pass: boolean;
  score: number;
  detail: string;
};

type PatternShape = {
  title?: unknown;
  domains?: unknown;
  narrative?: unknown;
  recommended_bot_mesh_action?: unknown;
  confidence?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return trimmed;
}

function isValidPattern(entry: PatternShape): boolean {
  if (!isRecord(entry)) return false;
  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  const narrative = typeof entry.narrative === 'string' ? entry.narrative.trim() : '';
  const action =
    typeof entry.recommended_bot_mesh_action === 'string'
      ? entry.recommended_bot_mesh_action.trim()
      : '';
  const domains = Array.isArray(entry.domains)
    ? entry.domains.filter((d) => typeof d === 'string' && d.trim().length > 0)
    : [];
  const confidence = Number(entry.confidence);
  if (!title || !narrative || !action || domains.length < 2) return false;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return false;
  return true;
}

/** Validates LLM JSON for revolutionary mesh cross-domain pattern synthesis. */
export function scoreRevolutionaryMeshJson(response: string): RevolutionaryMeshScore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonCandidate(response));
  } catch {
    return { pass: false, score: 0, detail: 'response is not valid JSON' };
  }

  const patterns = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.patterns)
      ? parsed.patterns
      : [];

  if (patterns.length < 2) {
    return { pass: false, score: 0, detail: `expected >=2 patterns, got ${patterns.length}` };
  }
  if (patterns.length > 6) {
    return { pass: false, score: 0, detail: `expected <=6 patterns, got ${patterns.length}` };
  }

  const invalid = patterns.filter((entry) => !isValidPattern(entry as PatternShape));
  if (invalid.length > 0) {
    return {
      pass: false,
      score: 0,
      detail: `${invalid.length} pattern object(s) missing required fields`,
    };
  }

  return { pass: true, score: 1, detail: 'revolutionary mesh JSON shape valid' };
}
