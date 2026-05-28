export type UpgradeScoutScore = {
  pass: boolean;
  score: number;
  detail: string;
};

type UpgradeShape = {
  headline?: unknown;
  why_now?: unknown;
  proposed_bot_action?: unknown;
  confidence?: unknown;
  impacted_stream?: unknown;
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
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1).trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return trimmed;
}

function isValidUpgrade(entry: UpgradeShape): boolean {
  if (!isRecord(entry)) return false;
  const headline = typeof entry.headline === 'string' ? entry.headline.trim() : '';
  const why_now = typeof entry.why_now === 'string' ? entry.why_now.trim() : '';
  const proposed =
    typeof entry.proposed_bot_action === 'string' ? entry.proposed_bot_action.trim() : '';
  const stream = typeof entry.impacted_stream === 'string' ? entry.impacted_stream.trim() : '';
  const confidence = Number(entry.confidence);
  if (!headline || !why_now || !proposed || !stream) return false;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return false;
  return true;
}

/**
 * Validates LLM JSON for autonomous upgrade scout responses (3–8 proposals).
 */
export function scoreUpgradeScoutJson(response: string): UpgradeScoutScore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonCandidate(response));
  } catch {
    return { pass: false, score: 0, detail: 'response is not valid JSON' };
  }

  const upgrades = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.upgrades)
      ? parsed.upgrades
      : [];

  if (upgrades.length < 3) {
    return { pass: false, score: 0, detail: `expected >=3 upgrades, got ${upgrades.length}` };
  }
  if (upgrades.length > 8) {
    return { pass: false, score: 0, detail: `expected <=8 upgrades, got ${upgrades.length}` };
  }

  const invalid = upgrades.filter((entry) => !isValidUpgrade(entry as UpgradeShape));
  if (invalid.length > 0) {
    return {
      pass: false,
      score: 0,
      detail: `${invalid.length} upgrade object(s) missing required fields`,
    };
  }

  return { pass: true, score: 1, detail: 'upgrade scout JSON shape valid' };
}
