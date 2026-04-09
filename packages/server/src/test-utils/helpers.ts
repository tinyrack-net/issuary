import { RequestContext } from '@mikro-orm/core';
import { testClient } from 'hono/testing';
import { expect } from 'vitest';
import type { AppType } from '../entrypoints/app.ts';
import type { ServiceContainer } from '../services/container.ts';
import { assertJsonBody } from './client.ts';
import { generateUniqueEmail, TEST_CONSENTS, TEST_USER } from './fixtures.ts';

/**
 * Extract cookie value by name from response.
 * Parses the set-cookie header from a standard Response object.
 * Throws an error if the cookie is not found.
 *
 * @param res - Response from app.request()
 * @param name - Cookie name to extract
 * @returns Cookie value
 * @throws Error if cookie is not found
 */
export function extractCookie(res: Response, name: string): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Cookie '${name}' not found in response`);
  }
  // set-cookie can have multiple values joined by comma
  // but we need to handle the session cookie format
  const cookies = setCookie.split(/,(?=\s*\w+=)/);
  for (const cookie of cookies) {
    const match = cookie.trim().match(new RegExp(`^${name}=([^;]+)`));
    if (match?.[1]) {
      return match[1];
    }
  }
  throw new Error(`Cookie '${name}' not found in response`);
}

/**
 * Create authenticated session and return session cookie value.
 * This is a common helper used across many tests.
 *
 * @param app - Hono app instance
 * @param email - User email (defaults to TEST_USER.email)
 * @param password - User password (defaults to TEST_USER.password)
 * @returns Session cookie value
 */
export async function createAuthenticatedSession(
  app: AppType,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password,
): Promise<string> {
  const client = testClient(app);
  const res = await client.api.auth.login.$post({
    json: { email, password },
  });

  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(
      `Failed to create authenticated session: ${res.status} - ${body}`,
    );
  }

  return extractCookie(res, 'session');
}

/**
 * Run code within MikroORM RequestContext.
 * Useful for database operations in tests.
 *
 * @param services - Service container
 * @param fn - Function to run within context
 */
export async function withMikroContext<T>(
  services: ServiceContainer,
  fn: () => Promise<T>,
): Promise<T> {
  return RequestContext.create(services.mikro.em, fn);
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
 * @param res - Response from app.request() or testClient
 * @param errorDef - Error definition from schemas/error.ts (e.g., e.InvalidEmailOrPassword)
 *
 * @example
 * ```typescript
 * import { e } from '../schemas/error.ts';
 * import { expectError } from './index.ts';
 *
 * const client = testClient(app);
 * const res = await client.api.auth.login.$post({
 *   json: { email: 'wrong@example.com', password: 'wrong' },
 * });
 * await expectError(res, e.InvalidEmailOrPassword);
 * ```
 */
export async function expectError(
  res: Response,
  errorDef: ErrorDefinition,
): Promise<void> {
  expect(res.status).toBe(errorDef.Status);
  const expectedError = new errorDef.Error();
  const body = await res.json();
  expect(body).toHaveProperty('code', expectedError.code);
  expect(body).toHaveProperty('message', expectedError.message);
}

/**
 * Create a database user with password and return authenticated session.
 * This is useful for tests that need a "real" database user instead of a config user.
 *
 * @param app - Hono app instance
 * @param services - Service container
 * @param email - User email
 * @param password - User password
 * @param options - Additional options
 * @returns Session cookie value and user sub
 *
 * @example
 * ```typescript
 * const { sessionCookie, userSub } = await createDbUserWithSession(
 *   app,
 *   services,
 *   generateUniqueEmail('test'),
 *   'password123!'
 * );
 * ```
 */
export async function createDbUserWithSession(
  app: AppType,
  services: ServiceContainer,
  email: string,
  password: string,
  options: { emailVerified?: boolean } = {},
): Promise<{ sessionCookie: string; userSub: string }> {
  const { emailVerified = true } = options;

  await withMikroContext(services, async () => {
    const passwordHash = await services.securityService.hashPassword(password);
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = emailVerified;
    await services.mikro.em.persist(user).flush();
  });

  const client = testClient(app);
  const loginRes = await client.api.auth.login.$post({
    json: { email, password },
  });

  if (loginRes.status !== 200) {
    const body = await loginRes.text();
    throw new Error(
      `Failed to login after creating user: ${loginRes.status} - ${body}`,
    );
  }

  const sessionCookie = extractCookie(loginRes, 'session');
  const body = await assertJsonBody(loginRes);
  const userSub = body.user.sub;

  return { sessionCookie, userSub };
}

/**
 * Create a passkey for a user in the database.
 * Useful for testing passkey-related functionality.
 *
 * @param services - Service container
 * @param userId - User ID to create passkey for
 * @param name - Optional passkey name
 * @returns Passkey ID
 *
 * @example
 * ```typescript
 * const passkeyId = await createPasskeyForUser(services, userId, 'My Passkey');
 * ```
 */
export async function createPasskeyForUser(
  services: ServiceContainer,
  userId: string,
  name: string | null = null,
): Promise<string> {
  let passkeyId = '';

  await withMikroContext(services, async () => {
    const passkey = services.mikro.userPasskey.create({
      user: userId,
      credential_id: `test-credential-${crypto.randomUUID()}`,
      public_key: 'test-public-key-base64url',
      counter: 0,
      device_type: 'multiDevice',
      backed_up: true,
      transports: ['internal'],
      name,
      aaguid: 'test-aaguid',
    });
    await services.mikro.em.persist(passkey).flush();
    passkeyId = passkey.id;
  });

  return passkeyId;
}

/**
 * Enable TOTP for a user in the database.
 * Useful for testing TOTP-related functionality.
 *
 * @param services - Service container
 * @param userId - User ID to enable TOTP for
 * @returns TOTP secret for generating codes
 *
 * @example
 * ```typescript
 * const secret = await enableTotpForUser(services, userId);
 * const code = services.totpService.generateToken(secret);
 * ```
 */
export async function enableTotpForUser(
  services: ServiceContainer,
  userId: string,
): Promise<string> {
  let secret = '';

  await withMikroContext(services, async () => {
    // Check if TOTP already exists
    const existingTotp = await services.mikro.userTotp.findByUserSub(userId);
    if (existingTotp) {
      existingTotp.verified = true;
      existingTotp.recovery_confirmed = true;
      secret = existingTotp.secret;
    } else {
      secret = services.totpService.generateSecret();
      const totp = services.mikro.userTotp.create({
        user: userId,
        secret,
        verified: true,
        recovery_confirmed: true,
      });
      services.mikro.em.persist(totp);
    }

    await services.mikro.em.flush();
  });

  return secret;
}

/**
 * Grant consent for a user to an OAuth client.
 * This should be called after authentication and before authorization.
 *
 * @param app - Hono app instance
 * @param sessionCookie - Session cookie from authenticated user
 * @param params - Consent parameters
 * @returns The redirect URL returned by the consent API
 */
export async function grantConsent(
  app: AppType,
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
  const client = testClient(app);

  const res = await client.api.consent.$post(
    {
      json: {
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
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );

  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`Failed to grant consent: ${res.status} - ${body}`);
  }

  const json = await assertJsonBody(res);
  return json.redirect_url;
}

/**
 * Register a new user with default terms consents.
 * Automatically includes required terms consents for explicit consent mode.
 *
 * @param app - Hono app instance
 * @param options - Registration options
 * @returns Response from registration endpoint
 *
 * @example
 * ```typescript
 * const res = await registerUser(app, {
 *   email: 'test@example.com',
 *   password: 'password123!',
 * });
 * expect(res.status).toBe(200);
 * ```
 */
/**
 * Extract Location header from redirect response.
 * Throws if the header is not present.
 *
 * @param res - Response from app.request() or testClient
 * @returns Location header value
 * @throws Error if Location header is missing
 */
export function getLocationHeader(res: Response): string {
  const location = res.headers.get('location');
  if (!location) {
    throw new Error('Expected Location header in response');
  }
  return location;
}

export async function registerUser(
  app: AppType,
  options: {
    email?: string;
    password?: string;
    consents?: ReadonlyArray<{
      termsId: string;
      agreed: boolean;
    }>;
  } = {},
): Promise<Response> {
  const {
    email = generateUniqueEmail('test'),
    password = 'password123!',
    consents = TEST_CONSENTS,
  } = options;

  const client = testClient(app);
  return client.api.auth.register.$post({
    header: {},
    json: {
      email,
      password,
      consents: consents as {
        termsId: string;
        agreed: boolean;
      }[],
    },
  });
}
