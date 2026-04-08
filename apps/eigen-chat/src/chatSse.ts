import type { ChatResponse } from './chatTypes';

export async function consumeEigenChatSse(
  response: Response,
  onDelta: (text: string) => void,
): Promise<ChatResponse> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let resolved: ChatResponse | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const line = block.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        const raw = line.slice(6).trim();
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (typeof data.error === 'string') {
          throw new Error(data.error);
        }
        if (typeof data.text === 'string' && data.text.length > 0) {
          onDelta(data.text);
        }
        if (data.done === true) {
          resolved = {
            response: typeof data.response === 'string' ? data.response : '',
            citations: Array.isArray(data.citations) ? (data.citations as ChatResponse['citations']) : [],
            confidence: (data.confidence as ChatResponse['confidence']) ?? 'low',
            retrieval_run_id: typeof data.retrieval_run_id === 'string' ? data.retrieval_run_id : null,
            memory_updated: data.memory_updated === true,
            session_id: typeof data.session_id === 'string' ? data.session_id : '',
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!resolved) {
    throw new Error('Stream ended before completion');
  }
  return resolved;
}
