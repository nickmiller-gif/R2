/**
 * REGENT — corpus citation resolver.
 *
 * REGENT's "brain" is the codified MBA method (the /Users/nick/CMU archive).
 * Each framework string names the course(s) it draws on, e.g.
 *   "Economic profit / EVA (Strategy, Performance Measurement & Corporate Governance)".
 * This resolver maps those course names to real readings/working models from the
 * committed corpus index, so every recommendation cites a verifiable source —
 * turning framework provenance from a label into a link. Pure + deterministic.
 */

import { CORPUS_INDEX } from './corpus-index.ts';

export interface Citation {
  course: string;
  source?: string;
  kind?: 'reading' | 'model';
}

function normalizeCourse(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Generic names that appear in framework strings, mapped to a real course key.
const ALIASES: Record<string, string> = {
  accounting: 'financial and managerial accounting i',
  governance: 'strategy performance measurement and corporate governance',
  'executive communication': 'executive communication skills',
};

/** Expand "Finance I/II" into ["Finance I", "Finance II"]. */
function expandSlashedNumerals(name: string): string[] {
  const m = name.match(/^(.*?)\s+([IVX]+)\/([IVX]+)$/i);
  if (m) return [`${m[1]} ${m[2]}`, `${m[1]} ${m[3]}`];
  return [name];
}

/** Pull the course names out of a framework string's trailing "(A; B; C)".
 * Courses are separated by ';' only — commas occur inside course names. */
export function citedCourses(framework: string): string[] {
  const m = framework.match(/\(([^)]*)\)\s*$/);
  if (!m || !m[1]) return [];
  return m[1]
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(expandSlashedNumerals);
}

const KEYWORDS = [
  'eva',
  'pricing',
  'evc',
  'portfolio',
  'diversification',
  'variance',
  'production',
  'constraint',
  'culture',
  'negotiation',
  'cost',
  'incentive',
  'valuation',
];

function bestSource(
  course: (typeof CORPUS_INDEX)[string],
  framework: string,
): { source?: string; kind?: 'reading' | 'model' } {
  const hay = framework.toLowerCase();
  const hit = (list: string[]) =>
    list.find((t) => KEYWORDS.some((k) => hay.includes(k) && t.toLowerCase().includes(k)));
  const r = hit(course.readings);
  if (r) return { source: r, kind: 'reading' };
  const m = hit(course.models);
  if (m) return { source: m, kind: 'model' };
  if (course.readings[0]) return { source: course.readings[0], kind: 'reading' };
  if (course.models[0]) return { source: course.models[0], kind: 'model' };
  return {};
}

/** Resolve a framework string to corpus citations (course + best-matching source). */
export function citeFramework(framework: string): Citation[] {
  const out: Citation[] = [];
  for (const name of citedCourses(framework)) {
    const key0 = normalizeCourse(name);
    const key = CORPUS_INDEX[key0] ? key0 : (ALIASES[key0] ?? key0);
    const course = CORPUS_INDEX[key];
    if (!course) continue;
    const { source, kind } = bestSource(course, framework);
    out.push({ course: course.course, source, kind });
  }
  return out;
}

/** Distinct courses a set of decisions draws on — a faculty's corpus basis. */
export function corpusBasis(frameworks: string[]): string[] {
  const seen = new Set<string>();
  for (const f of frameworks) {
    for (const c of citeFramework(f)) seen.add(c.course);
  }
  return [...seen];
}
