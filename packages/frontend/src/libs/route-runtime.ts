import type { QueryClient } from '@tanstack/react-query';
import type { i18n as I18nInstance } from 'i18next';
import { createContext, type RouterContextProvider } from 'react-router';
import type { ApiClient } from '#frontend/libs/api.ts';
import type { AppConfigs } from '#frontend/queries/config.ts';
import type { AuthResponse } from '#frontend/queries/session.ts';

export type RouteRuntime = {
  api: ApiClient;
  config: AppConfigs;
  i18n: I18nInstance;
  queryClient: QueryClient;
  session: AuthResponse;
};

export const routeRuntimeContext = createContext<RouteRuntime | null>(null);

export function getRouteRuntime(
  context: Readonly<RouterContextProvider>,
): RouteRuntime {
  const runtime = context.get(routeRuntimeContext);
  if (runtime === null) {
    throw new Error(
      'Route runtime was not initialized by the root middleware.',
    );
  }
  return runtime;
}
