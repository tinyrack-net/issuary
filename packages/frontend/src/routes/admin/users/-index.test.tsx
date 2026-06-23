import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  type AdminUser,
  adminUsersQueryOptions,
} from '#frontend/queries/admin-users.ts';
import type { SessionUser } from '#frontend/queries/session.ts';
import {
  type CapturedFetchRequest,
  firstRequest,
  jsonRequestBody,
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  appConfigQueryData,
  renderRoute,
  routeTestAppConfig,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';

const adminUser = {
  ...routeTestUser,
  role: 'admin',
} satisfies SessionUser;

const databaseUser = {
  ...routeTestUser,
  sub: 'database-user-1',
  email: 'managed@example.com',
  role: 'user',
  managed_by: 'database',
  deleted_at: null,
} satisfies AdminUser;

const configUser = {
  ...routeTestUser,
  sub: 'config-user-1',
  email: 'config@example.com',
  role: 'admin',
  managed_by: 'config',
  deleted_at: null,
} satisfies AdminUser;

const createdUser = {
  ...databaseUser,
  sub: 'created-user-1',
  email: 'created@example.com',
  role: 'admin',
  email_verified: true,
} satisfies AdminUser;

function adminUsersData(users: AdminUser[] = [databaseUser, configUser]) {
  return {
    users,
    pagination: { page: 1, page_size: 20, total: users.length },
  };
}

async function renderAdminUsers() {
  return await renderRoute({
    initialLocation: '/admin/users',
    queryData: [
      appConfigQueryData(),
      {
        queryKey: adminUsersQueryOptions().queryKey,
        data: adminUsersData(),
      },
    ],
    user: adminUser,
  });
}

function expectRequest(
  request: CapturedFetchRequest,
  { method, url }: { method: string; url: string },
) {
  expect(request.method).toBe(method);
  expect(request.url).toBe(url);
}

afterEach(() => {
  resetFetchMock();
});

describe('/admin/users', () => {
  test('shows a disabled message when the admin console is disabled', async () => {
    const { screen } = await renderRoute({
      initialLocation: '/admin/users',
      queryData: [
        appConfigQueryData({
          ...routeTestAppConfig,
          admin: { enabled: false },
        }),
      ],
      user: adminUser,
    });

    await expect
      .element(screen.getByText('Admin console disabled'))
      .toBeVisible();
  });

  test('shows the admin user list with daisyUI controls', async () => {
    const { screen } = await renderAdminUsers();

    await expect
      .element(screen.getByRole('heading', { name: 'Users' }))
      .toBeVisible();
    await expect.element(screen.getByText('managed@example.com')).toBeVisible();
    await expect.element(screen.getByText('config@example.com')).toBeVisible();
    await expect
      .element(screen.getByRole('cell', { name: 'Database', exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('cell', { name: 'Config', exact: true }))
      .toBeVisible();

    expect(
      screen.getByText('User directory').element().closest('.card'),
    ).not.toBeNull();
    expect(
      screen
        .getByRole('searchbox', { name: 'Search users by email or ID' })
        .element()
        .closest('.input'),
    ).not.toBeNull();
    expect(
      screen.getByText('managed@example.com').element().closest('.table'),
    ).not.toBeNull();
    expect(
      screen
        .getByRole('cell', { name: 'Database', exact: true })
        .element()
        .closest('td'),
    ).not.toBeNull();
    const managedRow = screen
      .getByText('managed@example.com')
      .element()
      .closest('tr');
    expect(managedRow?.querySelector('.badge-success')?.textContent).toBe(
      'Active',
    );
    await expect.element(screen.getByText('Active on this page')).toBeVisible();
    await expect.element(screen.getByText('Config on this page')).toBeVisible();
    await expect
      .element(screen.getByText('Database on this page'))
      .toBeVisible();
  });

  test('searches and toggles deleted users through the admin API', async () => {
    const fetchMock = mockJsonResponses({
      url: '/api/admin/users?query=config&page=1&page_size=20&include_deleted=true',
      method: 'GET',
      body: adminUsersData([configUser]),
    });
    const { screen } = await renderAdminUsers();

    await screen
      .getByRole('searchbox', { name: 'Search users by email or ID' })
      .fill('config');
    await screen.getByRole('checkbox', { name: 'Include deleted' }).click();
    await screen.getByRole('button', { name: 'Search' }).click();

    await vi.waitFor(() =>
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(1),
    );
    expectRequest(firstRequest(fetchMock.requests), {
      method: 'GET',
      url: '/api/admin/users?query=config&page=1&page_size=20&include_deleted=true',
    });
    await expect.element(screen.getByText('config@example.com')).toBeVisible();
  });

  test('applies quick filters through the admin API', async () => {
    const fetchMock = mockJsonResponses({
      url: '/api/admin/users?query=&page=1&page_size=20&include_deleted=false&managed_by=database',
      method: 'GET',
      body: adminUsersData([databaseUser]),
    });
    const { screen } = await renderAdminUsers();

    await screen.getByRole('button', { name: 'Database' }).click();

    await vi.waitFor(() => expect(fetchMock.requests).toHaveLength(1));
    expectRequest(firstRequest(fetchMock.requests), {
      method: 'GET',
      url: '/api/admin/users?query=&page=1&page_size=20&include_deleted=false&managed_by=database',
    });
  });

  test('creates a database-managed user from the modal', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/api/admin/users',
        method: 'POST',
        body: { user: createdUser },
        init: { status: 201 },
      },
      {
        url: '/api/admin/users?query=&page=1&page_size=20&include_deleted=false',
        method: 'GET',
        body: adminUsersData([createdUser, databaseUser, configUser]),
      },
    );
    const { screen } = await renderAdminUsers();

    await screen.getByRole('button', { name: 'Create user' }).click();
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Email' }).element(),
    );
    await screen
      .getByRole('textbox', { name: 'Email' })
      .fill('created@example.com');
    await screen.getByLabelText('Password').fill('Created123!');
    await screen.getByLabelText('Role').selectOptions('admin');
    await screen.getByRole('checkbox', { name: 'Email verified' }).click();
    await screen.getByRole('button', { name: 'Create', exact: true }).click();

    await vi.waitFor(() =>
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(1),
    );
    expectRequest(firstRequest(fetchMock.requests), {
      method: 'POST',
      url: '/api/admin/users',
    });
    expect(jsonRequestBody(firstRequest(fetchMock.requests))).toEqual({
      email: 'created@example.com',
      password: 'Created123!',
      role: 'admin',
      email_verified: true,
    });
    await vi.waitFor(() => expect(fetchMock.requests).toHaveLength(2));
    expectRequest(fetchMock.requests[1], {
      method: 'GET',
      url: '/api/admin/users?query=&page=1&page_size=20&include_deleted=false',
    });
    await expect
      .element(screen.getByText('created@example.com', { exact: true }))
      .toBeVisible();
    await expect.element(screen.getByRole('status')).toBeVisible();
  });

  test('hides edit and delete actions for soft-deleted database users', async () => {
    const deletedDatabaseUser = {
      ...databaseUser,
      deleted_at: '2026-06-22T10:00:00.000Z',
    } satisfies AdminUser;

    const { screen } = await renderRoute({
      initialLocation: '/admin/users',
      queryData: [
        appConfigQueryData(),
        {
          queryKey: adminUsersQueryOptions().queryKey,
          data: adminUsersData([deletedDatabaseUser]),
        },
      ],
      user: adminUser,
    });

    await expect
      .element(screen.getByText('Deleted', { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Edit managed@example.com' }))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole('button', { name: 'Delete managed@example.com' }),
      )
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText('Read-only', { exact: true }))
      .toBeVisible();
  });

  test('edits and deletes database-managed users while config users stay read-only', async () => {
    const updatedUser = {
      ...databaseUser,
      email: 'updated@example.com',
      role: 'admin',
      email_verified: true,
    } satisfies AdminUser;
    const deletedUser = {
      ...updatedUser,
      deleted_at: '2026-06-22T10:00:00.000Z',
    } satisfies AdminUser;
    const fetchMock = mockJsonResponses(
      {
        url: '/api/admin/users/database-user-1',
        method: 'PATCH',
        body: { user: updatedUser },
      },
      {
        url: '/api/admin/users?query=&page=1&page_size=20&include_deleted=false',
        method: 'GET',
        body: adminUsersData([updatedUser, configUser]),
      },
      {
        url: '/api/admin/users/database-user-1',
        method: 'DELETE',
        body: { user: deletedUser },
      },
      {
        url: '/api/admin/users?query=&page=1&page_size=20&include_deleted=false',
        method: 'GET',
        body: adminUsersData([configUser]),
      },
    );
    const { screen } = await renderAdminUsers();

    await expect
      .element(screen.getByRole('button', { name: 'Edit config@example.com' }))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole('button', { name: 'Delete config@example.com' }),
      )
      .not.toBeInTheDocument();

    await screen
      .getByRole('button', { name: 'Edit managed@example.com' })
      .click();
    await screen
      .getByRole('textbox', { name: 'Email' })
      .fill('updated@example.com');
    await screen.getByLabelText('Role').selectOptions('admin');
    await screen.getByRole('button', { name: 'Save changes' }).click();

    await vi.waitFor(() =>
      expect(fetchMock.requests.length).toBeGreaterThanOrEqual(1),
    );
    expectRequest(fetchMock.requests[0], {
      method: 'PATCH',
      url: '/api/admin/users/database-user-1',
    });
    expect(jsonRequestBody(fetchMock.requests[0])).toEqual({
      email: 'updated@example.com',
      role: 'admin',
      email_verified: true,
    });
    await vi.waitFor(() => expect(fetchMock.requests).toHaveLength(2));
    await expect
      .element(screen.getByText('updated@example.com', { exact: true }))
      .toBeVisible();

    await screen
      .getByRole('button', { name: 'Delete updated@example.com' })
      .click();
    await expect
      .element(screen.getByText('Delete updated@example.com?'))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Delete user' }).click();

    await vi.waitFor(() => expect(fetchMock.requests).toHaveLength(4));
    expectRequest(fetchMock.requests[2], {
      method: 'DELETE',
      url: '/api/admin/users/database-user-1',
    });
    await expect
      .element(screen.getByText('updated@example.com', { exact: true }))
      .not.toBeInTheDocument();
  });
});
