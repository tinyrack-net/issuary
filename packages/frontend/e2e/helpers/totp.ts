import type { APIRequestContext, Page, Route } from '@playwright/test';
import { generateSync } from 'otplib';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

/**
 * Intercepts the TOTP setup API response to extract the secret.
 *
 * Must be called BEFORE the setup request is made. Returns a
 * promise that resolves with the TOTP secret when the response
 * is intercepted.
 */
export function interceptTotpSecret(page: Page): Promise<string> {
  return new Promise((resolve) => {
    const handler = async (route: Route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { secret: string };
      resolve(body.secret);
      await route.fulfill({ response });
      await page.unroute('**/api/user/totp/setup', handler);
    };
    void page.route('**/api/user/totp/setup', handler);
  });
}

/**
 * Generates a valid 6-digit TOTP code from a secret.
 */
export function generateTotpCode(secret: string): string {
  return generateSync({ secret });
}

interface SetupTotpResult {
  secret: string;
}

/**
 * Programmatically sets up TOTP for a user via the API.
 *
 * Uses Playwright's APIRequestContext which automatically manages
 * cookies across requests, matching browser behavior.
 *
 * Performs the full 3-step flow:
 * 1. POST /api/user/totp/setup -> get secret
 * 2. POST /api/user/totp/verify -> verify with valid code
 * 3. POST /api/user/totp/confirm -> finalize setup
 *
 * @param request - Playwright APIRequestContext
 * @param baseURL - Backend base URL
 * @returns The TOTP secret for generating codes later
 */
export async function setupTotpViaApi(
  request: APIRequestContext,
  baseURL: string,
): Promise<SetupTotpResult> {
  // Step 1: Start setup
  const setupRes = await request.post(`${baseURL}/api/user/totp/setup`);
  if (!setupRes.ok()) {
    throw new Error(
      `TOTP setup failed: ${setupRes.status()} ${await setupRes.text()}`,
    );
  }
  const { secret } = (await setupRes.json()) as { secret: string };

  // Step 2: Verify with valid code
  const code = generateTotpCode(secret);
  const verifyRes = await request.post(`${baseURL}/api/user/totp/verify`, {
    data: { code },
  });
  if (!verifyRes.ok()) {
    throw new Error(
      `TOTP verify failed: ${verifyRes.status()} ${await verifyRes.text()}`,
    );
  }

  // Step 3: Confirm (acknowledge recovery codes)
  const confirmRes = await request.post(`${baseURL}/api/user/totp/confirm`);
  if (!confirmRes.ok()) {
    throw new Error(
      `TOTP confirm failed: ${confirmRes.status()} ${await confirmRes.text()}`,
    );
  }

  return { secret };
}

/**
 * Sets up TOTP for a user via the test-only endpoint (no session required).
 *
 * Directly creates a verified TOTP record in the database, bypassing
 * the authenticated API flow. This avoids cookie-store mismatch between
 * the Hono RPC client (used for registration) and Playwright's
 * APIRequestContext.
 *
 * @param baseURL - Backend base URL
 * @param email - User email
 * @returns The TOTP secret for generating codes later
 */
export async function setupTotpViaTestApi(
  baseURL: string,
  email: string,
): Promise<SetupTotpResult> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const res = await client.test.totp.setup[':email'].$post({
    param: { email },
  });
  if (!res.ok) {
    throw new Error(`TOTP test setup failed: ${res.status}`);
  }
  const data = (await res.json()) as { secret: string };
  return { secret: data.secret };
}

/**
 * Sets up TOTP with recovery codes via the test-only endpoint
 * (no session required).
 *
 * Performs the full TOTP setup flow server-side (start, verify, confirm)
 * and returns both the secret and recovery codes.
 *
 * @param baseURL - Backend base URL
 * @param email - User email
 * @returns The TOTP secret and recovery codes
 */
export async function setupTotpWithRecoveryViaTestApi(
  baseURL: string,
  email: string,
): Promise<{ secret: string; recoveryCodes: string[] }> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const res = await client.test.totp['setup-with-recovery'][':email'].$post({
    param: { email },
  });
  if (!res.ok) {
    throw new Error(`TOTP test setup with recovery failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    secret: string;
    recovery_codes: string[];
  };
  return { secret: data.secret, recoveryCodes: data.recovery_codes };
}
