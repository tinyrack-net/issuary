import { describe, expect, test } from 'vitest';
import { adminUsersQueryOptions } from '#frontend/queries/admin-users.ts';
import {
  appConfigQueryData,
  renderRoute,
  routeTestAppConfig,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';

describe('/admin', () => {
  test('shows the admin dashboard for admin users', async () => {
    const { screen } = await renderRoute({
      initialLocation: '/admin',
      queryData: [
        appConfigQueryData(),
        {
          queryKey: adminUsersQueryOptions().queryKey,
          data: {
            users: [
              {
                ...routeTestUser,
                role: 'admin',
                managed_by: 'config',
                deleted_at: null,
              },
              {
                ...routeTestUser,
                sub: 'database-user-1',
                email: 'managed@example.com',
                role: 'user',
                managed_by: 'database',
                deleted_at: null,
              },
            ],
            pagination: { page: 1, page_size: 20, total: 2 },
          },
        },
        {
          queryKey: adminUsersQueryOptions({ pageSize: 1, role: 'admin' })
            .queryKey,
          data: { users: [], pagination: { page: 1, page_size: 1, total: 1 } },
        },
        {
          queryKey: adminUsersQueryOptions({ managedBy: 'config', pageSize: 1 })
            .queryKey,
          data: { users: [], pagination: { page: 1, page_size: 1, total: 1 } },
        },
        {
          queryKey: adminUsersQueryOptions({
            managedBy: 'database',
            pageSize: 1,
          }).queryKey,
          data: { users: [], pagination: { page: 1, page_size: 1, total: 1 } },
        },
      ],
      user: {
        ...routeTestUser,
        role: 'admin',
      },
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Admin dashboard' }))
      .toBeVisible();

    const shellRoot = screen.baseElement.querySelector('.tr-app-shell');
    expect(shellRoot).not.toBeNull();
    expect(
      screen.getByText('Config-managed users and clients are read-only.'),
    ).not.toBeNull();
    expect(screen.getByText('Total users')).not.toBeNull();
  });

  test('shows a forbidden message for non-admin users', async () => {
    const { screen } = await renderRoute({
      initialLocation: '/admin',
      queryData: [appConfigQueryData()],
      user: routeTestUser,
    });

    await expect
      .element(screen.getByText('Admin access required'))
      .toBeVisible();
  });

  test('shows a disabled message when the admin console is disabled', async () => {
    const { screen } = await renderRoute({
      initialLocation: '/admin',
      queryData: [
        appConfigQueryData({
          ...routeTestAppConfig,
          admin: { enabled: false },
        }),
      ],
      user: {
        ...routeTestUser,
        role: 'admin',
      },
    });

    await expect
      .element(screen.getByText('Admin console disabled'))
      .toBeVisible();
  });
});
