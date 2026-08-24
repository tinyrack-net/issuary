import { afterEach, describe, expect, test, vi } from 'vitest';
import { IssuaryError } from '#frontend/libs/error.ts';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonError,
  mockJsonResponses,
  mockJsonSuccess,
  mutationFunctionContext,
  queryFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  authenticateWithPasskeyMutationOptions,
  type DeletePasskeyParams,
  deletePasskeyMutationOptions,
  getPasskeysQueryOptions,
  type RegisterPasskeyParams,
  type RenamePasskeyParams,
  registerPasskeyMutationOptions,
  renamePasskeyMutationOptions,
  startConditionalPasskeyAuth,
} from './passkey.ts';

const webauthn = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => webauthn);

const passkeysResponse = {
  passkeys: [
    {
      id: 'passkey-1',
      credential_id: 'credential-1',
      name: 'Laptop key',
      device_type: 'singleDevice',
      backed_up: true,
      transports: ['internal'],
      created_at: '2026-05-14T10:00:00.000Z',
      last_used_at: null,
    },
  ],
};

const registrationOptions = {
  challenge: 'registration-challenge',
  rp: { name: 'Issuary', id: 'auth.example.com' },
  user: { id: 'user-1', name: 'user@example.com', displayName: 'User' },
  pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
};

const registrationResponse = {
  id: 'new-passkey',
  rawId: 'new-passkey-raw-id',
  response: {
    attestationObject: 'attestation-object',
    clientDataJSON: 'client-data-json',
  },
  type: 'public-key',
  clientExtensionResults: {},
};

const authenticationOptions = {
  challenge: 'authentication-challenge',
  timeout: 60_000,
  rpId: 'auth.example.com',
  allowCredentials: [],
};

const authenticationResponse = {
  id: 'existing-passkey',
  rawId: 'existing-passkey-raw-id',
  response: {
    authenticatorData: 'authenticator-data',
    clientDataJSON: 'client-data-json',
    signature: 'signature',
    userHandle: 'user-1',
  },
  type: 'public-key',
  clientExtensionResults: { appid: false },
};

async function runPasskeysQuery() {
  const queryFn = getPasskeysQueryOptions.queryFn;

  if (typeof queryFn !== 'function') {
    throw new Error('Expected passkeys queryFn to be defined');
  }

  return queryFn(queryFunctionContext(getPasskeysQueryOptions.queryKey));
}

async function runRegisterPasskeyMutation(values: RegisterPasskeyParams) {
  const mutationFn = registerPasskeyMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected register passkey mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runAuthenticateWithPasskeyMutation() {
  const mutationFn = authenticateWithPasskeyMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected authenticate passkey mutationFn to be defined');
  }

  return mutationFn(undefined, mutationFunctionContext());
}

async function runDeletePasskeyMutation(values: DeletePasskeyParams) {
  const mutationFn = deletePasskeyMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected delete passkey mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runRenamePasskeyMutation(values: RenamePasskeyParams) {
  const mutationFn = renamePasskeyMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected rename passkey mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

describe('getPasskeysQueryOptions', () => {
  afterEach(() => {
    resetFetchMock();
    vi.clearAllMocks();
  });

  test('loads passkeys from the expected profile endpoint', async () => {
    const fetchMock = mockJsonSuccess(passkeysResponse);

    await expect(runPasskeysQuery()).resolves.toEqual(passkeysResponse);

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/user/passkeys');
    expect(request.method).toBe('GET');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });
});

describe('registerPasskeyMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
    vi.clearAllMocks();
  });

  test('gets registration options, invokes WebAuthn, and verifies the named credential', async () => {
    const verifyResponse = { ok: true, passkey_id: 'passkey-2' };
    const fetchMock = mockJsonResponses(
      { body: { options: registrationOptions } },
      { body: verifyResponse },
    );
    webauthn.startRegistration.mockResolvedValue(registrationResponse);

    await expect(
      runRegisterPasskeyMutation({ name: 'Security Key' }),
    ).resolves.toEqual(verifyResponse);

    expect(webauthn.startRegistration).toHaveBeenCalledWith({
      optionsJSON: registrationOptions,
    });

    expect(fetchMock.requests).toHaveLength(2);
    expect(fetchMock.requests[0]?.url).toBe(
      '/api/user/passkeys/register/options',
    );
    expect(fetchMock.requests[0]?.method).toBe('POST');
    expect(fetchMock.requests[1]?.url).toBe(
      '/api/user/passkeys/register/verify',
    );
    expect(fetchMock.requests[1]?.method).toBe('POST');
    expect(jsonRequestBody(fetchMock.requests[1])).toEqual({
      response: registrationResponse,
      name: 'Security Key',
    });
  });

  test('preserves registration option errors as IssuaryError', async () => {
    mockJsonError(
      {
        code: 'PASSKEY_DISABLED',
        message: 'Passkey registration is disabled.',
      },
      403,
    );

    try {
      await runRegisterPasskeyMutation({ name: 'Security Key' });
      throw new Error('Expected register passkey mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(IssuaryError);

      if (error instanceof IssuaryError) {
        expect(error.code).toBe('PASSKEY_DISABLED');
        expect(error.status).toBe(403);
        expect(error.message).toBe('Passkey registration is disabled.');
      }
    }
  });
});

