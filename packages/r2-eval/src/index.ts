/**
 * Op#5 offline AI eval harness — scaffold.
 * Gates synthesis-heavy surfaces until corpus + pass-rate baselines exist.
 */

export type { EvalCorpusEntry, EvalCorpusFile } from './corpus.ts';
export { assertEvalCorpusFile, parseEvalCorpusFile } from './corpus.ts';

export const R2_EVAL_VERSION = '0.0.1' as const;
