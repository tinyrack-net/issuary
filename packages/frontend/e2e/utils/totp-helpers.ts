import type { Page } from '@playwright/test';
import { authenticator } from 'otplib';
import { ROUTES } from '../fixtures/test-data';

/**
 * Generate a TOTP code from a secret
 */
export function generateTOTPCode(secret: string): string {
  return authenticator.generate(secret);
}

/**
 * Extract secret from otpauth URL
 * Format: otpauth://totp/LABEL?secret=SECRET&issuer=ISSUER
 */
export function extractSecretFromOtpauthUrl(otpauthUrl: string): string {
  const url = new URL(otpauthUrl);
  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('Secret not found in otpauth URL');
  }
  return secret;
}

/**
 * Verify that a TOTP code is valid for a given secret
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

/**
 * API helper: Create a new user directly via backend API
 */
export async function createUserViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<{ userId: string; sessionCookie: string }> {
  const context = page.context();

  // Register the user via API
  const registerResponse = await context.request.post(
    'http://localhost:8080/api/v1/auth/register',
    {
      data: { email, password },
    },
  );

  if (!registerResponse.ok()) {
    const error = await registerResponse.json();
    throw new Error(`Failed to register user: ${JSON.stringify(error)}`);
  }

  const registerData = await registerResponse.json();

  // Get session cookie from response headers
  const cookies = await context.cookies();
  const sessionCookie = cookies.find((c) => c.name === 'session')?.value ?? '';

  return {
    userId: registerData.user?.id ?? '',
    sessionCookie,
  };
}

/**
 * API helper: Enable TOTP for a user via API
 * Returns the TOTP secret
 */
export async function enableTotpViaApi(
  page: Page,
): Promise<{ secret: string; otpauthUrl: string }> {
  const context = page.context();

  // Start TOTP setup
  const setupResponse = await context.request.post(
    'http://localhost:8080/api/v1/user/totp/setup',
  );

  if (!setupResponse.ok()) {
    const error = await setupResponse.json();
    throw new Error(`Failed to start TOTP setup: ${JSON.stringify(error)}`);
  }

  const setupData = await setupResponse.json();
  const secret = setupData.secret;

  // Generate valid TOTP code and verify
  const code = generateTOTPCode(secret);

  const verifyResponse = await context.request.post(
    'http://localhost:8080/api/v1/user/totp/verify',
    {
      data: { code },
    },
  );

  if (!verifyResponse.ok()) {
    const error = await verifyResponse.json();
    throw new Error(`Failed to verify TOTP: ${JSON.stringify(error)}`);
  }

  return {
    secret,
    otpauthUrl: setupData.otpauth_url,
  };
}

/**
 * API helper: Disable TOTP for a user via API
 */
export async function disableTotpViaApi(
  page: Page,
  secret: string,
): Promise<void> {
  const context = page.context();
  const code = generateTOTPCode(secret);

  const response = await context.request.delete(
    'http://localhost:8080/api/v1/user/totp',
    {
      data: { code },
    },
  );

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`Failed to disable TOTP: ${JSON.stringify(error)}`);
  }
}

/**
 * API helper: Login and get session (handles 2FA if needed)
 */
export async function loginViaApi(
  page: Page,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<{ user: Record<string, unknown>; requires2FA: boolean }> {
  const context = page.context();

  // Login with credentials
  const loginResponse = await context.request.post(
    'http://localhost:8080/api/v1/auth/login',
    {
      data: { email, password },
    },
  );

  if (!loginResponse.ok()) {
    const error = await loginResponse.json();
    throw new Error(`Failed to login: ${JSON.stringify(error)}`);
  }

  const loginData = await loginResponse.json();

  // Check if 2FA is required
  if (loginData.status === '2fa_required') {
    if (!totpSecret) {
      return { user: {}, requires2FA: true };
    }

    // Complete TOTP verification
    const code = generateTOTPCode(totpSecret);
    const verifyResponse = await context.request.post(
      'http://localhost:8080/api/v1/auth/totp/verify',
      {
        data: { code },
      },
    );

    if (!verifyResponse.ok()) {
      const error = await verifyResponse.json();
      throw new Error(`Failed to verify TOTP: ${JSON.stringify(error)}`);
    }

    const verifyData = await verifyResponse.json();
    return { user: verifyData.user, requires2FA: false };
  }

  if (loginData.status === 'success') {
    return { user: loginData.user ?? {}, requires2FA: false };
  }

  // For other statuses (email_verification_required, 2fa_setup_required)
  return { user: {}, requires2FA: false };
}

/**
 * UI helper: Complete TOTP verification on the verify-totp page
 */
export async function completeTotpVerification(
  page: Page,
  secret: string,
): Promise<void> {
  const code = generateTOTPCode(secret);
  await page.getByPlaceholder(/enter 6-digit code/i).fill(code);
  await page.getByRole('button', { name: /verify/i }).click();
}

/**
 * UI helper: Complete TOTP setup on the setup-totp page
 * Returns the TOTP secret extracted from the page
 */
export async function completeTotpSetup(page: Page): Promise<string> {
  // Wait for QR code to be displayed
  await page.waitForSelector('img[alt="TOTP QR Code"]', { timeout: 10000 });

  // Expand manual entry section to get the secret
  await page.getByText(/can't scan\?|manual entry/i).click();

  // Get the secret from the code element
  const secretElement = await page.locator('code').first();
  const secret = (await secretElement.textContent()) ?? '';

  if (!secret) {
    throw new Error('Failed to extract TOTP secret from page');
  }

  // Click next to go to verification step
  await page.getByRole('button', { name: /next|continue/i }).click();

  // Enter the TOTP code
  const code = generateTOTPCode(secret);
  await page.getByPlaceholder(/000000/i).fill(code);

  // Submit verification
  await page.getByRole('button', { name: /verify|complete/i }).click();

  return secret;
}

/**
 * UI helper: Navigate to login and handle 2FA flow
 */
export async function loginWithTotp(
  page: Page,
  email: string,
  password: string,
  totpSecret: string,
): Promise<void> {
  await page.goto(ROUTES.login);

  // Fill login form
  await page.getByPlaceholder(/hello@example.com/i).fill(email);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();

  // Wait for redirect to TOTP verification
  await page.waitForURL(/\/verify\/totp|\/verify\/2fa/, { timeout: 10000 });

  // If redirected to 2FA selection page, choose TOTP
  if (page.url().includes('/verify/2fa')) {
    await page.getByRole('link', { name: /authenticator app/i }).click();
    await page.waitForURL(/\/verify\/totp/, { timeout: 5000 });
  }

  // Complete TOTP verification
  await completeTotpVerification(page, totpSecret);
}
