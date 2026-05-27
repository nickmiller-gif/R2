#!/usr/bin/env node
/**
 * Builds JSON body for Supabase MCP deploy_edge_function (user-supabase-eigen).
 * Run: node scripts/build-meg-resolve-bridge-deploy-json.mjs > /tmp/meg-deploy.json
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = [
  'supabase/functions/meg-resolve-bridge/index.ts',
  'supabase/functions/_shared/cors.ts',
  'supabase/functions/_shared/correlation.ts',
  'supabase/functions/_shared/log.ts',
  'supabase/functions/_shared/supabase.ts',
  'supabase/functions/_shared/signal-utils.ts',
  'supabase/functions/_shared/auth.ts',
].map((rel) => {
  const abs = path.join(root, rel);
  const content = fs.readFileSync(abs, 'utf8');
  // MCP expects paths like `functions/foo/index.ts` (strip `supabase/` only).
  const name = rel.replace(/^supabase\//, '');
  return { name, content };
});

const payload = {
  name: 'meg-resolve-bridge',
  entrypoint_path: 'functions/meg-resolve-bridge/index.ts',
  verify_jwt: false,
  files,
};

process.stdout.write(JSON.stringify(payload));
