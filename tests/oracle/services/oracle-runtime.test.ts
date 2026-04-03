import { describe, expect, it } from 'vitest';
import {
  ORACLE_RUNTIME_SYNTHESIS_ENABLED,
  callOracleThesisEdge,
} from '../../../src/services/oracle/runtime.js';

describe('oracle runtime', () => {
  it('does not expose client-side synthesis execution', () => {
    expect(ORACLE_RUNTIME_SYNTHESIS_ENABLED).toBe(false);
  });

  it('routes portfolio_build to edge function invocation', async () => {
    const calls: Array<{ functionName: string; body: unknown }> = [];
    const invoker = {
      async invoke(functionName: string, options?: { body?: unknown }) {
        calls.push({ functionName, body: options?.body ?? null });
        return { ok: true };
      },
    };

    await callOracleThesisEdge(invoker, {
      action: 'portfolio_build',
      body: { profile_id: 'profile-1' },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].functionName).toBe('oracle-theses?action=portfolio_build');
    expect(calls[0].body).toEqual({ profile_id: 'profile-1' });
  });
});
