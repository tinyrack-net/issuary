import { describe, expect, test } from 'vitest';
import type { IssuaryRuntimeConfig } from '../lib/config/index.ts';
import type { SessionAccount } from '../middleware/session.ts';
import {
  type AccountSelectionDecision,
  AccountSelectionService,
} from './account-selection.service.ts';

type DecideParams = Parameters<AccountSelectionService['decide']>[0];
type PromptList = DecideParams['prompts'];
type ConfigMode = IssuaryRuntimeConfig['auth']['account_selection']['mode'];
type MatrixMode = ConfigMode | 'client-never';

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
} as unknown as IssuaryRuntimeConfig;

function createService(
  overrides: Partial<IssuaryRuntimeConfig['auth']['account_selection']> = {},
  clients: IssuaryRuntimeConfig['clients'] = [],
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
  } as IssuaryRuntimeConfig);
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

const NO_PROMPTS: PromptList = [];
const PROMPT_NONE: PromptList = ['none'];
const PROMPT_LOGIN: PromptList = ['login'];
const PROMPT_SELECT_ACCOUNT: PromptList = ['select_account'];

function rememberedAccounts(count: 0 | 1 | 2): SessionAccount[] {
  if (count === 0) {
    return [];
  }
  if (count === 1) {
    return [ACCOUNT_A];
  }
  return [ACCOUNT_A, ACCOUNT_B];
}

function createMatrixService(mode: MatrixMode) {
  if (mode === 'client-never') {
    const clients: IssuaryRuntimeConfig['clients'] = [
      {
        id: 'client-config-id',
        name: 'Client',
        client_id: 'client-id',
        redirect_uris: ['https://client.example/callback'],
        post_logout_redirect_uris: [],
        web_origins: [],
        response_types: ['code'],
        grant_types: ['authorization_code'],
        scope: 'openid',
        skip_consent: false,
        account_selection: { mode: 'never' },
      },
    ];
    return createService({ enabled: true, mode: 'smart' }, clients);
  }

  return createService({ enabled: mode !== 'disabled', mode });
}

interface MatrixRow {
  name: string;
  mode: MatrixMode;
  accountCount: 0 | 1 | 2;
  activeUserSub?: string | undefined;
  prompts: PromptList;
  expected: AccountSelectionDecision;
}

const MATRIX_MODES: MatrixMode[] = [
  'disabled',
  'oidc_prompt',
  'smart',
  'always',
  'client-never',
];
const MATRIX_ACCOUNT_COUNTS: Array<0 | 1 | 2> = [0, 1, 2];
const MATRIX_PROMPT_CASES: Array<{ label: string; prompts: PromptList }> = [
  { label: 'prompt absent', prompts: NO_PROMPTS },
  { label: 'prompt=none', prompts: PROMPT_NONE },
  { label: 'prompt=login', prompts: PROMPT_LOGIN },
  { label: 'prompt=select_account', prompts: PROMPT_SELECT_ACCOUNT },
];

function expectedMatrixDecision(
  mode: MatrixMode,
  accountCount: 0 | 1 | 2,
  prompts: PromptList,
): AccountSelectionDecision {
  if (prompts.includes('login')) {
    return { type: 'reauthenticate' };
  }

  if (mode === 'disabled' || mode === 'client-never') {
    if (prompts.includes('select_account')) {
      return prompts.includes('none')
        ? {
            type: 'oauth_error',
            error: 'account_selection_required',
            errorDescription:
              'The Authorization Server requires End-User account selection.',
          }
        : { type: 'reauthenticate' };
    }
    return { type: 'continue', selectedSub: ACCOUNT_A.sub };
  }

  const chooserRequired =
    prompts.includes('select_account') ||
    (mode === 'always' && accountCount > 0) ||
    (mode === 'smart' && accountCount === 2);

  if (!chooserRequired) {
    return { type: 'continue', selectedSub: ACCOUNT_A.sub };
  }

  if (prompts.includes('none')) {
    return {
      type: 'oauth_error',
      error: 'account_selection_required',
      errorDescription:
        'The Authorization Server requires End-User account selection.',
    };
  }

  return { type: 'show_chooser' };
}

