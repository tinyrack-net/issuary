import { describe, expect, test } from 'vitest';
import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { SessionAccount } from '../middleware/session.ts';
import { AccountSelectionService } from './account-selection.service.ts';

const BASE_CONFIG = {
  server: { public_origin: 'https://auth.example' },
  auth: {
    account_selection: {
      enabled: false,
      mode: 'oidc_prompt',
      remember_accounts: {
        enabled: true,
        max_accounts: 5,
        ttl: '30d',
      },
      allow_add_account: true,
      allow_remove_account: true,
      login_hint: {
        behavior: 'prefer',
      },
      prompt_none_error: 'account_selection_required',
    },
  },
  clients: [],
} as unknown as TinyAuthRuntimeConfig;

function createService(
  overrides: Partial<TinyAuthRuntimeConfig['auth']['account_selection']> = {},
  clients: TinyAuthRuntimeConfig['clients'] = [],
) {
  return new AccountSelectionService({
    ...BASE_CONFIG,
    auth: {
      ...BASE_CONFIG.auth,
      account_selection: {
        ...BASE_CONFIG.auth.account_selection,
        ...overrides,
        remember_accounts: {
          ...BASE_CONFIG.auth.account_selection.remember_accounts,
          ...overrides.remember_accounts,
        },
        login_hint: {
          ...BASE_CONFIG.auth.account_selection.login_hint,
          ...overrides.login_hint,
        },
      },
    },
    clients,
  } as TinyAuthRuntimeConfig);
}

const ACCOUNT_A: SessionAccount = {
  sub: 'user-a',
  authenticated_at: 1_700_000_000,
  last_used_at: 1_700_000_000,
};
const ACCOUNT_B: SessionAccount = {
  sub: 'user-b',
  authenticated_at: 1_700_000_100,
  last_used_at: 1_700_000_100,
};

describe('AccountSelectionService', () => {
  test('continues with the active account when account selection is disabled', () => {
    const service = createService({ enabled: false, mode: 'always' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'continue', selectedSub: ACCOUNT_A.sub });
  });

  test('requires chooser for prompt=select_account when enabled', () => {
    const service = createService({ enabled: true, mode: 'oidc_prompt' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A],
      }),
    ).toEqual({ type: 'show_chooser' });
  });

  test('smart mode shows chooser only when multiple remembered accounts exist', () => {
    const service = createService({ enabled: true, mode: 'smart' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: [],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A],
      }),
    ).toEqual({ type: 'continue', selectedSub: ACCOUNT_A.sub });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: [],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'show_chooser' });
  });

  test('always mode shows chooser even with a single remembered account', () => {
    const service = createService({ enabled: true, mode: 'always' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: [],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A],
      }),
    ).toEqual({ type: 'show_chooser' });
  });

  test('client override never suppresses a global chooser requirement', () => {
    const service = createService({ enabled: true, mode: 'smart' }, [
      {
        id: 'client-config-id',
        name: 'Client',
        client_id: 'client-id',
        redirect_uris: ['https://client.example/callback'],
        response_types: ['code'],
        grant_types: ['authorization_code'],
        scope: 'openid',
        account_selection: { mode: 'never' },
      },
    ] as TinyAuthRuntimeConfig['clients']);

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'continue', selectedSub: ACCOUNT_A.sub });
  });

  test('continues after an account has already been selected for this authorize request', () => {
    const service = createService({ enabled: true, mode: 'smart' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        accountSelected: true,
        activeUserSub: ACCOUNT_B.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'continue', selectedSub: ACCOUNT_B.sub });
  });

  test('prompt=none returns OAuth error instead of showing account-selection UI', () => {
    const service = createService({
      enabled: true,
      mode: 'always',
      prompt_none_error: 'login_required',
    });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['none'],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({
      type: 'oauth_error',
      error: 'login_required',
      errorDescription:
        'The Authorization Server requires End-User account selection.',
    });
  });

  test('prompt=login and max_age=0 request reauthentication instead of chooser completion', () => {
    const service = createService({ enabled: true, mode: 'always' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['login'],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'reauthenticate' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: [],
        maxAge: 0,
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'reauthenticate' });
  });

  test('prompt=select_account still shows chooser even when login_hint matches a remembered account', () => {
    const service = createService({
      enabled: true,
      mode: 'oidc_prompt',
      login_hint: { behavior: 'prefer' },
    });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        loginHint: 'user-b@example.com',
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [
          { ...ACCOUNT_A, email: 'user-a@example.com' },
          { ...ACCOUNT_B, email: 'user-b@example.com' },
        ],
      }),
    ).toEqual({ type: 'show_chooser' });
  });

  test('login_hint prefer chooses a matching active account without chooser in oidc_prompt mode', () => {
    const service = createService({
      enabled: true,
      mode: 'oidc_prompt',
      login_hint: { behavior: 'prefer' },
    });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: [],
        loginHint: 'user-b@example.com',
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [
          { ...ACCOUNT_A, email: 'user-a@example.com' },
          { ...ACCOUNT_B, email: 'user-b@example.com' },
        ],
      }),
    ).toEqual({ type: 'continue', selectedSub: ACCOUNT_B.sub });
  });

  test('login_hint require_match returns account_selection_required when no remembered account matches prompt=none', () => {
    const service = createService({
      enabled: true,
      mode: 'oidc_prompt',
      login_hint: { behavior: 'require_match' },
    });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['none'],
        loginHint: 'missing@example.com',
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [{ ...ACCOUNT_A, email: 'user-a@example.com' }],
      }),
    ).toEqual({
      type: 'oauth_error',
      error: 'account_selection_required',
      errorDescription:
        'The Authorization Server requires End-User account selection.',
    });
  });
});
