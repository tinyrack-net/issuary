import type { Page } from '@playwright/test';

/**
 * Selectors for the OAuth consent page (/consent).
 */
export const consentPage = {
  /** User info section showing email */
  userEmail: '.bg-base-200.p-3 .font-medium',
  /** Permission scope items */
  scopeItem: 'ul li',
  /** Deny button */
  denyButton: 'button.btn-outline',
  /** Allow button */
  allowButton: 'button.btn-primary',
} as const;

/**
 * Default OAuth client parameters for test consent flows.
 */
export const DEFAULT_OAUTH_PARAMS = {
  response_type: 'code',
  client_id: 'e2e-test-client-id',
  redirect_uri: 'http://localhost:18080/callback',
  scope: 'openid profile email',
  state: 'test-state-123',
} as const;

/**
 * Builds an OAuth authorization URL with the given parameters.
 */
export function buildOAuthAuthorizeUrl(
  params: Record<string, string> = {},
): string {
  const merged = { ...DEFAULT_OAUTH_PARAMS, ...params };
  const searchParams = new URLSearchParams(merged);
  return `/oauth/authorize?${searchParams.toString()}`;
}

/**
 * Navigates to the OAuth authorization endpoint, which triggers the full
 * OAuth flow (login -> consent -> redirect).
 *
 * The page will either:
 * - Redirect to /login if not authenticated
 * - Show the consent page if authenticated
 * - Redirect to redirect_uri if consent was already given
 */
export async function navigateToOAuthAuthorize(
  page: Page,
  params: Record<string, string> = {},
): Promise<void> {
  const url = buildOAuthAuthorizeUrl(params);
  await page.goto(url);
}
