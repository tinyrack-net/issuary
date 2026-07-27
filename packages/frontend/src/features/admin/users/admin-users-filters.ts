import type {
  AdminUser,
  normalizeAdminUsersQuery,
} from '#frontend/queries/admin-users.ts';

export type QuickFilter = 'all' | 'database' | 'config' | 'admins';

export type NoticeState = {
  tone: 'success' | 'error';
  message: string;
} | null;

export type UserModalState =
  | { type: 'create' }
  | { type: 'edit'; user: AdminUser }
  | { type: 'delete'; user: AdminUser }
  | null;

export function parseUserRole(
  value: FormDataEntryValue | null,
): 'user' | 'admin' {
  return value === 'admin' ? 'admin' : 'user';
}

export function getActiveQuickFilter(
  filters: ReturnType<typeof normalizeAdminUsersQuery>,
): QuickFilter {
  if (filters.role === 'admin') return 'admins';
  if (filters.managedBy === 'database') return 'database';
  if (filters.managedBy === 'config') return 'config';
  return 'all';
}
