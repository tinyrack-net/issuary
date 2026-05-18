import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from '#admin/i18n/index.js';
import './index.css';
import { GlobalQueryClient } from './libs/query-client.js';
import { AppRouter } from './libs/router.js';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

initI18n(navigator.language.split('-')[0] ?? 'en');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={GlobalQueryClient}>
      <RouterProvider router={AppRouter} />
    </QueryClientProvider>
  </StrictMode>,
);
