import type { Page } from '@playwright/test';
import {
  DEFAULT_SCOPES,
  TEST_OAUTH_CLIENT,
  TEST_PKCE,
} from '../fixtures/test-data';

/**
 * Build OAuth authorization URL
 */
export function buildAuthorizationUrl(params?: {
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
  responseType?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  prompt?: string;
}): string {
  const searchParams = new URLSearchParams({
    client_id: params?.clientId ?? TEST_OAUTH_CLIENT.clientId,
    redirect_uri: params?.redirectUri ?? TEST_OAUTH_CLIENT.redirectUri,
    response_type: params?.responseType ?? 'code',
    scope: params?.scope ?? DEFAULT_SCOPES,
    state: params?.state ?? 'test-state',
    code_challenge: params?.codeChallenge ?? TEST_PKCE.codeChallenge,
    code_challenge_method:
      params?.codeChallengeMethod ?? TEST_PKCE.codeChallengeMethod,
  });

  // Add optional prompt parameter
  if (params?.prompt) {
    searchParams.set('prompt', params.prompt);
  }

  return `/application/oauth/authorize?${searchParams.toString()}`;
}

/**
 * Navigate to OAuth consent page (forces consent screen)
 */
export async function navigateToConsent(
  page: Page,
  params?: Parameters<typeof buildAuthorizationUrl>[0],
): Promise<void> {
  // Always use prompt=consent to force showing the consent page
  const url = buildAuthorizationUrl({ ...params, prompt: 'consent' });
  await page.goto(url);
}

/**
 * Accept OAuth consent
 */
export async function acceptConsent(page: Page): Promise<void> {
  await page.getByRole('button', { name: /allow|accept|authorize/i }).click();
}

/**
 * Deny OAuth consent
 */
export async function denyConsent(page: Page): Promise<void> {
  await page.getByRole('button', { name: /deny|reject|cancel/i }).click();
}

/**
 * Extract authorization code from redirect URL
 */
export function extractAuthorizationCode(url: string): string | null {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('code');
}

/**
 * Extract error from redirect URL
 */
export function extractError(url: string): string | null {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('error');
}
