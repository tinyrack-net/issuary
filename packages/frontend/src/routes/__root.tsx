import {
  createRootRouteWithContext,
  Outlet,
} from '@tanstack/react-router';
import type { AppRouterContext } from '@/libs/router';

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});