const COMPLETE_ACCOUNT_SELECTION_MATRIX: MatrixRow[] = MATRIX_MODES.flatMap(
  (mode) =>
    MATRIX_ACCOUNT_COUNTS.flatMap((accountCount) =>
      MATRIX_PROMPT_CASES.map((promptCase) => ({
        name: `${mode} + active + ${accountCount} remembered account(s) + ${promptCase.label}`,
        mode,
        accountCount,
        activeUserSub: ACCOUNT_A.sub,
        prompts: promptCase.prompts,
        expected: expectedMatrixDecision(
          mode,
          accountCount,
          promptCase.prompts,
        ),
      })),
    ),
);

const ACCOUNT_SELECTION_MATRIX: MatrixRow[] = [
  {
    name: 'disabled + active + zero accounts + prompt absent continues active',
    mode: 'disabled',
    accountCount: 0,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'disabled + active + one account + prompt=select_account reauthenticates',
    mode: 'disabled',
    accountCount: 1,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_SELECT_ACCOUNT,
    expected: { type: 'reauthenticate' },
  },
  {
    name: 'disabled + active + two accounts + prompt=none continues active',
    mode: 'disabled',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_NONE,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'disabled + no active + remembered roster + prompt absent reauthenticates',
    mode: 'disabled',
    accountCount: 2,
    prompts: NO_PROMPTS,
    expected: { type: 'reauthenticate' },
  },
  {
    name: 'oidc_prompt + active + zero accounts + prompt=select_account shows chooser without selecting a fabricated account',
    mode: 'oidc_prompt',
    accountCount: 0,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_SELECT_ACCOUNT,
    expected: { type: 'show_chooser' },
  },
  {
    name: 'oidc_prompt + active + one account + prompt absent continues active',
    mode: 'oidc_prompt',
    accountCount: 1,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'oidc_prompt + active + two accounts + prompt=none continues active',
    mode: 'oidc_prompt',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_NONE,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'oidc_prompt + active + two accounts + prompt=login reauthenticates',
    mode: 'oidc_prompt',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_LOGIN,
    expected: { type: 'reauthenticate' },
  },
  {
    name: 'smart + active + zero accounts + prompt absent continues active',
    mode: 'smart',
    accountCount: 0,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'smart + active + one account + prompt absent continues active',
    mode: 'smart',
    accountCount: 1,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'smart + active + two accounts + prompt absent shows chooser',
    mode: 'smart',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'show_chooser' },
  },
  {
    name: 'smart + active + two accounts + prompt=none returns noninteractive account-selection error',
    mode: 'smart',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_NONE,
    expected: {
      type: 'oauth_error',
      error: 'account_selection_required',
      errorDescription:
        'The Authorization Server requires End-User account selection.',
    },
  },
  {
    name: 'smart + no active + remembered roster + prompt=none returns login_required',
    mode: 'smart',
    accountCount: 2,
    prompts: PROMPT_NONE,
    expected: {
      type: 'oauth_error',
      error: 'login_required',
      errorDescription:
        'The Authorization Server requires End-User authentication.',
    },
  },
  {
    name: 'smart + no active + remembered roster + prompt absent reauthenticates',
    mode: 'smart',
    accountCount: 2,
    prompts: NO_PROMPTS,
    expected: { type: 'reauthenticate' },
  },
  {
    name: 'always + active + zero accounts + prompt absent continues active',
    mode: 'always',
    accountCount: 0,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'always + active + one account + prompt absent shows chooser',
    mode: 'always',
    accountCount: 1,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'show_chooser' },
  },
  {
    name: 'always + active + two accounts + prompt=none returns account-selection error',
    mode: 'always',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_NONE,
    expected: {
      type: 'oauth_error',
      error: 'account_selection_required',
      errorDescription:
        'The Authorization Server requires End-User account selection.',
    },
  },
  {
    name: 'always + no active + remembered roster + prompt absent reauthenticates',
    mode: 'always',
    accountCount: 2,
    prompts: NO_PROMPTS,
    expected: { type: 'reauthenticate' },
  },
  {
    name: 'client override never + active + two accounts + prompt absent continues active',
    mode: 'client-never',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: NO_PROMPTS,
    expected: { type: 'continue', selectedSub: ACCOUNT_A.sub },
  },
  {
    name: 'client override never + active + two accounts + prompt=select_account reauthenticates',
    mode: 'client-never',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_SELECT_ACCOUNT,
    expected: { type: 'reauthenticate' },
  },
  {
    name: 'client override never + active + two accounts + prompt=login reauthenticates',
    mode: 'client-never',
    accountCount: 2,
    activeUserSub: ACCOUNT_A.sub,
    prompts: PROMPT_LOGIN,
    expected: { type: 'reauthenticate' },
  },
];

