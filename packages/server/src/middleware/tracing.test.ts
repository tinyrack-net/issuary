import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const otel = vi.hoisted(() => {
  const span = {
    end: vi.fn(),
    recordException: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    updateName: vi.fn(),
  };
  return {
    active: vi.fn(() => ({ root: true })),
    contextWith: vi.fn((_context, callback: () => unknown) => callback()),
    extract: vi.fn((context) => context),
    setSpan: vi.fn((context) => context),
    span,
    startSpan: vi.fn(() => span),
  };
});

vi.mock('@opentelemetry/api', () => ({
  context: { active: otel.active, with: otel.contextWith },
  propagation: { extract: otel.extract },
  SpanKind: { SERVER: 1 },
  SpanStatusCode: { ERROR: 2 },
  trace: {
    getTracer: () => ({ startSpan: otel.startSpan }),
    setSpan: otel.setSpan,
  },
}));

import { tracingMiddleware } from './tracing.ts';

describe('tracingMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a parent-aware server span using the matched route', async () => {
    const app = new Hono()
      .use('*', tracingMiddleware())
      .get('/users/:id', (c) => c.text('ok'));

    const response = await app.request('/users/42', {
      headers: {
        traceparent: '00-1234567890abcdef1234567890abcdef-1234567890abcdef-01',
      },
    });

    expect(response.status).toBe(200);
    expect(otel.extract).toHaveBeenCalled();
    expect(otel.startSpan).toHaveBeenCalledWith(
      'HTTP GET',
      expect.objectContaining({ kind: 1 }),
      expect.anything(),
    );
    expect(otel.span.updateName).toHaveBeenCalledWith('GET /users/:id');
    expect(otel.span.setAttribute).toHaveBeenCalledWith(
      'http.route',
      '/users/:id',
    );
    expect(otel.span.setAttribute).toHaveBeenCalledWith(
      'http.response.status_code',
      200,
    );
    expect(otel.span.end).toHaveBeenCalledOnce();
  });

  it('marks server failures as errors', async () => {
    const app = new Hono()
      .use('*', tracingMiddleware())
      .get('/failure', (c) => c.text('failed', 503));

    await app.request('/failure');

    expect(otel.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(otel.span.end).toHaveBeenCalledOnce();
  });
});
