#!/usr/bin/env node
/* global console, process */
// Generate catalog.json from src/v1.ts — a versioned artifact that
// non-TypeScript consumers (SQL migrations, Python tools, future repos)
// can validate against without parsing TS.
//
// Also performs a uniqueness check: if any union member appears twice,
// fail with exit 2. Catches typos in the source-of-truth file.
//
// Usage: node scripts/build-catalog-json.mjs [--check-only]
//   --check-only — validate but don't write the file (for CI)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..');
const SRC = resolve(PACKAGE_ROOT, 'src/v1.ts');
const OUT_DIR = resolve(PACKAGE_ROOT, 'dist');
const OUT = resolve(OUT_DIR, 'catalog.json');

const checkOnly = process.argv.includes('--check-only');

const src = readFileSync(SRC, 'utf8');

// Extract a named union: pulls "| 'literal'" entries between the type
// declaration and the next semicolon at start of line.
function extractUnion(name) {
  const re = new RegExp(`export type ${name} =([\\s\\S]*?);`, 'm');
  const m = src.match(re);
  if (!m) {
    console.error(`✗ could not find ${name} in catalog`);
    process.exit(2);
  }
  const literals = [];
  for (const line of m[1].split('\n')) {
    const lit = line.match(/'([^']+)'/);
    if (lit) literals.push(lit[1]);
  }
  // Uniqueness check
  const seen = new Set();
  const dupes = [];
  for (const lit of literals) {
    if (seen.has(lit)) dupes.push(lit);
    seen.add(lit);
  }
  if (dupes.length) {
    console.error(`✗ ${name} has duplicate union members: ${dupes.join(', ')}`);
    process.exit(2);
  }
  return literals;
}

function extractVersion() {
  const m = src.match(/MEG_CATALOG_VERSION:\s*MegCatalogVersion\s*=\s*'([^']+)'/);
  if (!m) {
    console.error(`✗ could not find MEG_CATALOG_VERSION`);
    process.exit(2);
  }
  return m[1];
}

const entityTypes = extractUnion('MegEntityType');
const edgeTypes = extractUnion('MegEdgeType');
const sourceSystems = extractUnion('MegSourceSystem');
const version = extractVersion();

// Sanity bounds — catches a corrupt/empty catalog file.
const MIN = { entityTypes: 5, edgeTypes: 5, sourceSystems: 5 };
const MAX = { entityTypes: 100, edgeTypes: 100, sourceSystems: 100 };
for (const [k, v] of Object.entries({ entityTypes, edgeTypes, sourceSystems })) {
  if (v.length < MIN[k]) {
    console.error(`✗ ${k}: ${v.length} entries — looks corrupted (< ${MIN[k]})`);
    process.exit(2);
  }
  if (v.length > MAX[k]) {
    console.error(`✗ ${k}: ${v.length} entries — looks runaway (> ${MAX[k]})`);
    process.exit(2);
  }
}

// Build the entity-type prefix regex used by SQL CHECK constraints across
// all Wave-A migrations. This is what migration-template.sql bakes in.
function buildEntityTypeRegex(types) {
  // Group by base type, then list subtypes under each.
  const groups = {};
  for (const t of types) {
    const parts = t.replace(/^meg:/, '').split(':');
    const base = parts[0];
    const sub = parts[1];
    groups[base] = groups[base] || new Set();
    if (sub) groups[base].add(sub);
  }
  const parts = [];
  for (const [base, subs] of Object.entries(groups)) {
    if (subs.size > 0) {
      const subList = [...subs].sort().join('|');
      parts.push(`${base}(:(${subList}))?`);
    } else {
      parts.push(base);
    }
  }
  return `^meg:(${parts.join('|')}):[a-z0-9_-]+$`;
}

const result = {
  $generated: 'derived from src/v1.ts — do not edit by hand',
  $generated_at: new Date().toISOString(),
  version,
  entityTypes,
  edgeTypes,
  sourceSystems,
  derived: {
    canonicalIdRegex: buildEntityTypeRegex(entityTypes),
    entityTypeCount: entityTypes.length,
    edgeTypeCount: edgeTypes.length,
    sourceSystemCount: sourceSystems.length,
  },
};

console.log(`✓ Catalog v${version}`);
console.log(`  ${entityTypes.length} entity types`);
console.log(`  ${edgeTypes.length} edge types`);
console.log(`  ${sourceSystems.length} source systems`);
console.log(`  uniqueness: ✓`);

if (checkOnly) {
  console.log(`  --check-only: skipping write`);
  process.exit(0);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`  wrote: ${OUT}`);
