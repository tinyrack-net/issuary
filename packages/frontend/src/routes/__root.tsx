import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/error-boundary.js';
import { AuthPageSkeleton } from '@/components/skeletons/auth-page-skeleton.js';
import { useTheme } from '@/hooks/use-theme.js';
import type { AppRouterContext } from '@/libs/router.js';

function RootComponent() {
  // Initialize theme from server config
  useTheme();

  return (
    <ErrorBoundary>
      <Suspense fallback={<AuthPageSkeleton />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});
