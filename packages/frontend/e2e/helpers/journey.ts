import { consentPage } from '@frontend-e2e/helpers/consent.js';
import { getEmailToken } from '@frontend-e2e/helpers/email-token.js';
import { emailVerifyPage, totpSetupPage } from '@frontend-e2e/helpers/login.js';
import { fillPinInput } from '@frontend-e2e/helpers/pin-input.js';
import { generateTotpCode } from '@frontend-e2e/helpers/totp.js';
import { expect, type Page } from '@playwright/test';

export type JourneyOAuthParams = {
  client_id: string;
  redirect_uri: string;
  response_type: 'code';
  scope: string;
  state: string;
  nonce: string;
  code_challenge: string;
  code_challenge_method: 'S256' | 'plain';
  prompt: 'login' | 'consent' | 'none' | 'select_account';
};

export const JOURNEY_OAUTH_PARAM_KEYS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
  'prompt',
] as const;

export type JourneyOAuthParamKey = (typeof JOURNEY_OAUTH_PARAM_KEYS)[number];

type AuthFlow = 'login' | 'register';
type AuthMode = 'form' | 'method' | 'password';

/**
 * Builds a full OAuth parameter set with deterministic defaults.
 * Uses prompt=consent to always render the consent page.
 */
export function buildJourneyOAuthParams(state: string): JourneyOAuthParams {
  return {
    client_id: 'e2e-test-client-id',
    redirect_uri: 'http://localhost:18080/callback',
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce: `nonce-${state}`,
    code_challenge: `code-challenge-${state}`,
    code_challenge_method: 'S256',
    prompt: 'consent',
  };
}

/**
 * Builds an auth entry URL with OAuth params.
 */
export function buildAuthEntryUrl(
  flow: AuthFlow,
  mode: AuthMode,
  params: JourneyOAuthParams,
): string {
  const path =
    flow === 'register'
      ? '/register'
      : mode === 'password'
        ? '/login/password'
        : '/login';
  const query = new URLSearchParams(params);
  return `${path}?${query.toString()}`;
}

/**
 * Asserts that OAuth params are preserved in the current URL.
 */
export async function expectOAuthParamsPresent(
  page: Page,
  params: JourneyOAuthParams,
  keys: readonly JourneyOAuthParamKey[] = JOURNEY_OAUTH_PARAM_KEYS,
): Promise<void> {
  const current = new URL(page.url());
  for (const key of keys) {
    expect(current.searchParams.get(key)).toBe(params[key]);
  }
}

/**
 * Completes verify-email form by fetching token from test endpoint.
 */
export async function completeEmailVerification(
  page: Page,
  baseURL: string,
  email: string,
): Promise<void> {
  const token = await getEmailToken(baseURL, email);
  await page.locator(emailVerifyPage.tokenInput).fill(token);
  await page.locator(emailVerifyPage.submitButton).click();
}

/**
 * Completes TOTP verification step with a valid code.
 */
export async function completeTotpVerify(
  page: Page,
  secret: string,
): Promise<void> {
  const code = generateTotpCode(secret);
  await fillPinInput(page, code);
}

/**
 * Completes the full TOTP setup flow (QR -> verify -> recovery confirm).
 */
export async function completeTotpSetup(
  page: Page,
  secret: string,
): Promise<void> {
  await expect(page.locator(totpSetupPage.qrCodeImage)).toBeVisible();
  await page.locator(totpSetupPage.nextButton).click();
  await completeTotpVerify(page, secret);
  await expect(page.locator(totpSetupPage.recoveryCodesGrid)).toBeVisible();
  await page.locator(totpSetupPage.confirmCheckbox).check();
  await page.locator(totpSetupPage.confirmButton).click();
}

/**
 * Waits for the final OIDC client redirect request and validates
 * authorization code + state.
 */
export async function expectOidcRedirectRequest(
  page: Page,
  redirectUri: string,
  expectedState: string,
): Promise<void> {
  const redirectRequest = await page.waitForRequest((request) =>
    request.url().startsWith(redirectUri),
  );
  const url = new URL(redirectRequest.url());
  expect(url.searchParams.get('code')).toBeTruthy();
  expect(url.searchParams.get('state')).toBe(expectedState);
}

/**
 * Clicks Allow on consent and verifies redirect with code/state.
 */
export async function allowConsentAndExpectRedirect(
  page: Page,
  redirectUri: string,
  expectedState: string,
): Promise<void> {
  await expect(page.locator(consentPage.allowButton)).toBeVisible();
  const redirectPromise = expectOidcRedirectRequest(
    page,
    redirectUri,
    expectedState,
  );
  await page.getByRole('button', { name: 'Allow' }).click();
  await redirectPromise;
}
