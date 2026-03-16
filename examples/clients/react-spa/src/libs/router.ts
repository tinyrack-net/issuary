import { createRouter } from '@tanstack/react-router';
import type { TokenResponse } from '#example-react-spa/types/oidc.js';
import { routeTree } from '../routeTree.gen';
import { queryClient } from './query-client';

export type AppRouterContext = {
  queryClient: typeof queryClient;
  tokens: TokenResponse | null;
};

export const router = createRouter({
  routeTree: routeTree,
  context: {
    queryClient: queryClient,
    tokens: null,
  },
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
