#!/usr/bin/env node
/**
 * Bundle an edge function and its local imports for Supabase MCP deploy_edge_function.
 * Usage: node scripts/build-edge-function-deploy.mjs eigen-chat [--verify-jwt=true]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const fnName = process.argv[2];
if (!fnName) {
  console.error('Usage: node scripts/build-edge-function-deploy.mjs <function-name>');
  process.exit(1);
}

const verifyJwtArg = process.argv.find((a) => a.startsWith('--verify-jwt='));
const verifyJwt = verifyJwtArg ? verifyJwtArg.split('=')[1] !== 'false' : true;

const entryAbs = path.join(root, 'supabase/functions', fnName, 'index.ts');
if (!fs.existsSync(entryAbs)) {
  console.error(`Missing ${entryAbs}`);
  process.exit(1);
}

const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;

function normalizeAbs(filePath) {
  return path.normalize(filePath);
}

function resolveImport(fromAbs, spec) {
  if (!spec || spec.startsWith('https://') || spec.startsWith('jsr:') || spec.startsWith('npm:')) {
    return null;
  }
  let target;
  if (spec.startsWith('../../../src/')) {
    target = path.join(root, 'src', spec.slice('../../../src/'.length));
  } else if (spec.startsWith('../') || spec.startsWith('./')) {
    target = path.join(path.dirname(fromAbs), spec);
  } else {
    return null;
  }
  if (!target.endsWith('.ts') && !target.endsWith('.tsx') && !target.endsWith('.js')) {
    if (fs.existsSync(`${target}.ts`)) target = `${target}.ts`;
    else if (fs.existsSync(`${target}/index.ts`)) target = `${target}/index.ts`;
  }
  return normalizeAbs(target);
}

function toDeployName(absPath) {
  const rel = path.relative(path.join(root, 'supabase'), absPath).split(path.sep).join('/');
  if (rel.startsWith('functions/')) return rel;
  if (rel.startsWith('../src/') || rel.startsWith('src/')) {
    return rel.replace(/^\.\.\//, '');
  }
  return rel;
}

const queue = [normalizeAbs(entryAbs)];
const seen = new Set();

while (queue.length) {
  const abs = queue.shift();
  if (!abs || seen.has(abs) || !fs.existsSync(abs)) continue;
  seen.add(abs);
  const content = fs.readFileSync(abs, 'utf8');
  for (const match of content.matchAll(IMPORT_RE)) {
    const resolved = resolveImport(abs, match[1]);
    if (resolved && fs.existsSync(resolved)) queue.push(resolved);
  }
}

const files = [...seen].sort().map((abs) => ({
  name: toDeployName(abs),
  content: fs.readFileSync(abs, 'utf8'),
}));

const payload = {
  project_id: 'zudslxucibosjwefojtm',
  name: fnName,
  entrypoint_path: `functions/${fnName}/index.ts`,
  verify_jwt: verifyJwt,
  files,
};

process.stdout.write(JSON.stringify(payload));
