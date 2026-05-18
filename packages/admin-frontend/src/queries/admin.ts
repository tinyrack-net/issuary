import { queryOptions } from '@tanstack/react-query';
import {
  type AdminPaginationParams,
  getAdminSession,
  listAdminUsers,
  listOAuthClients,
  listOAuthProviders,
} from '#admin/libs/api.js';
import { queryKeys } from './keys.js';

export const adminSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: getAdminSession,
});

export function adminUsersQueryOptions(params: AdminPaginationParams = {}) {
  return queryOptions({
    queryKey: queryKeys.users(params),
    queryFn: () => listAdminUsers(params),
  });
}

export function oauthClientsQueryOptions(params: AdminPaginationParams = {}) {
  return queryOptions({
    queryKey: queryKeys.oauthClients(params),
    queryFn: () => listOAuthClients(params),
  });
}

export function oauthProvidersQueryOptions(params: AdminPaginationParams = {}) {
  return queryOptions({
    queryKey: queryKeys.oauthProviders(params),
    queryFn: () => listOAuthProviders(params),
  });
}
