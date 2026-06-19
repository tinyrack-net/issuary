import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../entrypoints/app.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  getAuthorizationCode,
  MINIMAL_TEST_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

const CONFIDENTIAL_ORIGIN = 'http://localhost:18080';
const OTHER_ORIGIN = 'http://localhost:19090';
const SPA_ORIGIN = 'http://localhost:5173';
const DEVICE_ORIGIN = 'http://localhost:18081';
const EVIL_ORIGIN = 'http://evil.example.test';

function formBody(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

beforeAll(async () => {
  const testApp = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [
      {
        id: 'cors-confidential-config',
        name: 'CORS Confidential',
        client_id: 'cors-confidential-client',
        client_secret: 'cors-confidential-secret',
        redirect_uris: ['http://localhost:18080/callback'],
        web_origins: [CONFIDENTIAL_ORIGIN],
        response_types: ['code'],
        grant_types: [
          'authorization_code',
          'refresh_token',
          'client_credentials',
        ],
        scope: 'openid profile email offline_access service.read',
      },
      {
        id: 'cors-other-config',
        name: 'CORS Other',
        client_id: 'cors-other-client',
        client_secret: 'cors-other-secret-value',
        redirect_uris: ['http://localhost:19090/callback'],
        web_origins: [OTHER_ORIGIN],
        response_types: ['code'],
        grant_types: ['authorization_code', 'client_credentials'],
        scope: 'openid profile service.read',
      },
      {
        id: 'cors-spa-config',
        name: 'CORS SPA',
        client_id: 'cors-spa-client',
        redirect_uris: ['http://localhost:5173/callback'],
        web_origins: [SPA_ORIGIN],
        response_types: ['code'],
        grant_types: ['authorization_code', 'refresh_token'],
        scope: 'openid profile email offline_access',
      },
      {
        id: 'cors-device-public-config',
        name: 'CORS Device Public',
        client_id: 'cors-device-public-client',
        redirect_uris: ['http://localhost:18081/callback'],
        web_origins: [DEVICE_ORIGIN],
        response_types: ['code'],
        grant_types: [
          'authorization_code',
          'urn:ietf:params:oauth:grant-type:device_code',
        ],
        scope: 'openid profile',
      },
    ],
  });
  app = testApp.app;
  cleanup = testApp.cleanup;
});

afterAll(async () => {
  if (cleanup) {
    await cleanup();
  }
});

describe('OAuth CORS root policy', () => {
  test('serves discovery metadata with public wildcard CORS and no credentials', async () => {
    const response = await app.request(
      '/oauth/.well-known/openid-configuration',
      {
        headers: { origin: EVIL_ORIGIN },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  test('serves JWKS with public wildcard CORS and no credentials', async () => {
    const response = await app.request('/oauth/.well-known/jwks', {
      headers: { origin: EVIL_ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  test('allows token preflight from a registered OAuth web origin without query client_id', async () => {
    const response = await app.request('/oauth/token', {
      method: 'OPTIONS',
      headers: {
        origin: SPA_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      SPA_ORIGIN,
    );
    expect(response.headers.get('access-control-allow-methods')).toContain(
      'POST',
    );
    expect(response.headers.get('access-control-allow-headers')).toContain(
      'content-type',
    );
  });

  test('rejects token preflight from an unregistered origin', async () => {
    const response = await app.request('/oauth/token', {
      method: 'OPTIONS',
      headers: {
        origin: EVIL_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('does not expose token response when query client_id origin differs from actual body client', async () => {
    const response = await app.request(
      '/oauth/token?client_id=cors-confidential-client',
      {
        method: 'POST',
        headers: {
          origin: CONFIDENTIAL_ORIGIN,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: formBody({
          grant_type: 'client_credentials',
          client_id: 'cors-other-client',
          client_secret: 'cors-other-secret-value',
          scope: 'service.read',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('allows token response for actual body client web origin', async () => {
    const response = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        origin: CONFIDENTIAL_ORIGIN,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        grant_type: 'client_credentials',
        client_id: 'cors-confidential-client',
        client_secret: 'cors-confidential-secret',
        scope: 'service.read',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      CONFIDENTIAL_ORIGIN,
    );
  });

  test('allows public SPA PKCE token response from registered web origin', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const { code } = await getAuthorizationCode(app, {
      sessionCookie,
      clientId: 'cors-spa-client',
      redirectUri: 'http://localhost:5173/callback',
      codeChallenge: TEST_PKCE.codeChallenge,
      codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      scope: 'openid profile email',
    });

    const response = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        origin: SPA_ORIGIN,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        grant_type: 'authorization_code',
        code,
        client_id: 'cors-spa-client',
        redirect_uri: 'http://localhost:5173/callback',
        code_verifier: TEST_PKCE.codeVerifier,
      }),
    });

    const json = await assertJsonBody(response, 200);
    expect(json.access_token).toBeDefined();
    expect(response.headers.get('access-control-allow-origin')).toBe(
      SPA_ORIGIN,
    );
  });

  test('does not expose public SPA PKCE token response to unregistered origin', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const { code } = await getAuthorizationCode(app, {
      sessionCookie,
      clientId: 'cors-spa-client',
      redirectUri: 'http://localhost:5173/callback',
      codeChallenge: TEST_PKCE.codeChallenge,
      codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      scope: 'openid profile email',
    });

    const response = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        origin: EVIL_ORIGIN,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        grant_type: 'authorization_code',
        code,
        client_id: 'cors-spa-client',
        redirect_uri: 'http://localhost:5173/callback',
        code_verifier: TEST_PKCE.codeVerifier,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('allows revocation response for actual body client web origin', async () => {
    const tokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'client_credentials',
        client_id: 'cors-confidential-client',
        client_secret: 'cors-confidential-secret',
        scope: 'service.read',
      }),
    });
    const tokenJson = await assertJsonBody(tokenResponse, 200);

    const response = await app.request('/oauth/revoke', {
      method: 'POST',
      headers: {
        origin: CONFIDENTIAL_ORIGIN,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        token: tokenJson.access_token,
        client_id: 'cors-confidential-client',
        client_secret: 'cors-confidential-secret',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      CONFIDENTIAL_ORIGIN,
    );
  });

  test('does not expose revocation response when query client_id origin differs from actual body client', async () => {
    const tokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'client_credentials',
        client_id: 'cors-other-client',
        client_secret: 'cors-other-secret-value',
        scope: 'service.read',
      }),
    });
    const tokenJson = await assertJsonBody(tokenResponse, 200);

    const response = await app.request(
      '/oauth/revoke?client_id=cors-confidential-client',
      {
        method: 'POST',
        headers: {
          origin: CONFIDENTIAL_ORIGIN,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: formBody({
          token: tokenJson.access_token,
          client_id: 'cors-other-client',
          client_secret: 'cors-other-secret-value',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('does not allow browser CORS for confidential introspection', async () => {
    const response = await app.request('/oauth/introspect', {
      method: 'OPTIONS',
      headers: {
        origin: CONFIDENTIAL_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('does not allow browser CORS for device authorization', async () => {
    const response = await app.request('/oauth/device_authorization', {
      method: 'OPTIONS',
      headers: {
        origin: DEVICE_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('does not apply OAuth client CORS to non-OAuth API routes', async () => {
    const response = await app.request(
      '/api/docs/json?client_id=cors-confidential-client',
      {
        method: 'OPTIONS',
        headers: {
          origin: CONFIDENTIAL_ORIGIN,
          'access-control-request-method': 'GET',
        },
      },
    );

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
