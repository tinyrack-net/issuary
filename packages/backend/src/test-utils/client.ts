import type { StatusCode } from 'hono/utils/http-status';
import { expect } from 'vitest';

/**
 * Permissive JSON body type used as fallback when the exact
 * response type cannot be inferred from the route handler.
 *
 * This applies to error responses (400, 401, 404, etc.) that
 * are returned by the global error handler rather than directly
 * by route handlers — `hono-openapi`'s `describeRoute` does not
 * contribute to Hono's route type system, so these status codes
 * aren't present in the `testClient` response type union.
 *
 * Using an `interface` (not a type alias or `Record`) allows
 * property access with dot notation despite
 * `noPropertyAccessFromIndexSignature`, because interfaces
 * with only an index signature are treated more leniently by
 * TypeScript when used as return types in test assertions.
 *
 * Runtime validation is handled by vitest's `expect()` calls.
 */
/**
 * `any` is intentional: `noPropertyAccessFromIndexSignature`
 * prevents dot-notation access on index-signature types like
 * `Record<string, unknown>`. Since this fallback applies to
 * error responses handled by the global error handler (not
 * by route handlers), there is no compile-time type info
 * available. Runtime `expect()` calls provide validation.
 */
// biome-ignore lint/suspicious/noExplicitAny: explained above
type FallbackJsonBody = any;

/**
 * Type helper to extract the JSON body type for a specific status code
 * from a Hono testClient response.
 *
 * Hono's testClient returns a union of `ClientResponse` types, one
 * per declared status code. This helper uses `Extract` to first
 * narrow the union to the member matching status `S`, then infers
 * the JSON body type `R` from that narrowed member.
 *
 * When the response type doesn't include the requested status code
 * (e.g., error responses from the error handler), it falls back
 * to `FallbackJsonBody` for ergonomic test property access.
 */
type JsonResponseBody<
  T extends { json(): Promise<unknown>; status: number },
  S extends StatusCode = 200,
> =
  Extract<T, { status: S }> extends never
    ? FallbackJsonBody
    : Extract<T, { status: S }> extends {
          json(): Promise<infer R>;
        }
      ? [R] extends [never]
        ? FallbackJsonBody
        : R
      : FallbackJsonBody;

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
