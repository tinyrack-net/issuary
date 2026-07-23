import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { Suspense } from 'react';
import type { AppRouterContext } from '#example-react-spa/libs/router.ts';

function RootComponent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <TRSpinner uiSize="lg" />
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
