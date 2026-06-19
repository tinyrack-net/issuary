import { createHash, randomBytes } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { consentPage } from '#frontend-e2e/helpers/consent.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

const MOCK_CLIENT = {
  clientId: 'mock-e2e-oauth-client',
  clientSecret: 'mock-e2e-oauth-client-secret',
  name: 'Mock OAuth Client',
};

const TEST_PASSWORD = 'test-password-123';

const MOCK_CLIENT_HOST = '127.0.0.1';

function getMockClientOrigin(port: number): string {
  return `http://${MOCK_CLIENT_HOST}:${port}`;
}

const test = createScenarioFixture(
  (backendPort, _frontendPort, mockClientPort) => {
    const mockClientOrigin = getMockClientOrigin(mockClientPort);
    return {
      ...E2E_BASE_CONFIG,
      ...createTestConfig(backendPort, {
        registration: {
          enabled: true,
          allowed_email_patterns: ['*'],
        },
      }),
      clients: [
        {
          id: 'mock-e2e-oauth-client-config',
          name: MOCK_CLIENT.name,
          client_id: MOCK_CLIENT.clientId,
          client_secret: MOCK_CLIENT.clientSecret,
          redirect_uris: [`${mockClientOrigin}/callback`],
          post_logout_redirect_uris: [`${mockClientOrigin}/logged-out`],
          web_origins: [mockClientOrigin],
          response_types: ['code'],
          grant_types: [
            'authorization_code',
            'refresh_token',
            'client_credentials',
            'urn:ietf:params:oauth:grant-type:device_code',
          ],
          scope: 'openid profile email offline_access service.read',
        },
      ],
    };
  },
);

function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `mock-oauth-client-${suffix}`);
}

function createPkceS256Pair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(48).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

async function registerUserByApi(
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const registerRes = await client.api.auth.register.$post({
    header: {},
    json: { email, password },
  });

  if (!registerRes.ok) {
    throw new Error(`Failed to register user: ${registerRes.status}`);
  }
}

function extractSessionCookie(setCookie: string | null): string {
  const match = setCookie?.match(/session=([^;]+)/);
  if (!match?.[1]) {
    throw new Error('Missing session cookie');
  }

  return match[1];
}

async function loginByApi(
  context: import('@playwright/test').BrowserContext,
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  const response = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to login user: ${response.status}`);
  }

  await context.addCookies([
    {
      name: 'session',
      value: extractSessionCookie(response.headers.get('set-cookie')),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

type MockOAuthClientServer = {
  origin: string;
  close: () => Promise<void>;
};

type OpenIdConfiguration = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  deviceAuthorizationEndpoint: string;
  introspectionEndpoint: string;
  endSessionEndpoint: string;
  responseTypesSupported: string[];
  grantTypesSupported: string[];
  scopesSupported: string[];
};

async function fetchOpenIdConfiguration(
  authServerOrigin: string,
): Promise<OpenIdConfiguration> {
  const response = await fetch(
    `${authServerOrigin}/oauth/.well-known/openid-configuration`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch discovery document: ${response.status}`);
  }
  const json = await response.json();
  if (typeof json !== 'object' || json === null) {
    throw new Error('Discovery document is not an object');
  }

  return {
    authorizationEndpoint: requireStringField(json, 'authorization_endpoint'),
    tokenEndpoint: requireStringField(json, 'token_endpoint'),
    userinfoEndpoint: requireStringField(json, 'userinfo_endpoint'),
    deviceAuthorizationEndpoint: requireStringField(
      json,
      'device_authorization_endpoint',
    ),
    introspectionEndpoint: requireStringField(json, 'introspection_endpoint'),
    endSessionEndpoint: requireStringField(json, 'end_session_endpoint'),
    responseTypesSupported: requireStringArrayField(
      json,
      'response_types_supported',
    ),
    grantTypesSupported: requireStringArrayField(json, 'grant_types_supported'),
    scopesSupported: requireStringArrayField(json, 'scopes_supported'),
  };
}

function requireStringField(value: object, key: string): string {
  const field = readStringField(value, key);
  if (!field) {
    throw new Error(`Discovery document is missing ${key}`);
  }
  return field;
}

