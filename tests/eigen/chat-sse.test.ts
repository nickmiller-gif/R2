import { describe, expect, it, vi } from 'vitest';
import { consumeEigenChatSse } from '../../apps/eigen-chat/src/chatSse.js';

function makeSseResponse(chunks: string[], ok = true): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: ok ? 200 : 500,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  });
}

describe('consumeEigenChatSse', () => {
  it('aggregates text deltas and resolves on done payload', async () => {
    const response = makeSseResponse([
      'data: {"text":"Hello"}\n\n',
      'data: {"text":" world"}\n\n',
      'data: {"done":true,"response":"Hello world","citations":[],"confidence":"high","retrieval_run_id":"run-1","memory_updated":true,"session_id":"session-1"}\n\n',
    ]);
    const onDelta = vi.fn();

    const result = await consumeEigenChatSse(response, onDelta);

    expect(onDelta).toHaveBeenCalledTimes(2);
    expect(onDelta).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onDelta).toHaveBeenNthCalledWith(2, ' world');
    expect(result.response).toBe('Hello world');
    expect(result.retrieval_run_id).toBe('run-1');
    expect(result.confidence.overall).toBe('high');
    expect(result.memory_updated).toBe(true);
    expect(result.session_id).toBe('session-1');
  });

  it('ignores malformed JSON blocks and still completes if done arrives', async () => {
    const response = makeSseResponse([
      'data: {"text":"A"}\n\n',
      'data: {"text":not-json}\n\n',
      'data: {"done":true,"response":"A","citations":[],"confidence":"low","retrieval_run_id":null,"memory_updated":false,"session_id":"s-1"}\n\n',
    ]);
    const onDelta = vi.fn();

    const result = await consumeEigenChatSse(response, onDelta);

    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith('A');
    expect(result.response).toBe('A');
    expect(result.retrieval_run_id).toBeNull();
  });

  it('throws when stream emits error payload', async () => {
    const response = makeSseResponse(['data: {"error":"Denied"}\n\n']);

    await expect(consumeEigenChatSse(response, vi.fn())).rejects.toThrow('Denied');
  });

  it('throws when stream ends without done payload', async () => {
    const response = makeSseResponse(['data: {"text":"partial"}\n\n']);

    await expect(consumeEigenChatSse(response, vi.fn())).rejects.toThrow(
      'Stream ended before completion',
    );
  });

  it('parses multiline data blocks (SSE-conformant data fields)', async () => {
    const response = makeSseResponse([
      'event: message\n',
      'data: {"text":"Hello"}\n',
      'data: \n',
      '\n',
      'data: {"done":true,"response":"Hello","citations":[],"confidence":"medium","retrieval_run_id":"run-multi","memory_updated":false,"session_id":"session-multi"}\n\n',
    ]);
    const onDelta = vi.fn();

    const result = await consumeEigenChatSse(response, onDelta);

    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith('Hello');
    expect(result.retrieval_run_id).toBe('run-multi');
  });

  it('flushes final event when stream closes without trailing separator', async () => {
    const response = makeSseResponse([
      'data: {"text":"B"}\n\n',
      'data: {"done":true,"response":"B","citations":[],"confidence":"low","retrieval_run_id":"run-tail","memory_updated":false,"session_id":"tail"}',
    ]);
    const onDelta = vi.fn();

    const result = await consumeEigenChatSse(response, onDelta);

    expect(onDelta).toHaveBeenCalledWith('B');
    expect(result.session_id).toBe('tail');
  });

  it('short-circuits after first done payload and ignores subsequent blocks', async () => {
    const response = makeSseResponse([
      'data: {"text":"C"}\n\n',
      'data: {"done":true,"response":"C","citations":[],"confidence":"high","retrieval_run_id":"run-sc","memory_updated":false,"session_id":"sc"}\n\n',
      // extra block after done — should be ignored
      'data: {"done":true,"response":"OVERWRITE","citations":[],"confidence":"low","retrieval_run_id":"bad","memory_updated":false,"session_id":"bad"}\n\n',
    ]);
    const onDelta = vi.fn();

    const result = await consumeEigenChatSse(response, onDelta);

    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(result.response).toBe('C');
    expect(result.session_id).toBe('sc');
  });

  it('throws on buffer overflow when server sends excessive data without separator', async () => {
    // Build a chunk larger than the 4 MB guard (no \n\n separator so it
    // accumulates entirely in the buffer).
    const largeChunk = 'data: ' + 'x'.repeat(5 * 1024 * 1024);
    const response = makeSseResponse([largeChunk]);

    await expect(consumeEigenChatSse(response, vi.fn())).rejects.toThrow('SSE buffer overflow');
  });

  it('includes HTTP status in error message when response body is empty', async () => {
    const response = new Response('', { status: 503 });

    await expect(consumeEigenChatSse(response, vi.fn())).rejects.toThrow('HTTP 503');
  });
});
