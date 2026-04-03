import {
  stageErr,
  stageOk,
  type OpportunityDraft,
  type ScoredWhitespaceFrame,
  type StageResult,
  type ThesisSnapshot,
} from './types.ts';

function linkedEvidence(thesis: ThesisSnapshot): string[] {
  const v = Array.isArray(thesis.validation_evidence_item_ids)
    ? thesis.validation_evidence_item_ids
    : [];
  const c = Array.isArray(thesis.contradiction_evidence_item_ids)
    ? thesis.contradiction_evidence_item_ids
    : [];
  return [...v, ...c].filter((id): id is string => typeof id === 'string');
}

export function buildOpportunityPortfolio(
  scored: ScoredWhitespaceFrame[],
  thesesById: Map<string, ThesisSnapshot>,
): StageResult<OpportunityDraft[]> {
  try {
    const opportunities = scored
      .map((frame) => {
        const thesis = thesesById.get(frame.thesisId);
        if (!thesis) return null;

        const status = frame.downgradeReason ? 'watchlist' : 'candidate';
        const pricingModel = frame.evidenceSupportScore >= 60 ? 'recurring' : 'pilot';
        const estimated = frame.evidenceSupportScore >= 55
          ? Math.round((thesis.confidence + frame.confidenceEconomics) * 50)
          : null;

        const timeToRevenue = frame.confidenceTiming >= 70 ? '0-30 days' : '31-90 days';
        const proofRequired = frame.downgradeReason
          ? 'Resolve contradictory evidence and gather primary buyer validation.'
          : 'Validate willingness to pay with 3 buyer interviews.';

        return {
          profile_id: thesis.profile_id,
          thesis_id: thesis.id,
          title: thesis.title,
          buyer: frame.buyer,
          offer: frame.offer,
          pricing_model: pricingModel,
          estimated_acv_or_ltv: estimated,
          channel: frame.channel,
          time_to_first_revenue: timeToRevenue,
          proof_required: proofRequired,
          evidence_support_score: frame.evidenceSupportScore,
          confidence_thesis: thesis.confidence,
          confidence_economics: frame.confidenceEconomics,
          confidence_timing: frame.confidenceTiming,
          status,
          linked_evidence_ids: linkedEvidence(thesis),
          metadata: {
            downgrade_reason: frame.downgradeReason,
            whitespace_score: frame.whitespaceScore,
            contradiction_ratio: frame.contradictionRatio,
          },
        } satisfies OpportunityDraft;
      })
      .filter((item): item is OpportunityDraft => item !== null)
      .sort((a, b) => b.evidence_support_score - a.evidence_support_score);

    return stageOk(opportunities);
  } catch (error) {
    return stageErr(
      'buildOpportunityPortfolio',
      'PORTFOLIO_BUILD_FAILED',
      'Failed to construct opportunity portfolio.',
      true,
      error,
    );
  }
}
