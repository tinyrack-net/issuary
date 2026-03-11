import { QueryClientProvider, useSuspenseQueries } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import type { ErrorInfo, ReactNode } from 'react';
import { Component, memo, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n, { initI18n } from '#frontend/i18n/index.js';
import './index.css';
import { GlobalQueryClient } from './libs/query-client';
import { AppRouter } from './libs/router';
import { appConfigQueryOptions } from './queries/config';
import { getSessionQueryOptions } from './queries/session';

const RootElement = document.getElementById('root');

if (!RootElement) {
  throw new Error('Root element not found');
}

/**
 * Top-level error boundary that catches failures during
 * bootstrap (e.g. network errors when fetching the initial
 * session or app config).
 *
 * Because this renders *outside* the router, it cannot use
 * TanStack Router's `errorComponent`. A plain React class
 * component is used instead.
 */
type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App bootstrap error:', error, info);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col bg-base-200 p-4">
          <div className="flex flex-1 items-center justify-center">
            <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
              <h1 className="mb-2 text-center font-bold text-2xl">
                Service Unavailable
              </h1>
              <p className="mb-6 text-center text-base-content/60">
                Unable to load the application. Please try again later.
              </p>
              <button
                className="btn btn-primary btn-block h-10 font-semibold text-[14px]"
                onClick={() => window.location.reload()}
                type="button"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Loader = memo(() => {
  const [i18nInitialized, setI18nInitialized] = useState(false);

  const [{ data: session }, { data: config }] = useSuspenseQueries({
    queries: [getSessionQueryOptions, appConfigQueryOptions],
  });

  // Initialize i18n with server config
  useEffect(() => {
    if (config && !i18nInitialized) {
      initI18n({
        supportedLanguages: config.i18n.supported_languages,
        defaultLanguage: config.i18n.default_language,
        fallbackLanguage: config.i18n.fallback_language,
      });
      setI18nInitialized(true);
    }
  }, [config, i18nInitialized]);

  // Wait for i18n initialization before rendering router
  if (!i18nInitialized) {
    return null;
  }

  return (
    <RouterProvider
      context={{
        queryClient: GlobalQueryClient,
        user: session.user ?? null,
        i18n: i18n,
      }}
      router={AppRouter}
    />
  );
});

createRoot(RootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={GlobalQueryClient}>
        <Loader />
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
