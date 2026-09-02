import type { QueryClient } from '@tanstack/react-query';
import type { RenderResult } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';

export {
  appConfigQueryData,
  authorizationContextQueryData,
  routeTestAppConfig,
  routeTestAuthorizationContext,
  routeTestUser,
} from '#frontend/test-utils/route-screen-fixtures.ts';

import {
  createRouteScreen,
  createRouteScreenQueryClient,
  defineRouteScreen,
  type RouteScreenDefinition,
  type RouteScreenRenderOptions,
  type RouteTestQueryData,
} from '#frontend/test-utils/route-test-fixture.tsx';

export type { RouteScreenDefinition, RouteTestQueryData };
export { defineRouteScreen };

type RenderRouteOptions = RouteScreenRenderOptions;

type RenderRouteResult = {
  queryClient: QueryClient;
  router: Awaited<ReturnType<typeof createRouteScreen>>['router'];
  screen: RenderResult;
};

export function createTestQueryClient(): QueryClient {
  return createRouteScreenQueryClient();
}

export async function renderRoute(
  definition: RouteScreenDefinition,
  {
    initialLocation = '/',
    queryClient = createTestQueryClient(),
    queryData = [],
    user = null,
  }: RenderRouteOptions = {},
): Promise<RenderRouteResult> {
  initTestI18n();

  const { content, router } = await createRouteScreen(definition, {
    initialLocation,
    queryClient,
    queryData,
    user,
  });

  // AuthLayout renders the toast viewport, which needs a manager in context.
  const screen = await render(content);

  return {
    queryClient,
    router,
    screen,
  };
}
