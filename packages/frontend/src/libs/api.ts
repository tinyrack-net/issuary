import i18n from '@frontend/i18n/index.js';
import type { AppRouteType } from '@tinyauth/backend/rpc';
import type { ClientResponse } from 'hono/client';
import { hc } from 'hono/client';
import type { StatusCode, SuccessStatusCode } from 'hono/utils/http-status';
import { ApiError } from './error';

/**
 * Custom fetch that adds Accept-Language header
 * and converts error responses to ApiError.
 *
 * This replaces the old `etch()` wrapper, preserving
 * the same behavior within the Hono RPC client.
 */
const customFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);

  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', i18n.language);
  }

  const res = await fetch(input, { ...init, headers });

  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }

  return res;
};

/**
 * Type-safe Hono RPC client.
 *
 * Uses the backend's route types for full
 * request/response type inference.
 * All API calls should use this client instead of
 * raw fetch or the old etch() wrapper.
 */
export const api = hc<AppRouteType>('/', {
  fetch: customFetch,
});

/**
 * Extract the success (2xx) response body type from a
 * ClientResponse union.
 *
 * Since our custom fetch throws on non-ok responses,
 * `res.json()` will only ever return the success body.
 * This helper narrows the union so callers don't need
 * manual type assertions.
 */
type ExtractSuccessBody<T> =
  T extends ClientResponse<infer B, infer S, 'json'>
    ? S extends SuccessStatusCode
      ? B
      : never
    : never;

/**
 * Narrow a Hono ClientResponse to its success body type.
 *
 * Because our custom fetch already throws `ApiError` for
 * non-2xx responses, this is a safe cast that eliminates
 * error response types from the union.
 */
export async function jsonOk<
  T extends ClientResponse<unknown, StatusCode, 'json'>,
>(res: T): Promise<ExtractSuccessBody<T>> {
  return (await res.json()) as ExtractSuccessBody<T>;
}
