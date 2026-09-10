import { afterAll, beforeAll, expect, test } from 'vitest';
import {
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../test-utils/fixtures.js';
import {
  createAuthenticatedSession,
  withMikroContext,
} from '../../test-utils/helpers.js';
import {
  exchangeCodeForTokens,
  getAuthorizationCode,
} from '../../test-utils/oauth.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../../test-utils/setup.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });
});
afterAll(async () => {
  await server.cleanup();
});
async function code() {
  const sessionCookie = await createAuthenticatedSession(server.app);
  return getAuthorizationCode(server.app, {
    sessionCookie,
    codeChallenge: TEST_PKCE.codeChallenge,
    codeChallengeMethod: 'S256',
  });
}
test('wrong verifier does not consume a valid authorization code', async () => {
  const grant = await code();
  expect(
    (
      await exchangeCodeForTokens(server.app, {
        code: grant.code,
        codeVerifier: 'x'.repeat(43),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await exchangeCodeForTokens(server.app, {
        code: grant.code,
        codeVerifier: TEST_PKCE.codeVerifier,
      })
    ).status,
  ).toBe(200);
});
test('verified code replay revokes tokens previously issued from that code', async () => {
  const grant = await code();
  const first = await exchangeCodeForTokens(server.app, {
    code: grant.code,
    codeVerifier: TEST_PKCE.codeVerifier,
  });
  const tokens = await first.json();
  expect(first.status).toBe(200);
  expect(
    (
      await server.app.request('/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await exchangeCodeForTokens(server.app, {
        code: grant.code,
        codeVerifier: TEST_PKCE.codeVerifier,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await server.app.request('/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
    ).status,
  ).toBe(401);
});

test('wrong verifier on a used code cannot revoke the legitimate grant', async () => {
  const grant = await code();
  const first = await exchangeCodeForTokens(server.app, {
    code: grant.code,
    codeVerifier: TEST_PKCE.codeVerifier,
  });
  const tokens = await first.json();
  expect(first.status).toBe(200);
  expect(
    (
      await exchangeCodeForTokens(server.app, {
        code: grant.code,
        codeVerifier: 'x'.repeat(43),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await server.app.request('/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
    ).status,
  ).toBe(200);
});
test('cleanup preserves expired code replay evidence while issued tokens are alive', async () => {
  const grant = await code();
  const first = await exchangeCodeForTokens(server.app, {
    code: grant.code,
    codeVerifier: TEST_PKCE.codeVerifier,
  });
  const tokens = await first.json();
  expect(first.status).toBe(200);
  await withMikroContext(server.services, async () => {
    const hash = await server.services.securityService.hashOpaqueToken(
      'oauth-code',
      grant.code,
    );
    await server.services.mikro.oauthCode.nativeUpdate(
      { codeHash: hash },
      { expiredAt: new Date(0) },
    );
    await server.services.cleanupService.cleanupOAuthCodes({ dryRun: false });
    expect(
      await server.services.mikro.oauthCode.count({ codeHash: hash }),
    ).toBe(1);
  });
  expect(
    (
      await exchangeCodeForTokens(server.app, {
        code: grant.code,
        codeVerifier: TEST_PKCE.codeVerifier,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await server.app.request('/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
    ).status,
  ).toBe(401);
});
