/**
 * Op#5 offline AI eval harness — scaffold.
 * Gates synthesis-heavy surfaces until corpus + pass-rate baselines exist.
 */

export type { EvalCorpusEntry, EvalCorpusFile } from './corpus.ts';
export { assertEvalCorpusFile, parseEvalCorpusFile } from './corpus.ts';
export { scoreKeywordConstraints } from './scorers/keywords.ts';
export type { KeywordScore } from './scorers/keywords.ts';
export { runDeterministicHarness } from './runner/deterministic.ts';
export type {
  DeterministicHarnessResultRow,
  DeterministicHarnessSummary,
} from './runner/deterministic.ts';

export { scoreUpgradeScoutJson } from './scorers/upgrade-scout.ts';
export type { UpgradeScoutScore } from './scorers/upgrade-scout.ts';
export { scoreRevolutionaryMeshJson } from './scorers/revolutionary-mesh.ts';
export type { RevolutionaryMeshScore } from './scorers/revolutionary-mesh.ts';
export { scoreStewardBriefJson } from './scorers/steward-brief.ts';
export type { StewardBriefScore } from './scorers/steward-brief.ts';

export const R2_EVAL_VERSION = '0.0.3' as const;
export const OP5_PASS_RATE_THRESHOLD = 0.85 as const;
