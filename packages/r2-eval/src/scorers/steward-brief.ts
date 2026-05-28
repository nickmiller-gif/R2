export type StewardBriefScore = {
  pass: boolean;
  score: number;
  detail: string;
};

type FindingShape = {
  finding_id?: unknown;
  check_type?: unknown;
  suggested_fill_action?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (match?.[1]) return match[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

/** Validates steward_brief_published payload JSON shape. */
export function scoreStewardBriefJson(response: string): StewardBriefScore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonCandidate(response));
  } catch {
    return { pass: false, score: 0, detail: 'response is not valid JSON' };
  }

  if (!isRecord(parsed)) {
    return { pass: false, score: 0, detail: 'root must be an object' };
  }

  const pattern_id = typeof parsed.pattern_id === 'string' ? parsed.pattern_id.trim() : '';
  const narrative = typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '';
  const domains = Array.isArray(parsed.domains) ? parsed.domains : [];
  const meg = Array.isArray(parsed.meg_entity_ids) ? parsed.meg_entity_ids : [];
  const score = Number(parsed.completeness_score);
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  const actions = Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [];

  if (!pattern_id || !narrative) {
    return { pass: false, score: 0, detail: 'pattern_id and narrative required' };
  }
  if (domains.length < 3) {
    return { pass: false, score: 0, detail: `expected >=3 domains, got ${domains.length}` };
  }
  if (meg.length < 1) {
    return { pass: false, score: 0, detail: 'meg_entity_ids required' };
  }
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    return { pass: false, score: 0, detail: 'completeness_score must be 0-1' };
  }
  if (actions.length < 1) {
    return { pass: false, score: 0, detail: 'recommended_actions required' };
  }

  const invalidFindings = findings.filter((f) => {
    if (!isRecord(f)) return true;
    const row = f as FindingShape;
    return (
      typeof row.finding_id !== 'string' ||
      typeof row.check_type !== 'string' ||
      typeof row.suggested_fill_action !== 'string'
    );
  });
  if (invalidFindings.length > 0) {
    return { pass: false, score: 0, detail: 'invalid findings entries' };
  }

  return { pass: true, score: 1, detail: 'steward brief JSON shape valid' };
}
