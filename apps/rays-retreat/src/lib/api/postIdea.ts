// R2 integration: replace with POST ${import.meta.env.VITE_API_URL}/idea_submissions
// Oracle signal shape matches OracleSignal type in R2/src/types (to be published as npm package)
// Eigen: transcript docs stored with index_status/embedding_status lifecycle fields on backend

import type { IdeaSubmission } from '@/types/validation';

export type PostIdeaInput = Omit<IdeaSubmission, 'id' | 'founderId' | 'createdAt' | 'status'>;
export type PostIdeaResult = { ideaId: string; batchId: string };

export async function postIdea(
  input: PostIdeaInput,
  packageTier: 'starter' | 'standard' = 'starter',
): Promise<PostIdeaResult> {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  if (apiUrl) {
    const res = await fetch(`${apiUrl}/idea_submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, packageTier }),
    });
    if (!res.ok) throw new Error(`postIdea failed: ${res.status}`);
    return res.json() as Promise<PostIdeaResult>;
  }

  // Dev stub: simulate network delay and return fixture ids
  await new Promise((r) => setTimeout(r, 600));
  return { ideaId: 'idea_001', batchId: 'batch_001' };
}
