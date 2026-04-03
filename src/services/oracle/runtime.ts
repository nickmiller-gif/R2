/**
 * Oracle runtime contracts for client usage.
 *
 * The client runtime intentionally does not implement synthesis logic.
 * It only calls the oracle-theses edge function.
 */

export type OracleThesisAction = 'create' | 'publish' | 'challenge' | 'supersede' | 'portfolio_build';

export interface OracleRuntimeRequest {
  action: OracleThesisAction;
  body?: Record<string, unknown>;
}

export interface OracleFunctionInvoker {
  invoke(functionName: string, options?: { method?: string; body?: unknown }): Promise<unknown>;
}

export const ORACLE_RUNTIME_SYNTHESIS_ENABLED = false;

export async function callOracleThesisEdge(
  invoker: OracleFunctionInvoker,
  request: OracleRuntimeRequest,
): Promise<unknown> {
  const query = request.action === 'create' ? '' : `?action=${request.action}`;
  return invoker.invoke(`oracle-theses${query}`, {
    method: 'POST',
    body: request.body ?? {},
  });
}
