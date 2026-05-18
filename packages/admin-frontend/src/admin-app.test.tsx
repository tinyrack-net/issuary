import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import {
  jsonRequestBody,
  mockJsonResponses,
  resetFetchMock,
} from '#admin/test-utils/query-test-utils.js';
import { renderAdminRoute } from '#admin/test-utils/route-test-utils.js';

const adminSession = {
  is_admin: true,
  user: {
    sub: 'admin-1',
    email: 'admin@example.com',
    email_verified: true,
    role: 'admin',
    managed_by: 'database',
  },
};

const databaseProvider = {
  id: 'database-google',
  type: 'google',
  issuer: 'https://accounts.google.com',
  display_name: 'Database Google',
  icon_url: null,
  client_id: 'database-google-client',
  has_client_secret: true,
  scopes: ['openid', 'email', 'profile'],
  authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_url: 'https://oauth2.googleapis.com/token',
  userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
  jwks_url: null,
  email_url: null,
  response_mode: 'query',
  email_conflict_strategy: 'auto_link',
  userinfo_mapping: {
    id: 'sub',
    email: 'email',
    email_verified: 'email_verified',
    name: 'name',
    picture: 'picture',
  },
  enabled: true,
  managed_by: 'database',
  created_at: '2026-05-18T00:00:00.000Z',
  updated_at: '2026-05-18T00:00:00.000Z',
};

const configProvider = {
  ...databaseProvider,
  id: 'config-google',
  display_name: 'Config Google',
  managed_by: 'config',
  created_at: '1970-01-01T00:00:00.000Z',
  updated_at: '1970-01-01T00:00:00.000Z',
};

afterEach(async () => {
  await page.viewport(1024, 768);
  resetFetchMock();
});

describe('admin route guard', () => {
  test('renders login required for unauthenticated sessions', async () => {
    mockJsonResponses({
      url: '/admin/api/session',
      method: 'GET',
      init: { status: 401 },
      body: { code: 'unauthorized', message: 'Login required' },
    });

    const { screen } = await renderAdminRoute();

    await expect
      .element(screen.getByRole('heading', { name: 'Login required' }))
      .toBeVisible();
    await expect
      .element(screen.getByText('Sign in with an admin account to continue.'))
      .toBeVisible();
  });

  test('renders access denied for non-admin sessions', async () => {
    mockJsonResponses({
      url: '/admin/api/session',
      method: 'GET',
      init: { status: 403 },
      body: { code: 'forbidden', message: 'Access denied' },
    });

    const { screen } = await renderAdminRoute();

    await expect
      .element(screen.getByRole('heading', { name: 'Access denied' }))
      .toBeVisible();
    await expect
      .element(screen.getByText('Your account does not have admin access.'))
      .toBeVisible();
  });
});

