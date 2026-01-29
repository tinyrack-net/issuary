import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';
import type { AppRouterContext } from '@/libs/router';

function RootComponent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});
