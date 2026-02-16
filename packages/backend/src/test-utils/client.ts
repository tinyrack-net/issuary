import type { AppType } from '@backend/lib/app.js';
import type { AppRouteType } from '@backend/routes/index.js';
import { testClient } from 'hono/testing';

/**
 * Create a type-safe test client from the app instance.
 *
 * At runtime, `app` is an OpenAPIHono instance with all
 * routes mounted via `app.route('/', routes)`.
 * The `AppRouteType` cast gives testClient the full route
 * schema so it can infer paths, request bodies, and
 * response types.
 *
 * @param app - Hono app instance from createServer()
 * @returns Type-safe test client with route inference
 *
 * @example
 * ```typescript
 * const client = createTestClient(app);
 * const res = await client.api.v1.auth.login.$post({
 *   json: { email: 'user@example.com', password: 'pass' },
 * });
 * ```
 */
export function createTestClient(app: AppType) {
  return testClient(app as unknown as AppRouteType);
}

/**
 * Create a type-safe test client with default headers.
 * Useful for authenticated requests that need a session
 * cookie on every call.
 *
 * @param app - Hono app instance from createServer()
 * @param headers - Default headers to include in every request
 * @returns Type-safe test client with route inference
 *
 * @example
 * ```typescript
 * const client = createTestClientWithHeaders(app, {
 *   Cookie: `session=${sessionCookie}`,
 * });
 * const res = await client.api.v1.user.session.$get();
 * ```
 */
export function createTestClientWithHeaders(
  app: AppType,
  headers: Record<string, string>,
) {
  return testClient(app as unknown as AppRouteType, undefined, undefined, {
    headers,
  });
}
