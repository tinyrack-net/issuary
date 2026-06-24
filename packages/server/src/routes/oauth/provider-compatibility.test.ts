import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '../../entrypoints/app.ts';
import {
  countEntities,
  createAuthenticatedSession,
  createTestApp,
  getAuthorizationCode,
  grantConsent,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;
let services: Awaited<ReturnType<typeof createTestApp>>['services'];

const COMPAT_CLIENT = {
  clientId: 'compat-client',
  clientSecret: 'compat-client-secret',
  redirectUri: 'http://localhost:18080/compat/callback',
  postLogoutRedirectUri: 'http://localhost:18080/compat/logout-complete',
};

const COMPAT_CLIENT_CONFIG = {
  id: 'compat-client-config',
  name: 'Compatibility Client',
  client_id: COMPAT_CLIENT.clientId,
  client_secret: COMPAT_CLIENT.clientSecret,
  redirect_uris: [COMPAT_CLIENT.redirectUri],
  post_logout_redirect_uris: [COMPAT_CLIENT.postLogoutRedirectUri],
  web_origins: ['http://localhost:18080'],
  response_types: ['code'],
  grant_types: [
    'authorization_code',
    'refresh_token',
    'client_credentials',
    'urn:ietf:params:oauth:grant-type:device_code',
  ],
  scope: 'openid profile email offline_access service.read',
};

const SECOND_USER_CONFIG = {
  sub: 'second-test-user',
  email: 'second-test-user@example.com',
  password: 'second-test-password',
  role: 'admin' as const,
};

const IMPLICIT_CLIENT = {
  clientId: 'implicit-compat-client',
  clientSecret: 'implicit-compat-secret',
  redirectUri: 'http://localhost:8081/implicit/callback',
};

const IMPLICIT_CLIENT_CONFIG = {
  id: 'implicit-compat-client-config',
  name: 'Implicit Compatibility Client',
  client_id: IMPLICIT_CLIENT.clientId,
  client_secret: IMPLICIT_CLIENT.clientSecret,
  redirect_uris: [IMPLICIT_CLIENT.redirectUri],
  response_types: ['id_token'],
  grant_types: ['implicit'],
  scope: 'openid profile email',
};

const CORS_OTHER_CLIENT_CONFIG = {
  id: 'cors-other-client-config',
  name: 'CORS Other Client',
  client_id: 'cors-other-client',
  client_secret: 'cors-other-client-secret',
  redirect_uris: ['http://localhost:19090/callback'],
  web_origins: ['http://localhost:19090'],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile',
};

beforeAll(async () => {
  const testApp = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG, SECOND_USER_CONFIG],
    clients: [
      TEST_OAUTH_CLIENT_CONFIG,
      COMPAT_CLIENT_CONFIG,
      IMPLICIT_CLIENT_CONFIG,
      CORS_OTHER_CLIENT_CONFIG,
    ],
  });
  app = testApp.app;
  cleanup = testApp.cleanup;
  services = testApp.services;
});

afterAll(async () => {
  if (cleanup) {
    await cleanup();
  }
});

