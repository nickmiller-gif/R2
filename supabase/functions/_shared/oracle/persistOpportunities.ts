import { stageErr, stageOk, type OpportunityDraft, type StageResult } from './types.ts';

interface SupabaseLike {
  from(table: string): {
    upsert(
      value: OpportunityDraft[],
      options: { onConflict: string; ignoreDuplicates?: boolean },
    ): {
      select(): Promise<{ data: OpportunityDraft[] | null; error: { message: string } | null }>;
    };
  };
}

export async function persistOpportunities(
  client: SupabaseLike,
  opportunities: OpportunityDraft[],
): Promise<StageResult<OpportunityDraft[]>> {
  if (opportunities.length === 0) {
    return stageOk([]);
  }

  try {
    const { data, error } = await client
      .from('oracle_opportunities')
      .upsert(opportunities, { onConflict: 'profile_id,thesis_id,title' })
      .select();

    if (error || !data) {
      return stageErr(
        'persistOpportunities',
        'OPPORTUNITY_PERSIST_FAILED',
        error?.message ?? 'Unknown persistence failure.',
        true,
      );
    }

    return stageOk(data);
  } catch (error) {
    return stageErr(
      'persistOpportunities',
      'OPPORTUNITY_PERSIST_FAILED',
      'Failed to persist opportunities.',
      true,
      error,
    );
  }
}
