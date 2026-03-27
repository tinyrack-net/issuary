import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createTestApp,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';
import type { AuthorizeParams } from './oauth-authorize.service.ts';

describe('OAuthAuthorizeService', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  const baseQuery = {
    client_id: TEST_OAUTH_CLIENT.clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state: 'oauth-state-123',
    nonce: 'nonce-123',
    code_challenge: 'challenge-123',
    code_challenge_method: 'S256',
  } satisfies AuthorizeParams;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('returns login_required to the client when prompt=none and no session exists', async () => {
    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'none',
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.origin).toBe(new URL(TEST_OAUTH_CLIENT.redirectUri).origin);
    expect(redirect.pathname).toBe(
      new URL(TEST_OAUTH_CLIENT.redirectUri).pathname,
    );
    expect(redirect.searchParams.get('error')).toBe('login_required');
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
  });

  test('redirects to the login page and preserves OIDC parameters for interactive auth', async () => {
    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'login',
          max_age: 300,
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('client_id')).toBe(baseQuery.client_id);
    expect(redirect.searchParams.get('redirect_uri')).toBe(
      baseQuery.redirect_uri,
    );
    expect(redirect.searchParams.get('scope')).toBe(baseQuery.scope);
    expect(redirect.searchParams.get('nonce')).toBe(baseQuery.nonce);
    expect(redirect.searchParams.get('code_challenge')).toBe(
      baseQuery.code_challenge,
    );
    expect(redirect.searchParams.get('prompt')).toBe('login');
    expect(redirect.searchParams.get('max_age')).toBe('300');
  });

  test('returns consent_required when prompt=none and the user has not granted consent', async () => {
    const userSub = await createTestUser(services);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'none',
        },
        userSession: {
          sub: userSub,
          authenticated_at: 1_700_000_000,
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.searchParams.get('error')).toBe('consent_required');
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
  });

  test('issues an authorization code once consent already exists', async () => {
    const userSub = await createTestUser(services);

    await withMikroContext(services, async () => {
      const client = await services.oauthClientService.findByClientId(
        TEST_OAUTH_CLIENT.clientId,
      );
      await services.userConsentService.grantConsent({
        userSub,
        clientId: client.id,
        scopes: ['openid', 'email'],
      });
    });

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: baseQuery,
        userSession: {
          sub: userSub,
          authenticated_at: 1_700_000_000,
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.origin).toBe(new URL(TEST_OAUTH_CLIENT.redirectUri).origin);
    expect(redirect.pathname).toBe(
      new URL(TEST_OAUTH_CLIENT.redirectUri).pathname,
    );
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
  });
});
