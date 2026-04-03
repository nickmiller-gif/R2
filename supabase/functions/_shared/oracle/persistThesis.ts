import { stageErr, stageOk, type StageResult, type ThesisSnapshot } from './types.ts';

interface SupabaseLike {
  from(table: string): {
    update(value: Record<string, unknown>): {
      eq(column: string, value: string): {
        select(): { single(): Promise<{ data: ThesisSnapshot | null; error: { message: string } | null }> };
      };
    };
  };
}

export async function persistThesis(
  client: SupabaseLike,
  thesisId: string,
  patch: Record<string, unknown>,
): Promise<StageResult<ThesisSnapshot>> {
  try {
    const { data, error } = await client
      .from('oracle_theses')
      .update(patch)
      .eq('id', thesisId)
      .select()
      .single();

    if (error || !data) {
      return stageErr('persistThesis', 'THESIS_PERSIST_FAILED', error?.message ?? 'Unknown persistence failure.', true);
    }

    return stageOk(data);
  } catch (error) {
    return stageErr('persistThesis', 'THESIS_PERSIST_FAILED', 'Failed to persist thesis.', true, error);
  }
}
