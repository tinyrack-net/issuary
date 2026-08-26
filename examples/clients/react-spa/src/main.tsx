import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { trShikiWebHighlighter } from '@tinyrack/ui/highlighters/shiki-web';
import { TRCodeHighlighterProvider } from '@tinyrack/ui/providers/highlighter';
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
      <div className="flex min-h-screen items-center justify-center bg-tinyrack-surface">
        <TRCard.Root className="w-tinyrack-measure-xl shadow-tinyrack-overlay">
          <TRCard.Header>
            <TRCard.Title className="text-tinyrack-danger-foreground">
              Initialization Error
            </TRCard.Title>
            <TRCard.Description>
              <p className="text-tinyrack-sm">{error}</p>
              <p className="mt-tinyrack-sm text-tinyrack-text-muted text-tinyrack-xs">
                Make sure the OIDC provider is running at the configured issuer
                URL.
              </p>
            </TRCard.Description>
          </TRCard.Header>
        </TRCard.Root>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <TRSpinner uiSize="lg" />
      </div>
    );
  }

  const tokens = getTokens();

  return (
    <RouterProvider
      context={{
        queryClient,
        tokens,
      }}
      router={router}
    />
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <TRCodeHighlighterProvider highlighter={trShikiWebHighlighter}>
      <QueryClientProvider client={queryClient}>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <TRSpinner uiSize="lg" />
            </div>
          }
        >
          <App />
        </Suspense>
      </QueryClientProvider>
    </TRCodeHighlighterProvider>
  </StrictMode>,
);
