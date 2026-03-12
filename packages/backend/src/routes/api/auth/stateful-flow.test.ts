import { testClient } from 'hono/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { google } from '#backend/entrypoints/identity-providers/google.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createTestApp,
  expectError,
  extractCookie,
  generateUniqueEmail,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  mockOAuthProviderFetch,
  withMikroContext,
} from '#backend/test-utils/index.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function createMockAuthenticationResponse(overrides?: {
  id?: string;
  rawId?: string;
}): {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  };
  type: 'public-key';
  clientExtensionResults: Record<string, unknown>;
} {
  const credentialId = overrides?.id ?? 'mock-credential-id';
  return {
    id: credentialId,
    rawId: overrides?.rawId ?? credentialId,
    response: {
      clientDataJSON: Buffer.from(
        JSON.stringify({
          type: 'webauthn.get',
          challenge: 'mock-challenge',
          origin: 'http://localhost:8080',
        }),
      ).toString('base64url'),
      authenticatorData: 'bW9jay1hdXRoZW50aWNhdG9yLWRhdGE',
      signature: 'bW9jay1zaWduYXR1cmU',
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
      email_verification_required: false,
    },
    auth: {
      password: {
        enabled: true,
        two_factor: {
          enrollment_required: true,
        },
        totp: {
          enabled: true,
          issuer: 'TinyAuthStatefulTest',
        },
      },
      passkey: {
        enabled: true,
      },
    },
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await cleanup();
});