describe('authenticateWithPasskeyMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
    vi.clearAllMocks();
  });

  test('gets authentication options and posts the WebAuthn assertion', async () => {
    const authResponse = {
      user: {
        managed_by: 'database',
        sub: 'user_123',
        email: 'user@example.com',
        email_verified: true,
        email_verification_required: false,
        has_password: true,
        totp_registered: false,
        totp_recovery_codes_missing: false,
        second_factor_required: false,
        passkey_count: 1,
      },
    };
    const fetchMock = mockJsonResponses(
      { body: { options: authenticationOptions } },
      { body: authResponse },
    );
    webauthn.startAuthentication.mockResolvedValue(authenticationResponse);

    await expect(runAuthenticateWithPasskeyMutation()).resolves.toEqual(
      authResponse,
    );

    expect(webauthn.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: authenticationOptions,
    });
    expect(fetchMock.requests).toHaveLength(2);
    expect(fetchMock.requests[0]?.url).toBe('/api/auth/passkey/options');
    expect(fetchMock.requests[0]?.method).toBe('POST');
    expect(fetchMock.requests[1]?.url).toBe('/api/auth/passkey/verify');
    expect(fetchMock.requests[1]?.method).toBe('POST');
    expect(jsonRequestBody(fetchMock.requests[1])).toEqual({
      response: authenticationResponse,
    });
  });
});

describe('startConditionalPasskeyAuth', () => {
  afterEach(() => {
    resetFetchMock();
    vi.clearAllMocks();
  });

  test('uses conditional WebAuthn and calls onSuccess after verify', async () => {
    const authResponse = {
      user: {
        managed_by: 'database',
        sub: 'user_123',
        email: 'user@example.com',
        email_verified: true,
        email_verification_required: false,
        has_password: true,
        totp_registered: false,
        totp_recovery_codes_missing: false,
        second_factor_required: false,
        passkey_count: 1,
      },
    };
    const fetchMock = mockJsonResponses(
      { body: { options: authenticationOptions } },
      { body: authResponse },
    );
    const onSuccess = vi.fn();
    const abortController = new AbortController();
    webauthn.startAuthentication.mockResolvedValue(authenticationResponse);

    await startConditionalPasskeyAuth(onSuccess, abortController.signal);

    expect(webauthn.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: authenticationOptions,
      useBrowserAutofill: true,
    });
    expect(fetchMock.requests).toHaveLength(2);
    expect(fetchMock.requests[0]?.url).toBe('/api/auth/passkey/options');
    expect(fetchMock.requests[1]?.url).toBe('/api/auth/passkey/verify');
    expect(onSuccess).toHaveBeenCalledWith(authResponse);
  });
});

describe('passkey profile mutations', () => {
  afterEach(() => {
    resetFetchMock();
    vi.clearAllMocks();
  });

  test('deletes the selected passkey by id', async () => {
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(
      runDeletePasskeyMutation({ id: 'passkey-1' }),
    ).resolves.toEqual({ ok: true });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/passkeys/passkey-1');
    expect(request.method).toBe('DELETE');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });

  test('renames the selected passkey with the expected body', async () => {
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(
      runRenamePasskeyMutation({ id: 'passkey-1', name: 'Work laptop' }),
    ).resolves.toEqual({ ok: true });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/passkeys/passkey-1');
    expect(request.method).toBe('PATCH');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(jsonRequestBody(request)).toEqual({ name: 'Work laptop' });
  });
});
