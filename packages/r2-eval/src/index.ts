/**
 * Op#5 offline AI eval harness — scaffold.
 * Gates synthesis-heavy surfaces until corpus + pass-rate baselines exist.
 */

export type EvalCorpusEntry = {
  id: string;
  prompt: string;
  domain: string;
};

export const R2_EVAL_VERSION = '0.0.0-scaffold' as const;
