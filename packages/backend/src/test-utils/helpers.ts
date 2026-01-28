import { RequestContext } from '@mikro-orm/core';
import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
} from 'fastify';
import { expect } from 'vitest';
import { generateUniqueEmail, TEST_CONSENTS, TEST_USER } from './fixtures.js';

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

/**
 * Error definition type for expectError helper.
 */
export interface ErrorDefinition {
  Status: number;
  Error: new () => { code: string; message: string };
}

/**
 * Assert that a response matches an expected error definition.
 * This standardizes error assertions across all test files.
 *
 * @param res - Response from app.inject()
 * @param errorDef - Error definition from schemas/error.ts (e.g., e.InvalidEmailOrPassword)
 *
 * @example
 * ```typescript
 * import { e } from '@/schemas/error.js';
 * import { expectError } from '@/test-utils/index.js';
 *
 * const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {...} });
 * expectError(res, e.InvalidEmailOrPassword);
 * ```
 */
export function expectError(
  res: LightMyRequestResponse,
  errorDef: ErrorDefinition,
): void {
  expect(res.statusCode).toBe(errorDef.Status);
  const expectedError = new errorDef.Error();
  const body = res.json();
  expect(body).toHaveProperty('code', expectedError.code);
  expect(body).toHaveProperty('message', expectedError.message);
}

/**
 * Assert that a response has a specific status code and error code.
 * Use this for simpler error assertions when you don't need the full error definition.
 *
 * @param res - Response from app.inject()
 * @param statusCode - Expected HTTP status code
 * @param errorCode - Expected error code in response body
 *
 * @example
 * ```typescript
 * expectErrorCode(res, 401, 'UNAUTHORIZED');
 * ```
 */
export function expectErrorCode(
  res: LightMyRequestResponse,
  statusCode: number,
  errorCode: string,
): void {
  expect(res.statusCode).toBe(statusCode);
  const body = res.json();
  expect(body).toHaveProperty('code', errorCode);
}

/**
 * Create a database user with password and return authenticated session.
 * This is useful for tests that need a "real" database user instead of a config user.
 *
 * @param app - Fastify instance
 * @param email - User email
 * @param password - User password
 * @param options - Additional options
 * @returns Session cookie value and user ID
 *
 * @example
 * ```typescript
 * const { sessionCookie, userId } = await createDbUserWithSession(
 *   app,
 *   generateUniqueEmail('test'),
 *   'password123!'
 * );
 * ```
 */
export async function createDbUserWithSession(
  app: FastifyInstance,
  email: string,
  password: string,
  options: { emailVerified?: boolean } = {},
): Promise<{ sessionCookie: string; userId: string }> {
  const { emailVerified = true } = options;

  await withMikroContext(app, async () => {
    const user = app.mikro.user.create({
      email,
      password_hash: password, // Will be hashed by entity lifecycle hook
    });
    user.email_verified = emailVerified;
    await app.mikro.em.persist(user).flush();
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(
      `Failed to login after creating user: ${loginRes.statusCode} - ${loginRes.body}`,
    );
  }

  const sessionCookie = extractCookie(loginRes, 'session');
  const userId = loginRes.json().user.id;

  return { sessionCookie, userId };
}

/**
 * Create a passkey for a user in the database.
 * Useful for testing passkey-related functionality.
 *
 * @param app - Fastify instance
 * @param userId - User ID to create passkey for
 * @param name - Optional passkey name
 * @returns Passkey ID
 *
 * @example
 * ```typescript
 * const passkeyId = await createPasskeyForUser(app, userId, 'My Passkey');
 * ```
 */
export async function createPasskeyForUser(
  app: FastifyInstance,
  userId: string,
  name: string | null = null,
): Promise<string> {
  let passkeyId = '';

  await withMikroContext(app, async () => {
    const user = await app.mikro.user.findOneOrFail({ id: userId });
    const passkey = app.mikro.userPasskey.create({
      user,
      credential_id: `test-credential-${crypto.randomUUID()}`,
      public_key: 'test-public-key-base64url',
      counter: 0,
      device_type: 'multiDevice',
      backed_up: true,
      transports: ['internal'],
      name,
      aaguid: 'test-aaguid',
    });
    await app.mikro.em.persist(passkey).flush();
    passkeyId = passkey.id;
  });

  return passkeyId;
}

/**
 * Enable TOTP for a user in the database.
 * Useful for testing TOTP-related functionality.
 *
 * @param app - Fastify instance
 * @param userId - User ID to enable TOTP for
 * @returns TOTP secret for generating codes
 *
 * @example
 * ```typescript
 * const secret = await enableTotpForUser(app, userId);
 * const code = app.totpService.generateToken(secret);
 * ```
 */
export async function enableTotpForUser(
  app: FastifyInstance,
  userId: string,
): Promise<string> {
  let secret = '';

  await withMikroContext(app, async () => {
    const user = await app.mikro.user.findOneOrFail({ id: userId });

    // Check if TOTP already exists
    const existingTotp = await app.mikro.userTotp.findByUserId(userId);
    if (existingTotp) {
      existingTotp.verified = true;
      existingTotp.recovery_confirmed = true;
      secret = existingTotp.secret;
    } else {
      secret = app.totpService.generateSecret();
      const totp = app.mikro.userTotp.create({
        user,
        secret,
        verified: true,
        recovery_confirmed: true,
      });
      app.mikro.em.persist(totp);
    }

    await app.mikro.em.flush();
  });

  return secret;
}

/**
 * Register a new user with default terms consents.
 * Automatically includes required terms consents for explicit consent mode.
 *
 * @param app - Fastify instance
 * @param options - Registration options
 * @returns Response from registration endpoint
 *
 * @example
 * ```typescript
 * const res = await registerUser(app, { email: 'test@example.com', password: 'password123' });
 * expect(res.statusCode).toBe(200);
 * ```
 */
export async function registerUser(
  app: FastifyInstance,
  options: {
    email?: string;
    password?: string;
    consents?: ReadonlyArray<{ termsId: string; agreed: boolean }>;
  } = {},
): Promise<LightMyRequestResponse> {
  const {
    email = generateUniqueEmail('test'),
    password = 'password123',
    consents = TEST_CONSENTS,
  } = options;

  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password,
      consents,
    },
  });
}
