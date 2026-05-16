import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

const DEFAULT_CODE_VERIFIER = 'e2e-consent-flow-code-verifier-0123456789abcdef';
const DEFAULT_CODE_CHALLENGE = createHash('sha256')
  .update(DEFAULT_CODE_VERIFIER)
  .digest('base64url');

/**
 * Selectors for the OAuth consent page (/consent).
 */
export const consentPage = {
  /** User info section showing email */
  userEmail: '[data-testid="consent-user-email"]',
  /** Permission scope items */
  scopeItem: '[data-testid="consent-scope-list"] li',
  /** Deny button */
  denyButton: '[data-testid="consent-deny"]',
  /** Allow button */
  allowButton: '[data-testid="consent-allow"]',
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
  nonce: 'test-nonce-123',
  code_challenge: DEFAULT_CODE_CHALLENGE,
  code_challenge_method: 'S256',
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
