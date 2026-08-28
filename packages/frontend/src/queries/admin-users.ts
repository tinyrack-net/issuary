import { queryOptions } from '@tanstack/react-query';
import { client, jsonOk } from '#frontend/libs/api.ts';

export type AdminUsersQuery = {
  query?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
  managedBy?: 'database' | 'config';
  role?: 'user' | 'admin';
  emailVerified?: boolean;
  twoFactor?: boolean;
  sort?: 'email' | 'role' | 'created_at';
  direction?: 'asc' | 'desc';
};

export type CreateAdminUserInput = {
  email: string;
  password: string;
  role: 'user' | 'admin';
  email_verified: boolean;
};

export type UpdateAdminUserInput = {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  email_verified: boolean;
};

type NormalizedAdminUsersQuery = {
  query: string;
  page: number;
  pageSize: number;
  includeDeleted: boolean;
  managedBy?: 'database' | 'config' | undefined;
  role?: 'user' | 'admin' | undefined;
  emailVerified?: boolean | undefined;
  twoFactor?: boolean | undefined;
  sort: 'email' | 'role' | 'created_at';
  direction: 'asc' | 'desc';
};

const DEFAULT_ADMIN_USERS_QUERY = {
  query: '',
  page: 1,
  pageSize: 20,
  includeDeleted: false,
  sort: 'email',
  direction: 'asc',
} satisfies NormalizedAdminUsersQuery;

export function normalizeAdminUsersQuery(
  input: AdminUsersQuery = {},
): NormalizedAdminUsersQuery {
  return { ...DEFAULT_ADMIN_USERS_QUERY, ...input };
}

async function fetchAdminUsers({
  query,
  page,
  pageSize,
  includeDeleted,
  managedBy,
  role,
  emailVerified,
  twoFactor,
  sort,
  direction,
}: NormalizedAdminUsersQuery) {
  return jsonOk(
    await client.api.admin.users.$get({
      query: {
        query,
        page: String(page),
        page_size: String(pageSize),
        include_deleted: String(includeDeleted),
        managed_by: managedBy,
        role,
        email_verified:
          emailVerified === undefined ? undefined : String(emailVerified),
        two_factor: twoFactor === undefined ? undefined : String(twoFactor),
        sort,
        direction,
      },
    }),
  );
}

export async function createAdminUser(values: CreateAdminUserInput) {
  return jsonOk(
    await client.api.admin.users.$post({
      json: values,
    }),
  );
}

export async function updateAdminUser({
  sub,
  ...values
}: UpdateAdminUserInput) {
  return jsonOk(
    await client.api.admin.users[':sub'].$patch({
      param: { sub },
      json: values,
    }),
  );
}

export async function deleteAdminUser(sub: string) {
  return jsonOk(
    await client.api.admin.users[':sub'].$delete({
      param: { sub },
    }),
  );
}

export async function restoreAdminUser(sub: string) {
  return jsonOk(
    await client.api.admin.users[':sub'].restore.$post({ param: { sub } }),
  );
}

export type AdminBulkTarget =
  | { kind: 'ids'; ids: string[] }
  | {
      kind: 'filter';
      filter: {
        query?: string | undefined;
        include_deleted: boolean;
        managed_by?: 'database' | 'config' | undefined;
        role?: 'user' | 'admin' | undefined;
        email_verified?: boolean | undefined;
      };
    };

export async function bulkSetAdminUsersActive(input: {
  target: AdminBulkTarget;
  active: boolean;
}) {
  return jsonOk(
    await client.api.admin.users['bulk-status'].$post({ json: input }),
  );
}

export const adminUsersQueryOptions = (input: AdminUsersQuery = {}) => {
  const params = normalizeAdminUsersQuery(input);
  return queryOptions({
    queryKey: ['admin', 'users', params],
    queryFn: async () => fetchAdminUsers(params),
  });
};

export type AdminUsersResponse = Awaited<ReturnType<typeof fetchAdminUsers>>;
export type AdminUser = AdminUsersResponse['users'][number];
export type AdminUserResponse = Awaited<ReturnType<typeof createAdminUser>>;
