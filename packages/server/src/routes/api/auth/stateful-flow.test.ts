import type { RegistrationResponseJSON } from '@simplewebauthn/server';
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
import type { AppType } from '../../../entrypoints/app.ts';
import { google } from '../../../entrypoints/identity-providers/google.ts';
import { decrypt, encrypt } from '../../../lib/crypto.ts';
import type { SessionData } from '../../../middleware/session.ts';
import { e } from '../../../schemas/error.ts';
import type { ServiceContainer } from '../../../services/container.ts';
import {
  assertJsonBody,
  createTestApp,
  enableTotpForUser,
  expectError,
  extractCookie,
  generateUniqueEmail,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  mockOAuthProviderFetch,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.ts';

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

function createMockRegistrationResponse(overrides?: {
  id?: string;
  rawId?: string;
  clientDataJSON?: string;
}): RegistrationResponseJSON {
  return {
    id: overrides?.id ?? 'mock-registration-credential-id',
    rawId: overrides?.rawId ?? 'mock-registration-credential-id',
    response: {
      clientDataJSON:
        overrides?.clientDataJSON ??
        Buffer.from(
          JSON.stringify({
            type: 'webauthn.create',
            challenge: 'mock-challenge',
            origin: 'http://localhost:8080',
          }),
        ).toString('base64url'),
      attestationObject: 'mock-attestation-object',
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

async function createEncryptedSessionCookie(sessionData: SessionData) {
  return encrypt(
    JSON.stringify(sessionData),
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
}

async function readEncryptedSessionCookie(sessionCookie: string) {
  const decrypted = await decrypt(
    sessionCookie,
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
  if (!decrypted) {
    throw new Error('Expected readable encrypted session cookie');
  }
  return JSON.parse(decrypted);
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

  test('uses pending 2FA setup user instead of the existing active account for TOTP setup completion', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
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
            issuer: 'TinyAuthPendingSetupPrecedenceTest',
          },
        },
        account_selection: {
          enabled: true,
          mode: 'smart',
        },
      },
    });

    try {
      const client = testClient(scopedServer.app);
      const loginARes = await client.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      expect(loginARes.status).toBe(200);
      const userACookie = extractCookie(loginARes, 'session');

      const userBEmail = generateUniqueEmail('pending-setup-precedence-b');
      const userBPassword = 'pending-setup-precedence-password-123';
      const registerBRes = await client.api.auth.register.$post(
        {
          header: { 'accept-language': 'en' },
          json: { email: userBEmail, password: userBPassword },
        },
        { headers: { Cookie: `session=${userACookie}` } },
      );
      const registerBBody = await assertJsonBody(registerBRes);
      expect(registerBBody.user.email).toBe(userBEmail);
      expect(registerBBody.user.second_factor_required).toBe(true);
      const pendingSetupCookie = extractCookie(registerBRes, 'session');

      const stillActiveSessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${pendingSetupCookie}` } },
      );
      const stillActiveSessionBody = await assertJsonBody(
        stillActiveSessionRes,
      );
      expect(stillActiveSessionBody.user?.sub).toBe(TEST_USER_CONFIG.sub);

      const setupRes = await client.api.user.totp.setup.$post(
        {},
        { headers: { Cookie: `session=${pendingSetupCookie}` } },
      );
      const setupBody = await assertJsonBody(setupRes);
      const setupCode = scopedServer.services.totpService.generateToken(
        setupBody.secret,
      );

      const verifySetupRes = await client.api.user.totp.verify.$post(
        { json: { code: setupCode } },
        { headers: { Cookie: `session=${pendingSetupCookie}` } },
      );
      const verifySetupBody = await assertJsonBody(verifySetupRes);
      expect(verifySetupBody.recovery_codes.length).toBeGreaterThan(0);

      const confirmRes = await client.api.user.totp.confirm.$post(
        {},
        { headers: { Cookie: `session=${pendingSetupCookie}` } },
      );
      const confirmBody = await assertJsonBody(confirmRes);
      expect(confirmBody.user.email).toBe(userBEmail);
      expect(confirmBody.user.totp_registered).toBe(true);

      const confirmedCookie = extractCookie(confirmRes, 'session');
      const confirmedSessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${confirmedCookie}` } },
      );
      const confirmedSessionBody = await assertJsonBody(confirmedSessionRes);
      expect(confirmedSessionBody.user?.email).toBe(userBEmail);
      const confirmedSession =
        await readEncryptedSessionCookie(confirmedCookie);
      expect(confirmedSession).toMatchObject({
        user: { sub: confirmBody.user.sub },
        accounts: [
          { sub: TEST_USER_CONFIG.sub },
          { sub: confirmBody.user.sub },
        ],
      });
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('uses pending 2FA setup user instead of the existing active account for passkey setup completion', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
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
        },
        passkey: {
          enabled: true,
        },
        account_selection: {
          enabled: true,
          mode: 'smart',
        },
      },
    });

    try {
      const client = testClient(scopedServer.app);
      const loginARes = await client.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      expect(loginARes.status).toBe(200);
      const userACookie = extractCookie(loginARes, 'session');

      const userBEmail = generateUniqueEmail('pending-passkey-setup-b');
      const userBPassword = 'pending-passkey-setup-password-123';
      const registerBRes = await client.api.auth.register.$post(
        {
          header: { 'accept-language': 'en' },
          json: { email: userBEmail, password: userBPassword },
        },
        { headers: { Cookie: `session=${userACookie}` } },
      );
      const registerBBody = await assertJsonBody(registerBRes);
      expect(registerBBody.user.email).toBe(userBEmail);
      expect(registerBBody.user.second_factor_required).toBe(true);
      const pendingSetupCookie = extractCookie(registerBRes, 'session');

      const optionsRes = await client.api.user.passkeys.register.options.$post(
        {},
        { headers: { Cookie: `session=${pendingSetupCookie}` } },
      );
      const optionsBody = await assertJsonBody(optionsRes);
      expect(optionsBody.options.user.name).toBe(userBEmail);
      const optionsCookie = extractCookie(optionsRes, 'session');
      const credentialId = `pending-passkey-setup-${crypto.randomUUID()}`;

      const verifyRegistration = vi
        .spyOn(scopedServer.services.passkeyService, 'verifyRegistration')
        .mockImplementationOnce(async (user, _response, expectedChallenge) => {
          expect(user.email).toBe(userBEmail);
          expect(expectedChallenge).toBe(optionsBody.options.challenge);

          const passkey = scopedServer.services.mikro.userPasskey.create({
            user: user.sub,
            credential_id: credentialId,
            public_key: 'pending-passkey-setup-public-key',
            counter: 0,
            device_type: 'multiDevice',
            backed_up: true,
            transports: ['internal'],
            name: 'Pending Setup Passkey',
            aaguid: 'pending-passkey-setup-aaguid',
          });
          await scopedServer.services.mikro.em.persist(passkey).flush();
          return passkey;
        });

      const verifyRes = await client.api.user.passkeys.register.verify.$post(
        {
          json: {
            response: createMockRegistrationResponse({
              id: credentialId,
              rawId: credentialId,
            }),
            name: 'Pending Setup Passkey',
          },
        },
        { headers: { Cookie: `session=${optionsCookie}` } },
      );

      const verifyBody = await assertJsonBody(verifyRes);
      expect(verifyBody).toMatchObject({
        ok: true,
        second_factor_setup_completed: true,
        user: { sub: registerBBody.user.sub, email: userBEmail },
      });
      const verifiedCookie = extractCookie(verifyRes, 'session');
      const verifiedSessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${verifiedCookie}` } },
      );
      const verifiedSessionBody = await assertJsonBody(verifiedSessionRes);
      expect(verifiedSessionBody.user?.email).toBe(userBEmail);
      const verifiedSession = await readEncryptedSessionCookie(verifiedCookie);
      expect(verifiedSession).toMatchObject({
        user: { sub: registerBBody.user.sub },
        accounts: [
          { sub: TEST_USER_CONFIG.sub },
          { sub: registerBBody.user.sub },
        ],
      });

      verifyRegistration.mockRestore();
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('keeps the current account active while a different account waits for TOTP verification', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          enabled: true,
          totp: {
            enabled: true,
            issuer: 'TinyAuthPendingTotpSwitchTest',
          },
        },
        account_selection: {
          enabled: true,
          mode: 'smart',
        },
      },
    });

    try {
      const password = 'stateful-switch-totp-password-123';
      const userAEmail = generateUniqueEmail('stateful-switch-totp-a');
      const userBEmail = generateUniqueEmail('stateful-switch-totp-b');

      const { userA, userB } = await withMikroContext(
        scopedServer.services,
        async () => {
          const passwordHash =
            await scopedServer.services.securityService.hashPassword(password);
          const userAEntity = scopedServer.services.mikro.user.create({
            email: userAEmail,
            password_hash: passwordHash,
          });
          userAEntity.email_verified = true;
          const userBEntity = scopedServer.services.mikro.user.create({
            email: userBEmail,
            password_hash: passwordHash,
          });
          userBEntity.email_verified = true;
          scopedServer.services.mikro.em.persist(userAEntity);
          scopedServer.services.mikro.em.persist(userBEntity);
          await scopedServer.services.mikro.em.flush();
          return { userA: userAEntity, userB: userBEntity };
        },
      );
      const totpSecret = await enableTotpForUser(
        scopedServer.services,
        userB.sub,
      );

      const client = testClient(scopedServer.app);
      const loginARes = await client.api.auth.login.$post({
        json: { email: userAEmail, password },
      });
      expect(loginARes.status).toBe(200);
      const userACookie = extractCookie(loginARes, 'session');

      const loginBRes = await client.api.auth.login.$post(
        { json: { email: userBEmail, password } },
        { headers: { Cookie: `session=${userACookie}` } },
      );
      const loginBBody = await assertJsonBody(loginBRes);
      expect(loginBBody.user.sub).toBe(userB.sub);
      expect(loginBBody.user.totp_registered).toBe(true);
      const pendingTotpCookie = extractCookie(loginBRes, 'session');

      const pendingSessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${pendingTotpCookie}` } },
      );
      const pendingSessionBody = await assertJsonBody(pendingSessionRes);
      expect(pendingSessionBody.user?.sub).toBe(userA.sub);

      const verifyRes = await client.api.auth.totp.verify.$post(
        {
          json: {
            code: scopedServer.services.totpService.generateToken(totpSecret),
          },
        },
        { headers: { Cookie: `session=${pendingTotpCookie}` } },
      );
      const verifyBody = await assertJsonBody(verifyRes);
      expect(verifyBody.user.sub).toBe(userB.sub);
      const verifiedCookie = extractCookie(verifyRes, 'session');
      const verifiedSession = await readEncryptedSessionCookie(verifiedCookie);
      expect(verifiedSession).toMatchObject({
        user: { sub: userB.sub },
        accounts: [{ sub: userA.sub }, { sub: userB.sub }],
      });
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('keeps active account when stale pending 2FA login user is missing', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      auth: {
        passkey: {
          enabled: true,
        },
        account_selection: {
          enabled: true,
          mode: 'smart',
        },
      },
    });

    try {
      const client = testClient(scopedServer.app);
      const sessionCookie = await createEncryptedSessionCookie({
        user: {
          sub: TEST_USER_CONFIG.sub,
          authenticated_at: 1_700_000_000,
        },
        accounts: [
          {
            sub: TEST_USER_CONFIG.sub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
        pending2FAUser: {
          sub: 'deleted-pending-user',
          authenticated_at: 1_700_000_100,
        },
      });

      const optionsRes = await client.api.auth.passkey.options.$post(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect(optionsRes.status).toBe(200);
      const nextCookie = extractCookie(optionsRes, 'session');

      const sessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${nextCookie}` } },
      );
      const sessionBody = await assertJsonBody(sessionRes);
      expect(sessionBody.user?.sub).toBe(TEST_USER_CONFIG.sub);
      await expect(
        readEncryptedSessionCookie(nextCookie),
      ).resolves.toMatchObject({
        user: {
          sub: TEST_USER_CONFIG.sub,
          authenticated_at: 1_700_000_000,
        },
      });
      await expect(
        readEncryptedSessionCookie(nextCookie),
      ).resolves.not.toHaveProperty('pending2FAUser');
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('keeps active account when stale pending 2FA setup user is missing', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      auth: {
        password: {
          enabled: true,
          two_factor: {
            enrollment_required: true,
          },
          totp: {
            enabled: true,
            issuer: 'TinyAuthStalePendingSetupTest',
          },
        },
        account_selection: {
          enabled: true,
          mode: 'smart',
        },
      },
    });

    try {
      const client = testClient(scopedServer.app);
      const sessionCookie = await createEncryptedSessionCookie({
        user: {
          sub: TEST_USER_CONFIG.sub,
          authenticated_at: 1_700_000_000,
        },
        accounts: [
          {
            sub: TEST_USER_CONFIG.sub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
        pending2FASetup: {
          sub: 'deleted-pending-setup-user',
        },
      });

      const setupRes = await client.api.user.totp.setup.$post(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      await expectError(setupRes, e.SecondFactorNotAllowedForConfigUser);
      const nextCookie = extractCookie(setupRes, 'session');

      const sessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${nextCookie}` } },
      );
      const sessionBody = await assertJsonBody(sessionRes);
      expect(sessionBody.user?.sub).toBe(TEST_USER_CONFIG.sub);
      await expect(
        readEncryptedSessionCookie(nextCookie),
      ).resolves.toMatchObject({
        user: {
          sub: TEST_USER_CONFIG.sub,
          authenticated_at: 1_700_000_000,
        },
      });
      await expect(
        readEncryptedSessionCookie(nextCookie),
      ).resolves.not.toHaveProperty('pending2FASetup');
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('keeps the current account active while a different account waits for passkey verification', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          enabled: true,
        },
        passkey: {
          enabled: true,
        },
        account_selection: {
          enabled: true,
          mode: 'smart',
        },
      },
    });

    try {
      const password = 'stateful-switch-passkey-password-123';
      const userAEmail = generateUniqueEmail('stateful-switch-a');
      const userBEmail = generateUniqueEmail('stateful-switch-b');
      const credentialId = `stateful-switch-passkey-${crypto.randomUUID()}`;

      const { userA, userB } = await withMikroContext(
        scopedServer.services,
        async () => {
          const passwordHash =
            await scopedServer.services.securityService.hashPassword(password);
          const userAEntity = scopedServer.services.mikro.user.create({
            email: userAEmail,
            password_hash: passwordHash,
          });
          userAEntity.email_verified = true;

          const userBEntity = scopedServer.services.mikro.user.create({
            email: userBEmail,
            password_hash: passwordHash,
          });
          userBEntity.email_verified = true;

          scopedServer.services.mikro.em.persist(userAEntity);
          scopedServer.services.mikro.em.persist(userBEntity);
          await scopedServer.services.mikro.em.flush();

          const passkey = scopedServer.services.mikro.userPasskey.create({
            user: userBEntity.sub,
            credential_id: credentialId,
            public_key: 'stateful-switch-passkey-public-key',
            counter: 0,
            device_type: 'multiDevice',
            backed_up: true,
            transports: ['internal'],
            name: 'Stateful Switch Passkey',
            aaguid: 'stateful-switch-passkey-aaguid',
          });
          scopedServer.services.mikro.em.persist(passkey);
          await scopedServer.services.mikro.em.flush();

          return { userA: userAEntity, userB: userBEntity };
        },
      );

      const client = testClient(scopedServer.app);
      const loginARes = await client.api.auth.login.$post({
        json: { email: userAEmail, password },
      });
      expect(loginARes.status).toBe(200);
      const userACookie = extractCookie(loginARes, 'session');

      const loginBRes = await client.api.auth.login.$post(
        { json: { email: userBEmail, password } },
        { headers: { Cookie: `session=${userACookie}` } },
      );
      const loginBBody = await assertJsonBody(loginBRes);
      expect(loginBBody.user.sub).toBe(userB.sub);
      expect(loginBBody.user.passkey_count).toBe(1);
      const pendingPasskeyCookie = extractCookie(loginBRes, 'session');

      const pendingSessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${pendingPasskeyCookie}` } },
      );
      const pendingSessionBody = await assertJsonBody(pendingSessionRes);
      expect(pendingSessionBody.user?.sub).toBe(userA.sub);
    } finally {
      await scopedServer.cleanup();
    }
  });
});
