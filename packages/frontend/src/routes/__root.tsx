import { useTheme } from '@frontend/hooks/use-theme.js';
import type { AppRouterContext } from '@frontend/libs/router.js';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

function RootComponent() {
  // Initialize theme from server config
  useTheme();

  return <Outlet />;
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});
