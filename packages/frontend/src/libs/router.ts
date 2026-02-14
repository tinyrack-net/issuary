import i18n from '@frontend/i18n/index.js';
import type { SessionUser } from '@frontend/queries/session';
import { createRouter } from '@tanstack/react-router';
import type { i18n as I18nInstance } from 'i18next';
import { routeTree } from '../routeTree.gen';
import { GlobalQueryClient } from './query-client';

export type AppRouterContext = {
  queryClient: typeof GlobalQueryClient;
  user: SessionUser | null;
  i18n: I18nInstance;
};

export const AppRouter = createRouter({
  routeTree: routeTree,
  context: {
    queryClient: GlobalQueryClient,
    user: null,
    i18n: i18n,
  },
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof AppRouter;
  }
}
