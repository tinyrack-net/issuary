import type { ErrorComponentProps } from '@tanstack/react-router';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { useTheme } from '#frontend/hooks/use-theme.ts';
import type { AppRouterContext } from '#frontend/libs/router.ts';

function RootComponent() {
  // Initialize theme from server config
  useTheme();

  return <Outlet />;
}

/**
 * Catch-all error boundary for the entire router.
 *
 * If a child route does not define its own `errorComponent`,
 * this component will handle the error. 401 errors trigger a
 * redirect to /login.
 */
function RootErrorComponent(props: ErrorComponentProps) {
  return (
    <RouteErrorFallback
      {...props}
      onUnauthorized={() => {
        window.location.href = '/login';
      }}
    />
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
  errorComponent: RootErrorComponent,
});
