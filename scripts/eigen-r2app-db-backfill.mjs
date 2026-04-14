#!/usr/bin/env node
/**
 * Export r2app public-schema tables and ingest into Eigen knowledge corpus.
 *
 * Defaults:
 * - Reads env from workspace root .env
 * - Uses service role for table reads
 * - Uses eigen-ingest endpoint for document/chunk creation
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const WORKSPACE_ENV = '/Users/nick/Desktop/R2 Complete/.env';
const PAGE_SIZE = 500;
const DOC_ROW_BATCH = 100;
const MAX_DOC_CHARS = 90_000;
const MAX_STRING_FIELD_CHARS = 2_000;

const TABLES = [
  'retreat_years',
  'retreat_speakers',
  'retreat_media',
  'retreat_content_reviews',
  'retreat_content_takeaways',
  'retreat_agenda_sessions',
  'retreat_agenda_items',
  'agenda_thought_pieces',
  'retreat_attendees',
  'retreat_rsvps',
  'retreat_discussions',
  'session_notes',
  'session_requests',
  'session_request_upvotes',
  'content_bookmarks',
  'coffee_matches',
  'live_polls',
  'poll_votes',
  'qa_questions',
  'qa_upvotes',
  'photo_submissions',
  'linkedin_connection_analyses',
  'user_preferences',
  'user_roles',
];

const PRIVATE_TABLES = new Set([
  'retreat_attendees',
  'retreat_rsvps',
  'retreat_discussions',
  'session_notes',
  'session_requests',
  'session_request_upvotes',
  'content_bookmarks',
  'coffee_matches',
  'poll_votes',
  'qa_questions',
  'qa_upvotes',
  'photo_submissions',
  'linkedin_connection_analyses',
  'user_preferences',
  'user_roles',
]);

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const text = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function chunkRows(rows, maxRows = DOC_ROW_BATCH, maxChars = MAX_DOC_CHARS) {
  const batches = [];
  let current = [];
  let currentChars = 0;

  for (const row of rows) {
    const encoded = JSON.stringify(row);
    const nextChars = currentChars + encoded.length + 1;
    if (current.length >= maxRows || nextChars > maxChars) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(row);
    currentChars += encoded.length + 1;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_FIELD_CHARS) return value;
    return `${value.slice(0, MAX_STRING_FIELD_CHARS)}\n...[truncated for embedding safety]`;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = sanitizeValue(item);
    }
    return out;
  }
  return value;
}

function sanitizeRows(rows) {
  return rows.map((row) => sanitizeValue(row));
}

function buildPolicyTags(tableName) {
  if (PRIVATE_TABLES.has(tableName)) {
    return ['eigenx', 'r2app', 'r2app_db_private', 'event_ops'];
  }
  return ['eigen_public', 'r2app', 'r2app_db_public', 'event_ops'];
}

async function fetchTableRows(client, tableName) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('does not exist') || msg.includes('schema cache')) return { rows: [], missing: true };
      throw new Error(`Failed table read (${tableName}): ${error.message}`);
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { rows, missing: false };
}

async function ingestBatch({
  endpoint,
  serviceRoleKey,
  ingestBackfillToken,
  tableName,
  batchIndex,
  batchRows,
}) {
  const sourceRef = `r2app-db:${tableName}:batch-${String(batchIndex).padStart(4, '0')}`;
  const bodyText = batchRows.map((row) => JSON.stringify(row)).join('\n');
  const payload = {
    source_system: 'r2app',
    source_ref: sourceRef,
    chunking_mode: 'flat',
    policy_tags: buildPolicyTags(tableName),
    document: {
      title: `r2app ${tableName} snapshot (batch ${batchIndex})`,
      body: bodyText,
      content_type: 'application/jsonl',
      metadata: {
        site_id: 'r2app',
        source_table: tableName,
        batch_index: batchIndex,
        rows_in_batch: batchRows.length,
        snapshot_kind: PRIVATE_TABLES.has(tableName) ? 'private' : 'public',
      },
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      'x-eigen-ingest-token': ingestBackfillToken,
      'x-idempotency-key': sourceRef,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ingest failed (${tableName} batch ${batchIndex}): ${response.status} ${errText}`);
  }
  return response.json();
}

async function main() {
  const env = parseEnvFile(WORKSPACE_ENV);
  const r2appUrl =
    process.env.R2APP_SUPABASE_URL || env.R2APP_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.R2APP_SUPABASE_SERVICE_ROLE_KEY ||
    env.R2APP_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY;
  const ingestBackfillToken = process.env.EIGEN_INGEST_BACKFILL_TOKEN || env.EIGEN_INGEST_BACKFILL_TOKEN;
  const eigenBase =
    process.env.VITE_EIGEN_API_BASE ||
    env.VITE_EIGEN_API_BASE ||
    `${(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/+$/, '')}/functions/v1`;

  if (!r2appUrl) throw new Error('Missing r2app Supabase URL');
  if (!serviceRoleKey) throw new Error('Missing service role key');
  if (!ingestBackfillToken) throw new Error('Missing EIGEN_INGEST_BACKFILL_TOKEN');
  if (!eigenBase) throw new Error('Missing Eigen API base');

  const ingestEndpoint = `${eigenBase.replace(/\/+$/, '')}/eigen-ingest`;
  const dataClient = createClient(r2appUrl, serviceRoleKey, { auth: { persistSession: false } });

  console.log('Starting r2app DB backfill into Eigen...');
  console.log(`Tables configured: ${TABLES.length}`);

  let totalRows = 0;
  let totalBatches = 0;
  let skippedMissing = 0;

  for (const tableName of TABLES) {
    const { rows, missing } = await fetchTableRows(dataClient, tableName);
    if (missing) {
      skippedMissing += 1;
      console.log(`- ${tableName}: missing, skipped`);
      continue;
    }
    if (rows.length === 0) {
      console.log(`- ${tableName}: 0 rows, skipped`);
      continue;
    }

    const safeRows = sanitizeRows(rows);
    const batches = chunkRows(safeRows);
    console.log(`- ${tableName}: ${rows.length} rows in ${batches.length} batches`);
    for (let i = 0; i < batches.length; i += 1) {
      const batchIndex = i + 1;
      await ingestBatch({
        endpoint: ingestEndpoint,
        serviceRoleKey,
        ingestBackfillToken,
        tableName,
        batchIndex,
        batchRows: batches[i],
      });
      totalBatches += 1;
    }
    totalRows += rows.length;
  }

  console.log('Backfill complete.');
  console.log(`Rows ingested: ${totalRows}`);
  console.log(`Batches ingested: ${totalBatches}`);
  console.log(`Missing tables skipped: ${skippedMissing}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