function requireStringArrayField(value: object, key: string): string[] {
  const entry = Object.entries(value).find(([entryKey]) => entryKey === key);
  if (!Array.isArray(entry?.[1])) {
    throw new Error(`Discovery document is missing ${key}`);
  }
  const result = entry[1].filter((item) => typeof item === 'string');
  if (result.length !== entry[1].length) {
    throw new Error(`Discovery document ${key} must be a string array`);
  }
  return result;
}

function assertDiscoverySupports(
  discovery: OpenIdConfiguration,
  capability: 'response' | 'grant' | 'scope',
  value: string,
): void {
  const supported =
    capability === 'response'
      ? discovery.responseTypesSupported
      : capability === 'grant'
        ? discovery.grantTypesSupported
        : discovery.scopesSupported;
  if (!supported.includes(value)) {
    throw new Error(`Discovery does not advertise ${capability} ${value}`);
  }
}

function sendHtml(
  response: ServerResponse,
  status: number,
  html: string,
): void {
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
}

function sendRedirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { location });
  response.end();
}

function parseRequestUrl(request: IncomingMessage, origin: string): URL {
  return new URL(request.url ?? '/', origin);
}

function getTokenResponseClaims(tokenJson: unknown): {
  tokenType: string | undefined;
  hasIdToken: boolean;
  accessToken: string | undefined;
  refreshToken: string | undefined;
  scope: string | undefined;
} {
  if (typeof tokenJson !== 'object' || tokenJson === null) {
    return {
      tokenType: undefined,
      hasIdToken: false,
      accessToken: undefined,
      refreshToken: undefined,
      scope: undefined,
    };
  }

  const tokenType = readStringField(tokenJson, 'token_type');
  const accessToken = readStringField(tokenJson, 'access_token');
  const refreshToken = readStringField(tokenJson, 'refresh_token');
  const scope = readStringField(tokenJson, 'scope');
  const hasIdToken = typeof readStringField(tokenJson, 'id_token') === 'string';

  return { tokenType, hasIdToken, accessToken, refreshToken, scope };
}

function readStringField(value: object, key: string): string | undefined {
  const entry = Object.entries(value).find(([entryKey]) => entryKey === key);
  return typeof entry?.[1] === 'string' ? entry[1] : undefined;
}

function basicClientAuthHeader(): string {
  return `Basic ${Buffer.from(`${encodeURIComponent(MOCK_CLIENT.clientId)}:${encodeURIComponent(MOCK_CLIENT.clientSecret)}`).toString('base64')}`;
}

