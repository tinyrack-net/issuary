import { QueryClient } from '@tanstack/react-query';

export const GlobalQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
