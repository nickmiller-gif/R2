export interface WhitespaceFrame {
  thesisId: string;
  profileId: string;
  title: string;
  buyer: string;
  offer: string;
  channel: string;
  whitespaceScore: number;
  evidenceSupportScore: number;
  contradictionRatio: number;
}

export interface ScoredWhitespaceFrame extends WhitespaceFrame {
  confidenceEconomics: number;
  confidenceTiming: number;
  downgradeReason: string | null;
}

export interface ThesisSnapshot {
  id: string;
  profile_id: string;
  title: string;
  thesis_statement: string;
  confidence: number;
  evidence_strength: number;
  validation_evidence_item_ids: unknown;
  contradiction_evidence_item_ids: unknown;
  metadata?: Record<string, unknown>;
}

export interface OpportunityDraft {
  profile_id: string;
  thesis_id: string;
  title: string;
  buyer: string;
  offer: string;
  pricing_model: string;
  estimated_acv_or_ltv: number | null;
  channel: string;
  time_to_first_revenue: string;
  proof_required: string;
  evidence_support_score: number;
  confidence_thesis: number;
  confidence_economics: number;
  confidence_timing: number;
  status: string;
  linked_evidence_ids: string[];
  metadata: Record<string, unknown>;
}

export function scoreWhitespace(frames: WhitespaceFrame[]): ScoredWhitespaceFrame[] {
  return frames.map((frame) => {
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
}

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
): OpportunityDraft[] {
  return scored
    .map((frame): OpportunityDraft | null => {
      const thesis = thesesById.get(frame.thesisId);
      if (!thesis) return null;
      const status = frame.downgradeReason ? 'watchlist' : 'candidate';
      const pricingModel = frame.evidenceSupportScore >= 60 ? 'recurring' : 'pilot';
      const estimated = frame.evidenceSupportScore >= 55
        ? Math.round((thesis.confidence + frame.confidenceEconomics) * 50)
        : null;

      return {
        profile_id: thesis.profile_id,
        thesis_id: thesis.id,
        title: thesis.title,
        buyer: frame.buyer,
        offer: frame.offer,
        pricing_model: pricingModel,
        estimated_acv_or_ltv: estimated,
        channel: frame.channel,
        time_to_first_revenue: frame.confidenceTiming >= 70 ? '0-30 days' : '31-90 days',
        proof_required: frame.downgradeReason
          ? 'Resolve contradictory evidence and gather primary buyer validation.'
          : 'Validate willingness to pay with 3 buyer interviews.',
        evidence_support_score: frame.evidenceSupportScore,
        confidence_thesis: thesis.confidence,
        confidence_economics: frame.confidenceEconomics,
        confidence_timing: frame.confidenceTiming,
        status,
        linked_evidence_ids: linkedEvidence(thesis),
        metadata: {
          downgrade_reason: frame.downgradeReason,
        },
      };
    })
    .filter((item): item is OpportunityDraft => item !== null)
    .sort((a, b) => b.evidence_support_score - a.evidence_support_score);
}

export async function persistOpportunities(
  client: {
    from(table: string): {
      upsert(
        value: OpportunityDraft[],
        options: { onConflict: string; ignoreDuplicates?: boolean },
      ): {
        select(): Promise<{ data: OpportunityDraft[] | null; error: { message: string } | null }>;
      };
    };
  },
  opportunities: OpportunityDraft[],
): Promise<OpportunityDraft[]> {
  const { data, error } = await client
    .from('oracle_opportunities')
    .upsert(opportunities, { onConflict: 'profile_id,thesis_id,title' })
    .select();
  if (error || !data) throw new Error(error?.message ?? 'Failed to persist opportunities');
  return data;
}
