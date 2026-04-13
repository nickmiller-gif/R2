import type { ChatResponse } from './chatTypes.js';

/** Maximum accumulated buffer size before we abort to prevent memory exhaustion. */
const MAX_BUFFER_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Extracts and concatenates all `data:` field values from an SSE block,
 * then attempts to parse the result as JSON. Returns `null` for comment
 * lines, `[DONE]` sentinels, empty blocks, and invalid JSON.
 */
function parseDataBlock(block: string): Record<string, unknown> | null {
  const payload = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Builds a typed `ChatResponse` from a validated `done` SSE payload. */
function resolveFromData(data: Record<string, unknown>): ChatResponse {
  return {
    response: typeof data.response === 'string' ? data.response : '',
    citations: Array.isArray(data.citations) ? (data.citations as ChatResponse['citations']) : [],
    confidence: (data.confidence as ChatResponse['confidence']) ?? 'low',
    retrieval_run_id: typeof data.retrieval_run_id === 'string' ? data.retrieval_run_id : null,
    memory_updated: data.memory_updated === true,
    session_id: typeof data.session_id === 'string' ? data.session_id : '',
  };
}

export async function consumeEigenChatSse(
  response: Response,
  onDelta: (text: string) => void,
): Promise<ChatResponse> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let resolved: ChatResponse | null = null;

  /**
   * Appends a decoded chunk to the internal buffer, splits completed SSE
   * blocks on `\n\n` boundaries, dispatches `onDelta` for incremental text
   * events, and captures the terminal `done` payload. Throws immediately on
   * a server-sent error event or if the buffer exceeds `MAX_BUFFER_BYTES`.
   */
  const processStreamChunk = (chunk: string): void => {
    if (!chunk) return;
    buffer += chunk;
    if (buffer.length > MAX_BUFFER_BYTES) {
      throw new Error('SSE buffer overflow: server response too large');
    }
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const data = parseDataBlock(block);
      if (!data) continue;

      if (typeof data.error === 'string') {
        throw new Error(data.error);
      }
      if (typeof data.text === 'string' && data.text.length > 0) {
        onDelta(data.text);
      }
      if (data.done === true) {
        resolved = resolveFromData(data);
        break; // stop processing further blocks after terminal event
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      processStreamChunk(decoder.decode(value, { stream: true }));
      if (resolved) break; // short-circuit once terminal event received
    }
    if (!resolved) {
      // Flush any remaining bytes from the decoder and add a synthetic
      // separator so a terminal event without a trailing \n\n is still parsed.
      processStreamChunk(decoder.decode());
      processStreamChunk('\n\n');
    }
  } finally {
    reader.releaseLock();
  }

  if (!resolved) {
    throw new Error('Stream ended before completion');
  }
  return resolved;
}
