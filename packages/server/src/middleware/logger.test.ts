import { Hono } from 'hono';
import type pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

const otel = vi.hoisted(() => ({
  active: vi.fn(() => ({})),
  getSpan: vi.fn(() => ({
    spanContext: () => ({
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      traceFlags: 1,
    }),
  })),
  isSpanContextValid: vi.fn(() => true),
}));

vi.mock('@opentelemetry/api', () => ({
  context: { active: otel.active },
  isSpanContextValid: otel.isSpanContextValid,
  trace: { getSpan: otel.getSpan },
}));

import { loggerMiddleware } from './logger.ts';

describe('loggerMiddleware', () => {
  it('binds the active trace and span IDs to request logs', async () => {
    const requestLogger = { info: vi.fn() };
    const rootLogger = {
      child: vi.fn(() => requestLogger),
    } as unknown as pino.Logger;
    const app = new Hono()
      .use('*', loggerMiddleware(rootLogger))
      .get('/', (c) => c.text('ok'));

    await app.request('/');

    expect(rootLogger.child).toHaveBeenCalledWith({
      reqId: expect.any(String),
      trace_id: '1234567890abcdef1234567890abcdef',
      span_id: '1234567890abcdef',
    });
    expect(requestLogger.info).toHaveBeenCalledOnce();
  });
});
