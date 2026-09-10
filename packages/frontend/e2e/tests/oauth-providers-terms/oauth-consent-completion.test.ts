import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';
import { z } from 'zod';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT,
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { buildOAuthAuthorizeUrl } from '#frontend-e2e/helpers/consent.ts';
import { captureClientRedirectAfterAction } from '#frontend-e2e/helpers/oauth-client-flow.ts';

const test = createScenarioFixture((port) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(port),
  users: [E2E_TEST_USER_CONFIG],
  clients: [{ ...E2E_TEST_CLIENT_CONFIG, skip_consent: false }],
}));

test('OAuth consent returns to authorization and issues an exchangeable code', async ({
  page,
  serverPort,
}) => {
  const origin = `http://localhost:${serverPort}`;
  const verifier = 'consent-completion-verifier-0123456789abcdef0123456789';
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  expect(
    (
      await page.request.post(`${origin}/api/auth/login`, {
        data: E2E_TEST_USER,
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(200);
  await page.goto(
    `${origin}${buildOAuthAuthorizeUrl({ scope: 'openid email', state: 'consent-completion', code_challenge: challenge })}`,
  );
  await expect(page).toHaveURL(/\/consent\?/);
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/consent' &&
      response.request().method() === 'POST',
  );
  // Capture the real redirect request; the fixture has no client HTTP server.
  const callback = await captureClientRedirectAfterAction(page, () =>
    page.getByRole('button', { name: 'Allow', exact: true }).click(),
  );
  expect((await saved).status()).toBe(200);
  expect(`${callback.origin}${callback.pathname}`).toBe(
    E2E_TEST_CLIENT.redirectUri,
  );
  expect(callback.searchParams.get('state')).toBe('consent-completion');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Missing authorization code');
  const response = await page.request.post(`${origin}/oauth/token`, {
    form: {
      grant_type: 'authorization_code',
      client_id: E2E_TEST_CLIENT.clientId,
      client_secret: E2E_TEST_CLIENT.clientSecret,
      redirect_uri: E2E_TEST_CLIENT.redirectUri,
      code,
      code_verifier: verifier,
    },
  });
  expect(response.status()).toBe(200);
  const tokens = z
    .object({ access_token: z.string() })
    .parse(await response.json());
  expect(
    (
      await page.request.get(`${origin}/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
    ).status(),
  ).toBe(200);
});
