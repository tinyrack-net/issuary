import { RouterProvider } from '@tanstack/react-router';
import { memo, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { QueryClientProvider, useSuspenseQueries } from '@tanstack/react-query';
import { GlobalQueryClient } from './libs/query-client';
import { AppRouter } from './libs/router';
import { appConfigQueryOptions } from './queries/config';
import { getSessionQueryOptions } from './queries/session';

const RootElement = document.getElementById('root');

if (!RootElement) {
  throw new Error('Root element not found');
}

const Loader = memo(() => {
  const [{ data: session }] = useSuspenseQueries({
    queries: [getSessionQueryOptions, appConfigQueryOptions],
  });
  console.log('session: ', session);
  return (
    <RouterProvider
      router={AppRouter}
      context={{
        queryClient: GlobalQueryClient,
        user: session.user,
      }}
    />
  );
});

createRoot(RootElement).render(
  <StrictMode>
    <QueryClientProvider client={GlobalQueryClient}>
      <Suspense>
        <Loader />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>,
);
