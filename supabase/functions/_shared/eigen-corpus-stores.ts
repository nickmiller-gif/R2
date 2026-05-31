/**
 * Registry of the OpenAI Vector Stores that back Eigen retrieval.
 *
 * Per owner direction, ALL listed store content is treated as public-readable,
 * so there is NO per-tier access filtering — Eigen reads across the full corpus
 * set on both the public and EigenX surfaces.
 *
 * SAFETY NOTE: `hankin_pack_admin`, `crown_castle_admin`, and `admin_sensitive`
 * are currently empty. They remain here per the "all public" direction, but
 * anything later uploaded to them becomes readable by the anonymous public
 * surface. Remove the entry here to exclude a store.
 *
 * `role`:
 *   - 'corpus' → factual retrieval context.
 *   - 'voice'  → persona/style shaping only (mold Eigen to sound like Ray);
 *               never used as factual context.
 *
 * Store ids are not secret — the OPENAI_API_KEY is the credential and stays
 * server-side — so they live in source for discoverability/version control.
 */

export type EigenCorpusStoreRole = 'corpus' | 'voice';

export interface EigenCorpusStore {
  name: string;
  id: string;
  role: EigenCorpusStoreRole;
}

export const EIGEN_CORPUS_STORES: readonly EigenCorpusStore[] = [
  { name: 'public_doctrine', id: 'vs_69b368cc985c81919f249076f819fcf4', role: 'corpus' },
  { name: 'shared_general', id: 'vs_69b368ea7c0481918a72e7d0d9ee1ae0', role: 'corpus' },
  { name: 'real_estate', id: 'vs_69b3690ba2f08191808ea6e34365ca0c', role: 'corpus' },
  { name: 'legal_ip', id: 'vs_69b368fa35688191b50bc3c72fe1fd03', role: 'corpus' },
  { name: 'pharma_plrx', id: 'vs_69b36904586881918de4692e64e49a2d', role: 'corpus' },
  { name: 'career', id: 'vs_69b36930a2cc8191bb64ae346e1f0bac', role: 'corpus' },
  { name: 'marketing', id: 'vs_69b369237f7081918aef44a30f0df785', role: 'corpus' },
  { name: 'business', id: 'vs_69b3692c23d48191aee24a39ab8e2f7a', role: 'corpus' },
  { name: 'client_intelligence', id: 'vs_69b3691bee088191b1a859fc17341521', role: 'corpus' },
  { name: 'strategy_intelligence', id: 'vs_69b36913e6f481918d0f44e77fd9be99', role: 'corpus' },
  { name: 'future', id: 'vs_69b36c0271348191bf32ff85754e3fc2', role: 'corpus' },
  { name: 'smartplrx_internal', id: 'vs_69b61774070c8191bc12fcf490378f7f', role: 'corpus' },
  { name: 'hankin_pack_admin', id: 'vs_69b371fbd08c81918b45c2f2672f95a0', role: 'corpus' },
  { name: 'crown_castle_admin', id: 'vs_69b371f24fc88191a736744bcd131e5a', role: 'corpus' },
  { name: 'admin_sensitive', id: 'vs_69b368f0f98081918490832622e2d3ad', role: 'corpus' },
  { name: 'r2_mba_corpus', id: 'vs_6a1c2b22eaf08191babb35ef030ea792', role: 'corpus' },
  { name: 'ray_voice', id: 'vs_69b36935726881919c10484329b0f526', role: 'voice' },
] as const;

/** Vector store ids used as factual retrieval context. */
export function eigenCorpusStoreIds(): string[] {
  return EIGEN_CORPUS_STORES.filter((s) => s.role === 'corpus').map((s) => s.id);
}

/** Vector store id(s) that shape Eigen's response persona (Ray's voice). */
export function eigenVoiceStoreIds(): string[] {
  return EIGEN_CORPUS_STORES.filter((s) => s.role === 'voice').map((s) => s.id);
}