describe('AccountSelectionService', () => {
  test.each(COMPLETE_ACCOUNT_SELECTION_MATRIX)('$name', (row) => {
    const service = createMatrixService(row.mode);

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: row.prompts,
        activeUserSub: row.activeUserSub,
        rememberedAccounts: rememberedAccounts(row.accountCount),
      }),
    ).toEqual(row.expected);
  });

  test.each(ACCOUNT_SELECTION_MATRIX)('$name', (row) => {
    const service = createMatrixService(row.mode);

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: row.prompts,
        activeUserSub: row.activeUserSub,
        rememberedAccounts: rememberedAccounts(row.accountCount),
      }),
    ).toEqual(row.expected);
  });

  test('requires reauthentication for prompt=select_account when account selection is disabled', () => {
    const service = createService({ enabled: false, mode: 'always' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'reauthenticate' });
  });

  test('continues after fresh reauthentication for prompt=select_account when account selection is disabled', () => {
    const service = createService({ enabled: false, mode: 'always' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        freshReauthentication: true,
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A],
      }),
    ).toEqual({ type: 'continue', selectedSub: ACCOUNT_A.sub });
  });

  test('returns configured OAuth error for prompt=none select_account when account selection is disabled', () => {
    const service = createService({
      enabled: false,
      mode: 'always',
      prompt_none_error: 'login_required',
    });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['none', 'select_account'],
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

  test('fresh prompt=login reauthentication still honors prompt=select_account', () => {
    const service = createService({ enabled: true, mode: 'always' });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['login', 'select_account'],
        freshReauthentication: true,
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A],
      }),
    ).toEqual({ type: 'show_chooser' });
  });

  test('client override never silently continues for prompt=select_account', () => {
    const service = createService({ enabled: true, mode: 'smart' }, [
      {
        id: 'client-config-id',
        name: 'Client',
        client_id: 'client-id',
        redirect_uris: ['https://client.example/callback'],
        post_logout_redirect_uris: [],
        web_origins: [],
        response_types: ['code'],
        grant_types: ['authorization_code'],
        scope: 'openid',
        skip_consent: false,
        account_selection: { mode: 'never' },
      },
    ] as IssuaryRuntimeConfig['clients']);

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: ['select_account'],
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [ACCOUNT_A, ACCOUNT_B],
      }),
    ).toEqual({ type: 'reauthenticate' });
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

  test('login_hint prefer matching the active account bypasses smart-mode chooser', () => {
    const service = createService({
      enabled: true,
      mode: 'smart',
      login_hint: { behavior: 'prefer' },
    });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: [],
        loginHint: 'user-a@example.com',
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [
          { ...ACCOUNT_A, email: 'user-a@example.com' },
          { ...ACCOUNT_B, email: 'user-b@example.com' },
        ],
      }),
    ).toEqual({ type: 'continue', selectedSub: ACCOUNT_A.sub });
  });

  test('login_hint prefer matching a remembered non-active account selects the hinted account', () => {
    const service = createService({
      enabled: true,
      mode: 'smart',
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

  test('login_hint prefer chooses a matching remembered account without chooser in oidc_prompt mode', () => {
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

  test('login_hint require_match with an unknown interactive hint shows chooser', () => {
    const service = createService({
      enabled: true,
      mode: 'oidc_prompt',
      login_hint: { behavior: 'require_match' },
    });

    expect(
      service.decide({
        clientId: 'client-id',
        prompts: [],
        loginHint: 'missing@example.com',
        activeUserSub: ACCOUNT_A.sub,
        rememberedAccounts: [{ ...ACCOUNT_A, email: 'user-a@example.com' }],
      }),
    ).toEqual({ type: 'show_chooser' });
  });
});
