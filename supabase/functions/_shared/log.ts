import type { RequestMeta } from './correlation.ts';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  functionName?: string;
  correlationId?: string;
  [key: string]: unknown;
}

function writeLog(level: LogLevel, message: string, fields?: LogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(fields ?? {}),
  };
  // Use a single JSON log line to keep cloud log ingestion parseable.
  console.log(JSON.stringify(payload));
}

export function logInfo(message: string, fields?: LogFields): void {
  writeLog('info', message, fields);
}

export function logWarn(message: string, fields?: LogFields): void {
  writeLog('warn', message, fields);
}

export function logError(message: string, fields?: LogFields): void {
  writeLog('error', message, fields);
}

type BoundLogMethod = (message: string, fields?: LogFields) => void;

interface BoundLogger {
  info: BoundLogMethod;
  warn: BoundLogMethod;
  error: BoundLogMethod;
}

/**
 * Returns a logger that auto-injects `correlationId` (and optional
 * `functionName`) into every log call, so handlers don't have to thread
 * the fields manually. Per-call `fields` override bound fields.
 *
 * Usage inside a `withRequestMeta(async (req, meta) => {...})` handler:
 *
 *     const log = withLogger(meta, 'eigen-chat');
 *     log.info('chat turn accepted', { sessionId });
 *     // → {"ts":"…","level":"info","msg":"chat turn accepted",
 *     //    "sessionId":"…","correlationId":"…","functionName":"eigen-chat"}
 */
export function withLogger(meta: RequestMeta, functionName?: string): BoundLogger {
  const boundFields: LogFields = {
    correlationId: meta.correlationId,
    ...(functionName ? { functionName } : {}),
  };

  const mergeFields = (fields?: LogFields): LogFields => ({
    ...(fields ?? {}),
    ...boundFields,
  });

  return {
    info: (message, fields) => logInfo(message, mergeFields(fields)),
    warn: (message, fields) => logWarn(message, mergeFields(fields)),
    error: (message, fields) => logError(message, mergeFields(fields)),
  };
}
