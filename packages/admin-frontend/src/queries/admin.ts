import { queryOptions } from '@tanstack/react-query';
import {
  getAdminSession,
  listAdminUsers,
  listAuditEvents,
  listOAuthClients,
} from '#admin/libs/api.js';
import { queryKeys } from './keys.js';

export const adminSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: getAdminSession,
});

export const adminUsersQueryOptions = queryOptions({
  queryKey: queryKeys.users(),
  queryFn: listAdminUsers,
});

export const oauthClientsQueryOptions = queryOptions({
  queryKey: queryKeys.oauthClients(),
  queryFn: listOAuthClients,
});

export const auditEventsQueryOptions = queryOptions({
  queryKey: queryKeys.auditEvents(),
  queryFn: listAuditEvents,
});
