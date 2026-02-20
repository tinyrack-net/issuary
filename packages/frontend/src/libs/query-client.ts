import { QueryClient } from '@tanstack/react-query';
import { TinyAuthError } from './error';

export const GlobalQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Do not retry on client errors (4xx) — they will not
        // succeed on subsequent attempts (e.g. 401 Unauthorized,
        // 403 Forbidden, 404 Not Found).
        if (
          error instanceof TinyAuthError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