async function startOAuthLinkFlow(
  sessionCookie: string,
  returnUrl: string,
): Promise<{ sessionCookie: string; state: string }> {
  const client = testClient(app);
  const authorizeRes = await client.api.oauth[':provider'].authorize.$get(
    {
      param: { provider: 'google' },
      query: {
        mode: 'link',
        return_url: returnUrl,
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );

  expect(authorizeRes.status).toBe(302);
  const location = new URL(getLocationHeader(authorizeRes));
  const state = location.searchParams.get('state');
  if (!state) {
    throw new Error('Missing OAuth state from authorize response');
  }

  return {
    sessionCookie: extractCookie(authorizeRes, 'session'),
    state,
  };
}

describe('Stateful auth flows', () => {
  test('register => TOTP setup => login TOTP verify => OAuth link callback flow', async () => {
    const email = generateUniqueEmail('stateful-chain');
    const password = 'stateful-password-123';
    const client = testClient(app);

    const registerRes = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email,
        password,
      },
    });
    const registerBody = await assertJsonBody(registerRes);
    expect(registerBody.user.second_factor_required).toBe(true);

    const pendingSetupCookie = extractCookie(registerRes, 'session');

    const pendingSessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${pendingSetupCookie}` } },
    );
    const pendingSessionBody = await assertJsonBody(pendingSessionRes);
    expect(pendingSessionBody.user).toBeNull();

    const setupRes = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${pendingSetupCookie}` } },
    );
    const setupBody = await assertJsonBody(setupRes);

    const setupCode = services.totpService.generateToken(setupBody.secret);
    const verifySetupRes = await client.api.user.totp.verify.$post(
      {
        json: { code: setupCode },
      },
      { headers: { Cookie: `session=${pendingSetupCookie}` } },
    );
    const verifySetupBody = await assertJsonBody(verifySetupRes);
    expect(verifySetupBody.recovery_codes.length).toBeGreaterThan(0);

    const confirmRes = await client.api.user.totp.confirm.$post(
      {},
      { headers: { Cookie: `session=${pendingSetupCookie}` } },
    );
    const confirmBody = await assertJsonBody(confirmRes);
    expect(confirmBody.user.email).toBe(email);
    expect(confirmBody.user.totp_registered).toBe(true);

    const authenticatedCookie = extractCookie(confirmRes, 'session');
    const authenticatedSessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${authenticatedCookie}` } },
    );
    const authenticatedSessionBody = await assertJsonBody(
      authenticatedSessionRes,
    );
    expect(authenticatedSessionBody.user?.email).toBe(email);
    const userSub = authenticatedSessionBody.user?.sub;
    if (!userSub) {
      throw new Error('Expected authenticated user session after TOTP confirm');
    }

    const logoutRes = await client.api.auth.logout.$post(
      {},
      { headers: { Cookie: `session=${authenticatedCookie}` } },
    );
    expect(logoutRes.status).toBe(200);

    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    const loginBody = await assertJsonBody(loginRes);
    expect(loginBody.user.totp_registered).toBe(true);
    expect(loginBody.user.second_factor_required).toBe(true);
    const pendingVerifyCookie = extractCookie(loginRes, 'session');

    const pendingVerifySessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${pendingVerifyCookie}` } },
    );
    const pendingVerifySessionBody = await assertJsonBody(
      pendingVerifySessionRes,
    );
    expect(pendingVerifySessionBody.user).toBeNull();

    const loginTotpCode = services.totpService.generateToken(setupBody.secret);
    const loginVerifyRes = await client.api.auth.totp.verify.$post(
      {
        json: { code: loginTotpCode },
      },
      { headers: { Cookie: `session=${pendingVerifyCookie}` } },
    );
    const loginVerifyBody = await assertJsonBody(loginVerifyRes);
    expect(loginVerifyBody.user.sub).toBe(userSub);
    const reauthenticatedCookie = extractCookie(loginVerifyRes, 'session');

    const returnUrl = '/profile?tab=oauth-link';
    const { sessionCookie: oauthSessionCookie, state } =
      await startOAuthLinkFlow(reauthenticatedCookie, returnUrl);

    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: GOOGLE_TOKEN_URL,
      userInfoUrl: GOOGLE_USERINFO_URL,
      userInfo: {
        id: `oauth-link-${Date.now()}`,
        email: generateUniqueEmail('oauth-linked-account'),
        email_verified: true,
        name: 'OAuth Linked Account',
      },
    });

    try {
      const callbackRes = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: 'stateful-oauth-link-code',
            state,
          },
        },
        { headers: { Cookie: `session=${oauthSessionCookie}` } },
      );

      expect(callbackRes.status).toBe(302);
      const callbackLocation = new URL(
        getLocationHeader(callbackRes),
        'http://test',
      );
      expect(callbackLocation.pathname).toBe('/profile');
      expect(callbackLocation.searchParams.get('tab')).toBe('oauth-link');

      const callbackCookie = extractCookie(callbackRes, 'session');

      const linkedSessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${callbackCookie}` } },
      );
      const linkedSessionBody = await assertJsonBody(linkedSessionRes);
      expect(linkedSessionBody.user?.sub).toBe(userSub);

      const oauthAccountsRes = await client.api.user['oauth-accounts'].$get(
        {},
        { headers: { Cookie: `session=${callbackCookie}` } },
      );
      const oauthAccountsBody = await assertJsonBody(oauthAccountsRes);
      const hasGoogleLink = oauthAccountsBody.accounts.some(
        (account: { provider_name: string }) =>
          account.provider_name === 'google',
      );
      expect(hasGoogleLink).toBe(true);

      const replayRes = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: 'stateful-oauth-link-code',
            state,
          },
        },
        { headers: { Cookie: `session=${callbackCookie}` } },
      );
      await expectError(replayRes, e.OAuthSessionExpired);
    } finally {
      oauthMock.restore();
    }
  });

  test('password login => passkey verify should promote pending session to full session', async () => {
    const email = generateUniqueEmail('stateful-passkey');
    const password = 'stateful-passkey-password-123';
    const credentialId = `stateful-passkey-${crypto.randomUUID()}`;

    const user = await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(password);
      const userEntity = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      userEntity.email_verified = true;
      await services.mikro.em.persist(userEntity).flush();

      const passkey = services.mikro.userPasskey.create({
        user: userEntity.sub,
        credential_id: credentialId,
        public_key: 'stateful-passkey-public-key',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Stateful Passkey',
        aaguid: 'stateful-passkey-aaguid',
      });
      await services.mikro.em.persist(passkey).flush();

      return userEntity;
    });

    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    const loginBody = await assertJsonBody(loginRes);
    expect(loginBody.user.passkey_count).toBe(1);
    const pending2FACookie = extractCookie(loginRes, 'session');

    const pendingSessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    const pendingSessionBody = await assertJsonBody(pendingSessionRes);
    expect(pendingSessionBody.user).toBeNull();

    const optionsRes = await client.api.auth.passkey.options.$post(
      {},
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    const optionsBody = await assertJsonBody(optionsRes);
    const allowCredentials = optionsBody.options.allowCredentials ?? [];
    const hasCredentialInAllowList = allowCredentials.some(
      (credential: { id: string }) => credential.id === credentialId,
    );
    expect(hasCredentialInAllowList).toBe(true);
    const optionsCookie = extractCookie(optionsRes, 'session');

    const verifySpy = vi
      .spyOn(services.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user);

    const verifyRes = await client.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${optionsCookie}` } },
    );
    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody.user.sub).toBe(user.sub);
    const fullSessionCookie = extractCookie(verifyRes, 'session');

    const fullSessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${fullSessionCookie}` } },
    );
    const fullSessionBody = await assertJsonBody(fullSessionRes);
    expect(fullSessionBody.user?.sub).toBe(user.sub);

    verifySpy.mockRestore();
  });
});
