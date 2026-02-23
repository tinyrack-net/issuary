import { type APIRequestContext, expect } from '@playwright/test';
import { z } from 'zod';

const oauthErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type OAuthCallbackSession = {
  callbackUrl: URL;
  state: string;
};

export type OAuthCallbackErrorExpectation = {
  status: number;
  code: string;
};

/**
 * Initializes OAuth session state by calling provider authorize endpoint.
 */
export async function initOAuthCallbackSession(
  request: APIRequestContext,
  baseURL: string,
  providerId: string,
): Promise<OAuthCallbackSession> {
  const response = await request.get(
    `${baseURL}/api/oauth/${providerId}/authorize?mode=login`,
    {
      maxRedirects: 0,
    },
  );

  expect(response.status()).toBe(302);
  const location = response.headers()['location'];
  if (!location) {
    throw new Error('Expected redirect location from provider authorize');
  }

  const providerAuthorizeUrl = new URL(location);
  const callback = providerAuthorizeUrl.searchParams.get('redirect_uri');
  const state = providerAuthorizeUrl.searchParams.get('state');
  if (!callback || !state) {
    throw new Error('Expected redirect_uri and state from provider authorize');
  }

  return {
    callbackUrl: new URL(callback),
    state,
  };
}

/**
 * Expects JSON OAuth callback API error response.
 */
export async function expectOAuthCallbackApiError(
  request: APIRequestContext,
  url: URL,
  expected: OAuthCallbackErrorExpectation,
): Promise<void> {
  const response = await request.get(url.toString(), {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(expected.status);
  const payload = oauthErrorResponseSchema.parse(await response.json());
  expect(payload.code).toBe(expected.code);
}
