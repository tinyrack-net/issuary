import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { AppRouterContext } from '@/libs/router';
import { useTheme } from '@/hooks/use-theme';

function RootComponent() {
  // Initialize theme from server config
  useTheme();

  return <Outlet />;
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});
