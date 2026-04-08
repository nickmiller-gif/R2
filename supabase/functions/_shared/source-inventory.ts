import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { POLICY_TAG_EIGEN_PUBLIC, POLICY_TAG_EIGENX } from './eigen-policy.ts';

interface DocumentRow {
  id: string;
  source_system: string;
  source_ref: string | null;
  title: string;
  content_type: string | null;
  updated_at: string;
}

interface ChunkRow {
  document_id: string;
  policy_tags: unknown;
}

export interface SourceInventoryDocument {
  document_id: string;
  source_system: string;
  source_ref: string | null;
  title: string;
  content_type: string | null;
  updated_at: string;
  policy_tags: string[];
  chunk_count: number;
}

export interface SourceInventorySummary {
  source_system: string;
  document_count: number;
  chunk_count: number;
  public_document_count: number;
  eigenx_document_count: number;
  latest_updated_at: string | null;
  sample_source_refs: string[];
}

export interface SourceInventoryResult {
  generated_at: string;
  mode: 'all' | 'public';
  total_documents: number;
  total_chunks: number;
  sources: SourceInventorySummary[];
  documents: SourceInventoryDocument[];
}

function readInventoryLimit(): number {
  const raw = Deno.env.get('EIGEN_SOURCE_INVENTORY_DOC_LIMIT') ?? '500';
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 10) return 500;
  return Math.min(parsed, 5000);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function byUpdatedDesc(a: DocumentRow, b: DocumentRow): number {
  return b.updated_at.localeCompare(a.updated_at);
}

export async function fetchSourceInventory(
  client: SupabaseClient,
  mode: 'all' | 'public',
): Promise<SourceInventoryResult> {
  const limit = readInventoryLimit();
  const docsRes = await client
    .from('documents')
    .select('id,source_system,source_ref,title,content_type,updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (docsRes.error) throw new Error(docsRes.error.message);

  const docs = (docsRes.data ?? []) as DocumentRow[];
  if (docs.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      mode,
      total_documents: 0,
      total_chunks: 0,
      sources: [],
      documents: [],
    };
  }

  const docIds = docs.map((d) => d.id);
  const chunkRes = await client
    .from('knowledge_chunks')
    .select('document_id,policy_tags')
    .in('document_id', docIds);
  if (chunkRes.error) throw new Error(chunkRes.error.message);

  const chunks = (chunkRes.data ?? []) as ChunkRow[];
  const byDoc = new Map<string, { chunkCount: number; tags: Set<string> }>();
  for (const row of chunks) {
    const entry = byDoc.get(row.document_id) ?? { chunkCount: 0, tags: new Set<string>() };
    entry.chunkCount += 1;
    for (const tag of asStringList(row.policy_tags)) entry.tags.add(tag);
    byDoc.set(row.document_id, entry);
  }

  const filteredDocs = docs
    .filter((doc) => {
      const tags = byDoc.get(doc.id)?.tags ?? new Set<string>();
      if (mode === 'public') return tags.has(POLICY_TAG_EIGEN_PUBLIC);
      return true;
    })
    .sort(byUpdatedDesc);

  const documents: SourceInventoryDocument[] = filteredDocs.map((doc) => {
    const stat = byDoc.get(doc.id);
    const policyTags = stat ? Array.from(stat.tags).sort() : [];
    return {
      document_id: doc.id,
      source_system: doc.source_system,
      source_ref: doc.source_ref,
      title: doc.title,
      content_type: doc.content_type,
      updated_at: doc.updated_at,
      policy_tags: policyTags,
      chunk_count: stat?.chunkCount ?? 0,
    };
  });

  const sourceMap = new Map<string, SourceInventorySummary>();
  for (const doc of documents) {
    const key = doc.source_system;
    const current = sourceMap.get(key) ?? {
      source_system: key,
      document_count: 0,
      chunk_count: 0,
      public_document_count: 0,
      eigenx_document_count: 0,
      latest_updated_at: null,
      sample_source_refs: [],
    };
    current.document_count += 1;
    current.chunk_count += doc.chunk_count;
    if (doc.policy_tags.includes(POLICY_TAG_EIGEN_PUBLIC)) current.public_document_count += 1;
    if (doc.policy_tags.includes(POLICY_TAG_EIGENX)) current.eigenx_document_count += 1;
    if (!current.latest_updated_at || doc.updated_at > current.latest_updated_at) {
      current.latest_updated_at = doc.updated_at;
    }
    if (doc.source_ref && current.sample_source_refs.length < 5 && !current.sample_source_refs.includes(doc.source_ref)) {
      current.sample_source_refs.push(doc.source_ref);
    }
    sourceMap.set(key, current);
  }

  const sources = Array.from(sourceMap.values()).sort((a, b) => b.document_count - a.document_count);
  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunk_count, 0);

  return {
    generated_at: new Date().toISOString(),
    mode,
    total_documents: documents.length,
    total_chunks: totalChunks,
    sources,
    documents,
  };
}
