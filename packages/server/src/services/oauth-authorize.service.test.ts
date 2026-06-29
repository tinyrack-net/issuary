import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type {
  AccountSelectionSession,
  ReauthenticationSession,
  SessionAccount,
} from '../middleware/session.ts';
import {
  createTestApp,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
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
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
  } satisfies AuthorizeParams;

  async function grantBaseConsent(userSub: string): Promise<void> {
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
  }

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

  test('creates a bound reauthentication continuation before redirecting a logged-out interactive request to login', async () => {
    let capturedReauthentication:
      | Parameters<
          NonNullable<
            Parameters<
              typeof services.oauthAuthorizeService.authorize
            >[0]['setReauthenticationSession']
          >
        >[0]
      | undefined;

    const firstResult = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
        },
        setReauthenticationSession: (state) => {
          capturedReauthentication = state;
        },
      }),
    );

    expect(new URL(firstResult.url).pathname).toBe('/login');
    expect(capturedReauthentication?.request_fingerprint).toBeTruthy();

    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const authenticatedAt = Math.floor(Date.now() / 1000);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
          reauthenticated: '1',
        },
        userSession: {
          sub: userSub,
          authenticated_at: authenticatedAt,
        },
        reauthenticationSession: {
          ...capturedReauthentication,
          sub: userSub,
          authenticated_at: authenticatedAt,
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe(new URL(baseQuery.redirect_uri).pathname);
    expect(redirect.searchParams.get('code')).toBeTruthy();
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

    await grantBaseConsent(userSub);

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

  test('redirects an existing session to login when prompt=login is requested', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'login',
        },
        userSession: {
          sub: userSub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('prompt')).toBe('login');
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('does not trust forged reauthenticated=1 for prompt=login', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'login',
          reauthenticated: '1',
        },
        userSession: {
          sub: userSub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('prompt')).toBe('login');
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('does not trust a generic recent reauthentication marker for prompt=login', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const now = Math.floor(Date.now() / 1000);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'login',
          reauthenticated: '1',
        },
        userSession: {
          sub: userSub,
          authenticated_at: now,
        },
        reauthenticationSession: {
          sub: userSub,
          authenticated_at: now,
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('prompt')).toBe('login');
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('redirects an existing session to login when max_age=0 is requested', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          max_age: 0,
        },
        userSession: {
          sub: userSub,
          authenticated_at: Math.floor(Date.now() / 1000) - 1,
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('max_age')).toBe('0');
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('issues a code for max_age=0 after fresh reauthentication and consent allow', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const now = Math.floor(Date.now() / 1000);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          max_age: 0,
          reauthenticated: '1',
        },
        userSession: {
          sub: userSub,
          authenticated_at: now,
        },
        reauthenticationSession: {
          sub: userSub,
          authenticated_at: now,
          request_fingerprint: JSON.stringify([
            ['client_id', baseQuery.client_id],
            ['redirect_uri', baseQuery.redirect_uri],
            ['response_type', baseQuery.response_type],
            ['scope', baseQuery.scope],
            ['state', baseQuery.state],
            ['nonce', baseQuery.nonce],
            ['code_challenge', baseQuery.code_challenge],
            ['code_challenge_method', baseQuery.code_challenge_method],
            ['max_age', 0],
          ]),
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe(new URL(baseQuery.redirect_uri).pathname);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
    expect(redirect.searchParams.has('error')).toBe(false);
  });

  test('issues a code when the existing session is newer than max_age', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          max_age: 300,
        },
        userSession: {
          sub: userSub,
          authenticated_at: Math.floor(Date.now() / 1000) - 30,
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.has('error')).toBe(false);
  });

  test('redirects an authenticated prompt=select_account request to login when account selection is disabled', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
        },
        userSession: {
          sub: userSub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('prompt')).toBe('select_account');
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('continues after prompt=select_account has just reauthenticated when account selection is disabled', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const now = Math.floor(Date.now() / 1000);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
          reauthenticated: '1',
        },
        userSession: {
          sub: userSub,
          authenticated_at: now,
        },
        reauthenticationSession: {
          sub: userSub,
          authenticated_at: now,
          request_fingerprint: JSON.stringify([
            ['client_id', baseQuery.client_id],
            ['redirect_uri', baseQuery.redirect_uri],
            ['response_type', baseQuery.response_type],
            ['scope', baseQuery.scope],
            ['state', baseQuery.state],
            ['nonce', baseQuery.nonce],
            ['code_challenge', baseQuery.code_challenge],
            ['code_challenge_method', baseQuery.code_challenge_method],
            ['prompt', 'select_account'],
          ]),
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe(new URL(baseQuery.redirect_uri).pathname);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
    expect(redirect.searchParams.has('error')).toBe(false);
  });

  test('returns account_selection_required for prompt=none select_account when account selection is disabled', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'none select_account',
        },
        userSession: {
          sub: userSub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.searchParams.get('error')).toBe(
      'account_selection_required',
    );
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('returns login_required for prompt=none when the existing session is stale', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'none',
          max_age: 300,
        },
        userSession: {
          sub: userSub,
          authenticated_at: Math.floor(Date.now() / 1000) - 600,
        },
      }),
    );

    const redirect = new URL(result.url);

    expect(redirect.searchParams.get('error')).toBe('login_required');
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
    expect(redirect.searchParams.has('code')).toBe(false);
  });
});

