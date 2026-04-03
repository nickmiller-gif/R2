import { stageErr, stageOk, type ClusteredSignal, type StageResult, type WhitespaceFrame } from './types.ts';

export function buildWhitespaceFrame(
  signals: ClusteredSignal[],
): StageResult<WhitespaceFrame[]> {
  try {
    const frames = signals.map((signal) => {
      const evidenceSupportScore = Math.round(
        Math.min(
          100,
          signal.evidenceStrength * 0.7 + Math.min(signal.validationCount * 10, 30),
        ),
      );
      const contradictionRatio =
        signal.validationCount + signal.contradictionCount === 0
          ? 0
          : signal.contradictionCount / (signal.validationCount + signal.contradictionCount);
      const whitespaceScore = Math.round(Math.max(0, 100 - evidenceSupportScore + contradictionRatio * 20));

      return {
        thesisId: signal.thesisId,
        profileId: signal.profileId,
        title: signal.title,
        buyer: signal.buyer,
        offer: signal.offer,
        channel: signal.channel,
        whitespaceScore,
        evidenceSupportScore,
        contradictionRatio,
      };
    });

    return stageOk(frames);
  } catch (error) {
    return stageErr(
      'buildWhitespaceFrame',
      'WHITESPACE_FRAME_FAILED',
      'Failed to build whitespace frame.',
      true,
      error,
    );
  }
}
