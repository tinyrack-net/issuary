import { QueryClientProvider, useSuspenseQueries } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { memo, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from '@/i18n';
import './index.css';
import { GlobalQueryClient } from './libs/query-client';
import { AppRouter } from './libs/router';
import { appConfigQueryOptions } from './queries/config';
import { getSessionQueryOptions } from './queries/session';

const RootElement = document.getElementById('root');

if (!RootElement) {
  throw new Error('Root element not found');
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
        supportedLanguages: config.app.supported_languages,
        defaultLanguage: config.app.default_language,
        fallbackLanguage: config.app.fallback_language,
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
      router={AppRouter}
      context={{
        queryClient: GlobalQueryClient,
        user: session.user ?? null,
      }}
    />
  );
});

createRoot(RootElement).render(
  <StrictMode>
    <QueryClientProvider client={GlobalQueryClient}>
      <Loader />
    </QueryClientProvider>
  </StrictMode>,
);
