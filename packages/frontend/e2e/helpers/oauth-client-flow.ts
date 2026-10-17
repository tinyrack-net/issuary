import { createHash, randomBytes } from 'node:crypto';
import {
  type APIRequestContext,
  expect,
  type Page,
  type Route,
} from '@playwright/test';
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

export const CLIENT_REDIRECT_TIMEOUT_MS = 30_000;

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
    scope: 'openid profile email offline_access',
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

export type MockedClientCallbackCapture = {
  /** Resolves with the callback URL once the browser is redirected to it. */
  redirect: Promise<URL>;
  /** Removes the interception routes. Always call this in a `finally` block. */
  dispose: () => Promise<void>;
};

/**
 * Captures the mocked OAuth client callback without letting the browser
 * navigate to it.
 *
 * The mocked callback host is intentionally unreachable, so a navigation to it
 * never settles: Linux refuses the connection immediately, but environments
 * such as WSL2 mirrored networking silently drop the SYN. The callback is
 * reached in two ways:
 *
 * - allow: `/oauth/authorize` answers with a server-side 302 to the callback.
 *   Playwright does not run `page.route` handlers for the follow-up request of
 *   an HTTP redirect, so the callback cannot be intercepted at its own URL.
 * - deny: the app calls `location.assign(callbackUrl)` directly.
 *
 * Intercept both `/oauth/authorize` and the callback URL. The authorize response
 * is fetched with `maxRedirects: 0` so its 302 `Location` can be read, then
 * fulfilled with a harmless document. The browser therefore stays on the app and
 * the click navigation settles on every platform.
 */
export async function captureMockedClientCallback(
  page: Page,
  redirectUri: string = E2E_TEST_CLIENT.redirectUri,
): Promise<MockedClientCallbackCapture> {
  let resolveRedirect: (url: URL) => void = () => {};
  const redirect = new Promise<URL>((resolve) => {
    resolveRedirect = resolve;
  });

  const authorizePattern = '**/oauth/authorize**';
  const callbackPattern = `${redirectUri}**`;
  const capturedDocument =
    '<!doctype html><title>Mock OAuth client callback captured</title>';

  const captureRedirect = async (route: Route, url: string) => {
    resolveRedirect(new URL(url));
    await route.fulfill({
      body: capturedDocument,
      contentType: 'text/html',
      status: 200,
    });
  };

  const authorizeHandler = async (route: Route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers().location;
    if (location?.startsWith(redirectUri)) {
      await captureRedirect(route, location);
      return;
    }
    await route.fulfill({ response });
  };
  const callbackHandler = async (route: Route) => {
    await captureRedirect(route, route.request().url());
  };

  await page.route(authorizePattern, authorizeHandler);
  await page.route(callbackPattern, callbackHandler);

  return {
    dispose: async () => {
      await page.unroute(authorizePattern, authorizeHandler);
      await page.unroute(callbackPattern, callbackHandler);
    },
    redirect,
  };
}

export async function allowConsentAndCaptureCode(page: Page): Promise<string> {
  await expect(page.locator(consentPage.allowButton)).toBeVisible();
  const capture = await captureMockedClientCallback(page);
  try {
    await page.locator(consentPage.allowButton).click();
    const url = await capture.redirect;
    const code = url.searchParams.get('code');

    if (!code) {
      throw new Error('Expected authorization code in redirect URL');
    }

    return code;
  } finally {
    await capture.dispose();
  }
}

export async function denyConsentAndCaptureRedirect(page: Page): Promise<URL> {
  await expect(page.locator(consentPage.denyButton)).toBeVisible();
  const capture = await captureMockedClientCallback(page);
  try {
    await page.locator(consentPage.denyButton).click();
    return await capture.redirect;
  } finally {
    await capture.dispose();
  }
}

export async function exchangeAuthorizationCode(
  request: APIRequestContext,
  baseURL: string,
  options: {
    code: string;
    codeVerifier: string;
    redirectUri?: string;
    clientId?: string;
    clientSecret?: string;
  },
): Promise<z.infer<typeof tokenResponseSchema>> {
  const response = await request.post(`${baseURL}/oauth/token`, {
    form: {
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri ?? E2E_TEST_CLIENT.redirectUri,
      client_id: options.clientId ?? E2E_TEST_CLIENT.clientId,
      client_secret: options.clientSecret ?? E2E_TEST_CLIENT.clientSecret,
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
  const capture = await captureMockedClientCallback(page);
  try {
    await action();
    return await capture.redirect;
  } finally {
    await capture.dispose();
  }
}
