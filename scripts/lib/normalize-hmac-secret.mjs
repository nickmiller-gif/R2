import crypto from 'node:crypto';

/**
 * Normalize R2_SIGNAL_INGEST_HMAC_SECRET from env files for Node HMAC signing.
 * Strips quotes and accidental `sha256=` prefix on the secret value itself.
 */
export function normalizeHmacSecret(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (s.toLowerCase().startsWith('sha256=')) {
    s = s.slice('sha256='.length).trim();
  }
  return s;
}

export function signBodyHmacHex(secret, body) {
  const key = normalizeHmacSecret(secret);
  return crypto.createHmac('sha256', key).update(body).digest('hex');
}
