import { createRouter } from '@tanstack/react-router';
import type { SessionUser } from '@/queries/session';
import { routeTree } from '../routeTree.gen';
import { GlobalQueryClient } from './query-client';

export type AppRouterContext = {
  queryClient: typeof GlobalQueryClient;
  user: SessionUser | null;
};

export const AppRouter = createRouter({
  routeTree: routeTree,
  context: {
    queryClient: GlobalQueryClient,
    user: null,
  },
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof AppRouter;
  }
}
