// R2 integration: replace with GET ${import.meta.env.VITE_API_URL}/validation_batches/{id}
// Oracle signal shape matches OracleSignal type in R2/src/types (to be published as npm package)
// Eigen: transcript docs stored with index_status/embedding_status lifecycle fields on backend

import type { ValidationBatch } from '@/types/validation';
import fixtureData from '@/fixtures/validationBatch.json';

export async function getValidationStatus(batchId: string): Promise<ValidationBatch> {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  if (apiUrl) {
    const res = await fetch(`${apiUrl}/validation_batches/${batchId}`);
    if (!res.ok) throw new Error(`getValidationStatus failed: ${res.status}`);
    return res.json() as Promise<ValidationBatch>;
  }

  // Dev stub: return fixture data
  await new Promise((r) => setTimeout(r, 300));
  return fixtureData as ValidationBatch;
}
