import { afterEach, describe, expect, test, vi } from 'vitest';
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

afterEach(() => {
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
    await expect.element(screen.getByText('admin@example.com')).toBeVisible();
  });

  test('users page calls the users API', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/users',
        method: 'GET',
        body: {
          users: [
            {
              sub: 'user-1',
              email: 'user@example.com',
              email_verified: true,
              role: 'user',
              managed_by: 'database',
            },
          ],
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/users',
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Users' }))
      .toBeVisible();
    await expect.element(screen.getByText('user@example.com')).toBeVisible();
    fetchMock.assertAllResponsesConsumed();
  });

  test('users page can request a safe role update', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/users',
        method: 'GET',
        body: {
          users: [
            {
              sub: 'user-1',
              email: 'promote@example.com',
              email_verified: true,
              role: 'user',
              managed_by: 'database',
            },
          ],
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
        url: '/admin/api/users',
        method: 'GET',
        body: {
          users: [
            {
              sub: 'user-1',
              email: 'promote@example.com',
              email_verified: true,
              role: 'admin',
              managed_by: 'database',
            },
          ],
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/users',
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

  test('oauth clients page calls the clients API without secret fields', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients',
        method: 'GET',
        body: {
          oauth_clients: [
            {
              id: 'client-1',
              client_id: 'web',
              name: 'Web app',
              redirect_uris: ['https://client.example/callback'],
            },
          ],
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients',
    });

    await expect
      .element(screen.getByRole('heading', { name: 'OAuth clients' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('heading', { name: 'Web app' }))
      .toBeVisible();
    expect(document.body.textContent).not.toContain('client_secret');
    fetchMock.assertAllResponsesConsumed();
  });

  test('oauth clients page can request client creation without a secret field', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients',
        method: 'GET',
        body: { oauth_clients: [] },
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
        url: '/admin/api/oauth-clients',
        method: 'GET',
        body: {
          oauth_clients: [
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
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients',
    });

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
  });

  test('oauth clients page can request client updates and deletion', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/oauth-clients',
        method: 'GET',
        body: {
          oauth_clients: [
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
            },
          ],
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
        url: '/admin/api/oauth-clients',
        method: 'GET',
        body: {
          oauth_clients: [
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
            },
          ],
        },
      },
      {
        url: '/admin/api/oauth-clients/client-1',
        method: 'DELETE',
        body: {},
      },
      {
        url: '/admin/api/oauth-clients',
        method: 'GET',
        body: { oauth_clients: [] },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/oauth-clients',
    });

    await screen.getByLabelText('Name for Web app').fill('Web app updated');
    await screen
      .getByLabelText('Redirect URIs for Web app')
      .fill('http://localhost:3000/callback');
    await screen.getByRole('button', { name: 'Save Web app' }).click();

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
    await vi.waitFor(() => {
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(5);
    });
    expect(fetchMock.requests[4]).toEqual(
      expect.objectContaining({
        url: '/admin/api/oauth-clients/client-1',
        method: 'DELETE',
      }),
    );
  });

  test('audit events page calls the audit events API', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/session',
        method: 'GET',
        body: adminSession,
      },
      {
        url: '/admin/api/audit-events',
        method: 'GET',
        body: {
          audit_events: [
            {
              id: 'event-1',
              actor_sub: 'admin-1',
              action: 'admin.session.view',
              target_type: 'session',
              target_id: 'admin-1',
              metadata: { viewed: true },
              ip: '203.0.113.20',
              user_agent: 'admin-app-test',
              created_at: '2026-05-17T00:00:00.000Z',
            },
          ],
        },
      },
    );

    const { screen } = await renderAdminRoute({
      initialLocation: '/admin/audit-events',
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Audit events' }))
      .toBeVisible();
    await expect.element(screen.getByText('admin.session.view')).toBeVisible();
    await expect.element(screen.getByText('203.0.113.20')).toBeVisible();
    await expect.element(screen.getByText('admin-app-test')).toBeVisible();
    fetchMock.assertAllResponsesConsumed();
  });
});
