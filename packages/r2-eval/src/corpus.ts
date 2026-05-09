export type EvalCorpusEntry = {
  id: string;
  prompt: string;
  domain: string;
  tags?: string[];
};

export type EvalCorpusFile = {
  version: number;
  entries: EvalCorpusEntry[];
};

const DOMAIN_SET = new Set([
  'platform_core',
  'retreat_commerce',
  'autonomous_ops',
  'ip_patent',
  'health_wellness',
  'productivity_memory',
]);

export function assertEvalCorpusFile(raw: unknown): asserts raw is EvalCorpusFile {
  if (!raw || typeof raw !== 'object') throw new Error('corpus: root must be an object');
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) throw new Error('corpus: version must be 1');
  if (!Array.isArray(o.entries)) throw new Error('corpus: entries must be an array');
  const seen = new Set<string>();
  for (const row of o.entries) {
    if (!row || typeof row !== 'object') throw new Error('corpus: each entry must be an object');
    const e = row as Record<string, unknown>;
    if (typeof e.id !== 'string' || !e.id.trim()) throw new Error('corpus: entry.id required');
    if (seen.has(e.id)) throw new Error(`corpus: duplicate id ${e.id}`);
    seen.add(e.id);
    if (typeof e.prompt !== 'string' || e.prompt.length < 20) {
      throw new Error(`corpus: entry ${e.id} prompt too short`);
    }
    if (typeof e.domain !== 'string' || !DOMAIN_SET.has(e.domain)) {
      throw new Error(`corpus: entry ${e.id} has invalid domain`);
    }
    if (e.tags !== undefined) {
      if (!Array.isArray(e.tags) || !e.tags.every((t) => typeof t === 'string')) {
        throw new Error(`corpus: entry ${e.id} tags must be string[]`);
      }
    }
  }
  if (o.entries.length < 10) throw new Error('corpus: minimum 10 entries for week-1 harness');
}

export function parseEvalCorpusFile(raw: unknown): EvalCorpusFile {
  assertEvalCorpusFile(raw);
  return raw;
}
