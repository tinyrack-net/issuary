import { describe, expect, test } from 'vitest';
import {
  type AdminClient,
  adminClientsQueryOptions,
} from '#frontend/queries/admin-console.ts';
import {
  appConfigQueryData,
  defineRouteScreen,
  renderRoute,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';
import * as RouteModule from './route.tsx';

const routeDefinition = defineRouteScreen('admin', RouteModule);

function adminClient(
  values: Pick<
    AdminClient,
    'id' | 'client_id' | 'name' | 'managed_by' | 'deleted_at'
  >,
): AdminClient {
  return {
    ...values,
    type: 'public',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    scopes: ['openid'],
    redirect_uris: ['https://client.example/callback'],
    post_logout_redirect_uris: [],
    web_origins: [],
    enabled: true,
    skip_consent: false,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

async function renderClients(clients: AdminClient[]) {
  return renderRoute(routeDefinition, {
    initialLocation: '/admin/clients',
    queryData: [
      appConfigQueryData(),
      {
        queryKey: adminClientsQueryOptions({ page: 1, pageSize: 20 }).queryKey,
        data: {
          clients,
          pagination: { page: 1, page_size: 20, total: clients.length },
        },
      },
    ],
    user: { ...routeTestUser, role: 'admin' },
  });
}

describe('/admin/clients', () => {
  test('separates delete from deactivate and confirms the retention policy', async () => {
    const { screen } = await renderClients([
      adminClient({
        id: 'database-client',
        client_id: 'database-client',
        name: 'Database client',
        managed_by: 'database',
        deleted_at: null,
      }),
    ]);

    await expect
      .element(screen.getByRole('button', { name: 'Deactivate' }))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Delete' }).click();
    await expect
      .element(screen.getByRole('heading', { name: 'Delete Database client?' }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/retained for 30 days/))
      .toBeVisible();
  });

  test('keeps deleted config clients read-only and out of bulk selection', async () => {
    const { screen } = await renderClients([
      adminClient({
        id: 'deleted-config-client',
        client_id: 'deleted-config-client',
        name: 'Deleted config client',
        managed_by: 'config',
        deleted_at: new Date().toISOString(),
      }),
    ]);

    await expect
      .element(
        screen
          .getByRole('table', { name: 'OAuth clients' })
          .getByText('Deleted', { exact: true }),
      )
      .toBeVisible();
    await expect.element(screen.getByText('Restore via config')).toBeVisible();
    expect(screen.getByRole('checkbox').elements()).toHaveLength(1);
  });
});
