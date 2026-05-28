import { readFileSync, existsSync } from 'node:fs';
import { normalizeHmacSecret } from './normalize-hmac-secret.mjs';

export function readEnvKey(path, key) {
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    if (t.slice(0, i).trim() === key) return t.slice(i + 1).trim();
  }
  return undefined;
}

/** Legacy helper — Eigen/producers sign with raw UTF-8 secret; length need not be 64 hex. */
export function isValidHmacSecret(raw) {
  const n = normalizeHmacSecret(raw ?? '');
  return n.length > 0 && !n.startsWith('op://');
}

/** Prefer wave1 / op-injected env over bridge-sync (invalid short HMAC poisoned smokes). */
export function pickHmacSecret(r2Root) {
  const candidates = [
    process.env.R2_SIGNAL_INGEST_HMAC_SECRET,
    readEnvKey(`${r2Root}/.env.wave1.local`, 'R2_SIGNAL_INGEST_HMAC_SECRET'),
    readEnvKey(`${r2Root}/.env.bridge-sync.local`, 'R2_SIGNAL_INGEST_HMAC_SECRET'),
  ];
  for (const raw of candidates) {
    const n = normalizeHmacSecret(raw ?? '');
    if (n.length > 0 && !n.startsWith('op://')) return n;
  }
  return '';
}

export function normalizeBearer(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('sbp_')) return '';
  return s;
}

export function diagnoseBearer(bearer) {
  if (!bearer) return 'missing';
  if (bearer.startsWith('sbp_')) return 'sbp_cli_token';
  const parts = bearer.split('.');
  if (parts.length !== 3 || !bearer.startsWith('eyJ')) return 'not_jwt';
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
    if (payload.role !== 'service_role') return `role_${payload.role}`;
    if (payload.ref && payload.ref !== 'zudslxucibosjwefojtm') return `wrong_ref_${payload.ref}`;
    return 'ok';
  } catch {
    return 'jwt_decode_fail';
  }
}
