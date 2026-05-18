import type { AdminPaginationParams } from '#admin/libs/api.js';

export const queryKeys = {
  session: () => ['admin', 'session'],
  users: (params?: AdminPaginationParams) =>
    params ? ['admin', 'users', params] : ['admin', 'users'],
  oauthClients: (params?: AdminPaginationParams) =>
    params ? ['admin', 'oauth-clients', params] : ['admin', 'oauth-clients'],
  oauthProviders: (params?: AdminPaginationParams) =>
    params
      ? ['admin', 'oauth-providers', params]
      : ['admin', 'oauth-providers'],
};