describe('OAuthAuthorizeService account selection', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  const baseQuery = {
    client_id: TEST_OAUTH_CLIENT.clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state: 'oauth-state-123',
    nonce: 'nonce-123',
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
  } satisfies AuthorizeParams;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
        },
      },
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  async function grantBaseConsent(userSub: string): Promise<void> {
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
  }

  async function createChooserState(params: {
    userSub: string;
    query?: AuthorizeParams;
    rememberedAccounts?: SessionAccount[];
  }): Promise<{
    state: AccountSelectionSession;
    reauthentication: ReauthenticationSession;
    redirect: URL;
  }> {
    const query: AuthorizeParams = params.query ?? {
      ...baseQuery,
      prompt: 'select_account',
    };
    const storedStates: AccountSelectionSession[] = [];
    const reauthenticationStates: ReauthenticationSession[] = [];
    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query,
        userSession: {
          sub: params.userSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: params.rememberedAccounts ?? [
          {
            sub: params.userSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
        setAccountSelectionSession: (state) => storedStates.push(state),
        setReauthenticationSession: (state) =>
          reauthenticationStates.push(state),
      }),
    );
    expect(storedStates).toHaveLength(1);
    expect(reauthenticationStates).toHaveLength(1);
    return {
      state: storedStates[0] as AccountSelectionSession,
      reauthentication: reauthenticationStates[0] as ReauthenticationSession,
      redirect: new URL(result.url),
    };
  }

  test('redirects an authenticated prompt=select_account request to the account chooser with server-side continuation state', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const { state: storedState, redirect } = await createChooserState({
      userSub,
    });

    expect(redirect.pathname).toBe('/account/select');
    expect(redirect.searchParams.get('client_id')).toBe(baseQuery.client_id);
    expect(redirect.searchParams.get('redirect_uri')).toBe(
      baseQuery.redirect_uri,
    );
    expect(redirect.searchParams.get('prompt')).toBe('select_account');
    expect(redirect.searchParams.get('account_selection_state')).toBeTruthy();
    expect(redirect.searchParams.has('account_selected')).toBe(false);
    expect(redirect.searchParams.has('code')).toBe(false);
    expect(storedState.id).toBe(
      redirect.searchParams.get('account_selection_state'),
    );
    expect(storedState.client_id).toBe(baseQuery.client_id);
    expect(storedState.request_fingerprint).toBeTruthy();
    expect(storedState.allowed_subs).toEqual([userSub]);
  });

  test('continues after chooser marks account_selected=1 with a valid server-side continuation state', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const { state: accountSelectionSession } = await createChooserState({
      userSub,
    });
    const cleared: string[] = [];

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
          account_selected: '1',
          account_selection_state: accountSelectionSession.id,
        },
        userSession: {
          sub: userSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: [
          {
            sub: userSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
        accountSelectionSession,
        clearAccountSelectionSession: () => cleared.push('cleared'),
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe(new URL(baseQuery.redirect_uri).pathname);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
    expect(cleared).toEqual(['cleared']);
  });

  test('continues after add-account login returns with a bound reauthentication and chooser state', async () => {
    const activeSub = await createTestUser(services, {
      email: 'add-account-active@example.com',
    });
    const addedSub = await createTestUser(services, {
      email: 'add-account-added@example.com',
    });
    await grantBaseConsent(addedSub);
    const { state: accountSelectionSession, reauthentication } =
      await createChooserState({ userSub: activeSub });
    const authenticatedAt = Math.floor(Date.now() / 1000);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account login',
          reauthenticated: '1',
          account_selected: '1',
          account_selection_state: accountSelectionSession.id,
        },
        userSession: {
          sub: addedSub,
          authenticated_at: authenticatedAt,
        },
        reauthenticationSession: {
          ...reauthentication,
          sub: addedSub,
          authenticated_at: authenticatedAt,
        },
        accountSelectionSession,
        rememberedAccounts: [
          {
            sub: activeSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
          {
            sub: addedSub,
            authenticated_at: authenticatedAt,
            last_used_at: authenticatedAt,
          },
        ],
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe(new URL(baseQuery.redirect_uri).pathname);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
  });

  test('does not trust account_selected when the continuation state was created for a different authorize request', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const { state: accountSelectionSession } = await createChooserState({
      userSub,
    });

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          scope: 'openid profile email',
          prompt: 'select_account',
          account_selected: '1',
          account_selection_state: accountSelectionSession.id,
        },
        userSession: {
          sub: userSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: [
          {
            sub: userSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
        accountSelectionSession,
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/account/select');
    expect(redirect.searchParams.get('account_selected')).toBeNull();
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('does not trust account_selected when the continuation state is expired', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const { state } = await createChooserState({ userSub });
    const accountSelectionSession = {
      ...state,
      created_at: Math.floor(Date.now() / 1000) - 301,
    };

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
          account_selected: '1',
          account_selection_state: accountSelectionSession.id,
        },
        userSession: {
          sub: userSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: [
          {
            sub: userSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
        accountSelectionSession,
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/account/select');
    expect(redirect.searchParams.get('account_selected')).toBeNull();
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('does not trust fresh account_selected when prompt=select_account explicitly requests a chooser', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const now = Math.floor(Date.now() / 1000);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
          reauthenticated: '1',
          account_selected: '1',
        },
        userSession: {
          sub: userSub,
          authenticated_at: now,
        },
        rememberedAccounts: [
          {
            sub: userSub,
            authenticated_at: now,
            last_used_at: now,
          },
        ],
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/account/select');
    expect(redirect.searchParams.get('account_selected')).toBeNull();
    expect(redirect.searchParams.get('code')).toBeNull();
  });

  test('does not trust a forged account_selected flag without server-side continuation state', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
          account_selected: '1',
        },
        userSession: {
          sub: userSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: [
          {
            sub: userSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/account/select');
    expect(redirect.searchParams.get('account_selected')).toBeNull();
    expect(redirect.searchParams.get('account_selection_state')).toBeTruthy();
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('rejects add-account continuation when the chooser state does not allow adding accounts', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);
    const { state } = await createChooserState({
      userSub,
      rememberedAccounts: [
        {
          sub: 'another-remembered-user',
          authenticated_at: 1_700_000_000,
          last_used_at: 1_700_000_000,
        },
      ],
    });
    const accountSelectionSession = {
      ...state,
      allow_add_account: false,
    };

    await expect(
      withMikroContext(services, async () =>
        services.oauthAuthorizeService.authorize({
          query: {
            ...baseQuery,
            prompt: 'select_account',
            account_selected: '1',
            account_selection_state: accountSelectionSession.id,
          },
          userSession: {
            sub: userSub,
            authenticated_at: 1_700_000_000,
          },
          rememberedAccounts: [
            {
              sub: userSub,
              authenticated_at: 1_700_000_000,
              last_used_at: 1_700_000_000,
            },
          ],
          accountSelectionSession,
        }),
      ),
    ).rejects.toThrow();
  });

  test('rejects manual login to a new account while an existing chooser state forbids adding accounts', async () => {
    const originalUserSub = await createTestUser(services);
    const newUserSub = await createTestUser(services);
    await grantBaseConsent(originalUserSub);
    await grantBaseConsent(newUserSub);
    const { state } = await createChooserState({
      userSub: originalUserSub,
      rememberedAccounts: [
        {
          sub: originalUserSub,
          authenticated_at: 1_700_000_000,
          last_used_at: 1_700_000_000,
        },
      ],
    });
    const accountSelectionSession = {
      ...state,
      allow_add_account: false,
    };

    await expect(
      withMikroContext(services, async () =>
        services.oauthAuthorizeService.authorize({
          query: {
            ...baseQuery,
            prompt: 'select_account',
          },
          userSession: {
            sub: newUserSub,
            authenticated_at: 1_700_000_100,
          },
          rememberedAccounts: [
            {
              sub: originalUserSub,
              authenticated_at: 1_700_000_000,
              last_used_at: 1_700_000_000,
            },
            {
              sub: newUserSub,
              authenticated_at: 1_700_000_100,
              last_used_at: 1_700_000_100,
            },
          ],
          accountSelectionSession,
        }),
      ),
    ).rejects.toThrow();
  });

  test('preserves account_selected when the selected account still needs consent', async () => {
    const userSub = await createTestUser(services);
    const { state: accountSelectionSession } = await createChooserState({
      userSub,
    });

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          prompt: 'select_account',
          reauthenticated: '1',
          account_selected: '1',
          account_selection_state: accountSelectionSession.id,
        },
        userSession: {
          sub: userSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: [
          {
            sub: userSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
        accountSelectionSession,
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/consent');
    expect(redirect.searchParams.get('prompt')).toBe('select_account');
    expect(redirect.searchParams.get('reauthenticated')).toBe('1');
    expect(redirect.searchParams.get('account_selected')).toBe('1');
    expect(redirect.searchParams.get('account_selection_state')).toBe(
      accountSelectionSession.id,
    );
  });

  test('requires login when login_hint selects a remembered account older than max_age', async () => {
    const activeSub = await createTestUser(services, {
      email: 'max-age-active@example.com',
    });
    const hintedSub = await createTestUser(services, {
      email: 'max-age-stale-selected@example.com',
    });
    await grantBaseConsent(hintedSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          login_hint: 'max-age-stale-selected@example.com',
          max_age: 300,
        },
        userSession: {
          sub: activeSub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
        rememberedAccounts: [
          {
            sub: activeSub,
            authenticated_at: Math.floor(Date.now() / 1000),
            last_used_at: Math.floor(Date.now() / 1000),
          },
          {
            sub: hintedSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
        ],
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('login_hint')).toBe(
      'max-age-stale-selected@example.com',
    );
    expect(redirect.searchParams.get('max_age')).toBe('300');
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  test('matches login_hint against remembered account email even when the session roster stores only subs', async () => {
    const activeSub = await createTestUser(services, {
      email: 'hint-active@example.com',
    });
    const hintedSub = await createTestUser(services, {
      email: 'hint-selected@example.com',
    });
    await grantBaseConsent(hintedSub);

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          login_hint: 'hint-selected@example.com',
        },
        userSession: {
          sub: activeSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: [
          {
            sub: activeSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
          {
            sub: hintedSub,
            authenticated_at: 1_700_000_100,
            last_used_at: 1_700_000_100,
          },
        ],
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    const code = redirect.searchParams.get('code');
    expect(code).not.toBeNull();
    const oauthCode = await withMikroContext(services, async () =>
      services.mikro.oauthCode.findOneOrFail({ user: hintedSub }),
    );
    expect(oauthCode.user.sub).toBe(hintedSub);
  });

  test('promotes the selected remembered account before redirecting to consent', async () => {
    const activeSub = await createTestUser(services, {
      email: 'consent-active@example.com',
    });
    const selectedSub = await createTestUser(services, {
      email: 'consent-selected@example.com',
    });
    const selected: string[] = [];

    const result = await withMikroContext(services, async () =>
      services.oauthAuthorizeService.authorize({
        query: {
          ...baseQuery,
          login_hint: 'consent-selected@example.com',
        },
        userSession: {
          sub: activeSub,
          authenticated_at: 1_700_000_000,
        },
        rememberedAccounts: [
          {
            sub: activeSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
          {
            sub: selectedSub,
            authenticated_at: 1_700_000_100,
            last_used_at: 1_700_000_100,
          },
        ],
        selectUserSession: (sub) => {
          selected.push(sub);
          return true;
        },
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.pathname).toBe('/consent');
    expect(selected).toEqual([selectedSub]);
  });

  test('returns account_selection_required for prompt=none when chooser would be required', async () => {
    const userSub = await createTestUser(services);
    await grantBaseConsent(userSub);

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
        rememberedAccounts: [
          {
            sub: userSub,
            authenticated_at: 1_700_000_000,
            last_used_at: 1_700_000_000,
          },
          {
            sub: 'other-user',
            authenticated_at: 1_700_000_100,
            last_used_at: 1_700_000_100,
          },
        ],
      }),
    );

    const redirect = new URL(result.url);
    expect(redirect.searchParams.get('error')).toBe(
      'account_selection_required',
    );
    expect(redirect.searchParams.get('state')).toBe(baseQuery.state);
    expect(redirect.searchParams.has('code')).toBe(false);
  });
});
