import type { AppType } from '@tinyrack/issuary-server';
import type { ClientResponse } from 'hono/client';
import { hc } from 'hono/client';
import type { StatusCode, SuccessStatusCode } from 'hono/utils/http-status';
import { IssuaryError } from './error.js';

export type ApiClientOptions = {
  baseUrl: string;
  cookie?: string | undefined;
  fetch: typeof fetch;
  language: () => string;
};

/**
 * Custom fetch that adds Accept-Language header
 * and converts error responses to IssuaryError.
 *
 * This replaces the old `etch()` wrapper, preserving
 * the same behavior within the Hono RPC client.
 */
function createApiFetch(options: ApiClientOptions): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has('Accept-Language')) {
      headers.set('Accept-Language', options.language());
    }
    if (options.cookie && !headers.has('Cookie')) {
      headers.set('Cookie', options.cookie);
    }

    const inputUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const target =
      options.baseUrl === '/' ? input : new URL(inputUrl, options.baseUrl);
    const response = await options.fetch(target, {
      ...init,
      headers,
    });
    if (!response.ok) throw await IssuaryError.fromResponse(response);
    return response;
  };
}

/**
 * Type-safe Hono RPC client.
 *
 * Uses the backend's route types for full
 * request/response type inference.
 * All API calls should use this client instead of
 * raw fetch or the old etch() wrapper.
 */
export function createApiClient(options: ApiClientOptions) {
  return hc<AppType>(options.baseUrl, { fetch: createApiFetch(options) });
}

export type ApiClient = ReturnType<typeof createApiClient>;

let browserLanguage = 'en';

export function setBrowserApiLanguage(language: string): void {
  browserLanguage = language;
}

export const client = createApiClient({
  baseUrl: '/',
  fetch: (input, init) => globalThis.fetch(input, init),
  language: () => browserLanguage,
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
 * Because our custom fetch already throws `IssuaryError` for
 * non-2xx responses, this is a safe cast that eliminates
 * error response types from the union.
 */
export async function jsonOk<
  T extends ClientResponse<unknown, StatusCode, 'json'>,
>(res: T): Promise<ExtractSuccessBody<T>> {
  return (await res.json()) as ExtractSuccessBody<T>;
}