function formBody(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`;
}

async function jsonBody(response: Response): Promise<unknown> {
  return response.json();
}

function expectSessionCleared(response: Response): void {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toContain('session=');
  expect(setCookie).toContain('Path=/');
  expect(setCookie).toMatch(/Max-Age=0|Expires=/);
}

describe('OAuth/OIDC provider compatibility', () => {
  test('serves direct root OIDC discovery JSON with accurate compatibility metadata', async () => {
    const response = await app.request('/.well-known/openid-configuration');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(jsonBody(response)).resolves.toMatchObject({
      issuer: 'http://localhost:8080',
      authorization_endpoint: 'http://localhost:8080/oauth/authorize',
      token_endpoint: 'http://localhost:8080/oauth/token',
      userinfo_endpoint: 'http://localhost:8080/oauth/userinfo',
      end_session_endpoint: 'http://localhost:8080/oauth/end_session',
      device_authorization_endpoint:
        'http://localhost:8080/oauth/device_authorization',
      response_modes_supported: ['query', 'fragment', 'form_post'],
      grant_types_supported: [
        'authorization_code',
        'implicit',
        'refresh_token',
        'client_credentials',
        'urn:ietf:params:oauth:grant-type:device_code',
      ],
      userinfo_signing_alg_values_supported: ['none'],
      introspection_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
      ],
      revocation_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
    });
  });

  test('does not advertise unsupported JWT client auth or hybrid response types', async () => {
    const response = await app.request('/.well-known/openid-configuration');

    expect(response.status).toBe(200);
    const configuration = await response.json();
    expect(configuration).toMatchObject({
      response_types_supported: ['code', 'id_token'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
    });
    expect(configuration.scopes_supported).toContain('service.read');
    expect(configuration.response_types_supported).not.toContain(
      'code id_token',
    );
    expect(configuration.response_types_supported).not.toContain('code token');
    expect(configuration.token_endpoint_auth_methods_supported).not.toContain(
      'client_secret_jwt',
    );
    expect(configuration.token_endpoint_auth_methods_supported).not.toContain(
      'private_key_jwt',
    );
  });

  test('serves JWKS from startup-initialized keys without creating keys on GET', async () => {
    const keyCountBefore = await countEntities(services, 'jwtKey');
    expect(keyCountBefore).toBeGreaterThan(0);

    const response = await app.request('/oauth/.well-known/jwks');
    expect(response.status).toBe(200);
    await expect(jsonBody(response)).resolves.toMatchObject({
      keys: expect.any(Array),
    });

    const keyCountAfter = await countEntities(services, 'jwtKey');
    expect(keyCountAfter).toBe(keyCountBefore);
  });

  test('returns OAuth standard error JSON from token endpoint', async () => {
    const response = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({ grant_type: 'authorization_code' }),
    });

    expect(response.status).toBe(401);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_client',
      error_description: 'Invalid client credentials.',
    });
  });

  test('supports response_mode fragment and form_post for authorization code responses', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    await getAuthorizationCode(app, { sessionCookie });
    const fragmentQuery = new URLSearchParams({
      response_type: 'code',
      client_id: TEST_OAUTH_CLIENT.clientId,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      scope: 'openid profile email',
      state: 'fragment-state',
      code_challenge: TEST_PKCE.codeChallenge,
      code_challenge_method: TEST_PKCE.codeChallengeMethod,
      response_mode: 'fragment',
    });
    const fragmentResponse = await app.request(
      `/oauth/authorize?${fragmentQuery.toString()}`,
      { headers: { cookie: `session=${sessionCookie}` } },
    );

    expect(fragmentResponse.status).toBe(302);
    const fragmentLocation = new URL(
      fragmentResponse.headers.get('location') ?? '',
      'http://localhost:8080',
    );
    expect(fragmentLocation.searchParams.has('code')).toBe(false);
    expect(
      new URLSearchParams(fragmentLocation.hash.slice(1)).get('code'),
    ).toBeTruthy();

    const formPostUrl = new URL('/oauth/authorize', 'http://localhost');
    formPostUrl.searchParams.set('response_type', 'code');
    formPostUrl.searchParams.set('client_id', TEST_OAUTH_CLIENT.clientId);
    formPostUrl.searchParams.set('redirect_uri', TEST_OAUTH_CLIENT.redirectUri);
    formPostUrl.searchParams.set('scope', 'openid profile email');
    formPostUrl.searchParams.set('state', 'form-post-state');
    formPostUrl.searchParams.set('code_challenge', TEST_PKCE.codeChallenge);
    formPostUrl.searchParams.set(
      'code_challenge_method',
      TEST_PKCE.codeChallengeMethod,
    );
    formPostUrl.searchParams.set('response_mode', 'form_post');

    const formPostResponse = await app.request(formPostUrl, {
      headers: { cookie: `session=${sessionCookie}` },
    });

    expect(formPostResponse.status).toBe(200);
    expect(formPostResponse.headers.get('content-type')).toContain('text/html');
    const html = await formPostResponse.text();
    expect(html).toContain(
      `form method="post" action="${TEST_OAUTH_CLIENT.redirectUri}"`,
    );
    expect(html).toContain('name="code"');
    expect(html).toContain('name="state" value="form-post-state"');
  });

  test('preserves optional auth parameters through login redirect', async () => {
    const url = new URL('/oauth/authorize', 'http://localhost');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', TEST_OAUTH_CLIENT.clientId);
    url.searchParams.set('redirect_uri', TEST_OAUTH_CLIENT.redirectUri);
    url.searchParams.set('scope', 'openid profile email');
    url.searchParams.set('code_challenge', TEST_PKCE.codeChallenge);
    url.searchParams.set(
      'code_challenge_method',
      TEST_PKCE.codeChallengeMethod,
    );
    url.searchParams.set('login_hint', 'user@example.com');
    url.searchParams.set('ui_locales', 'ja en');
    url.searchParams.set('id_token_hint', 'hint-token');
    url.searchParams.set('acr_values', 'urn:mace:incommon:iap:silver');
    url.searchParams.set('response_mode', 'fragment');

    const response = await app.request(url);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).not.toBeNull();
    const location = new URL(locationHeader ?? '', 'http://localhost');

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('login_hint')).toBe('user@example.com');
    expect(location.searchParams.get('ui_locales')).toBe('ja en');
    expect(location.searchParams.get('id_token_hint')).toBe('hint-token');
    expect(location.searchParams.get('acr_values')).toBe(
      'urn:mace:incommon:iap:silver',
    );
    expect(location.searchParams.get('response_mode')).toBe('fragment');
  });

  test('allows UserInfo POST with Bearer token and OAuth standard errors', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const { code } = await getAuthorizationCode(app, {
      sessionCookie,
      clientId: COMPAT_CLIENT.clientId,
      redirectUri: COMPAT_CLIENT.redirectUri,
      scope: 'openid profile email',
    });

    const tokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: COMPAT_CLIENT.redirectUri,
        client_id: COMPAT_CLIENT.clientId,
        client_secret: COMPAT_CLIENT.clientSecret,
        code_verifier: TEST_PKCE.codeVerifier,
      }),
    });
    const tokens = await tokenResponse.json();
    expect(tokens).toHaveProperty('access_token');

    const accessToken =
      typeof tokens === 'object' &&
      tokens !== null &&
      'access_token' in tokens &&
      typeof tokens.access_token === 'string'
        ? tokens.access_token
        : '';
    const userInfoResponse = await app.request('/oauth/userinfo', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(userInfoResponse.status).toBe(200);
    await expect(jsonBody(userInfoResponse)).resolves.toMatchObject({
      sub: TEST_USER_CONFIG.sub,
      email: TEST_USER_CONFIG.email,
    });

    const missingAuthResponse = await app.request('/oauth/userinfo', {
      method: 'POST',
    });
    expect(missingAuthResponse.status).toBe(401);
    await expect(jsonBody(missingAuthResponse)).resolves.toMatchObject({
      error: 'invalid_token',
    });
  });

  test('supports CORS from registered web origins', async () => {
    const response = await app.request(
      `/oauth/token?client_id=${COMPAT_CLIENT.clientId}`,
      {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:18080',
          'access-control-request-method': 'POST',
        },
      },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:18080',
    );

    const apiResponse = await app.request('/api/docs/json', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:18080',
        'access-control-request-method': 'GET',
      },
    });

    expect(apiResponse.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('does not expose navigation-only authorize endpoint through CORS', async () => {
    const crossClientResponse = await app.request(
      `/oauth/authorize?client_id=${COMPAT_CLIENT.clientId}`,
      {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:19090',
          'access-control-request-method': 'GET',
        },
      },
    );
    expect(
      crossClientResponse.headers.get('access-control-allow-origin'),
    ).toBeNull();

    const registeredOriginResponse = await app.request(
      `/oauth/authorize?client_id=${COMPAT_CLIENT.clientId}`,
      {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:18080',
          'access-control-request-method': 'GET',
        },
      },
    );
    expect(
      registeredOriginResponse.headers.get('access-control-allow-origin'),
    ).toBeNull();
  });

  test('scopes OAuth CORS to token POST body client_id', async () => {
    const crossClientResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'http://localhost:19090',
      },
      body: formBody({
        grant_type: 'client_credentials',
        client_id: COMPAT_CLIENT.clientId,
        client_secret: COMPAT_CLIENT.clientSecret,
        scope: 'service.read',
      }),
    });
    expect(crossClientResponse.status).toBe(200);
    expect(
      crossClientResponse.headers.get('access-control-allow-origin'),
    ).toBeNull();

    const ownClientResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'http://localhost:18080',
      },
      body: formBody({
        grant_type: 'client_credentials',
        client_id: COMPAT_CLIENT.clientId,
        client_secret: COMPAT_CLIENT.clientSecret,
        scope: 'service.read',
      }),
    });
    expect(ownClientResponse.status).toBe(200);
    expect(ownClientResponse.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:18080',
    );
  });

  test('honors response_mode for authorization errors and rejects implicit query responses', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const formPostUrl = new URL('/oauth/authorize', 'http://localhost');
    formPostUrl.searchParams.set('response_type', 'code');
    formPostUrl.searchParams.set('client_id', COMPAT_CLIENT.clientId);
    formPostUrl.searchParams.set('redirect_uri', COMPAT_CLIENT.redirectUri);
    formPostUrl.searchParams.set('scope', 'openid unsupported-scope');
    formPostUrl.searchParams.set('state', 'error-form-post-state');
    formPostUrl.searchParams.set('code_challenge', TEST_PKCE.codeChallenge);
    formPostUrl.searchParams.set(
      'code_challenge_method',
      TEST_PKCE.codeChallengeMethod,
    );
    formPostUrl.searchParams.set('response_mode', 'form_post');

    const formPostErrorResponse = await app.request(formPostUrl, {
      headers: { cookie: `session=${sessionCookie}` },
    });

    expect(formPostErrorResponse.status).toBe(200);
    const errorHtml = await formPostErrorResponse.text();
    expect(errorHtml).toContain(
      `form method="post" action="${COMPAT_CLIENT.redirectUri}"`,
    );
    expect(errorHtml).toContain('name="error" value="invalid_scope"');
    expect(errorHtml).toContain('name="state" value="error-form-post-state"');

    const implicitQueryUrl = new URL('/oauth/authorize', 'http://localhost');
    implicitQueryUrl.searchParams.set('response_type', 'id_token');
    implicitQueryUrl.searchParams.set('client_id', IMPLICIT_CLIENT.clientId);
    implicitQueryUrl.searchParams.set(
      'redirect_uri',
      IMPLICIT_CLIENT.redirectUri,
    );
    implicitQueryUrl.searchParams.set('scope', 'openid profile email');
    implicitQueryUrl.searchParams.set('nonce', 'implicit-query-nonce');
    implicitQueryUrl.searchParams.set('response_mode', 'query');

    const implicitQueryResponse = await app.request(implicitQueryUrl, {
      headers: { cookie: `session=${sessionCookie}` },
    });
    expect(implicitQueryResponse.status).toBe(302);
    const implicitQueryLocation = new URL(
      implicitQueryResponse.headers.get('location') ?? '',
    );
    expect(implicitQueryLocation.hash).toBe('');
    expect(implicitQueryLocation.searchParams.get('error')).toBe(
      'invalid_request',
    );
    expect(implicitQueryLocation.searchParams.has('id_token')).toBe(false);
  });

  test('honors response_mode form_post for prompt none authorization errors', async () => {
    const loginRequiredUrl = new URL('/oauth/authorize', 'http://localhost');
    loginRequiredUrl.searchParams.set('response_type', 'code');
    loginRequiredUrl.searchParams.set('client_id', COMPAT_CLIENT.clientId);
    loginRequiredUrl.searchParams.set(
      'redirect_uri',
      COMPAT_CLIENT.redirectUri,
    );
    loginRequiredUrl.searchParams.set('scope', 'openid profile');
    loginRequiredUrl.searchParams.set('state', 'prompt-none-login-state');
    loginRequiredUrl.searchParams.set(
      'code_challenge',
      TEST_PKCE.codeChallenge,
    );
    loginRequiredUrl.searchParams.set(
      'code_challenge_method',
      TEST_PKCE.codeChallengeMethod,
    );
    loginRequiredUrl.searchParams.set('prompt', 'none');
    loginRequiredUrl.searchParams.set('response_mode', 'form_post');

    const loginRequiredResponse = await app.request(loginRequiredUrl);

    expect(loginRequiredResponse.status).toBe(200);
    expect(loginRequiredResponse.headers.get('content-type')).toContain(
      'text/html',
    );
    const loginRequiredHtml = await loginRequiredResponse.text();
    expect(loginRequiredHtml).toContain(
      `form method="post" action="${COMPAT_CLIENT.redirectUri}"`,
    );
    expect(loginRequiredHtml).toContain('name="error" value="login_required"');
    expect(loginRequiredHtml).toContain(
      'name="state" value="prompt-none-login-state"',
    );

    const sessionCookie = await createAuthenticatedSession(
      app,
      SECOND_USER_CONFIG.email,
      SECOND_USER_CONFIG.password,
    );
    const consentRequiredUrl = new URL('/oauth/authorize', 'http://localhost');
    consentRequiredUrl.searchParams.set('response_type', 'code');
    consentRequiredUrl.searchParams.set('client_id', COMPAT_CLIENT.clientId);
    consentRequiredUrl.searchParams.set(
      'redirect_uri',
      COMPAT_CLIENT.redirectUri,
    );
    consentRequiredUrl.searchParams.set('scope', 'openid email');
    consentRequiredUrl.searchParams.set('state', 'prompt-none-consent-state');
    consentRequiredUrl.searchParams.set(
      'code_challenge',
      TEST_PKCE.codeChallenge,
    );
    consentRequiredUrl.searchParams.set(
      'code_challenge_method',
      TEST_PKCE.codeChallengeMethod,
    );
    consentRequiredUrl.searchParams.set('prompt', 'none');
    consentRequiredUrl.searchParams.set('response_mode', 'form_post');

    const consentRequiredResponse = await app.request(consentRequiredUrl, {
      headers: { cookie: `session=${sessionCookie}` },
    });

    expect(consentRequiredResponse.status).toBe(200);
    const consentRequiredHtml = await consentRequiredResponse.text();
    expect(consentRequiredHtml).toContain(
      `form method="post" action="${COMPAT_CLIENT.redirectUri}"`,
    );
    expect(consentRequiredHtml).toContain(
      'name="error" value="consent_required"',
    );
    expect(consentRequiredHtml).toContain(
      'name="state" value="prompt-none-consent-state"',
    );
  });

  test('supports response_mode form_post for implicit id_token responses', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const implicitFormPostUrl = new URL('/oauth/authorize', 'http://localhost');
    implicitFormPostUrl.searchParams.set('response_type', 'id_token');
    implicitFormPostUrl.searchParams.set('client_id', IMPLICIT_CLIENT.clientId);
    implicitFormPostUrl.searchParams.set(
      'redirect_uri',
      IMPLICIT_CLIENT.redirectUri,
    );
    implicitFormPostUrl.searchParams.set('scope', 'openid profile email');
    implicitFormPostUrl.searchParams.set('nonce', 'implicit-form-post-nonce');
    implicitFormPostUrl.searchParams.set('state', 'implicit-form-post-state');
    implicitFormPostUrl.searchParams.set('response_mode', 'form_post');
    await grantConsent(app, sessionCookie, {
      client_id: IMPLICIT_CLIENT.clientId,
      redirect_uri: IMPLICIT_CLIENT.redirectUri,
      response_type: 'id_token',
      scope: 'openid profile email',
      nonce: 'implicit-form-post-nonce',
      state: 'implicit-form-post-state',
    });

    const response = await app.request(implicitFormPostUrl, {
      headers: { cookie: `session=${sessionCookie}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain(`method="post"`);
    expect(html).toContain(`action="${IMPLICIT_CLIENT.redirectUri}"`);
    expect(html).toContain(`name="id_token"`);
    expect(html).toContain(`name="token_type" value="Bearer"`);
    expect(html).toContain(`name="expires_in"`);
    expect(html).toContain(`name="state" value="implicit-form-post-state"`);
  });

  test('supports RP-initiated logout with registered post_logout_redirect_uri', async () => {
    const response = await app.request(
      `/oauth/end_session?client_id=${COMPAT_CLIENT.clientId}&post_logout_redirect_uri=${encodeURIComponent(COMPAT_CLIENT.postLogoutRedirectUri)}&state=logged-out`,
    );

    expect(response.status).toBe(302);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).not.toBeNull();
    const location = new URL(locationHeader ?? '');
    expect(location.toString()).toBe(
      `${COMPAT_CLIENT.postLogoutRedirectUri}?state=logged-out`,
    );
    expectSessionCleared(response);

    const defaultRedirectResponse = await app.request('/oauth/end_session');
    expect(defaultRedirectResponse.status).toBe(302);
    expect(defaultRedirectResponse.headers.get('location')).toBe(
      'http://localhost:8080',
    );
    expectSessionCleared(defaultRedirectResponse);

    const invalidResponse = await app.request(
      `/oauth/end_session?client_id=${COMPAT_CLIENT.clientId}&post_logout_redirect_uri=${encodeURIComponent('http://evil.test/logout')}`,
    );
    expect(invalidResponse.status).toBe(400);
    await expect(jsonBody(invalidResponse)).resolves.toMatchObject({
      error: 'invalid_request',
    });
  });

  test('supports RP-initiated logout using id_token_hint without client_id', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const { code } = await getAuthorizationCode(app, {
      sessionCookie,
      clientId: COMPAT_CLIENT.clientId,
      redirectUri: COMPAT_CLIENT.redirectUri,
      scope: 'openid profile email',
    });

    const tokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: COMPAT_CLIENT.redirectUri,
        client_id: COMPAT_CLIENT.clientId,
        client_secret: COMPAT_CLIENT.clientSecret,
        code_verifier: TEST_PKCE.codeVerifier,
      }),
    });
    const tokenJson = await tokenResponse.json();
    expect(tokenJson.id_token).toEqual(expect.any(String));

    const response = await app.request(
      `/oauth/end_session?post_logout_redirect_uri=${encodeURIComponent(COMPAT_CLIENT.postLogoutRedirectUri)}&id_token_hint=${encodeURIComponent(tokenJson.id_token)}&state=hint-only`,
    );

    expect(response.status).toBe(302);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).not.toBeNull();
    const location = new URL(locationHeader ?? '');
    expect(location.toString()).toBe(
      `${COMPAT_CLIENT.postLogoutRedirectUri}?state=hint-only`,
    );
    expectSessionCleared(response);
  });
  test('rejects RP-initiated logout with invalid id_token_hint', async () => {
    const response = await app.request(
      `/oauth/end_session?client_id=${COMPAT_CLIENT.clientId}&post_logout_redirect_uri=${encodeURIComponent(COMPAT_CLIENT.postLogoutRedirectUri)}&id_token_hint=not-a-valid-id-token`,
    );

    expect(response.status).toBe(400);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_request',
    });
  });

  test('rejects device authorization without client authentication', async () => {
    const response = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({ scope: 'openid profile' }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Basic realm="tinyauth"',
    );
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_client',
    });
  });

  test('rejects device authorization with an invalid client secret', async () => {
    const response = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(COMPAT_CLIENT.clientId, 'wrong-secret'),
      },
      body: formBody({ scope: 'openid profile' }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Basic realm="tinyauth"',
    );
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_client',
    });
  });

  test('rejects device authorization with both Basic and body client_secret', async () => {
    const response = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        client_secret: COMPAT_CLIENT.clientSecret,
        scope: 'openid profile',
      }),
    });

    expect(response.status).toBe(401);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_client',
    });
  });

  test('rejects device authorization with conflicting Basic and body client_id', async () => {
    const response = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        client_id: 'different-device-client',
        scope: 'openid profile',
      }),
    });

    expect(response.status).toBe(401);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_client',
    });
  });

  test('rejects device authorization with unsupported scopes', async () => {
    const response = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid unsupported-device-scope' }),
    });

    expect(response.status).toBe(400);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_scope',
    });
  });

  test('rejects device authorization for a disabled client', async () => {
    const disabledClientId = 'disabled-device-client';
    const disabledClientSecret = 'disabled-device-secret';
    await withMikroContext(services, async () => {
      const disabledClient = services.mikro.oauthClient.create({
        id: 'disabled-device-client-config',
        clientId: disabledClientId,
        clientSecretHash:
          await services.securityService.hashClientSecret(disabledClientSecret),
        name: 'Disabled Device Client',
        grantTypes: [
          'authorization_code',
          'urn:ietf:params:oauth:grant-type:device_code',
        ],
        responseTypes: ['code'],
        scopes: ['openid', 'profile'],
        redirectUris: ['http://localhost:18081/callback'],
        postLogoutRedirectUris: [],
        webOrigins: [],
        enabled: false,
        managed_by: 'database',
        logoUri: null,
      });
      await services.mikro.em.persist(disabledClient).flush();
    });

    const response = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(disabledClientId, disabledClientSecret),
      },
      body: formBody({ scope: 'openid profile' }),
    });

    expect(response.status).toBe(400);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_request',
    });
  });

  test('rejects client credentials requests for end-user OIDC scopes', async () => {
    const response = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'client_credentials',
        scope: 'openid service.read',
      }),
    });

    expect(response.status).toBe(400);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_scope',
    });
  });

  test('supports client_credentials and complete device authorization flow', async () => {
    const clientCredentialsResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'client_credentials',
        scope: 'service.read',
      }),
    });

    expect(clientCredentialsResponse.status).toBe(200);
    const clientCredentialsJson = await clientCredentialsResponse.json();
    expect(clientCredentialsJson).toMatchObject({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'service.read',
    });

    const clientCredentialsIntrospectionResponse = await app.request(
      '/oauth/introspect',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: basicAuthHeader(
            COMPAT_CLIENT.clientId,
            COMPAT_CLIENT.clientSecret,
          ),
        },
        body: formBody({
          token: clientCredentialsJson.access_token,
          token_type_hint: 'access_token',
        }),
      },
    );
    expect(clientCredentialsIntrospectionResponse.status).toBe(200);
    await expect(
      jsonBody(clientCredentialsIntrospectionResponse),
    ).resolves.toMatchObject({
      active: true,
      client_id: COMPAT_CLIENT.clientId,
      sub: COMPAT_CLIENT.clientId,
      scope: 'service.read',
    });

    const unauthenticatedClientCredentialsResponse = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: formBody({
          grant_type: 'client_credentials',
          client_id: COMPAT_CLIENT.clientId,
          scope: 'service.read',
        }),
      },
    );
    expect(unauthenticatedClientCredentialsResponse.status).toBe(401);
    await expect(
      jsonBody(unauthenticatedClientCredentialsResponse),
    ).resolves.toMatchObject({ error: 'invalid_client' });

    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });

    expect(deviceResponse.status).toBe(200);
    expect(deviceResponse.headers.get('cache-control')).toBe('no-store');
    expect(deviceResponse.headers.get('pragma')).toBe('no-cache');
    const deviceJson = await deviceResponse.json();
    expect(deviceJson).toMatchObject({
      verification_uri: 'http://localhost:8080/oauth/device',
      expires_in: 600,
      interval: 5,
    });
    expect(deviceJson.device_code).toEqual(expect.any(String));
    expect(deviceJson.user_code).toEqual(expect.any(String));
    expect(deviceJson.verification_uri_complete).toContain(
      encodeURIComponent(deviceJson.user_code),
    );

    const pendingTokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceJson.device_code,
      }),
    });

    expect(pendingTokenResponse.status).toBe(400);
    await expect(jsonBody(pendingTokenResponse)).resolves.toMatchObject({
      error: 'authorization_pending',
      error_description: 'Device authorization is pending.',
    });

    const missingDeviceCodeResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    expect(missingDeviceCodeResponse.status).toBe(400);
    await expect(jsonBody(missingDeviceCodeResponse)).resolves.toMatchObject({
      error: 'invalid_request',
    });

    const unsupportedDeviceGrantResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          TEST_OAUTH_CLIENT.clientId,
          TEST_OAUTH_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceJson.device_code,
      }),
    });
    expect(unsupportedDeviceGrantResponse.status).toBe(400);
    await expect(
      jsonBody(unsupportedDeviceGrantResponse),
    ).resolves.toMatchObject({ error: 'unsupported_grant_type' });

    const sessionCookie = await createAuthenticatedSession(app);
    const approveResponse = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionCookie}`,
      },
      body: formBody({ user_code: deviceJson.user_code }),
    });
    expect(approveResponse.status).toBe(200);
    await expect(jsonBody(approveResponse)).resolves.toMatchObject({
      status: 'approved',
      client_id: COMPAT_CLIENT.clientId,
    });

    const approvedTokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceJson.device_code,
      }),
    });
    expect(approvedTokenResponse.status).toBe(200);
    await expect(jsonBody(approvedTokenResponse)).resolves.toMatchObject({
      token_type: 'Bearer',
      scope: 'openid profile',
      id_token: expect.any(String),
    });

    const reusedTokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceJson.device_code,
      }),
    });
    expect(reusedTokenResponse.status).toBe(400);
    await expect(jsonBody(reusedTokenResponse)).resolves.toMatchObject({
      error: 'invalid_grant',
    });
  });

  test('returns access_denied after the user denies a device authorization request', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();

    const sessionCookie = await createAuthenticatedSession(app);
    const denyResponse = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionCookie}`,
      },
      body: formBody({ user_code: deviceJson.user_code, decision: 'deny' }),
    });
    expect(denyResponse.status).toBe(200);
    await expect(jsonBody(denyResponse)).resolves.toMatchObject({
      status: 'denied',
      client_id: COMPAT_CLIENT.clientId,
    });

    const tokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceJson.device_code,
      }),
    });

    expect(tokenResponse.status).toBe(400);
    await expect(jsonBody(tokenResponse)).resolves.toMatchObject({
      error: 'access_denied',
      error_description:
        'The resource owner or authorization server denied the request.',
    });
  });
  test('redeems an approved device_code only once under concurrent polling', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    expect(deviceResponse.status).toBe(200);
    const deviceJson = await deviceResponse.json();

    const sessionCookie = await createAuthenticatedSession(app);
    const approveResponse = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionCookie}`,
      },
      body: formBody({ user_code: deviceJson.user_code }),
    });
    expect(approveResponse.status).toBe(200);

    const poll = () =>
      app.request('/oauth/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: basicAuthHeader(
            COMPAT_CLIENT.clientId,
            COMPAT_CLIENT.clientSecret,
          ),
        },
        body: formBody({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceJson.device_code,
        }),
      });

    const responses = await Promise.all([poll(), poll()]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 400]);
    const failedResponse = responses.find(
      (response) => response.status === 400,
    );
    expect(failedResponse).toBeDefined();
    await expect(jsonBody(failedResponse as Response)).resolves.toMatchObject({
      error: 'invalid_grant',
    });
  });

  test('increases the enforced device polling interval after slow_down', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-24T00:00:00.000Z') });
    try {
      const deviceResponse = await app.request('/oauth/device_authorization', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: basicAuthHeader(
            COMPAT_CLIENT.clientId,
            COMPAT_CLIENT.clientSecret,
          ),
        },
        body: formBody({ scope: 'openid profile' }),
      });
      const deviceJson = await deviceResponse.json();

      const poll = () =>
        app.request('/oauth/token', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: basicAuthHeader(
              COMPAT_CLIENT.clientId,
              COMPAT_CLIENT.clientSecret,
            ),
          },
          body: formBody({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceJson.device_code,
          }),
        });

      const firstResponse = await poll();
      expect(firstResponse.status).toBe(400);
      await expect(jsonBody(firstResponse)).resolves.toMatchObject({
        error: 'authorization_pending',
      });

      const secondResponse = await poll();
      expect(secondResponse.status).toBe(400);
      await expect(jsonBody(secondResponse)).resolves.toMatchObject({
        error: 'slow_down',
      });

      await withMikroContext(services, async () => {
        const deviceCodeHash = await services.securityService.hashOpaqueToken(
          'oauth-device-code',
          deviceJson.device_code,
        );
        const persistedDeviceCode =
          await services.mikro.oauthDeviceCode.findOneOrFail({
            deviceCodeHash,
          });
        expect(persistedDeviceCode.lastPolledAt).toEqual(
          new Date('2026-06-24T00:00:00.000Z'),
        );
        expect(persistedDeviceCode.pollIntervalSeconds).toBe(10);
      });

      await vi.advanceTimersByTimeAsync(5_000);
      const originalIntervalResponse = await poll();
      expect(originalIntervalResponse.status).toBe(400);
      await expect(jsonBody(originalIntervalResponse)).resolves.toMatchObject({
        error: 'slow_down',
      });

      await vi.advanceTimersByTimeAsync(15_000);
      const increasedIntervalResponse = await poll();
      expect(increasedIntervalResponse.status).toBe(400);
      await expect(jsonBody(increasedIntervalResponse)).resolves.toMatchObject({
        error: 'authorization_pending',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('device verification page shows client and requested scopes', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();
    const sessionCookie = await createAuthenticatedSession(app);

    const pageResponse = await app.request(
      `/oauth/device?user_code=${encodeURIComponent(deviceJson.user_code)}`,
      { headers: { cookie: `session=${sessionCookie}` } },
    );

    expect(pageResponse.status).toBe(200);
    const html = await pageResponse.text();
    expect(html).toContain('Compatibility Client');
    expect(html).toContain('openid');
    expect(html).toContain('profile');
  });

  test('rejects cross-site POST to /oauth/device without same-origin header', async () => {
    // Device authorization to get user_code
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();

    // Cross-site POST with session cookie but wrong Origin
    const sessionCookie = await createAuthenticatedSession(app);
    const crossSiteResponse = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionCookie}`,
        Origin: 'http://evil.com',
      },
      body: formBody({ user_code: deviceJson.user_code }),
    });
    expect(crossSiteResponse.status).toBe(403);
  });

  test('prevents overwriting an already-approved user_code', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();

    // User A approves
    const sessionA = await createAuthenticatedSession(app);
    const approveA = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionA}`,
      },
      body: formBody({ user_code: deviceJson.user_code }),
    });
    expect(approveA.status).toBe(200);

    // User B attempts to overwrite
    const sessionB = await createAuthenticatedSession(
      app,
      SECOND_USER_CONFIG.email,
      SECOND_USER_CONFIG.password,
    );
    const approveB = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionB}`,
      },
      body: formBody({ user_code: deviceJson.user_code }),
    });
    // Should fail because already approved
    expect(approveB.status).toBe(400);
    await expect(jsonBody(approveB)).resolves.toMatchObject({
      error: 'invalid_grant',
    });
  });

  test('approves a pending user_code only once under concurrent user submissions', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();
    const sessionA = await createAuthenticatedSession(app);
    const sessionB = await createAuthenticatedSession(
      app,
      SECOND_USER_CONFIG.email,
      SECOND_USER_CONFIG.password,
    );

    const approve = (sessionCookie: string) =>
      app.request('/oauth/device', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: `session=${sessionCookie}`,
        },
        body: formBody({ user_code: deviceJson.user_code }),
      });

    const responses = await Promise.all([approve(sessionA), approve(sessionB)]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
  });

  test('rejects an unknown device user_code during approval', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const response = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionCookie}`,
      },
      body: formBody({ user_code: 'UNKNOWN-CODE' }),
    });

    expect(response.status).toBe(400);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_grant',
    });
  });

  test('does not display client details for an expired device user_code', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();
    await withMikroContext(services, async () => {
      const userCodeHash = await services.securityService.hashOpaqueToken(
        'oauth-device-user-code',
        deviceJson.user_code.toUpperCase(),
      );
      const deviceCode =
        await services.mikro.oauthDeviceCode.findPendingByUserCodeHash(
          userCodeHash,
        );
      if (!deviceCode) {
        throw new Error('Expected pending device code');
      }
      deviceCode.expiresAt = new Date(Date.now() - 1000);
      await services.mikro.em.flush();
    });

    const sessionCookie = await createAuthenticatedSession(app);
    const response = await app.request(
      `/oauth/device?user_code=${encodeURIComponent(deviceJson.user_code)}`,
      { headers: { cookie: `session=${sessionCookie}` } },
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toContain(COMPAT_CLIENT_CONFIG.name);
    expect(html).not.toContain('<li>openid</li>');
  });

  test('rejects an expired device user_code during approval', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();
    await withMikroContext(services, async () => {
      const userCodeHash = await services.securityService.hashOpaqueToken(
        'oauth-device-user-code',
        deviceJson.user_code.toUpperCase(),
      );
      const deviceCode =
        await services.mikro.oauthDeviceCode.findPendingByUserCodeHash(
          userCodeHash,
        );
      if (!deviceCode) {
        throw new Error('Expected pending device code');
      }
      deviceCode.expiresAt = new Date(Date.now() - 1000);
      await services.mikro.em.flush();
    });

    const sessionCookie = await createAuthenticatedSession(app);
    const response = await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionCookie}`,
      },
      body: formBody({ user_code: deviceJson.user_code }),
    });

    expect(response.status).toBe(400);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'invalid_grant',
    });
  });

  test('rejects an expired device_code during token polling', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile' }),
    });
    const deviceJson = await deviceResponse.json();
    await withMikroContext(services, async () => {
      const client = await services.oauthClientService.findByClientId(
        COMPAT_CLIENT.clientId,
      );
      const deviceCodeHash = await services.securityService.hashOpaqueToken(
        'oauth-device-code',
        deviceJson.device_code,
      );
      const deviceCode =
        await services.mikro.oauthDeviceCode.findByClientAndDeviceCodeHash(
          client.id,
          deviceCodeHash,
        );
      if (!deviceCode) {
        throw new Error('Expected pending device code');
      }
      deviceCode.expiresAt = new Date(Date.now() - 1000);
      await services.mikro.em.flush();
    });

    const response = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceJson.device_code,
      }),
    });

    expect(response.status).toBe(400);
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: 'expired_token',
    });
  });

  test('CORS rejects cross-origin OAuth endpoint access from non-web_origin', async () => {
    const response = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        Origin: 'http://unregistered-evil.com',
      },
    });
    // CORS should reject — no Access-Control-Allow-Origin for unregistered origin
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('device flow id_token contains correct claims', async () => {
    const deviceResponse = await app.request('/oauth/device_authorization', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({ scope: 'openid profile email' }),
    });
    const deviceJson = await deviceResponse.json();

    const sessionCookie = await createAuthenticatedSession(app);
    await app.request('/oauth/device', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${sessionCookie}`,
      },
      body: formBody({ user_code: deviceJson.user_code }),
    });

    const tokenResponse = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader(
          COMPAT_CLIENT.clientId,
          COMPAT_CLIENT.clientSecret,
        ),
      },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceJson.device_code,
      }),
    });
    const tokenJson = await tokenResponse.json();
    expect(tokenJson.id_token).toEqual(expect.any(String));

    // Decode JWT payload (base64url middle part)
    const idTokenPayload = JSON.parse(
      Buffer.from(tokenJson.id_token.split('.')[1], 'base64url').toString(),
    );
    expect(idTokenPayload).toMatchObject({
      sub: expect.any(String),
      aud: COMPAT_CLIENT.clientId,
      iss: 'http://localhost:8080',
    });
    expect(idTokenPayload.email).toBeDefined();
    expect(idTokenPayload.email_verified).toBeDefined();
  });
});
