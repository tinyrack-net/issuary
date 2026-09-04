import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AccountsResponse } from '#frontend/queries/accounts.ts';
import { queryKeys } from '#frontend/queries/keys.ts';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonResponses,
  mockPendingResponse,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  appConfigQueryData,
  defineRouteScreen,
  renderRoute,
  routeTestAppConfig,
} from '#frontend/test-utils/route-test-utils.tsx';
import * as RouteModule from './route.tsx';

const routeDefinition = defineRouteScreen('auth', RouteModule);

import source from './route.tsx?raw';

const selectSearch =
  'client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid+profile&state=state-123&nonce=nonce-123&code_challenge=challenge-123&code_challenge_method=S256&prompt=select_account&login_hint=alice%40example.com&response_mode=form_post&account_selection_state=chooser-state-123';
const selectLocation = `/account/select?${selectSearch}`;

const accountData: AccountsResponse = {
  active_sub: 'user-b',
  allow_add_account: true,
  allow_remove_account: true,
  accounts: [
    {
      sub: 'user-a',
      email: 'alice@example.com',
      role: 'admin',
      current: false,
      authenticated_at: 1_700_000_000,
      last_used_at: 1_700_000_010,
    },
    {
      sub: 'user-b',
      email: 'bob@example.com',
      role: 'user',
      current: true,
      authenticated_at: 1_700_000_100,
      last_used_at: 1_700_000_110,
    },
  ],
};

function seededQueryData(data = accountData) {
  return [
    appConfigQueryData(routeTestAppConfig),
    {
      queryKey: queryKeys.accounts('client-web'),
      data,
    },
  ];
}

afterEach(() => {
  resetFetchMock();
});

describe('/account/select', () => {
  test('uses i18n for account-selection unavailable text', () => {
    expect(source).toContain("t('accountSelect.unavailable')");
    expect(source).not.toContain('Account selection is unavailable');
  });

  test('shows unavailable state when adding accounts is disabled and no accounts are available', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: selectLocation,
      queryData: seededQueryData({
        ...accountData,
        active_sub: null,
        allow_add_account: false,
        allow_remove_account: false,
        accounts: [],
      }),
    });

    await expect
      .element(screen.getByText('Account selection is unavailable'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: /Use another account/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByTestId('account-list'))
      .not.toBeInTheDocument();
  });

  test('lists remembered accounts and preserves OAuth params for add-account login', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: selectLocation,
      queryData: seededQueryData(),
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Choose an account' }))
      .toBeVisible();
    await expect.element(screen.getByText('alice@example.com')).toBeVisible();
    await expect.element(screen.getByText('bob@example.com')).toBeVisible();
    await expect.element(screen.getByText('Current account')).toBeVisible();

    const currentAccountCard = screen
      .getByTestId('remembered-account-user-b')
      .element()
      .querySelector('.tr-card');
    const rememberedAccountCard = screen
      .getByTestId('remembered-account-user-a')
      .element()
      .querySelector('.tr-card');
    expect(currentAccountCard).not.toBeNull();
    expect(rememberedAccountCard).not.toBeNull();
    expect(
      currentAccountCard?.contains(
        screen.getByText('Current', { exact: true }).element(),
      ),
    ).toBe(true);
    expect(
      rememberedAccountCard?.contains(
        screen.getByTestId('remove-account-user-a').element(),
      ),
    ).toBe(true);
    await expect
      .element(screen.getByTestId('remove-account-user-b'))
      .not.toBeInTheDocument();

    const addAccountLink = screen
      .getByRole('link', { name: /Use another account/ })
      .element();
    expect(addAccountLink).toHaveAttribute('data-appearance', 'ghost');
    const href = addAccountLink.getAttribute('href') ?? '';
    expect(href).toContain('/login?');
    expect(href).toContain('client_id=client-web');
    expect(href).toContain('prompt=select_account+login');
    expect(href).toContain('login_hint=alice%40example.com');
    expect(href).toContain('response_mode=form_post');
    expect(href).toContain('account_selected=1');
    expect(href).toContain('account_selection_state=chooser-state-123');
  });

  test('loads remembered accounts with the OAuth client_id so client overrides apply', async () => {
    const fetchMock = mockJsonResponses({
      body: accountData,
      method: 'GET',
      url: '/api/auth/accounts?client_id=client-web',
    });

    await renderRoute(routeDefinition, {
      initialLocation: selectLocation,
      queryData: [appConfigQueryData(routeTestAppConfig)],
    });

    await vi.waitFor(() => {
      expect(firstRequest(fetchMock.requests).url).toBe(
        '/api/auth/accounts?client_id=client-web',
      );
    });
  });

  test('selects a remembered account and resumes authorize with account_selected=1', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: selectLocation,
      queryData: seededQueryData(),
    });
    const fetchMock = mockPendingResponse();

    await screen.getByTestId('select-account-user-a').click();

    await vi.waitFor(() => {
      const request = firstRequest(fetchMock.requests);
      expect(request.url).toBe('/api/auth/accounts/select');
      expect(request.method).toBe('POST');
      expect(jsonRequestBody(request)).toEqual({ sub: 'user-a' });
    });
  });

  test('keeps roster visible but hides add-account action when adding accounts is disabled', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: selectLocation,
      queryData: seededQueryData({
        ...accountData,
        allow_add_account: false,
      }),
    });

    await expect.element(screen.getByTestId('account-list')).toBeVisible();
    await expect.element(screen.getByText('alice@example.com')).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: /Use another account/ }))
      .not.toBeInTheDocument();
  });

  test('hides remove controls when account removal is disabled', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: selectLocation,
      queryData: seededQueryData({
        ...accountData,
        allow_remove_account: false,
      }),
    });

    await expect.element(screen.getByText('alice@example.com')).toBeVisible();
    await expect
      .element(screen.getByTestId('remove-account-user-a'))
      .not.toBeInTheDocument();
  });

  test('removes a non-current remembered account and refreshes the account list', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: selectLocation,
      queryData: seededQueryData(),
    });
    const fetchMock = mockJsonResponses(
      { body: { ok: true }, method: 'POST', url: '/api/auth/accounts/remove' },
      {
        body: {
          ...accountData,
          accounts: [accountData.accounts[1]],
        },
        method: 'GET',
        url: '/api/auth/accounts?client_id=client-web',
      },
    );

    await screen.getByTestId('remove-account-user-a').click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(1);
      expect(jsonRequestBody(firstRequest(fetchMock.requests))).toEqual({
        sub: 'user-a',
      });
      expect(
        fetchMock.requests.some(
          (request) => request.url === '/api/auth/accounts/select',
        ),
      ).toBe(false);
    });
  });
});
