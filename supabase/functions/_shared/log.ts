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
