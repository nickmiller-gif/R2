#!/usr/bin/env node
/**
 * Backfill / sync R2 `documents` into the Eigen OpenAI Vector Store so Eigen's
 * full corpus lives in "your OpenAI vector". OpenAI handles chunking +
 * embedding; we stamp each file with policy-tag + identity attributes so R2 can
 * do ACCESS-SCOPED retrieval (public surface -> `eigen_public`; EigenX -> the
 * principal's granted tags). The store has no row-level governance, so access
 * is enforced only when R2 queries it with the per-caller filter — keep the
 * store id / API key server-side.
 *
 *   OPENAI_API_KEY=...  EIGEN_CORPUS_VECTOR_STORE_ID=vs_...  \
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
 *     node scripts/eigen-corpus-sync.mjs [--limit 1000] [--page-size 200] [--dry-run] \
 *       [--store-name "Eigen Corpus"]
 *
 * Idempotent: skips documents already present in the store (filename = <id>.md).
 * A document's policy tags are the de-duped union of its knowledge_chunks'
 * `policy_tags`; documents with zero policy tags have undefined access and are
 * skipped (reported) rather than uploaded as unreachable content.
 *
 * NOTE: this is the initial/backfill path (mirrors scripts/regent-corpus-upload.mjs).
 * Ongoing per-ingest sync is a later slice.
 */

const arg = (flag, fb) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fb;
};
const has = (flag) => process.argv.includes(flag);

const KEY = process.env.OPENAI_API_KEY?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim()?.replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const DRY = has('--dry-run');
const LIMIT = Number(arg('--limit', '100000'));
const PAGE_SIZE = Math.max(1, Math.min(Number(arg('--page-size', '200')), 1000));

if (!KEY) {
  console.error('OPENAI_API_KEY required.');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
  process.exit(1);
}

const OAI = 'https://api.openai.com/v1';
const OAI_H = { Authorization: `Bearer ${KEY}` };
const SB_H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const MAX_ATTRS = 16; // OpenAI Vector Store attribute cap per file

/**
 * Stable OpenAI attribute key for a policy tag. MUST stay byte-for-byte
 * identical to `supabase/functions/_shared/eigen-corpus-search.ts`.
 */
function policyTagAttrKey(tag) {
  const slug = String(tag)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `tag_${slug}`;
}

async function resolveStoreId() {
  const id = process.env.EIGEN_CORPUS_VECTOR_STORE_ID?.trim();
  if (id) return id;
  const name = arg('--store-name', 'Eigen Corpus');
  const res = await fetch(`${OAI}/vector_stores?limit=100`, { headers: OAI_H });
  const body = await res.json();
  const match = (body.data ?? []).find((s) => s.name === name);
  if (!match) {
    throw new Error(`Vector store named "${name}" not found; set EIGEN_CORPUS_VECTOR_STORE_ID.`);
  }
  return match.id;
}

async function* fetchDocuments() {
  let fetched = 0;
  for (let offset = 0; fetched < LIMIT; offset += PAGE_SIZE) {
    const pageSize = Math.min(PAGE_SIZE, LIMIT - fetched);
    const select =
      'id,title,body,source_system,source_title,meg_entity_id,visibility,knowledge_chunks(policy_tags)';
    const url =
      `${SUPABASE_URL}/rest/v1/documents?select=${encodeURIComponent(select)}` +
      `&order=created_at.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: SB_H });
    if (!res.ok) throw new Error(`documents fetch failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return;
    for (const row of rows) yield row;
    fetched += rows.length;
    if (rows.length < pageSize) return;
  }
}

function uniqueTags(doc) {
  const chunks = Array.isArray(doc.knowledge_chunks) ? doc.knowledge_chunks : [];
  const tags = new Set();
  for (const c of chunks) {
    const pt = Array.isArray(c?.policy_tags) ? c.policy_tags : [];
    for (const t of pt) {
      if (typeof t === 'string' && t.trim()) tags.add(t.trim());
    }
  }
  return [...tags];
}

