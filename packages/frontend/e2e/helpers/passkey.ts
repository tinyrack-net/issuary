import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

/**
 * Sets up a passkey for a user via the test-only endpoint.
 *
 * This avoids browser-specific WebAuthn setup in tests that only need
 * the registered passkey state, such as 2FA routing and fallback checks.
 *
 * @param baseURL - Backend base URL
 * @param email - User email
 * @returns The created passkey ID
 */
export async function setupPasskeyViaTestApi(
  baseURL: string,
  email: string,
): Promise<{ id: string }> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const res = await client.test.passkey.setup[':email'].$post({
    param: { email },
  });
  if (!res.ok) {
    throw new Error(`Passkey test setup failed: ${res.status}`);
  }
  return res.json();
}
