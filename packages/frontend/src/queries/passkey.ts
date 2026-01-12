import { mutationOptions, queryOptions } from '@tanstack/react-query';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { etch } from '@/libs/etch.js';
import type { SessionResponse } from './session.js';

export const PASSKEYS_QUERY_KEY = ['/api/v1/user/passkeys'];

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

export type SuccessResponse = {
  success: boolean;
};

/**
 * Get all passkeys for current user
 */
export const getPasskeysQueryOptions = queryOptions({
  queryKey: PASSKEYS_QUERY_KEY,
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
    const registrationResponse = await startRegistration({ optionsJSON: options });

    // Step 3: Send registration response to server for verification
    const verifyRes = await etch('/api/v1/user/passkeys/register/verify', {
      method: 'POST',
      body: JSON.stringify({
        response: registrationResponse,
        name: params.name,
      }),
    });
    return verifyRes.json() as Promise<SuccessResponse>;
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
    return res.json() as Promise<SuccessResponse>;
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
    return res.json() as Promise<SuccessResponse>;
  },
});

/**
 * Login with passkey (passwordless)
 */
export const loginWithPasskeyMutationOptions = mutationOptions({
  mutationFn: async () => {
    // Step 1: Get authentication options from server
    const optionsRes = await etch('/api/v1/auth/passkey/options', {
      method: 'POST',
    });
    const { options } = (await optionsRes.json()) as {
      options: PublicKeyCredentialRequestOptionsJSON;
    };

    // Step 2: Start WebAuthn authentication in browser
    const authenticationResponse = await startAuthentication({ optionsJSON: options });

    // Step 3: Send authentication response to server for verification
    const verifyRes = await etch('/api/v1/auth/passkey/verify', {
      method: 'POST',
      body: JSON.stringify({
        response: authenticationResponse,
      }),
    });
    return verifyRes.json() as Promise<SessionResponse>;
  },
});
