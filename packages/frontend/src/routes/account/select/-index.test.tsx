import { afterEach, describe, expect, test, vi } from 'vitest';
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
  renderRoute,
  routeTestAppConfig,
} from '#frontend/test-utils/route-test-utils.tsx';

const selectSearch =
  'client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid+profile&state=state-123&nonce=nonce-123&code_challenge=challenge-123&code_challenge_method=S256&prompt=select_account&login_hint=alice%40example.com&response_mode=form_post&account_selection_state=chooser-state-123';
const selectLocation = `/account/select?${selectSearch}`;

const accountData = {
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
  test('lists remembered accounts and preserves OAuth params for add-account login', async () => {
    const { screen } = await renderRoute({
      initialLocation: selectLocation,
      queryData: seededQueryData(),
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Choose an account' }))
      .toBeVisible();
    await expect.element(screen.getByText('alice@example.com')).toBeVisible();
    await expect.element(screen.getByText('bob@example.com')).toBeVisible();
    await expect.element(screen.getByText('Current account')).toBeVisible();

    const addAccountLink = screen
      .getByRole('link', { name: /Use another account/ })
      .element();
    const href = addAccountLink.getAttribute('href') ?? '';
    expect(href).toContain('/login?');
    expect(href).toContain('client_id=client-web');
    expect(href).toContain('prompt=select_account');
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

    await renderRoute({
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
    const { screen } = await renderRoute({
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

  test('removes a non-current remembered account and refreshes the account list', async () => {
    const { screen } = await renderRoute({
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
    });
  });
});
