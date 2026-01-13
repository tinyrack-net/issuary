import { RequestContext } from '@mikro-orm/core';
import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
} from 'fastify';
import { TEST_USER } from './fixtures.js';

/**
 * Extract session cookie from response headers
 */
export function extractSessionCookie(
  res: LightMyRequestResponse,
): string | undefined {
  const setCookieHeader = res.headers['set-cookie'];

  if (!setCookieHeader) {
    return undefined;
  }

  const cookieValue = Array.isArray(setCookieHeader)
    ? setCookieHeader[0]
    : setCookieHeader;

  return cookieValue?.split(';')[0];
}

/**
 * Extract cookie value by name from response.
 * Throws an error if the cookie is not found.
 *
 * @param res - Response from app.inject()
 * @param name - Cookie name to extract
 * @returns Cookie value
 * @throws Error if cookie is not found
 */
export function extractCookie(
  res: LightMyRequestResponse,
  name: string,
): string {
  const cookie = res.cookies.find((c) => c.name === name);
  if (!cookie?.value) {
    throw new Error(`Cookie '${name}' not found in response`);
  }
  return cookie.value;
}

/**
 * Create authenticated session and return session cookie value.
 * This is a common helper used across many tests.
 *
 * @param app - Fastify instance
 * @param email - User email (defaults to TEST_USER.email)
 * @param password - User password (defaults to TEST_USER.password)
 * @returns Session cookie value
 */
export async function createAuthenticatedSession(
  app: FastifyInstance,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password,
): Promise<string> {
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(
      `Failed to create authenticated session: ${loginRes.statusCode} - ${loginRes.body}`,
    );
  }

  const sessionCookie = extractCookie(loginRes, 'session');

  if (!sessionCookie) {
    throw new Error('Session cookie not found in login response');
  }

  return sessionCookie;
}

/**
 * Run code within MikroORM RequestContext.
 * Useful for database operations in tests.
 *
 * @param app - Fastify instance
 * @param fn - Function to run within context
 */
export async function withMikroContext<T>(
  app: FastifyInstance,
  fn: () => Promise<T>,
): Promise<T> {
  return RequestContext.create(app.mikro.em, fn);
}

/**
 * Helper to make inject calls with cookies
 */
export function injectWithCookie(
  app: FastifyInstance,
  options: InjectOptions,
  cookieName: string,
  cookieValue: string,
): Promise<LightMyRequestResponse> {
  return app.inject({
    ...options,
    cookies: {
      ...options.cookies,
      [cookieName]: cookieValue,
    },
  });
}

/**
 * Helper to make inject calls with session cookie
 */
export function injectWithSession(
  app: FastifyInstance,
  options: InjectOptions,
  sessionCookie: string,
): Promise<LightMyRequestResponse> {
  return injectWithCookie(app, options, 'session', sessionCookie);
}

/**
 * Grant consent for a user to an OAuth client.
 * This should be called after authentication and before authorization.
 *
 * @param app - Fastify instance
 * @param sessionCookie - Session cookie from authenticated user
 * @param clientId - OAuth client ID
 * @param redirectUri - Redirect URI
 * @param scopes - Scopes to consent to
 * @returns The redirect URL returned by the consent API
 */
export async function grantConsent(
  app: FastifyInstance,
  sessionCookie: string,
  params: {
    client_id: string;
    redirect_uri: string;
    response_type?: string;
    scope?: string;
    state?: string;
    nonce?: string;
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
  },
): Promise<string> {
  const consentRes = await app.inject({
    method: 'POST',
    url: '/api/v1/consent',
    cookies: { session: sessionCookie },
    payload: {
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      response_type: params.response_type || 'code',
      scope: params.scope || '',
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
      decision: 'allow',
    },
  });

  if (consentRes.statusCode !== 200) {
    throw new Error(
      `Failed to grant consent: ${consentRes.statusCode} - ${consentRes.body}`,
    );
  }

  const json = consentRes.json();
  return json.redirect_url;
}
