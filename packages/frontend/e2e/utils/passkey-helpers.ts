import type { CDPSession, Page } from '@playwright/test';

/**
 * Virtual Authenticator configuration and session
 */
export interface VirtualAuthenticator {
  client: CDPSession;
  authenticatorId: string;
}

/**
 * Credential information returned from WebAuthn.getCredentials
 */
export interface WebAuthnCredential {
  credentialId: string;
  isResidentCredential: boolean;
  rpId: string;
  privateKey: string;
  userHandle: string;
  signCount: number;
  largeBlob?: string;
}

/**
 * Setup a virtual WebAuthn authenticator using Chrome DevTools Protocol
 * This creates a platform authenticator that supports discoverable credentials
 */
export async function setupVirtualAuthenticator(
  page: Page,
): Promise<VirtualAuthenticator> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');

  const { authenticatorId } = await client.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal', // Platform authenticator (Touch ID, Windows Hello, etc.)
        hasResidentKey: true, // Support discoverable credentials (required for passkeys)
        hasUserVerification: true, // Support user verification
        isUserVerified: true, // Auto-verify user (simulate biometric success)
        automaticPresenceSimulation: true, // Auto-simulate user presence
      },
    },
  );

  return { client, authenticatorId };
}

/**
 * Remove a virtual authenticator
 */
export async function removeVirtualAuthenticator(
  client: CDPSession,
  authenticatorId: string,
): Promise<void> {
  await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
}

/**
 * Get all credentials stored in the virtual authenticator
 */
export async function getCredentials(
  client: CDPSession,
  authenticatorId: string,
): Promise<WebAuthnCredential[]> {
  const result = await client.send('WebAuthn.getCredentials', {
    authenticatorId,
  });
  return result.credentials as WebAuthnCredential[];
}

/**
 * Wait for a credential to be added (registration)
 */
export async function waitForCredentialAdded(
  client: CDPSession,
): Promise<void> {
  return new Promise((resolve) => {
    client.once('WebAuthn.credentialAdded', () => resolve());
  });
}

/**
 * Wait for a credential to be asserted (authentication)
 */
export async function waitForCredentialAsserted(
  client: CDPSession,
): Promise<void> {
  return new Promise((resolve) => {
    client.once('WebAuthn.credentialAsserted', () => resolve());
  });
}

/**
 * Clear all credentials from the virtual authenticator
 */
export async function clearCredentials(
  client: CDPSession,
  authenticatorId: string,
): Promise<void> {
  await client.send('WebAuthn.clearCredentials', { authenticatorId });
}

const BASE_URL = 'http://localhost:8080';

/**
 * API helper: Create a new user directly via backend API
 */
export async function createUserViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<{ userId: string }> {
  const context = page.context();

  const registerResponse = await context.request.post(
    `${BASE_URL}/api/v1/auth/register`,
    {
      data: { email, password },
    },
  );

  if (!registerResponse.ok()) {
    const error = await registerResponse.json();
    throw new Error(`Failed to register user: ${JSON.stringify(error)}`);
  }

  const registerData = await registerResponse.json();

  return {
    userId: registerData.user?.id ?? '',
  };
}

/**
 * API helper: Login and get session
 */
export async function loginViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<{ user: Record<string, unknown>; requires2FA: boolean }> {
  const context = page.context();

  const loginResponse = await context.request.post(
    `${BASE_URL}/api/v1/auth/login`,
    {
      data: { email, password },
    },
  );

  if (!loginResponse.ok()) {
    const error = await loginResponse.json();
    throw new Error(`Failed to login: ${JSON.stringify(error)}`);
  }

  const loginData = await loginResponse.json();

  if (loginData.status === '2fa_required') {
    return { user: {}, requires2FA: true };
  }

  if (loginData.status === 'authenticated') {
    return { user: loginData.user ?? {}, requires2FA: false };
  }

  return { user: {}, requires2FA: false };
}

/**
 * API helper: Register a passkey for the current user via API
 * Note: This simulates the WebAuthn flow by using the virtual authenticator
 */
export async function registerPasskeyViaApi(
  page: Page,
  client: CDPSession,
  authenticatorId: string,
  _name?: string,
): Promise<{ credentialId: string }> {
  const context = page.context();

  // Step 1: Get registration options
  const optionsResponse = await context.request.post(
    `${BASE_URL}/api/v1/user/passkeys/register/options`,
  );

  if (!optionsResponse.ok()) {
    const error = await optionsResponse.json();
    throw new Error(`Failed to get passkey options: ${JSON.stringify(error)}`);
  }

  // The WebAuthn flow will be handled by the virtual authenticator
  // when the browser calls navigator.credentials.create()
  // For API-only testing, we would need to manually create the credential
  // but for E2E tests, we'll use the UI flow

  const credentials = await getCredentials(client, authenticatorId);
  const latestCredential = credentials[credentials.length - 1];

  return {
    credentialId: latestCredential?.credentialId ?? '',
  };
}

/**
 * API helper: Get user's passkeys
 */
export async function getPasskeysViaApi(
  page: Page,
): Promise<{ passkeys: Array<{ id: string; name: string | null }> }> {
  const context = page.context();

  const response = await context.request.get(
    `${BASE_URL}/api/v1/user/passkeys`,
  );

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`Failed to get passkeys: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * API helper: Delete a passkey
 */
export async function deletePasskeyViaApi(
  page: Page,
  passkeyId: string,
): Promise<void> {
  const context = page.context();

  const response = await context.request.delete(
    `${BASE_URL}/api/v1/user/passkeys/${passkeyId}`,
  );

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`Failed to delete passkey: ${JSON.stringify(error)}`);
  }
}

/**
 * API helper: Rename a passkey
 */
export async function renamePasskeyViaApi(
  page: Page,
  passkeyId: string,
  newName: string,
): Promise<void> {
  const context = page.context();

  const response = await context.request.patch(
    `${BASE_URL}/api/v1/user/passkeys/${passkeyId}`,
    {
      data: { name: newName },
    },
  );

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`Failed to rename passkey: ${JSON.stringify(error)}`);
  }
}
