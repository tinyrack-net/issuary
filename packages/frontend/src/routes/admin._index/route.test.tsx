import { describe, expect, test } from 'vitest';
import { adminOverviewQueryOptions } from '#frontend/queries/admin-console.ts';
import {
  appConfigQueryData,
  defineRouteScreen,
  renderRoute,
  routeTestAppConfig,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';
import * as RouteModule from './route.tsx';

const routeDefinition = defineRouteScreen('admin', RouteModule);

const overview = {
  metrics: { active_users: 8, admins: 2, active_clients: 3, required_terms: 1 },
  users: {
    source: { config: 2, database: 6 },
    authentication: { email_verified: 7, two_factor: 3, remaining: 1 },
  },
  status: {
    database: 'healthy',
    email: 'disabled',
    password: true,
    passkey: false,
    totp: true,
  },
};

describe('/admin', () => {
  test('shows real current-state metrics without historical charts or activity logs', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: '/admin',
      queryData: [
        appConfigQueryData(),
        { queryKey: adminOverviewQueryOptions.queryKey, data: overview },
      ],
      user: { ...routeTestUser, role: 'admin' },
    });
    await expect.element(screen.getByText('Active users')).toBeVisible();
    await expect.element(screen.getByText('8', { exact: true })).toBeVisible();
    await expect
      .element(screen.getByText('Services and authentication methods'))
      .toBeVisible();
    expect(screen.baseElement.textContent).not.toContain('Activity log');
    expect(screen.baseElement.querySelector('canvas')).toBeNull();
  });

  test('opens account details and logout from the header avatar menu', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: '/admin',
      queryData: [
        appConfigQueryData(),
        { queryKey: adminOverviewQueryOptions.queryKey, data: overview },
      ],
      user: { ...routeTestUser, role: 'admin' },
    });
    await screen.getByRole('button', { name: 'Open account menu' }).click();
    await expect.element(screen.getByText(routeTestUser.email)).toBeVisible();
    await expect
      .element(screen.getByText('Admin', { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('menuitem', { name: 'Settings' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('menuitem', { name: 'Log out' }))
      .toBeVisible();
  });

  test('shows a forbidden message for non-admin users', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: '/admin',
      queryData: [appConfigQueryData()],
      user: routeTestUser,
    });
    await expect
      .element(screen.getByText('Admin access required'))
      .toBeVisible();
  });

  test('shows a disabled message when the admin console is disabled', async () => {
    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: '/admin',
      queryData: [
        appConfigQueryData({
          ...routeTestAppConfig,
          admin: { enabled: false },
        }),
      ],
      user: { ...routeTestUser, role: 'admin' },
    });
    await expect
      .element(screen.getByText('Admin console disabled'))
      .toBeVisible();
  });
});