describe('admin routes', () => {
  test('renders the dashboard for an admin session', async () => {
    mockJsonResponses({
      url: '/admin/api/session',
      method: 'GET',
      body: adminSession,
    });

    const { screen } = await renderAdminRoute();

    await expect
      .element(screen.getByRole('heading', { name: 'Admin dashboard' }))
      .toBeVisible();
    await expect
      .element(
        screen
          .getByRole('main', { name: 'Admin content' })
          .getByText('admin@example.com'),
      )
      .toBeVisible();
  });

  test('does not show removed events navigation', async () => {
    mockJsonResponses({
      url: '/admin/api/session',
      method: 'GET',
      body: adminSession,
    });

    const { screen } = await renderAdminRoute();

    await expect
      .element(screen.getByRole('heading', { name: 'Admin dashboard' }))
      .toBeVisible();

    expect(document.body.textContent).not.toContain('Audit events');
  });

  test('renders a responsive drawer navigation shell', async () => {
    await page.viewport(390, 844);

    mockJsonResponses({
      url: '/admin/api/session',
      method: 'GET',
      body: adminSession,
    });

    const { screen } = await renderAdminRoute();

    await expect
      .element(screen.getByRole('heading', { name: 'Admin dashboard' }))
      .toBeVisible();
    expect(
      document.querySelector('[aria-label="Open admin navigation"]'),
    ).not.toBeNull();
    await screen.getByLabelText('Open admin navigation').click();
    await expect
      .element(screen.getByRole('navigation', { name: 'Admin navigation' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Dashboard' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Users' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'OAuth providers' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'OAuth clients' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('main', { name: 'Admin content' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('banner').getByText('admin@example.com'))
      .toBeVisible();
    expect(document.body.textContent).not.toContain('Audit events');
  });

  test('drawer toggle exposes mobile control state at a narrow viewport', async () => {
    await page.viewport(390, 844);
    mockJsonResponses({
      url: '/admin/api/session',
      method: 'GET',
      body: adminSession,
    });

    const { screen } = await renderAdminRoute();

    await expect
      .element(screen.getByRole('heading', { name: 'Admin dashboard' }))
      .toBeVisible();
    const openNavigation = screen.getByRole('button', {
      name: 'Open admin navigation',
    });

    await expect
      .element(openNavigation)
      .toHaveAttribute('aria-controls', 'admin-drawer');
    await expect
      .element(openNavigation)
      .toHaveAttribute('aria-expanded', 'false');

    await openNavigation.click();

    await expect
      .element(openNavigation)
      .toHaveAttribute('aria-expanded', 'true');
  });

  test('marks the current route as the active drawer menu item', async () => {
    mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/users?limit=20&offset=0',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/users',
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Users' }))
      .toBeVisible();

    const usersLink = Array.from(document.querySelectorAll('a')).find(
      (link) => link.textContent === 'Users',
    );

    expect(usersLink?.className).toContain('active');
    expect(usersLink?.getAttribute('aria-current')).toBe('page');
  });

  test('users page renders a paginated table from URL search params', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/users?limit=2&offset=2&search=alice',
        method: 'GET',
        body: {
          items: [
            {
              sub: 'user-1',
              email: 'alice@example.com',
              email_verified: true,
              role: 'user',
              managed_by: 'database',
              created_at: '2026-05-01T10:00:00.000Z',
              updated_at: '2026-05-02T10:00:00.000Z',
            },
            {
              sub: 'user-2',
              email: 'alice.admin@example.com',
              email_verified: false,
              role: 'admin',
              managed_by: 'database',
              created_at: '2026-05-03T10:00:00.000Z',
              updated_at: '2026-05-04T10:00:00.000Z',
            },
          ],
          pagination: { limit: 2, offset: 2, total: 5 },
        },
      },
      {
        url: '/admin/api/users?limit=2&offset=0&search=alice',
        method: 'GET',
        body: {
          items: [],
          pagination: { limit: 2, offset: 0, total: 5 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/users?limit=2&offset=2&search=alice',
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Users' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('table', { name: 'Users table' }))
      .toBeVisible();
    await expect.element(screen.getByText('alice@example.com')).toBeVisible();
    await expect
      .element(screen.getByRole('columnheader', { name: 'Created' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('columnheader', { name: 'Updated' }))
      .toBeVisible();
    await expect
      .element(screen.getByText('Page 2 of 3 · 5 total'))
      .toBeVisible();

    await screen.getByRole('button', { name: 'Previous page' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.at(-1)?.url).toBe(
        '/admin/api/users?limit=2&offset=0&search=alice',
      );
    });
    fetchMock.assertAllResponsesConsumed();
  });

  test('users page disables protected role change actions', async () => {
    mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/users?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [
            {
              sub: 'admin-1',
              email: 'admin@example.com',
              email_verified: true,
              role: 'admin',
              managed_by: 'database',
            },
            {
              sub: 'config-admin',
              email: 'config-admin@example.com',
              email_verified: true,
              role: 'admin',
              managed_by: 'config',
            },
          ],
          pagination: { limit: 20, offset: 0, total: 2 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/users',
    });

    await expect
      .element(
        screen
          .getByRole('table', { name: 'Users table' })
          .getByText('admin@example.com', { exact: true }),
      )
      .toBeVisible();
    await expect
      .element(
        screen.getByRole('button', { name: 'Make user for admin@example.com' }),
      )
      .toBeDisabled();
    await expect
      .element(
        screen.getByRole('button', {
          name: 'Make user for config-admin@example.com',
        }),
      )
      .toBeDisabled();
  });

  test('users page can request a safe role update', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/users?limit=2&offset=2&search=promote',
        method: 'GET',
        body: {
          items: [
            {
              sub: 'user-1',
              email: 'promote@example.com',
              email_verified: true,
              role: 'user',
              managed_by: 'database',
            },
          ],
          pagination: { limit: 2, offset: 2, total: 3 },
        },
      },
      {
        url: '/admin/api/users/user-1',
        method: 'PATCH',
        body: {
          user: {
            sub: 'user-1',
            email: 'promote@example.com',
            email_verified: true,
            role: 'admin',
            managed_by: 'database',
          },
        },
      },
      {
        url: '/admin/api/users?limit=2&offset=2&search=promote',
        method: 'GET',
        body: {
          items: [
            {
              sub: 'user-1',
              email: 'promote@example.com',
              email_verified: true,
              role: 'admin',
              managed_by: 'database',
            },
          ],
          pagination: { limit: 2, offset: 2, total: 3 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/users?limit=2&offset=2&search=promote',
    });

    await expect.element(screen.getByText('promote@example.com')).toBeVisible();
    await screen.getByRole('button', { name: 'Make admin' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
    });
    const request = fetchMock.requests[2];
    expect(request).toEqual(
      expect.objectContaining({
        url: '/admin/api/users/user-1',
        method: 'PATCH',
      }),
    );
    expect(jsonRequestBody(request)).toEqual({ role: 'admin' });
  });

  test('users page can update email verification and refresh the current page', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/users?limit=2&offset=2&search=verify',
        method: 'GET',
        body: {
          items: [
            {
              sub: 'user-1',
              email: 'verify@example.com',
              email_verified: false,
              role: 'user',
              managed_by: 'database',
            },
          ],
          pagination: { limit: 2, offset: 2, total: 3 },
        },
      },
      {
        url: '/admin/api/users/user-1',
        method: 'PATCH',
        body: {
          user: {
            sub: 'user-1',
            email: 'verify@example.com',
            email_verified: true,
            role: 'user',
            managed_by: 'database',
          },
        },
      },
      {
        url: '/admin/api/users?limit=2&offset=2&search=verify',
        method: 'GET',
        body: {
          items: [
            {
              sub: 'user-1',
              email: 'verify@example.com',
              email_verified: true,
              role: 'user',
              managed_by: 'database',
            },
          ],
          pagination: { limit: 2, offset: 2, total: 3 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/users?limit=2&offset=2&search=verify',
    });

    await expect.element(screen.getByText('verify@example.com')).toBeVisible();
    await screen
      .getByRole('checkbox', {
        name: 'Email verification for verify@example.com',
      })
      .click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
    });
    const request = fetchMock.requests[2];
    expect(request).toEqual(
      expect.objectContaining({
        url: '/admin/api/users/user-1',
        method: 'PATCH',
      }),
    );
    expect(jsonRequestBody(request)).toEqual({ email_verified: true });

    await vi.waitFor(() => {
      expect(fetchMock.requests.at(-1)?.url).toBe(
        '/admin/api/users?limit=2&offset=2&search=verify',
      );
    });
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth providers route renders a paginated provider table', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-providers?limit=2&offset=2&search=google',
        method: 'GET',
        body: {
          items: [databaseProvider, configProvider],
          pagination: { limit: 2, offset: 2, total: 5 },
        },
      },
      {
        url: '/admin/api/oauth-providers?limit=2&offset=0&search=google',
        method: 'GET',
        body: {
          items: [],
          pagination: { limit: 2, offset: 0, total: 5 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-providers?limit=2&offset=2&search=google',
    });

    await expect
      .element(screen.getByRole('heading', { name: 'OAuth providers' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('table', { name: 'OAuth providers table' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Edit Database Google' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Edit Config Google' }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/Page 2 of 3.*5 total/))
      .toBeVisible();
    expect(document.body.textContent).not.toContain('client_secret');
    expect(document.body.textContent).not.toContain('ciphertext');

    await screen.getByRole('button', { name: 'Previous page' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.at(-1)?.url).toBe(
        '/admin/api/oauth-providers?limit=2&offset=0&search=google',
      );
    });
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth providers page validates required create fields and submits provider secrets write-only', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-providers?limit=20&offset=0',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
      {
        url: '/admin/api/oauth-providers',
        method: 'POST',
        body: { oauth_provider: databaseProvider },
      },
      {
        url: '/admin/api/oauth-providers?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [databaseProvider],
          pagination: { limit: 20, offset: 0, total: 1 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-providers',
    });

    await screen.getByRole('button', { name: 'Add provider' }).click();
    await screen.getByRole('button', { name: 'Create provider' }).click();
    expect(fetchMock.requests).toHaveLength(2);

    await screen.getByLabelText('Provider ID').fill('database-google');
    await screen.getByLabelText('Display name').fill('Database Google');
    await screen.getByLabelText('Client ID').fill('database-google-client');
    await screen.getByLabelText('Client secret').fill('provider-secret');
    await screen.getByLabelText('Scopes').fill('openid email profile');
    await screen
      .getByLabelText('Authorization URL')
      .fill('https://accounts.google.com/o/oauth2/v2/auth');
    await screen
      .getByLabelText('Token URL')
      .fill('https://oauth2.googleapis.com/token');
    await screen
      .getByLabelText('Userinfo URL')
      .fill('https://openidconnect.googleapis.com/v1/userinfo');
    await screen.getByRole('button', { name: 'Create provider' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
    });
    const request = fetchMock.requests[2];
    expect(request).toEqual(
      expect.objectContaining({
        url: '/admin/api/oauth-providers',
        method: 'POST',
      }),
    );
    expect(jsonRequestBody(request)).toEqual({
      id: 'database-google',
      type: 'generic_oauth',
      issuer: null,
      display_name: 'Database Google',
      icon_url: null,
      client_id: 'database-google-client',
      client_secret: 'provider-secret',
      scopes: ['openid', 'email', 'profile'],
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwks_url: null,
      email_url: null,
      response_mode: 'query',
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: { id: 'sub', email: 'email' },
      enabled: true,
    });
    await vi.waitFor(() => {
      expect(fetchMock.requests.at(-1)?.url).toBe(
        '/admin/api/oauth-providers?limit=20&offset=0',
      );
    });
    expect(document.body.textContent).not.toContain('provider-secret');
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth provider modal has accessible dialog, close, and toggle names', async () => {
    mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-providers?limit=20&offset=0',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-providers',
    });

    await screen.getByRole('button', { name: 'Add provider' }).click();

    await expect
      .element(screen.getByRole('dialog', { name: 'Create OAuth provider' }))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole('button', {
          name: 'Close OAuth provider dialog',
        }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole('checkbox', { name: 'Provider enabled' }))
      .toBeVisible();
  });

  test('oauth providers page disables write actions for config-managed providers', async () => {
    mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-providers?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [configProvider],
          pagination: { limit: 20, offset: 0, total: 1 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-providers',
    });

    await expect
      .element(screen.getByRole('button', { name: 'Edit Config Google' }))
      .toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Delete Config Google' }))
      .toBeDisabled();
    await expect.element(screen.getByText('Read-only config')).toBeVisible();
  });

  test('oauth providers page confirms database-managed provider deletion', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-providers?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [databaseProvider],
          pagination: { limit: 20, offset: 0, total: 1 },
        },
      },
      {
        url: '/admin/api/oauth-providers/database-google',
        method: 'DELETE',
        body: {},
      },
      {
        url: '/admin/api/oauth-providers?limit=20&offset=0',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-providers',
    });

    await screen
      .getByRole('button', { name: 'Delete Database Google' })
      .click();
    await expect
      .element(screen.getByRole('heading', { name: 'Delete Database Google' }))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Delete provider' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
    });
    expect(fetchMock.requests[2]).toEqual(
      expect.objectContaining({
        url: '/admin/api/oauth-providers/database-google',
        method: 'DELETE',
      }),
    );
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth clients page renders a paginated table from URL search params', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients?limit=2&offset=2&search=app',
        method: 'GET',
        body: {
          items: [
            {
              id: 'client-1',
              client_id: 'web',
              name: 'Web app',
              redirect_uris: ['https://client.example/callback'],
              response_types: ['code'],
              grant_types: ['authorization_code'],
              scope: 'openid profile',
              enabled: true,
              managed_by: 'database',
              updated_at: '2026-05-18T10:00:00.000Z',
            },
            {
              id: 'client-2',
              client_id: 'mobile',
              name: 'Mobile app',
              redirect_uris: [
                'com.example.app:/oauth/callback',
                'https://mobile.example/callback',
              ],
              response_types: ['code'],
              grant_types: ['authorization_code', 'refresh_token'],
              scope: 'openid email profile offline_access',
              enabled: false,
              managed_by: 'database',
              updated_at: '2026-05-18T11:00:00.000Z',
            },
          ],
          pagination: { limit: 2, offset: 2, total: 5 },
        },
      },
      {
        url: '/admin/api/oauth-clients?limit=2&offset=4&search=app',
        method: 'GET',
        body: {
          items: [],
          pagination: { limit: 2, offset: 4, total: 5 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients?limit=2&offset=2&search=app',
    });

    await expect
      .element(screen.getByRole('heading', { name: 'OAuth clients' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('table', { name: 'OAuth clients table' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('columnheader', { name: 'Redirect URIs' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('columnheader', { name: 'Grant types' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Edit Web app' }))
      .toBeVisible();
    await expect.element(screen.getByText('2 redirect URIs')).toBeVisible();
    await expect.element(screen.getByText('Disabled')).toBeVisible();
    await expect
      .element(screen.getByText(/Page 2 of 3.*5 total/))
      .toBeVisible();
    expect(document.querySelectorAll('article.card').length).toBe(0);
    expect(document.body.textContent).not.toContain('client_secret');

    await screen.getByRole('button', { name: 'Next page' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.at(-1)?.url).toBe(
        '/admin/api/oauth-clients?limit=2&offset=4&search=app',
      );
    });
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth clients search input is accessible and refreshes pagination from the first page', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0&search=mobile',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients',
    });

    const searchClients = screen.getByRole('searchbox', {
      name: 'Search OAuth clients',
    });
    await searchClients.fill('mobile');
    await screen.getByRole('button', { name: 'Search OAuth clients' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.at(-1)?.url).toBe(
        '/admin/api/oauth-clients?limit=20&offset=0&search=mobile',
      );
    });
    await expect
      .element(screen.getByRole('navigation', { name: 'Pagination' }))
      .toBeVisible();
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth clients page can create a client from a modal without a secret field', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
      {
        url: '/admin/api/oauth-clients',
        method: 'POST',
        body: {
          oauth_client: {
            id: 'new-client',
            client_id: 'new-client',
            name: 'New client',
            redirect_uris: ['https://client.example/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid profile',
            enabled: true,
            managed_by: 'database',
          },
        },
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [
            {
              id: 'new-client',
              client_id: 'new-client',
              name: 'New client',
              redirect_uris: ['https://client.example/callback'],
              response_types: ['code'],
              grant_types: ['authorization_code'],
              scope: 'openid profile',
              enabled: true,
              managed_by: 'database',
            },
          ],
          pagination: { limit: 20, offset: 0, total: 1 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients',
    });

    await screen.getByRole('button', { name: 'Add client' }).click();
    await expect
      .element(screen.getByRole('heading', { name: 'Create OAuth client' }))
      .toBeVisible();
    await screen.getByLabelText('Name').fill('New client');
    await screen.getByLabelText('Client ID').fill('new-client');
    await screen
      .getByLabelText('Redirect URIs')
      .fill('https://client.example/callback');
    await screen.getByLabelText('Scope').fill('openid profile');
    await screen.getByRole('button', { name: 'Create client' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
    });
    const request = fetchMock.requests[2];
    expect(request).toEqual(
      expect.objectContaining({
        url: '/admin/api/oauth-clients',
        method: 'POST',
      }),
    );
    expect(jsonRequestBody(request)).toEqual({
      client_id: 'new-client',
      grant_types: ['authorization_code'],
      id: 'new-client',
      name: 'New client',
      redirect_uris: ['https://client.example/callback'],
      response_types: ['code'],
      scope: 'openid profile',
    });
    expect(JSON.stringify(jsonRequestBody(request))).not.toContain(
      'client_secret',
    );
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth clients page can edit and delete a client from modals', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [
            {
              id: 'client-1',
              client_id: 'web',
              name: 'Web app',
              redirect_uris: ['https://client.example/callback'],
              response_types: ['code'],
              grant_types: ['authorization_code'],
              scope: 'openid profile',
              enabled: true,
              managed_by: 'database',
              updated_at: '2026-05-18T10:00:00.000Z',
            },
          ],
          pagination: { limit: 20, offset: 0, total: 1 },
        },
      },
      {
        url: '/admin/api/oauth-clients/client-1',
        method: 'PATCH',
        body: {
          oauth_client: {
            id: 'client-1',
            client_id: 'web',
            name: 'Web app updated',
            redirect_uris: ['http://localhost:3000/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid profile',
            enabled: true,
            managed_by: 'database',
          },
        },
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [
            {
              id: 'client-1',
              client_id: 'web',
              name: 'Web app updated',
              redirect_uris: ['http://localhost:3000/callback'],
              response_types: ['code'],
              grant_types: ['authorization_code'],
              scope: 'openid profile',
              enabled: true,
              managed_by: 'database',
              updated_at: '2026-05-18T11:00:00.000Z',
            },
          ],
          pagination: { limit: 20, offset: 0, total: 1 },
        },
      },
      {
        url: '/admin/api/oauth-clients/client-1',
        method: 'DELETE',
        body: {},
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0',
        method: 'GET',
        body: { items: [], pagination: { limit: 20, offset: 0, total: 0 } },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients',
    });

    await screen.getByRole('button', { name: 'Edit Web app' }).click();
    await expect
      .element(screen.getByRole('heading', { name: 'Edit Web app' }))
      .toBeVisible();
    await screen.getByLabelText('Name').fill('Web app updated');
    await screen
      .getByLabelText('Redirect URIs')
      .fill('http://localhost:3000/callback');
    await screen.getByRole('button', { name: 'Save client' }).click();

    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
    });
    expect(fetchMock.requests[2]).toEqual(
      expect.objectContaining({
        url: '/admin/api/oauth-clients/client-1',
        method: 'PATCH',
      }),
    );
    expect(jsonRequestBody(fetchMock.requests[2])).toEqual({
      enabled: true,
      grant_types: ['authorization_code'],
      name: 'Web app updated',
      redirect_uris: ['http://localhost:3000/callback'],
      response_types: ['code'],
      scope: 'openid profile',
    });

    await screen
      .getByRole('button', { name: 'Delete Web app updated' })
      .click();
    await expect
      .element(screen.getByRole('heading', { name: 'Delete Web app updated' }))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Delete client' }).click();
    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(5);
    });
    expect(fetchMock.requests[4]).toEqual(
      expect.objectContaining({
        url: '/admin/api/oauth-clients/client-1',
        method: 'DELETE',
      }),
    );
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth clients page marks config-managed clients read-only', async () => {
    mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients?limit=20&offset=0',
        method: 'GET',
        body: {
          items: [
            {
              id: 'config-client',
              client_id: 'config-client',
              name: 'Config app',
              redirect_uris: ['https://config.example/callback'],
              response_types: ['code'],
              grant_types: ['authorization_code'],
              scope: 'openid profile',
              enabled: true,
              managed_by: 'config',
              updated_at: '1970-01-01T00:00:00.000Z',
            },
          ],
          pagination: { limit: 20, offset: 0, total: 1 },
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients',
    });

    await expect
      .element(screen.getByRole('button', { name: 'Edit Config app' }))
      .toBeVisible();
    await expect.element(screen.getByText('Read-only config')).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Edit Config app' }))
      .toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Delete Config app' }))
      .toBeDisabled();
  });
});