async function startMockOAuthClient(params: {
  authServerOrigin: string;
  mockClientOrigin: string;
  mockClientPort: number;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  codeVerifier: string;
  releasePort?: () => Promise<void>;
}): Promise<MockOAuthClientServer> {
  let latestDeviceCode: string | undefined;
  let latestRefreshToken: string | undefined;
  const discovery = await fetchOpenIdConfiguration(params.authServerOrigin);
  assertDiscoverySupports(discovery, 'response', 'code');
  assertDiscoverySupports(discovery, 'grant', 'authorization_code');
  assertDiscoverySupports(discovery, 'grant', 'refresh_token');
  assertDiscoverySupports(discovery, 'grant', 'client_credentials');
  assertDiscoverySupports(
    discovery,
    'grant',
    'urn:ietf:params:oauth:grant-type:device_code',
  );
  assertDiscoverySupports(discovery, 'scope', 'openid');
  assertDiscoverySupports(discovery, 'scope', 'offline_access');
  assertDiscoverySupports(discovery, 'scope', 'service.read');

  const server = createServer(async (request, response) => {
    const url = parseRequestUrl(request, params.mockClientOrigin);

    if (url.pathname === '/start') {
      const authorizeUrl = new URL(discovery.authorizationEndpoint);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', MOCK_CLIENT.clientId);
      authorizeUrl.searchParams.set('redirect_uri', params.redirectUri);
      authorizeUrl.searchParams.set(
        'scope',
        'openid profile email offline_access',
      );
      authorizeUrl.searchParams.set('state', params.state);
      authorizeUrl.searchParams.set('nonce', params.nonce);
      authorizeUrl.searchParams.set('code_challenge', params.codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');
      authorizeUrl.searchParams.set('prompt', 'consent');
      sendRedirect(response, authorizeUrl.toString());
      return;
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || state !== params.state) {
        sendHtml(response, 400, '<h1>Mock client callback failed</h1>');
        return;
      }

      const tokenResponse = await fetch(discovery.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: params.redirectUri,
          client_id: MOCK_CLIENT.clientId,
          client_secret: MOCK_CLIENT.clientSecret,
          code_verifier: params.codeVerifier,
        }),
      });
      const tokenJson = await tokenResponse.json();
      if (!tokenResponse.ok) {
        sendHtml(
          response,
          502,
          `<h1>Mock client token exchange failed</h1><pre>${JSON.stringify(tokenJson)}</pre>`,
        );
        return;
      }

      const tokenClaims = getTokenResponseClaims(tokenJson);
      if (!tokenClaims.accessToken) {
        sendHtml(response, 502, '<h1>Mock client missing access token</h1>');
        return;
      }
      if (!tokenClaims.refreshToken) {
        sendHtml(response, 502, '<h1>Mock client missing refresh token</h1>');
        return;
      }
      latestRefreshToken = tokenClaims.refreshToken;

      const userInfoResponse = await fetch(discovery.userinfoEndpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenClaims.accessToken}` },
      });
      const userInfoJson = await userInfoResponse.json();
      if (!userInfoResponse.ok) {
        sendHtml(
          response,
          502,
          `<h1>Mock client userinfo failed</h1><pre>${JSON.stringify(userInfoJson)}</pre>`,
        );
        return;
      }
      const userInfoEmail =
        typeof userInfoJson === 'object' && userInfoJson !== null
          ? readStringField(userInfoJson, 'email')
          : undefined;

      sendHtml(
        response,
        200,
        `<h1>Mock client signed in</h1><p id="token-type">${tokenClaims.tokenType}</p><p id="has-id-token">${tokenClaims.hasIdToken}</p><p id="has-refresh-token">${typeof latestRefreshToken === 'string'}</p><p id="userinfo-email">${userInfoEmail}</p>`,
      );
      return;
    }

    if (url.pathname === '/refresh-token') {
      if (!latestRefreshToken) {
        sendHtml(response, 400, '<h1>No refresh token available</h1>');
        return;
      }
      const tokenResponse = await fetch(discovery.tokenEndpoint, {
        method: 'POST',
        headers: {
          authorization: basicClientAuthHeader(),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: latestRefreshToken,
        }),
      });
      const tokenJson = await tokenResponse.json();
      if (!tokenResponse.ok) {
        sendHtml(
          response,
          502,
          `<h1>Mock refresh token exchange failed</h1><pre>${JSON.stringify(tokenJson)}</pre>`,
        );
        return;
      }
      const tokenClaims = getTokenResponseClaims(tokenJson);
      if (!tokenClaims.accessToken) {
        sendHtml(response, 502, '<h1>Mock refresh missing access token</h1>');
        return;
      }
      if (tokenClaims.refreshToken) {
        latestRefreshToken = tokenClaims.refreshToken;
      }
      sendHtml(
        response,
        200,
        `<h1>Mock refresh token exchanged</h1><p id="refresh-token-type">${tokenClaims.tokenType}</p><p id="refresh-has-id-token">${tokenClaims.hasIdToken}</p><p id="refresh-scope">${tokenClaims.scope}</p>`,
      );
      return;
    }

    if (url.pathname === '/client-credentials') {
      const tokenResponse = await fetch(discovery.tokenEndpoint, {
        method: 'POST',
        headers: {
          authorization: basicClientAuthHeader(),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'service.read',
        }),
      });
      const tokenJson = await tokenResponse.json();
      if (!tokenResponse.ok) {
        sendHtml(
          response,
          502,
          `<h1>Mock client credentials failed</h1><pre>${JSON.stringify(tokenJson)}</pre>`,
        );
        return;
      }
      const tokenClaims = getTokenResponseClaims(tokenJson);
      if (!tokenClaims.accessToken) {
        sendHtml(
          response,
          502,
          '<h1>Mock client credentials missing access token</h1>',
        );
        return;
      }
      const introspectionResponse = await fetch(
        discovery.introspectionEndpoint,
        {
          method: 'POST',
          headers: {
            authorization: basicClientAuthHeader(),
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: tokenClaims.accessToken,
            token_type_hint: 'access_token',
          }),
        },
      );
      const introspectionJson = await introspectionResponse.json();
      if (!introspectionResponse.ok) {
        sendHtml(
          response,
          502,
          `<h1>Mock client credentials introspection failed</h1><pre>${JSON.stringify(introspectionJson)}</pre>`,
        );
        return;
      }
      const active =
        typeof introspectionJson === 'object' &&
        introspectionJson !== null &&
        Object.entries(introspectionJson).some(
          ([key, value]) => key === 'active' && value === true,
        );
      if (!active) {
        sendHtml(
          response,
          502,
          `<h1>Mock client credentials token inactive</h1><pre>${JSON.stringify(introspectionJson)}</pre>`,
        );
        return;
      }
      sendHtml(
        response,
        200,
        `<h1>Mock client credentials token issued</h1><p id="client-credentials-token-type">${tokenClaims.tokenType}</p><p id="client-credentials-scope">${tokenClaims.scope}</p>`,
      );
      return;
    }

    if (url.pathname === '/device/start') {
      const deviceResponse = await fetch(
        discovery.deviceAuthorizationEndpoint,
        {
          method: 'POST',
          headers: {
            authorization: basicClientAuthHeader(),
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ scope: 'openid profile email' }),
        },
      );
      const deviceJson = await deviceResponse.json();
      if (!deviceResponse.ok) {
        sendHtml(
          response,
          502,
          `<h1>Mock device authorization failed</h1><pre>${JSON.stringify(deviceJson)}</pre>`,
        );
        return;
      }
      if (typeof deviceJson !== 'object' || deviceJson === null) {
        sendHtml(response, 502, '<h1>Invalid device authorization JSON</h1>');
        return;
      }
      latestDeviceCode = readStringField(deviceJson, 'device_code');
      const userCode = readStringField(deviceJson, 'user_code');
      const verificationUriComplete = readStringField(
        deviceJson,
        'verification_uri_complete',
      );
      if (!latestDeviceCode || !userCode || !verificationUriComplete) {
        sendHtml(response, 502, '<h1>Missing device authorization fields</h1>');
        return;
      }
      sendHtml(
        response,
        200,
        `<h1>Mock device authorization started</h1><p id="device-user-code">${userCode}</p><a id="device-verification-link" href="${verificationUriComplete}">Verify device</a>`,
      );
      return;
    }

    if (url.pathname === '/device/token') {
      if (!latestDeviceCode) {
        sendHtml(response, 400, '<h1>No device code available</h1>');
        return;
      }
      const tokenResponse = await fetch(discovery.tokenEndpoint, {
        method: 'POST',
        headers: {
          authorization: basicClientAuthHeader(),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: latestDeviceCode,
        }),
      });
      const tokenJson = await tokenResponse.json();
      if (!tokenResponse.ok) {
        sendHtml(
          response,
          502,
          `<h1>Mock device token exchange failed</h1><pre>${JSON.stringify(tokenJson)}</pre>`,
        );
        return;
      }
      const tokenClaims = getTokenResponseClaims(tokenJson);
      if (!tokenClaims.accessToken) {
        sendHtml(response, 502, '<h1>Mock device missing access token</h1>');
        return;
      }
      sendHtml(
        response,
        200,
        `<h1>Mock device signed in</h1><p id="device-token-type">${tokenClaims.tokenType}</p><p id="device-has-id-token">${tokenClaims.hasIdToken}</p>`,
      );
      return;
    }

    if (url.pathname === '/logout-start') {
      const endSessionUrl = new URL(discovery.endSessionEndpoint);
      endSessionUrl.searchParams.set('client_id', MOCK_CLIENT.clientId);
      endSessionUrl.searchParams.set(
        'post_logout_redirect_uri',
        `${params.mockClientOrigin}/logged-out`,
      );
      endSessionUrl.searchParams.set('state', 'mock-logout-state');
      sendRedirect(response, endSessionUrl.toString());
      return;
    }

    if (url.pathname === '/logged-out') {
      sendHtml(
        response,
        200,
        `<h1>Mock client logged out</h1><p id="logout-state">${url.searchParams.get('state')}</p>`,
      );
      return;
    }

    sendHtml(response, 404, '<h1>Not Found</h1>');
  });

  await params.releasePort?.();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(params.mockClientPort, MOCK_CLIENT_HOST, () => resolve());
  });

  const address = server.address();
  if (
    typeof address !== 'object' ||
    address === null ||
    !('port' in address) ||
    typeof address.port !== 'number'
  ) {
    throw new Error('Expected mock OAuth client to listen on a TCP port');
  }

  return {
    origin: `http://${MOCK_CLIENT_HOST}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

test.describe('mock OAuth client integration', () => {
  test('real mock OAuth client completes authorization code flow, token exchange, and UserInfo POST', async ({
    page,
    context,
    auxiliaryPort,
    releaseAuxiliaryPort,
    baseURL,
  }) => {
    const email = uniqueEmail('code-flow');
    await registerUserByApi(String(baseURL), email, TEST_PASSWORD);
    await loginByApi(context, String(baseURL), email, TEST_PASSWORD);

    const pkce = createPkceS256Pair();
    const state = 'mock-client-state';
    const mockClientOrigin = getMockClientOrigin(auxiliaryPort);
    const mockClient = await startMockOAuthClient({
      authServerOrigin: String(baseURL),
      mockClientOrigin,
      mockClientPort: auxiliaryPort,
      releasePort: releaseAuxiliaryPort,
      redirectUri: `${mockClientOrigin}/callback`,
      state,
      nonce: 'mock-client-nonce',
      codeChallenge: pkce.codeChallenge,
      codeVerifier: pkce.codeVerifier,
    });

    try {
      await page.goto(`${mockClient.origin}/start`);
      await expect(page).toHaveURL(/\/consent/);
      await expect(page.getByText(MOCK_CLIENT.name)).toBeVisible();
      await page.locator(consentPage.allowButton).click({ noWaitAfter: true });
      await expect(page).toHaveURL(new RegExp(`^${mockClientOrigin}/callback`));
      await expect(
        page.getByRole('heading', { name: 'Mock client signed in' }),
      ).toBeVisible();
      await expect(page.locator('#token-type')).toHaveText('Bearer');
      await expect(page.locator('#has-id-token')).toHaveText('true');
      await expect(page.locator('#has-refresh-token')).toHaveText('true');
      await expect(page.locator('#userinfo-email')).toHaveText(email);

      await page.goto(`${mockClient.origin}/refresh-token`);
      await expect(
        page.getByRole('heading', { name: 'Mock refresh token exchanged' }),
      ).toBeVisible();
      await expect(page.locator('#refresh-token-type')).toHaveText('Bearer');
      await expect(page.locator('#refresh-has-id-token')).toHaveText('true');
      await expect(page.locator('#refresh-scope')).toContainText('openid');
    } finally {
      await mockClient.close();
    }
  });

  test('real mock OAuth client completes client credentials flow', async ({
    page,
    auxiliaryPort,
    releaseAuxiliaryPort,
    baseURL,
  }) => {
    const pkce = createPkceS256Pair();
    const mockClientOrigin = getMockClientOrigin(auxiliaryPort);
    const mockClient = await startMockOAuthClient({
      authServerOrigin: String(baseURL),
      mockClientOrigin,
      mockClientPort: auxiliaryPort,
      releasePort: releaseAuxiliaryPort,
      redirectUri: `${mockClientOrigin}/callback`,
      state: 'mock-client-credentials-state',
      nonce: 'mock-client-credentials-nonce',
      codeChallenge: pkce.codeChallenge,
      codeVerifier: pkce.codeVerifier,
    });

    try {
      await page.goto(`${mockClient.origin}/client-credentials`);
      await expect(
        page.getByRole('heading', {
          name: 'Mock client credentials token issued',
        }),
      ).toBeVisible();
      await expect(page.locator('#client-credentials-token-type')).toHaveText(
        'Bearer',
      );
      await expect(page.locator('#client-credentials-scope')).toHaveText(
        'service.read',
      );
    } finally {
      await mockClient.close();
    }
  });

  test('real mock OAuth client completes device authorization flow', async ({
    page,
    context,
    auxiliaryPort,
    releaseAuxiliaryPort,
    baseURL,
  }) => {
    const email = uniqueEmail('device-flow');
    await registerUserByApi(String(baseURL), email, TEST_PASSWORD);
    await loginByApi(context, String(baseURL), email, TEST_PASSWORD);

    const pkce = createPkceS256Pair();
    const mockClientOrigin = getMockClientOrigin(auxiliaryPort);
    const mockClient = await startMockOAuthClient({
      authServerOrigin: String(baseURL),
      mockClientOrigin,
      mockClientPort: auxiliaryPort,
      releasePort: releaseAuxiliaryPort,
      redirectUri: `${mockClientOrigin}/callback`,
      state: 'mock-device-state',
      nonce: 'mock-device-nonce',
      codeChallenge: pkce.codeChallenge,
      codeVerifier: pkce.codeVerifier,
    });

    try {
      await page.goto(`${mockClient.origin}/device/start`);
      await expect(
        page.getByRole('heading', {
          name: 'Mock device authorization started',
        }),
      ).toBeVisible();
      await expect(page.locator('#device-user-code')).not.toHaveText('');
      await page.locator('#device-verification-link').click();
      await expect(page).toHaveURL(/\/oauth\/device/);
      await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
      await page.getByRole('button', { name: 'Approve' }).click();
      await expect(page.getByText('approved')).toBeVisible();

      await page.goto(`${mockClient.origin}/device/token`);
      await expect(
        page.getByRole('heading', { name: 'Mock device signed in' }),
      ).toBeVisible();
      await expect(page.locator('#device-token-type')).toHaveText('Bearer');
      await expect(page.locator('#device-has-id-token')).toHaveText('true');
    } finally {
      await mockClient.close();
    }
  });

  test('real mock OAuth client completes RP-initiated logout flow', async ({
    page,
    context,
    auxiliaryPort,
    releaseAuxiliaryPort,
    baseURL,
  }) => {
    const email = uniqueEmail('logout-flow');
    await registerUserByApi(String(baseURL), email, TEST_PASSWORD);
    await loginByApi(context, String(baseURL), email, TEST_PASSWORD);
    const sessionBeforeLogout = await page.request.get(
      `${String(baseURL)}/api/user/session`,
    );
    await expect(sessionBeforeLogout).toBeOK();
    await expect(sessionBeforeLogout.json()).resolves.toMatchObject({
      user: { email },
    });

    const pkce = createPkceS256Pair();
    const mockClientOrigin = getMockClientOrigin(auxiliaryPort);
    const mockClient = await startMockOAuthClient({
      authServerOrigin: String(baseURL),
      mockClientOrigin,
      mockClientPort: auxiliaryPort,
      releasePort: releaseAuxiliaryPort,
      redirectUri: `${mockClientOrigin}/callback`,
      state: 'mock-logout-code-state',
      nonce: 'mock-logout-nonce',
      codeChallenge: pkce.codeChallenge,
      codeVerifier: pkce.codeVerifier,
    });

    try {
      await page.goto(`${mockClient.origin}/logout-start`);
      await expect(page).toHaveURL(
        `${mockClient.origin}/logged-out?state=mock-logout-state`,
      );
      await expect(
        page.getByRole('heading', { name: 'Mock client logged out' }),
      ).toBeVisible();
      await expect(page.locator('#logout-state')).toHaveText(
        'mock-logout-state',
      );
      const sessionAfterLogout = await page.request.get(
        `${String(baseURL)}/api/user/session`,
      );
      await expect(sessionAfterLogout).toBeOK();
      await expect(sessionAfterLogout.json()).resolves.toMatchObject({
        user: null,
      });
    } finally {
      await mockClient.close();
    }
  });
});
