import { createHash, randomBytes } from 'node:crypto';
import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { z } from 'zod';
import { E2E_TEST_CLIENT } from '#frontend-e2e/fixtures/index.ts';
import { consentPage } from '#frontend-e2e/helpers/consent.ts';

export type OAuthPrompt = 'none' | 'login' | 'consent' | 'select_account';

export type OAuthAuthorizeParams = {
  client_id: string;
  redirect_uri: string;
  response_type: 'code';
  scope: string;
  state: string;
  nonce: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  prompt?: OAuthPrompt;
};

export type OAuthFlowInput = {
  authorizeParams: OAuthAuthorizeParams;
  codeVerifier: string;
};

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});

const OAUTH_PARAM_KEYS = [
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

function createPkceS256Pair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(48).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function buildOAuthFlowInput(
  state: string,
  overrides: Partial<OAuthAuthorizeParams> = {},
): OAuthFlowInput {
  const pkce = createPkceS256Pair();
  const authorizeParams: OAuthAuthorizeParams = {
    client_id: E2E_TEST_CLIENT.clientId,
    redirect_uri: E2E_TEST_CLIENT.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce: `nonce-${state}`,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'consent',
    ...overrides,
  };

  return {
    authorizeParams,
    codeVerifier: pkce.codeVerifier,
  };
}

export function buildAuthorizePath(params: OAuthAuthorizeParams): string {
  const search = new URLSearchParams();
  for (const key of OAUTH_PARAM_KEYS) {
    const value = params[key];
    if (value) {
      search.set(key, value);
    }
  }
  return `/oauth/authorize?${search.toString()}`;
}

export function expectOAuthParamsInCurrentUrl(
  page: Page,
  params: OAuthAuthorizeParams,
): void {
  const current = new URL(page.url());
  for (const key of OAUTH_PARAM_KEYS) {
    const value = params[key];
    if (value) {
      expect(current.searchParams.get(key)).toBe(value);
    }
  }
}

async function waitForClientRedirect(page: Page): Promise<URL> {
  const redirectRequest = await page.waitForRequest((request) =>
    request.url().startsWith(E2E_TEST_CLIENT.redirectUri),
  );
  return new URL(redirectRequest.url());
}

export async function allowConsentAndCaptureCode(page: Page): Promise<string> {
  await expect(page.locator(consentPage.allowButton)).toBeVisible();
  const redirectPromise = waitForClientRedirect(page);
  await page.locator(consentPage.allowButton).click();
  const url = await redirectPromise;
  const code = url.searchParams.get('code');

  if (!code) {
    throw new Error('Expected authorization code in redirect URL');
  }

  return code;
}

export async function denyConsentAndCaptureRedirect(page: Page): Promise<URL> {
  await expect(page.locator(consentPage.denyButton)).toBeVisible();
  const redirectPromise = waitForClientRedirect(page);
  await page.locator(consentPage.denyButton).click();
  return redirectPromise;
}

export async function exchangeAuthorizationCode(
  request: APIRequestContext,
  baseURL: string,
  options: {
    code: string;
    codeVerifier: string;
    redirectUri?: string;
    clientId?: string;
  },
): Promise<z.infer<typeof tokenResponseSchema>> {
  const response = await request.post(`${baseURL}/oauth/token`, {
    form: {
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri ?? E2E_TEST_CLIENT.redirectUri,
      client_id: options.clientId ?? E2E_TEST_CLIENT.clientId,
      code_verifier: options.codeVerifier,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Token exchange failed with status ${response.status()}: ${await response.text()}`,
    );
  }

  return tokenResponseSchema.parse(await response.json());
}

export async function captureClientRedirectAfterAction(
  page: Page,
  action: () => Promise<void>,
): Promise<URL> {
  const redirectPromise = waitForClientRedirect(page);
  await action();
  return redirectPromise;
}
