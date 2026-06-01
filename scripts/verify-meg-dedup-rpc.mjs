#!/usr/bin/env node
/**
 * Verify Eigen meg_dedup_key RPCs (cross-source property normalization).
 *
 * Usage:
 *   op run --env-file=op.env -- node scripts/verify-meg-dedup-rpc.mjs
 */
import { createClient } from '@supabase/supabase-js';

const eigenUrl =
  process.env.EIGEN_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  'https://zudslxucibosjwefojtm.supabase.co';
const serviceKey =
  process.env.EIGEN_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!serviceKey) {
  console.error('Set EIGEN_SUPABASE_SERVICE_ROLE_KEY (Eigen service role).');
  process.exit(1);
}

const eigen = createClient(eigenUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function rpc(name, args) {
  const { data, error } = await eigen.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

async function main() {
  const k1 = await rpc('meg_normalize_property_dedup_key', {
    p_name: 'Tower Home',
    p_address: '123 N Main St',
    p_city: 'Austin',
    p_state: 'TX',
  });
  const k2 = await rpc('meg_normalize_property_dedup_key', {
    p_name: 'Works Home',
    p_address: '123 North Main Street',
    p_city: 'austin',
    p_state: 'Texas',
  });

  if (!k1 || !k2 || k1 !== k2) {
    console.error('FAIL property normalization mismatch', { k1, k2 });
    process.exit(1);
  }

  const bridgeKey = await rpc('meg_compute_dedup_key', {
    p_entity_type: 'meg:property',
    p_canonical_name: 'Probe Property',
    p_canonical_email: null,
    p_payload: {
      hints: {
        address: '123 N Main St',
        city: 'Austin',
        state: 'TX',
      },
    },
  });

  if (bridgeKey !== k1) {
    console.error('FAIL meg_compute_dedup_key vs normalize_property', { bridgeKey, k1 });
    process.exit(1);
  }

  console.log('OK meg_dedup_key normalization + meg_compute_dedup_key', { sample_key: k1 });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