function buildAttributes(doc, tags) {
  const attrs = { document_id: String(doc.id) };
  if (doc.source_system) attrs.source_system = String(doc.source_system).slice(0, 200);
  if (doc.meg_entity_id) attrs.meg_entity_id = String(doc.meg_entity_id);
  if (doc.visibility) attrs.visibility = String(doc.visibility);
  const room = Math.max(0, MAX_ATTRS - Object.keys(attrs).length);
  let truncated = false;
  for (const t of tags.slice(0, room)) attrs[policyTagAttrKey(t)] = true;
  if (tags.length > room) truncated = true;
  return { attrs, truncated };
}

function buildFileContent(doc) {
  const header = [
    doc.title ? `# ${doc.title}` : null,
    doc.source_title ? `Source: ${doc.source_title}` : null,
    doc.source_system ? `System: ${doc.source_system}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const body = typeof doc.body === 'string' ? doc.body : '';
  return header ? `${header}\n\n${body}` : body;
}

async function existingDocFilenames(storeId) {
  const names = new Set();
  let after = '';
  for (let i = 0; i < 1000; i += 1) {
    const url = `${OAI}/vector_stores/${storeId}/files?limit=100${after ? `&after=${after}` : ''}`;
    const res = await fetch(url, { headers: OAI_H });
    if (!res.ok) throw new Error(`list store files failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    for (const f of body.data ?? []) {
      const fr = await fetch(`${OAI}/files/${f.id}`, { headers: OAI_H });
      const fb = await fr.json();
      if (fb.filename) names.add(fb.filename);
    }
    if (!body.has_more) break;
    after = body.last_id;
  }
  return names;
}

async function uploadFile(filename, content) {
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append('file', new Blob([content], { type: 'text/markdown' }), filename);
  const res = await fetch(`${OAI}/files`, { method: 'POST', headers: OAI_H, body: form });
  if (!res.ok) throw new Error(`file upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

async function addToStore(storeId, fileId, attrs) {
  const res = await fetch(`${OAI}/vector_stores/${storeId}/files`, {
    method: 'POST',
    headers: { ...OAI_H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, attributes: attrs }),
  });
  if (!res.ok) throw new Error(`attach failed: ${res.status} ${await res.text()}`);
}

const storeId = await resolveStoreId();
console.log(`Eigen corpus sync -> store ${storeId} (page-size ${PAGE_SIZE}, limit ${LIMIT}).`);

let considered = 0;
let uploaded = 0;
let skippedExisting = 0;
let skippedNoTags = 0;
let skippedEmpty = 0;
let truncatedTags = 0;
let failed = 0;

const present = DRY ? new Set() : await existingDocFilenames(storeId);

for await (const doc of fetchDocuments()) {
  considered += 1;
  const filename = `${doc.id}.md`;
  const tags = uniqueTags(doc);
  const content = buildFileContent(doc);

  if (!content.trim()) {
    skippedEmpty += 1;
    continue;
  }
  if (tags.length === 0) {
    skippedNoTags += 1;
    continue;
  }
  if (present.has(filename)) {
    skippedExisting += 1;
    continue;
  }

  const { attrs, truncated } = buildAttributes(doc, tags);
  if (truncated) truncatedTags += 1;

  if (DRY) {
    uploaded += 1;
    if (uploaded <= 5) console.log(`  would upload ${filename}`, attrs);
    continue;
  }

  try {
    const fileId = await uploadFile(filename, content);
    await addToStore(storeId, fileId, attrs);
    uploaded += 1;
    if (uploaded % 25 === 0) console.log(`  …${uploaded} uploaded`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL ${filename}: ${e.message}`);
  }
}

console.log(
  `Done. considered=${considered} uploaded=${uploaded} ` +
    `skipped(existing=${skippedExisting}, no_tags=${skippedNoTags}, empty=${skippedEmpty}) ` +
    `tag_truncated=${truncatedTags} failed=${failed}.`,
);
if (skippedNoTags > 0) {
  console.log(
    `Note: ${skippedNoTags} document(s) had no policy tags (undefined access) and were skipped.`,
  );
}
if (!DRY) {
  console.log(
    'OpenAI is chunking + embedding the batch; retrieval is ready once processing completes.',
  );
}
