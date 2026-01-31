import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import { queryKeys } from './keys';
import type { AuthResponse, OkResponse, SessionUser } from './session.js';

export type PasskeyInfo = {
  id: string;
  credential_id: string;
  name: string | null;
  device_type: 'singleDevice' | 'multiDevice';
  backed_up: boolean;
  created_at: string;
};

export type PasskeysResponse = {
  passkeys: PasskeyInfo[];
};

export type PasskeySetupVerifyResponse = {
  ok: true;
  user?: SessionUser;
  second_factor_setup_completed: boolean;
};

/**
 * Get all passkeys for current user
 */
export const getPasskeysQueryOptions = queryOptions({
  queryKey: queryKeys.passkeys(),
  queryFn: async () => {
    const res = await etch('/api/v1/user/passkeys');
    return res.json() as Promise<PasskeysResponse>;
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
    const optionsRes = await etch('/api/v1/user/passkeys/register/options', {
      method: 'POST',
    });
    const { options } = (await optionsRes.json()) as {
      options: PublicKeyCredentialCreationOptionsJSON;
    };

    // Step 2: Start WebAuthn registration in browser
    const registrationResponse = await startRegistration({
      optionsJSON: options,
    });

    // Step 3: Send registration response to server for verification
    const verifyRes = await etch('/api/v1/user/passkeys/register/verify', {
      method: 'POST',
      body: JSON.stringify({
        response: registrationResponse,
        name: params.name,
      }),
    });
    return verifyRes.json() as Promise<PasskeySetupVerifyResponse>;
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
    const res = await etch(`/api/v1/user/passkeys/${params.id}`, {
      method: 'DELETE',
    });
    return res.json() as Promise<OkResponse>;
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
    const res = await etch(`/api/v1/user/passkeys/${params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: params.name }),
    });
    return res.json() as Promise<OkResponse>;
  },
});

/**
 * Authenticate with passkey (supports both passwordless and 2FA)
 *
 * The server automatically determines the mode based on session state:
 * - If pending2FAUser session exists: 2FA mode (verifies passkey belongs to that user)
 * - Otherwise: Passwordless mode (discoverable credentials)
 */
export const authenticateWithPasskeyMutationOptions = mutationOptions({
  mutationFn: async () => {
    // Step 1: Get authentication options from server
    const optionsRes = await etch('/api/v1/auth/passkey/options', {
      method: 'POST',
    });
    const { options } = (await optionsRes.json()) as {
      options: PublicKeyCredentialRequestOptionsJSON;
    };

    // Step 2: Start WebAuthn authentication in browser
    const authenticationResponse = await startAuthentication({
      optionsJSON: options,
    });

    // Step 3: Send authentication response to server for verification
    const verifyRes = await etch('/api/v1/auth/passkey/verify', {
      method: 'POST',
      body: JSON.stringify({
        response: authenticationResponse,
      }),
    });
    return verifyRes.json() as AuthResponse;
  },
});

/**
 * Start conditional passkey authentication (browser autofill / Conditional UI)
 *
 * This enables the browser to suggest passkeys in the autofill dropdown
 * when the user focuses on an input with autocomplete="username webauthn".
 *
 * Should be called on page load and runs in the background until:
 * - User selects a passkey from the autofill dropdown
 * - The AbortController is aborted (e.g., on component unmount)
 *
 * @param onSuccess - Callback when passkey authentication succeeds
 * @param abortSignal - AbortSignal to cancel the conditional authentication
 */
export const startConditionalPasskeyAuth = async (
  onSuccess: (data: AuthResponse) => void,
  abortSignal: AbortSignal,
): Promise<void> => {
  try {
    // Step 1: Get authentication options from server
    const optionsRes = await etch('/api/v1/auth/passkey/options', {
      method: 'POST',
      signal: abortSignal,
    });
    const { options } = (await optionsRes.json()) as {
      options: PublicKeyCredentialRequestOptionsJSON;
    };

    // Step 2: Start WebAuthn with conditional mediation (autofill UI)
    const authenticationResponse = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: true,
    });

    // Step 3: Send authentication response to server for verification
    const verifyRes = await etch('/api/v1/auth/passkey/verify', {
      method: 'POST',
      body: JSON.stringify({
        response: authenticationResponse,
      }),
      signal: abortSignal,
    });
    const data = (await verifyRes.json()) as AuthResponse;
    onSuccess(data);
  } catch (error) {
    // AbortError is expected when component unmounts, so ignore it
    if ((error as Error).name !== 'AbortError') {
    }
  }
};
