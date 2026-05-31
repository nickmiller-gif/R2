#!/usr/bin/env node
/**
 * One-time ingest of the CMU MBA corpus PDFs into the OpenAI Vector Store
 * ("R2 MBA Corpus") that backs REGENT's retrieval. OpenAI handles chunking +
 * embedding; we just upload each PDF with { course, module } attributes so the
 * bot can do course-scoped retrieval.
 *
 * Idempotent-ish: skips files already present in the store (by filename).
 *
 *   OPENAI_API_KEY=...  REGENT_CORPUS_VECTOR_STORE_ID=vs_...  \
 *     node scripts/regent-corpus-upload.mjs --root /Users/nick/CMU [--limit 50] [--dry-run]
 *
 * If you only know the store NAME, pass --store-name "R2 MBA Corpus" and the
 * script resolves the id.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

const arg = (flag, fb) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fb;
};
const has = (flag) => process.argv.includes(flag);

const ROOT = arg('--root', '/Users/nick/CMU');
const LIMIT = Number(arg('--limit', '100000'));
const DRY = has('--dry-run');
const KEY = process.env.OPENAI_API_KEY?.trim();
if (!KEY) {
  console.error('OPENAI_API_KEY required.');
  process.exit(1);
}
const OAI = 'https://api.openai.com/v1';
const H = { Authorization: `Bearer ${KEY}` };

async function resolveStoreId() {
  let id = process.env.REGENT_CORPUS_VECTOR_STORE_ID?.trim();
  if (id) return id;
  const name = arg('--store-name', 'R2 MBA Corpus');
  const res = await fetch(`${OAI}/vector_stores?limit=100`, { headers: H });
  const body = await res.json();
  const match = (body.data ?? []).find((s) => s.name === name);
  if (!match)
    throw new Error(`Vector store named "${name}" not found; set REGENT_CORPUS_VECTOR_STORE_ID.`);
  return match.id;
}

// Course folder -> stable key (mirrors build_corpus_index.py).
function courseKey(folder) {
  const m = folder.match(/\b\d{2}-\d{2}\b/);
  return (m ? folder.slice(0, m.index) : folder).trim();
}

function findPdfs(root) {
  const out = [];
  for (const course of readdirSync(root)) {
    const cdir = join(root, course);
    if (course === 'regent' || course.startsWith('.')) continue;
    let st;
    try {
      st = statSync(cdir);
    } catch {
      continue;
    }
    if (!st.isDirectory() || !existsSync(join(cdir, 'modules'))) continue;
    const walk = (dir) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        let s;
        try {
          s = statSync(p);
        } catch {
          continue;
        }
        if (s.isDirectory()) {
          if (/submissions|discussions/i.test(e)) continue;
          walk(p);
        } else if (e.toLowerCase().endsWith('.pdf')) {
          out.push({ path: p, course: courseKey(course), module: basename(dir) });
        }
      }
    };
    walk(join(cdir, 'modules'));
  }
  return out;
}

async function existingFilenames(storeId) {
  const names = new Set();
  let after = '';
  for (let i = 0; i < 50; i += 1) {
    const url = `${OAI}/vector_stores/${storeId}/files?limit=100${after ? `&after=${after}` : ''}`;
    const res = await fetch(url, { headers: H });
    const body = await res.json();
    for (const f of body.data ?? []) {
      // fetch filename from the file object
      const fr = await fetch(`${OAI}/files/${f.id}`, { headers: H });
      const fb = await fr.json();
      if (fb.filename) names.add(fb.filename);
    }
    if (!body.has_more) break;
    after = body.last_id;
  }
  return names;
}

async function uploadFile(pdf) {
  const form = new FormData();
  form.append('purpose', 'user_data');
  const buf = await (await import('node:fs/promises')).readFile(pdf.path);
  form.append('file', new Blob([buf], { type: 'application/pdf' }), basename(pdf.path));
  const res = await fetch(`${OAI}/files`, { method: 'POST', headers: H, body: form });
  if (!res.ok) throw new Error(`file upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

async function addToStore(storeId, fileId, attrs) {
  const res = await fetch(`${OAI}/vector_stores/${storeId}/files`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, attributes: attrs }),
  });
  if (!res.ok) throw new Error(`attach failed: ${res.status} ${await res.text()}`);
}

const storeId = await resolveStoreId();
const pdfs = findPdfs(ROOT).slice(0, LIMIT);
console.log(`Store ${storeId}: found ${pdfs.length} PDFs under ${ROOT}.`);
if (DRY) {
  const byCourse = {};
  for (const p of pdfs) byCourse[p.course] = (byCourse[p.course] ?? 0) + 1;
  console.log(JSON.stringify(byCourse, null, 2));
  console.log('(dry run — nothing uploaded)');
  process.exit(0);
}

const present = await existingFilenames(storeId);
let uploaded = 0;
let skipped = 0;
let failed = 0;
for (const pdf of pdfs) {
  const name = basename(pdf.path);
  if (present.has(name)) {
    skipped += 1;
    continue;
  }
  try {
    const fileId = await uploadFile(pdf);
    await addToStore(storeId, fileId, {
      course: pdf.course,
      module: pdf.module.slice(0, 200),
      type: 'reading',
    });
    uploaded += 1;
    if (uploaded % 20 === 0) console.log(`  …${uploaded} uploaded`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL ${name}: ${e.message}`);
  }
}
console.log(`Done. uploaded=${uploaded} skipped(existing)=${skipped} failed=${failed}.`);
console.log(
  'OpenAI is now chunking + embedding the batch; retrieval is ready once processing completes.',
);
