// R2 integration: replace with GET ${import.meta.env.VITE_API_URL}/oracle_signals?batchId={id}
// Oracle signal shape matches OracleSignal type in R2/src/types (to be published as npm package)
// Eigen: transcript docs stored with index_status/embedding_status lifecycle fields on backend

import type { OracleSignal } from '@/types/validation';
import fixtureData from '@/fixtures/oracleSignal.json';

export async function getResults(batchId: string): Promise<OracleSignal> {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  if (apiUrl) {
    const res = await fetch(`${apiUrl}/oracle_signals?batchId=${batchId}`);
    if (!res.ok) throw new Error(`getResults failed: ${res.status}`);
    return res.json() as Promise<OracleSignal>;
  }

  // Dev stub: return fixture data
  await new Promise((r) => setTimeout(r, 300));
  return fixtureData as OracleSignal;
}
