import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.ts';
import { queryKeys } from './keys';
import type { AuthResponse } from './session';

export type PasskeysResponse = InferResponseType<
  (typeof client.api.user.passkeys)['$get'],
  200
>;

export type PasskeyInfo = PasskeysResponse['passkeys'][number];

export type PasskeySetupVerifyResponse = InferResponseType<
  (typeof client.api.user.passkeys.register.verify)['$post'],
  200
>;

/**
 * Get all passkeys for current user
 */
export const getPasskeysQueryOptions = queryOptions({
  queryKey: queryKeys.passkeys(),
  queryFn: async () => {
    const res = await client.api.user.passkeys.$get();
    return jsonOk(res);
  },
});

/**
 * Register a new passkey
 */
export type RegisterPasskeyParams = {
  name?: string;
};

export const registerPasskeyMutationOptions = mutationOptions({
  mutationFn: async (params: RegisterPasskeyParams) => {
    // Step 1: Get registration options from server
    const optionsRes = await client.api.user.passkeys.register.options.$post();
    const { options } = await jsonOk(optionsRes);

    // Step 2: Start WebAuthn registration in browser
    const registrationResponse = await startRegistration({
      optionsJSON: options,
    });

    // Step 3: Send registration response to server
    const verifyRes = await client.api.user.passkeys.register.verify.$post({
      json: {
        response: registrationResponse,
        name: params.name,
      },
    });
    return jsonOk(verifyRes);
  },
});

/**
 * Delete a passkey
 */
export type DeletePasskeyParams = {
  id: string;
};

export const deletePasskeyMutationOptions = mutationOptions({
  mutationFn: async (params: DeletePasskeyParams) => {
    const res = await client.api.user.passkeys[':id'].$delete({
      param: { id: params.id },
    });
    return jsonOk(res);
  },
});

/**
 * Rename a passkey
 */
export type RenamePasskeyParams = {
  id: string;
  name: string;
};

export const renamePasskeyMutationOptions = mutationOptions({
  mutationFn: async (params: RenamePasskeyParams) => {
    const res = await client.api.user.passkeys[':id'].$patch({
      param: { id: params.id },
      json: { name: params.name },
    });
    return jsonOk(res);
  },
});

/**
 * Authenticate with passkey (supports both passwordless
 * and 2FA)
 *
 * The server automatically determines the mode based on
 * session state:
 * - If pending2FAUser session exists: 2FA mode
 * - Otherwise: Passwordless mode (discoverable
 *   credentials)
 */
export const authenticateWithPasskeyMutationOptions = mutationOptions({
  mutationFn: async () => {
    // Step 1: Get authentication options from server
    const optionsRes = await client.api.auth.passkey.options.$post();
    const { options } = await jsonOk(optionsRes);

    // Step 2: Start WebAuthn authentication in browser
    const authenticationResponse = await startAuthentication({
      optionsJSON: options,
    });

    // Step 3: Send authentication response to server
    const verifyRes = await client.api.auth.passkey.verify.$post({
      json: {
        response: {
          ...authenticationResponse,
          clientExtensionResults: {
            ...authenticationResponse.clientExtensionResults,
          },
        },
      },
    });
    return jsonOk(verifyRes);
  },
});

/**
 * Start conditional passkey authentication (browser
 * autofill / Conditional UI)
 *
 * This enables the browser to suggest passkeys in the
 * autofill dropdown when the user focuses on an input
 * with autocomplete="username webauthn".
 *
 * Should be called on page load and runs in the background
 * until:
 * - User selects a passkey from the autofill dropdown
 * - The AbortController is aborted (e.g., on component
 *   unmount)
 *
 * @param onSuccess - Callback when passkey authentication
 *   succeeds
 * @param abortSignal - AbortSignal to cancel the
 *   conditional authentication
 */
export const startConditionalPasskeyAuth = async (
  onSuccess: (data: AuthResponse) => void,
  abortSignal: AbortSignal,
): Promise<void> => {
  try {
    // Step 1: Get authentication options from server
    const optionsRes = await client.api.auth.passkey.options.$post(
      {},
      { init: { signal: abortSignal } },
    );
    const { options } = await jsonOk(optionsRes);

    // Step 2: Start WebAuthn with conditional mediation
    const authenticationResponse = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: true,
    });

    // Step 3: Send authentication response to server
    const verifyRes = await client.api.auth.passkey.verify.$post(
      {
        json: {
          response: {
            ...authenticationResponse,
            clientExtensionResults: {
              ...authenticationResponse.clientExtensionResults,
            },
          },
        },
      },
      { init: { signal: abortSignal } },
    );
    const data = await jsonOk(verifyRes);
    onSuccess(data);
  } catch (error) {
    // AbortError is expected when component unmounts
    if (error instanceof Error && error.name !== 'AbortError') {
      // Non-abort error - could be handled here in the future
    }
  }
};
