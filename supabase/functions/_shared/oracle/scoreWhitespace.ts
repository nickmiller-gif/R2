import {
  stageErr,
  stageOk,
  type ScoredWhitespaceFrame,
  type StageResult,
  type WhitespaceFrame,
} from './types.ts';

export function scoreWhitespace(frames: WhitespaceFrame[]): StageResult<ScoredWhitespaceFrame[]> {
  try {
    const scored = frames.map((frame) => {
      let confidenceEconomics = Math.round(frame.evidenceSupportScore * 0.9);
      const confidenceTiming = Math.round((100 - frame.whitespaceScore) * 0.8 + (1 - frame.contradictionRatio) * 20);
      let downgradeReason: string | null = null;

      if (frame.contradictionRatio >= 0.4) {
        confidenceEconomics = Math.max(0, confidenceEconomics - 35);
        downgradeReason = 'contradiction_downgrade';
      }

      if (frame.evidenceSupportScore < 45) {
        confidenceEconomics = Math.min(confidenceEconomics, 30);
        downgradeReason = downgradeReason ?? 'evidence_gate';
      }

      return {
        ...frame,
        confidenceEconomics,
        confidenceTiming: Math.max(0, Math.min(100, confidenceTiming)),
        downgradeReason,
      };
    });

    return stageOk(scored);
  } catch (error) {
    return stageErr('scoreWhitespace', 'WHITESPACE_SCORE_FAILED', 'Failed to score whitespace.', true, error);
  }
}
