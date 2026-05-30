/**
 * Contract tests for the fail-soft helpers that wire the O1 confidence
 * recalibration service into edge functions. The adapter SQL is covered by
 * the live edge function path; here we lock the user-visible guarantee that
 * a recalibration failure cannot bubble up and break the operator-facing
 * mutation that triggered it.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  recalibrateAfterEvidenceLink,
  recalibrateAfterOutcome,
} from '../../supabase/functions/_shared/oracle-thesis-confidence-db.ts';

/** A SupabaseClient whose `.from(...)` chains all reject — simulates a DB outage. */
function throwingClient(): SupabaseClient {
  const rejecting = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: { message: 'simulated DB failure' } });
        }
        // Every other chained call returns the same proxy.
        return () => rejecting;
      },
    },
  );
  return {
    from: vi.fn(() => rejecting),
  } as unknown as SupabaseClient;
}

const THESIS = '11111111-1111-1111-1111-111111111111';
const EVIDENCE = '22222222-2222-2222-2222-222222222222';
const OUTCOME = '33333333-3333-3333-3333-333333333333';

describe('recalibrateAfterEvidenceLink', () => {
  it('swallows DB errors and returns ok:false without throwing', async () => {
    // Suppress the structured warn line so the test output stays readable.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await recalibrateAfterEvidenceLink(throwingClient(), {
        thesisId: THESIS,
        evidenceItemId: EVIDENCE,
        role: 'validation',
        actor: null,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('recalibrateAfterOutcome', () => {
  it('swallows DB errors and returns ok:false without throwing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await recalibrateAfterOutcome(throwingClient(), {
        thesisId: THESIS,
        outcomeId: OUTCOME,
        actor: null,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    } finally {
      logSpy.mockRestore();
    }
  });
});
