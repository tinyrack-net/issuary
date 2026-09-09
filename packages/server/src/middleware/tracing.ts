import {
  context as otelContext,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { createMiddleware } from 'hono/factory';

const tracer = trace.getTracer('issuary-http');

const headersGetter = {
  get(carrier: Headers, key: string): string | undefined {
    return carrier.get(key) ?? undefined;
  },
  keys(carrier: Headers): string[] {
    return [...carrier.keys()];
  },
};

/** Creates one parent-aware server span for every Hono request. */
export function tracingMiddleware() {
  return createMiddleware(async (c, next) => {
    const parentContext = propagation.extract(
      otelContext.active(),
      c.req.raw.headers,
      headersGetter,
    );
    const span = tracer.startSpan(
      `HTTP ${c.req.method}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.request.method': c.req.method,
          'url.scheme': new URL(c.req.url).protocol.replace(':', ''),
        },
      },
      parentContext,
    );

    return otelContext.with(trace.setSpan(parentContext, span), async () => {
      try {
        await next();
        const route = c.req.routePath;
        if (route) {
          span.updateName(`${c.req.method} ${route}`);
          span.setAttribute('http.route', route);
        }
        span.setAttribute('http.response.status_code', c.res.status);
        if (c.res.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        if (error instanceof Error) span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  });
}
