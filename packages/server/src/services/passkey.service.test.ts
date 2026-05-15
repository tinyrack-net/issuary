import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import {
  createTestApp,
  createTestUser,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

const webauthn = vi.hoisted(() => ({
  generateAuthenticationOptions: vi.fn(),
  generateRegistrationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
}));

vi.mock('@simplewebauthn/server', () => webauthn);

const REGISTRATION_RESPONSE: RegistrationResponseJSON = {
  id: 'registration-credential-id',
  rawId: 'registration-credential-id',
  response: {
    attestationObject: 'attestation-object',
    clientDataJSON: 'client-data-json',
    transports: ['internal'],
  },
  type: 'public-key',
  clientExtensionResults: {},
};

function createAuthenticationResponse(
  credentialId: string,
): AuthenticationResponseJSON {
  return {
    id: credentialId,
    rawId: credentialId,
    response: {
      authenticatorData: 'authenticator-data',
      clientDataJSON: 'client-data-json',
      signature: 'signature',
      userHandle: 'user-handle',
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

async function expectErrorCode(
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await promise;
    expect.unreachable('Expected promise to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty('code', expectedCode);
  }
}

async function createPasskeyForUser(
  services: ServiceContainer,
  userSub: string,
  options: { credentialId: string; counter: number },
) {
  const passkey = services.mikro.userPasskey.create({
    user: userSub,
    credential_id: options.credentialId,
    public_key: 'AQIDBA',
    counter: options.counter,
    device_type: 'multiDevice',
    backed_up: true,
    transports: ['internal'],
    name: 'Test passkey',
    aaguid: 'test-aaguid',
  });
  services.mikro.em.persist(passkey);
  await services.mikro.em.flush();
  return passkey;
}

describe('PasskeyService security policy', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      server: {
        public_origin: 'https://auth.example.com',
      },
      auth: {
        passkey: {
          enabled: true,
          origins: ['https://auth.example.com'],
          rp_id: 'auth.example.com',
        },
      },
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('rejects registration when WebAuthn verifier reports an origin mismatch', async () => {
    webauthn.verifyRegistrationResponse.mockResolvedValue({ verified: false });
    const userSub = await createTestUser(services, {
      email: generateUniqueEmail('passkey-origin'),
    });

    await expectErrorCode(
      withMikroContext(services, async () => {
        const user = await services.mikro.user.verifyBySub(userSub);
        return services.passkeyService.verifyRegistration(
          user,
          REGISTRATION_RESPONSE,
          'expected-challenge',
          'Origin test passkey',
        );
      }),
      'PASSKEY_VERIFICATION_FAILED',
    );

    expect(webauthn.verifyRegistrationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'expected-challenge',
        expectedOrigin: ['https://auth.example.com'],
      }),
    );
  });

  test('rejects registration when WebAuthn verifier reports an rpId mismatch', async () => {
    webauthn.verifyRegistrationResponse.mockResolvedValue({ verified: false });
    const userSub = await createTestUser(services, {
      email: generateUniqueEmail('passkey-rpid'),
    });

    await expectErrorCode(
      withMikroContext(services, async () => {
        const user = await services.mikro.user.verifyBySub(userSub);
        return services.passkeyService.verifyRegistration(
          user,
          REGISTRATION_RESPONSE,
          'expected-challenge',
        );
      }),
      'PASSKEY_VERIFICATION_FAILED',
    );

    expect(webauthn.verifyRegistrationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRPID: 'auth.example.com',
      }),
    );
  });

  test('rejects authentication when the verifier reports cloned credential counter rollback', async () => {
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 9 },
    });
    const userSub = await createTestUser(services, {
      email: generateUniqueEmail('passkey-counter-rollback'),
    });
    const response = createAuthenticationResponse(
      'counter-rollback-credential',
    );

    await expectErrorCode(
      withMikroContext(services, async () => {
        await createPasskeyForUser(services, userSub, {
          credentialId: response.id,
          counter: 10,
        });
        return services.passkeyService.verifyAuthentication(
          response,
          'expected-challenge',
        );
      }),
      'PASSKEY_VERIFICATION_FAILED',
    );

    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findByCredentialId(
        response.id,
      );
      expect(passkey?.counter).toBe(10);
    });
  });

  test('updates authentication counter monotonically after successful verification', async () => {
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 11 },
    });
    const userSub = await createTestUser(services, {
      email: generateUniqueEmail('passkey-counter-update'),
    });
    const response = createAuthenticationResponse('counter-update-credential');

    const result = await withMikroContext(services, async () => {
      await createPasskeyForUser(services, userSub, {
        credentialId: response.id,
        counter: 10,
      });
      return services.passkeyService.verifyAuthentication(
        response,
        'expected-challenge',
      );
    });

    expect(result.sub).toBe(userSub);
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findByCredentialId(
        response.id,
      );
      expect(passkey?.counter).toBe(11);
    });
  });

  test('rejects an authenticated credential that belongs to a different expected user', async () => {
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 11 },
    });
    const ownerSub = await createTestUser(services, {
      email: generateUniqueEmail('passkey-owner'),
    });
    const expectedSub = await createTestUser(services, {
      email: generateUniqueEmail('passkey-expected-user'),
    });
    const response = createAuthenticationResponse('user-mismatch-credential');

    await expectErrorCode(
      withMikroContext(services, async () => {
        await createPasskeyForUser(services, ownerSub, {
          credentialId: response.id,
          counter: 10,
        });
        return services.passkeyService.verifyAuthentication(
          response,
          'expected-challenge',
          expectedSub,
        );
      }),
      'PASSKEY_USER_MISMATCH',
    );
  });

  test('returns the credential owner for passwordless authentication when no expected user is provided', async () => {
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 11 },
    });
    const ownerSub = await createTestUser(services, {
      email: generateUniqueEmail('passkey-owner-passwordless'),
    });
    const response = createAuthenticationResponse('passwordless-credential');

    const result = await withMikroContext(services, async () => {
      await createPasskeyForUser(services, ownerSub, {
        credentialId: response.id,
        counter: 10,
      });
      return services.passkeyService.verifyAuthentication(
        response,
        'expected-challenge',
      );
    });

    expect(result.sub).toBe(ownerSub);
  });
});
