import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initializeOIDCConfig } from './libs/oidc-client';
import { queryClient } from './libs/query-client';
import { router } from './libs/router';
import { getTokens } from './libs/token-storage';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeOIDCConfig()
      .then(() => {
        setInitialized(true);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to initialize OIDC: ${message}`);
      });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <div className="card w-96 bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-error">Initialization Error</h2>
            <p className="text-sm">{error}</p>
            <p className="mt-2 text-base-content/60 text-xs">
              Make sure the OIDC provider is running at the configured issuer
              URL.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const tokens = getTokens();

  return (
    <RouterProvider
      router={router}
      context={{
        queryClient,
        tokens,
      }}
    />
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        }
      >
        <App />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>,
);
