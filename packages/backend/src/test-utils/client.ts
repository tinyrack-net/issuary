import type { AppType } from '@backend/app.js';
import type { AppRouteType } from '@backend/routes/index.js';
import { testClient } from 'hono/testing';
import type { StatusCode } from 'hono/utils/http-status';
import { expect } from 'vitest';

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

/**
 * Type helper to extract the JSON body type for a specific status code
 * from a Hono testClient response.
 *
 * Hono's testClient returns `res.json()` as a union of all possible
 * response body types. This helper narrows the type to the body
 * matching a specific status code.
 */
type JsonResponseBody<
  T extends { json(): Promise<unknown>; status: number },
  S extends StatusCode = 200,
> = T extends { status: S; json(): Promise<infer R> } ? R : never;

/**
 * Assert the response status and parse JSON body with correct type inference.
 *
 * This solves the union-type problem: Hono's testClient returns `res.json()`
 * as a union of ALL response schemas (200 | 400 | 401 etc.). After asserting
 * the status, we know which schema the body matches, but TypeScript can't
 * narrow based on `expect()` calls. This helper combines the status assertion
 * with type narrowing in a single call.
 *
 * @param res - Response from testClient
 * @param status - Expected HTTP status code (default: 200)
 * @returns Typed JSON body matching the expected status
 *
 * @example
 * ```typescript
 * const res = await client.api.v1.auth.login.$post({
 *   json: { email: 'user@example.com', password: 'pass' },
 * });
 * // body is typed as the 200 response schema (AuthResponse)
 * const body = await assertJsonBody(res);
 * expect(body.user.id).toBeDefined();
 *
 * // For error responses:
 * const errorBody = await assertJsonBody(res, 401);
 * expect(errorBody.code).toBe('INVALID_EMAIL_OR_PASSWORD');
 * ```
 */
export async function assertJsonBody<
  T extends { json(): Promise<unknown>; status: number },
  S extends StatusCode = 200,
>(res: T, status?: S): Promise<JsonResponseBody<T, S>> {
  const expectedStatus = status ?? 200;
  expect(res.status).toBe(expectedStatus);
  return (await res.json()) as JsonResponseBody<T, S>;
}
