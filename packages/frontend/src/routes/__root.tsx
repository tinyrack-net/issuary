import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { useTheme } from '@/hooks/use-theme';
import type { AppRouterContext } from '@/libs/router';

function RootComponent() {
  // Initialize theme from server config
  useTheme();

  return <Outlet />;
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});
