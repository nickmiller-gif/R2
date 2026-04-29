import { logWarn } from './log.ts';

export type AnonGateRejectReason =
  | 'rate_limit'
  | 'origin'
  | 'widget_token_expired'
  | 'widget_token_invalid'
  | 'widget_origin_mismatch';

export interface AnonGateRejectFields {
  gate: AnonGateRejectReason;
  functionName: string;
  correlationId?: string;
  site_id?: string;
  origin?: string | null;
  status?: number;
  detail?: string;
}

/**
 * Structured log for anonymous-surface denials (ADR-003).
 * Operators can filter on `event: anon_gate_reject` and `gate`.
 */
export function logAnonGateReject(fields: AnonGateRejectFields): void {
  logWarn('anon_gate_reject', {
    event: 'anon_gate_reject',
    ...fields,
  });
}
