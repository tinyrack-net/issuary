import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import type { RenderResult } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';
import { initI18n } from '#admin/i18n/index.js';
import { createAdminRouter } from '#admin/libs/router.js';

type RenderRouteOptions = {
  initialLocation?: string;
  queryClient?: QueryClient;
};

type RenderRouteResult = {
  queryClient: QueryClient;
  screen: RenderResult;
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export async function renderAdminRoute({
  initialLocation = '/admin/',
  queryClient = createTestQueryClient(),
}: RenderRouteOptions = {}): Promise<RenderRouteResult> {
  const i18n = initI18n('en');
  const history = createMemoryHistory({
    initialEntries: [initialLocation],
  });
  const router = createAdminRouter({ history, queryClient, i18n });

  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { queryClient, screen };
}
