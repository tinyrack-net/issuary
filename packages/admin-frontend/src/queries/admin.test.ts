import { describe, expect, test } from 'vitest';
import {
  adminUsersQueryOptions,
  oauthClientsQueryOptions,
  oauthProvidersQueryOptions,
} from '#admin/queries/admin.js';
import { queryKeys } from './keys.js';

describe('admin query options', () => {
  test('include pagination params in users query key', () => {
    const params = { limit: 10, offset: 20, search: 'alice' };

    expect(queryKeys.users(params)).toEqual(['admin', 'users', params]);
    expect(adminUsersQueryOptions(params).queryKey).toEqual(
      queryKeys.users(params),
    );
  });

  test('include pagination params in OAuth clients query key', () => {
    const params = { limit: 5, offset: 10, search: 'web' };

    expect(queryKeys.oauthClients(params)).toEqual([
      'admin',
      'oauth-clients',
      params,
    ]);
    expect(oauthClientsQueryOptions(params).queryKey).toEqual(
      queryKeys.oauthClients(params),
    );
  });

  test('include pagination params in OAuth providers query key', () => {
    const params = { limit: 5, offset: 10, search: 'google' };

    expect(queryKeys.oauthProviders(params)).toEqual([
      'admin',
      'oauth-providers',
      params,
    ]);
    expect(oauthProvidersQueryOptions(params).queryKey).toEqual(
      queryKeys.oauthProviders(params),
    );
  });
});
