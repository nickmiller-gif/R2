import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CORRELATION_ID_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  REQUEST_ID_HEADER,
  TRACEPARENT_HEADER,
  extractRequestMeta,
  type RequestMeta,
} from '../../supabase/functions/_shared/correlation.ts';
import { withLogger } from '../../supabase/functions/_shared/log.ts';

describe('extractRequestMeta', () => {
  it('prefers x-correlation-id when both x-correlation-id and x-request-id are present', () => {
    const req = new Request('https://example.test', {
      headers: {
        [CORRELATION_ID_HEADER]: 'cid-1',
        [REQUEST_ID_HEADER]: 'rid-1',
      },
    });
    const meta = extractRequestMeta(req);
    expect(meta.correlationId).toBe('cid-1');
    expect(meta.requestId).toBe('rid-1');
  });

  it('falls back to x-request-id when x-correlation-id is absent', () => {
    const req = new Request('https://example.test', {
      headers: { [REQUEST_ID_HEADER]: 'rid-only' },
    });
    const meta = extractRequestMeta(req);
    expect(meta.correlationId).toBe('rid-only');
    expect(meta.requestId).toBe('rid-only');
  });

  it('mints a UUID when neither header is present', () => {
    const req = new Request('https://example.test');
    const meta = extractRequestMeta(req);
    expect(meta.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(meta.requestId).toBeNull();
  });

  it('captures traceparent verbatim when upstream supplies it', () => {
    const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const req = new Request('https://example.test', {
      headers: { [TRACEPARENT_HEADER]: traceparent },
    });
    const meta = extractRequestMeta(req);
    expect(meta.traceparent).toBe(traceparent);
  });

  it('captures idempotency key + leaves missing fields null', () => {
    const req = new Request('https://example.test', {
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'idem-1' },
    });
    const meta = extractRequestMeta(req);
    expect(meta.idempotencyKey).toBe('idem-1');
    expect(meta.traceparent).toBeNull();
    expect(meta.requestId).toBeNull();
  });
});

describe('withLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sampleMeta(correlationId: string): RequestMeta {
    return {
      correlationId,
      requestId: null,
      traceparent: null,
      idempotencyKey: null,
    };
  }

  it('injects correlationId into every info/warn/error call', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = withLogger(sampleMeta('cid-test'), 'eigen-chat');
    log.info('hi', { sessionId: 's-1' });
    log.warn('careful', { retries: 2 });
    log.error('boom', { stack: 'abc' });

    expect(spy).toHaveBeenCalledTimes(3);
    for (const call of spy.mock.calls) {
      const payload = JSON.parse(String(call[0]));
      expect(payload.correlationId).toBe('cid-test');
      expect(payload.functionName).toBe('eigen-chat');
    }
  });

  it('caller-supplied fields lose to bound fields on a key conflict (bound wins)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = withLogger(sampleMeta('bound-cid'), 'eigen-chat');
    log.info('overrides', { correlationId: 'should-not-win', sessionId: 's-2' });
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.correlationId).toBe('bound-cid');
    expect(payload.sessionId).toBe('s-2');
  });

  it('omits functionName when none is supplied', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = withLogger(sampleMeta('cid-2'));
    log.info('no-fn');
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.correlationId).toBe('cid-2');
    expect('functionName' in payload).toBe(false);
  });
});
