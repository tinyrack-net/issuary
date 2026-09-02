import { describe, expect, test } from 'vitest';
import {
  type AdminUser,
  adminUsersQueryOptions,
} from '#frontend/queries/admin-users.ts';
import type { SessionUser } from '#frontend/queries/session.ts';
import {
  appConfigQueryData,
  defineRouteScreen,
  renderRoute,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';
import * as RouteModule from './route.tsx';

const routeDefinition = defineRouteScreen('admin', RouteModule);

const adminUser = { ...routeTestUser, role: 'admin' } satisfies SessionUser;
const databaseUser = {
  ...routeTestUser,
  sub: 'database-user',
  email: 'managed@example.com',
  managed_by: 'database',
  deleted_at: null,
} satisfies AdminUser;
const configUser = {
  ...routeTestUser,
  sub: 'config-user',
  email: 'config@example.com',
  role: 'admin',
  managed_by: 'config',
  deleted_at: null,
} satisfies AdminUser;

async function renderUsers(users: AdminUser[] = [databaseUser, configUser]) {
  return renderRoute(routeDefinition, {
    initialLocation: '/admin/users',
    queryData: [
      appConfigQueryData(),
      {
        queryKey: adminUsersQueryOptions().queryKey,
        data: {
          users,
          pagination: { page: 1, page_size: 20, total: users.length },
        },
      },
    ],
    user: adminUser,
  });
}

describe('/admin/users', () => {
  test('renders one responsive table without a mobile card layout', async () => {
    const { screen } = await renderUsers();
    await expect
      .element(screen.getByRole('heading', { name: 'Users' }))
      .toBeVisible();
    await expect.element(screen.getByText('managed@example.com')).toBeVisible();
    const table = screen
      .getByText('managed@example.com')
      .element()
      .closest('table');
    const tableFrame = table?.closest('[data-layout="table"]');
    const tableContainer = table?.parentElement;
    expect(table).not.toBeNull();
    expect(tableFrame).not.toBeNull();
    expect(tableFrame?.classList.contains('flex-1')).toBe(true);
    expect(tableContainer?.classList.contains('flex-1')).toBe(true);
    expect(tableContainer?.classList.contains('overflow-auto')).toBe(true);
    expect(table?.querySelector('thead.sticky.top-0')).not.toBeNull();
    expect(screen.baseElement.querySelector('[data-layout="card"]')).toBeNull();
    expect(table?.querySelector('th.sticky.left-0')).not.toBeNull();
    expect(table?.querySelector('th.sticky.right-0')).not.toBeNull();
    expect(
      screen
        .getByTestId('admin-list-toolbar')
        .element()
        .className.includes('border'),
    ).toBe(false);
  });

  test('supports current-page selection and exposes the floating bulk bar', async () => {
    const { screen } = await renderUsers();
    await screen.getByRole('checkbox', { name: 'Select current page' }).click();
    await expect.element(screen.getByTestId('admin-bulk-bar')).toBeVisible();
    await expect.element(screen.getByText('2 selected')).toBeVisible();
    await expect.element(screen.getByText('Current page')).toBeVisible();
  });

  test('keeps config resources and the current administrator protected', async () => {
    const { screen } = await renderUsers();
    const configRow = screen
      .getByText('config@example.com')
      .element()
      .closest('tr');
    expect(configRow?.querySelector('button')?.hasAttribute('disabled')).toBe(
      true,
    );
    const selfScreen = await renderUsers([
      {
        ...databaseUser,
        sub: adminUser.sub,
        email: adminUser.email,
        role: 'admin',
      },
    ]);
    const selfRow = selfScreen.screen
      .getByText(adminUser.email)
      .element()
      .closest('tr');
    const buttons = selfRow?.querySelectorAll('button');
    expect(buttons?.item(1).hasAttribute('disabled')).toBe(true);
  });
});
